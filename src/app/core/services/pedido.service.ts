import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { EstadoPedido, ItemCarrito, Pedido, PedidoPendiente } from '../models/pedido.model';

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
      .select('id, mesa_id, estado, importe_total, tiempo_estimado_minutos, created_at')
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
      .select('id, mesa_id, estado, importe_total, tiempo_estimado_minutos, created_at')
      .eq('id', pedidoId)
      .single();

    if (error) throw new Error('No se pudo obtener el estado del pedido.');
    return this.mapPedido(data);
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

  private mapPedido(fila: any): Pedido {
    return {
      id: fila.id,
      mesaId: fila.mesa_id,
      estado: fila.estado,
      importeTotal: Number(fila.importe_total),
      tiempoEstimadoMinutos: fila.tiempo_estimado_minutos,
      creadoEn: fila.created_at,
    };
  }
}
