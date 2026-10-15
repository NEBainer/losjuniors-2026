import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { EstadoPedido, ItemCarrito, Pedido, PedidoPendiente, PedidoSector, Sector } from '../models/pedido.model';

// Puntos 16/17: mismo criterio que marcar_sector_listo en schema.sql v9.
function esDelSector(tipo: string, sector: Sector): boolean {
  return sector === 'bar' ? tipo === 'bebida' : tipo !== 'bebida';
}

@Injectable({ providedIn: 'root' })
export class PedidoService {
  private readonly supabaseService = inject(SupabaseService);
  private get client() {
    return this.supabaseService.client;
  }

  async crearPedido(mesaId: string, items: ItemCarrito[]): Promise<string> {
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
      .select('id, mesa_id, estado, importe_total, tiempo_estimado_minutos, created_at, cocina_lista, bar_listo, entregado_por_mozo')
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
      .select('id, mesa_id, estado, importe_total, tiempo_estimado_minutos, created_at, cocina_lista, bar_listo, entregado_por_mozo')
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
      .select('id, mesa_id, estado, importe_total, tiempo_estimado_minutos, created_at, cocina_lista, bar_listo, entregado_por_mozo, mesas(numero), pedido_items(cantidad, productos(nombre))')
      .eq('estado', 'pendiente_confirmacion')
      .order('created_at', { ascending: true });

    if (error) throw new Error('No se pudieron cargar los pedidos pendientes.');

    return (data ?? []).map((fila: any) => this.mapPedidoPendiente(fila));
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

  // Punto 18: pedidos que cocina y bar ya terminaron y el mozo todavía no
  // llevó a la mesa. Filtra también por entregado_por_mozo: después de
  // "Entregar" el pedido sigue en 'completo' hasta que el cliente
  // confirma, y no tiene que volver a aparecer en la lista del mozo.
  async listarListosParaEntregar(): Promise<PedidoPendiente[]> {
    const { data, error } = await this.client
      .from('pedidos')
      .select('id, mesa_id, estado, importe_total, tiempo_estimado_minutos, created_at, cocina_lista, bar_listo, entregado_por_mozo, mesas(numero), pedido_items(cantidad, productos(nombre))')
      .eq('estado', 'completo')
      .eq('entregado_por_mozo', false)
      .order('created_at', { ascending: true });

    if (error) throw new Error('No se pudieron cargar los pedidos listos para entregar.');

    return (data ?? []).map((fila: any) => this.mapPedidoPendiente(fila));
  }

  // Punto 19: el mozo avisa que llevó el pedido a la mesa. La función
  // valida el perfil y el estado (ver schema.sql v9).
  async marcarEntregado(pedidoId: string): Promise<void> {
    const { error } = await this.client.rpc('marcar_entregado_mozo', { p_pedido_id: pedidoId });

    if (error) throw new Error('No se pudo marcar el pedido como entregado.');
  }

  // Punto 19: el cliente confirma que recibió el pedido y pasa a
  // 'entregado'. La pantalla se entera del cambio por Realtime.
  async confirmarRecepcion(pedidoId: string): Promise<void> {
    const { error } = await this.client.rpc('confirmar_recepcion_cliente', { p_pedido_id: pedidoId });

    if (error) throw new Error('No se pudo confirmar la recepción del pedido.');
  }

  // Puntos 16/17: pedidos confirmados que el sector todavía no terminó,
  // con solo sus ítems (nombre y cantidad). Ordenados por mesa y después
  // por hora, así la pantalla los agrupa por mesa directo.
  async listarParaSector(sector: Sector): Promise<PedidoSector[]> {
    const columnaListo = sector === 'cocina' ? 'cocina_lista' : 'bar_listo';
    const { data, error } = await this.client
      .from('pedidos')
      .select('id, created_at, mesas(numero), pedido_items(cantidad, productos(nombre, tipo))')
      .eq('estado', 'confirmado')
      .eq(columnaListo, false)
      .order('created_at', { ascending: true });

    if (error) throw new Error('No se pudieron cargar los pedidos.');

    return (data ?? [])
      .map((fila: any) => {
        // Suma por producto: "2 × Milanesa" aunque sean de comensales distintos.
        const porNombre = new Map<string, number>();
        for (const item of fila.pedido_items ?? []) {
          if (!item.productos || !esDelSector(item.productos.tipo, sector)) continue;
          const nombre = item.productos.nombre as string;
          porNombre.set(nombre, (porNombre.get(nombre) ?? 0) + item.cantidad);
        }
        return {
          id: fila.id,
          mesaNumero: fila.mesas?.numero ?? 0,
          creadoEn: fila.created_at,
          items: Array.from(porNombre, ([nombre, cantidad]) => ({ nombre, cantidad })),
        };
      })
      .filter((p) => p.items.length > 0) // pedido sin productos de este sector
      .sort((a, b) => a.mesaNumero - b.mesaNumero);
  }

  // Si el pedido tiene productos de este sector (para no avisarle a la
  // cocina de un pedido que es solo de bebidas, y viceversa).
  async tieneItemsDelSector(pedidoId: string, sector: Sector): Promise<boolean> {
    const { data, error } = await this.client
      .from('pedido_items')
      .select('productos(tipo)')
      .eq('pedido_id', pedidoId);

    if (error) return false;
    return (data ?? []).some((fila: any) => fila.productos && esDelSector(fila.productos.tipo, sector));
  }

  // Punto 18 (lado sector): cocina/bar avisan que terminaron su parte. La
  // función valida el perfil y, si ya están todos, pasa el pedido a
  // 'completo' (schema.sql v9).
  async marcarSectorListo(pedidoId: string, sector: Sector): Promise<void> {
    const { error } = await this.client.rpc('marcar_sector_listo', {
      p_pedido_id: pedidoId,
      p_sector: sector,
    });
    if (error) throw new Error('No se pudo marcar el pedido como listo.');
  }

  private mapPedido(fila: any): Pedido {
    return {
      id: fila.id,
      mesaId: fila.mesa_id,
      estado: fila.estado,
      importeTotal: Number(fila.importe_total),
      tiempoEstimadoMinutos: fila.tiempo_estimado_minutos,
      creadoEn: fila.created_at,
      cocinaLista: fila.cocina_lista ?? false,
      barListo: fila.bar_listo ?? false,
      entregadoPorMozo: fila.entregado_por_mozo ?? false,
    };
  }
  private mapPedidoPendiente(fila: any): PedidoPendiente {
    const porNombre = new Map<string, number>();
    for (const item of fila.pedido_items ?? []) {
      const nombre = item.productos?.nombre as string | undefined;
      if (!nombre) continue;
      porNombre.set(nombre, (porNombre.get(nombre) ?? 0) + item.cantidad);
    }
    return {
      ...this.mapPedido(fila),
      mesaNumero: fila.mesas?.numero ?? 0,
      items: Array.from(porNombre, ([nombre, cantidad]) => ({ nombre, cantidad })),
    };
  }
}
