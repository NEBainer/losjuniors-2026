import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import {
  EstadoPedido,
  EstadoSector,
  ItemCarrito,
  Pedido,
  PedidoPendiente,
  PedidoSector,
  Sector,
} from '../models/pedido.model';

// Qué tipos de producto prepara cada sector (puntos 16/17).
const TIPOS_POR_SECTOR: Record<Sector, string[]> = {
  cocina: ['plato', 'postre'],
  bar: ['bebida'],
};

const COLUMNAS_PEDIDO =
  'id, mesa_id, estado, importe_total, tiempo_estimado_minutos, created_at, estado_cocina, estado_bar';

@Injectable({ providedIn: 'root' })
export class PedidoService {
  private readonly supabaseService = inject(SupabaseService);
  private get client() {
    return this.supabaseService.client;
  }

  // `sectores`: qué sectores intervienen según los productos elegidos
  // (puntos 16/17) -- el que no interviene queda en null y no aparece en
  // su listado ni en el estado que ve el cliente.
  async crearPedido(
    mesaId: string,
    items: ItemCarrito[],
    sectores: { cocina: boolean; bar: boolean },
  ): Promise<string> {
    if (!items.length) {
      throw new Error('El pedido no tiene productos.');
    }

    const importeTotal = items.reduce((acc, i) => acc + i.precioUnitario * i.cantidad, 0);
    const tiempoEstimadoMinutos = Math.max(...items.map((i) => i.tiempoElaboracionMinutos));
    const {
      data: { user },
    } = await this.client.auth.getUser();

    if (!user) {
      throw new Error('No hay una sesión activa para registrar el pedido.');
    }

    const { data: pedido, error: errorPedido } = await this.client
      .from('pedidos')
      .insert({
        mesa_id: mesaId,
        estado: 'pendiente_confirmacion',
        importe_total: importeTotal,
        tiempo_estimado_minutos: tiempoEstimadoMinutos,
        creado_por: user.id,
        estado_cocina: sectores.cocina ? 'pendiente' : null,
        estado_bar: sectores.bar ? 'pendiente' : null,
      })
      .select('id')
      .single();

    if (errorPedido) {
      throw new Error('No se pudo registrar el pedido. Intentá de nuevo.');
    }

    const pedidoId = (pedido as any).id as string;

    const { error: errorItems } = await this.client.from('pedido_items').insert(
      items.map((i) => ({
        pedido_id: pedidoId,
        producto_id: i.productoId,
        comensal_numero: i.comensalNumero,
        cantidad: i.cantidad,
        precio_unitario: i.precioUnitario,
      })),
    );

    if (errorItems) {
      throw new Error('El pedido se registró pero hubo un error al guardar los productos. Avisá a un mozo.');
    }

    return pedidoId;
  }

  async obtenerPedidoActivoDeMesa(mesaId: string): Promise<Pedido | null> {
    const { data, error } = await this.client
      .from('pedidos')
      .select(COLUMNAS_PEDIDO)
      .eq('mesa_id', mesaId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error('No se pudo verificar si ya había un pedido para esta mesa.');
    return data ? this.mapPedido(data) : null;
  }

  async obtenerPedido(pedidoId: string): Promise<Pedido> {
    const { data, error } = await this.client
      .from('pedidos')
      .select(COLUMNAS_PEDIDO)
      .eq('id', pedidoId)
      .single();

    if (error) throw new Error('No se pudo obtener el estado del pedido.');
    return this.mapPedido(data);
  }

  // Punto 13: productos del pedido rechazado, para que el cliente vuelva
  // a armarlo desde ahí (modificar/agregar/quitar) aunque haya cerrado la
  // app entre el envío y el rechazo. Nombre y tiempo los completa
  // PedidoPage con la carta que ya tiene cargada.
  async obtenerItems(
    pedidoId: string,
  ): Promise<{ productoId: string; comensalNumero: number; cantidad: number; precioUnitario: number }[]> {
    const { data, error } = await this.client
      .from('pedido_items')
      .select('producto_id, comensal_numero, cantidad, precio_unitario')
      .eq('pedido_id', pedidoId);

    if (error) throw new Error('No se pudieron recuperar los productos del pedido.');

    return (data ?? []).map((fila: any) => ({
      productoId: fila.producto_id,
      comensalNumero: fila.comensal_numero,
      cantidad: fila.cantidad,
      precioUnitario: Number(fila.precio_unitario),
    }));
  }

  escucharConfirmacion(pedidoId: string, callback: (pedido: Pedido) => void) {
    return this.client
      .channel(`pedido-${pedidoId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pedidos',
          filter: `id=eq.${pedidoId}`,
        },
        (payload) => callback(this.mapPedido(payload.new)),
      )
      .subscribe((status, err) => {
        console.log('[PedidoService] Realtime pedido', pedidoId, 'status:', status, err ?? '');
      });
  }

  async listarPendientes(): Promise<PedidoPendiente[]> {
    const { data, error } = await this.client
      .from('pedidos')
      .select('id, mesa_id, estado, importe_total, tiempo_estimado_minutos, created_at, mesas(numero)')
      .eq('estado', 'pendiente_confirmacion')
      .order('created_at', { ascending: true });

    if (error) throw new Error('No se pudieron cargar los pedidos pendientes.');

    return (data ?? []).map((fila: any) => ({
      ...this.mapPedido(fila),
      mesaNumero: fila.mesas?.numero ?? 0,
    }));
  }

  async confirmarPedido(pedidoId: string): Promise<void> {
    const { error } = await this.client
      .from('pedidos')
      .update({ estado: 'confirmado' as EstadoPedido })
      .eq('id', pedidoId)
      .select()
      .single();

    if (error) throw new Error('No se pudo confirmar el pedido.');
  }

  async rechazarPedido(pedidoId: string): Promise<void> {
    const { error } = await this.client
      .from('pedidos')
      .update({ estado: 'rechazado' as EstadoPedido })
      .eq('id', pedidoId)
      .select()
      .single();

    if (error) throw new Error('No se pudo rechazar el pedido.');
  }

  // Puntos 16/17: pedidos confirmados que el sector todavía no terminó
  // (pendientes o en preparación), con solo sus ítems. Ordenados por mesa
  // y después por hora, así la pantalla los agrupa por mesa directo.
  async listarParaSector(sector: Sector): Promise<PedidoSector[]> {
    const columnaEstado = sector === 'cocina' ? 'estado_cocina' : 'estado_bar';
    const { data, error } = await this.client
      .from('pedidos')
      .select(`id, created_at, ${columnaEstado}, mesas(numero), pedido_items(cantidad, productos(nombre, tipo))`)
      .eq('estado', 'confirmado')
      .in(columnaEstado, ['pendiente', 'en_preparacion'])
      .order('created_at', { ascending: true });

    if (error) throw new Error('No se pudieron cargar los pedidos.');

    const tipos = TIPOS_POR_SECTOR[sector];
    return (data ?? [])
      .map((fila: any) => {
        // Suma por producto: "2 × Milanesa" aunque sean de comensales distintos.
        const porNombre = new Map<string, number>();
        for (const item of fila.pedido_items ?? []) {
          if (!tipos.includes(item.productos?.tipo)) continue;
          const nombre = item.productos.nombre as string;
          porNombre.set(nombre, (porNombre.get(nombre) ?? 0) + item.cantidad);
        }
        return {
          id: fila.id,
          mesaNumero: fila.mesas?.numero ?? 0,
          creadoEn: fila.created_at,
          estado: fila[columnaEstado] as EstadoSector,
          items: Array.from(porNombre, ([nombre, cantidad]) => ({ nombre, cantidad })),
        };
      })
      .filter((p) => p.items.length > 0)
      .sort((a, b) => a.mesaNumero - b.mesaNumero);
  }

  // El cocinero solo puede tocar estado_cocina y el cantinero estado_bar:
  // lo decide la función en la base según el perfil (ver schema.sql v9).
  async cambiarEstadoSector(pedidoId: string, estado: EstadoSector): Promise<void> {
    const { error } = await this.client.rpc('cambiar_estado_sector', {
      p_pedido_id: pedidoId,
      p_estado: estado,
    });
    if (error) throw new Error('No se pudo actualizar el estado del pedido.');
  }

  private mapPedido(fila: any): Pedido {
    return {
      id: fila.id,
      mesaId: fila.mesa_id,
      estado: fila.estado,
      importeTotal: Number(fila.importe_total),
      tiempoEstimadoMinutos: fila.tiempo_estimado_minutos,
      creadoEn: fila.created_at,
      estadoCocina: fila.estado_cocina ?? null,
      estadoBar: fila.estado_bar ?? null,
    };
  }
}
