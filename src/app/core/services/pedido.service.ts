import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { EstadoPedido, ItemCarrito, Pedido, PedidoPendiente } from '../models/pedido.model';

@Injectable({ providedIn: 'root' })
export class PedidoService {
  private readonly supabaseService = inject(SupabaseService);
  private get client() {
    return this.supabaseService.client;
  }

  // Punto 12: crea la cabecera del pedido y sus items en dos inserts
  // (no hay transacciones multi-tabla desde supabase-js sin una Edge
  // Function -- si falla el segundo insert, el pedido queda creado sin
  // items en vez de perderse en silencio; ver el catch de más abajo).
  //
  // importeTotal y tiempoEstimadoMinutos se calculan ACÁ, a partir del
  // carrito, y se guardan como snapshot (mismo criterio que
  // pedido_items.precio_unitario: no dependen de que el precio de un
  // producto siga siendo el mismo después).
  //
  // tiempoEstimadoMinutos = el MÁXIMO entre los productos pedidos, no la
  // suma: cocina y cantina preparan en paralelo, sumar daría un número
  // irreal (ej. milanesa 20' + gaseosa 2' no son 22' de espera real).
  async crearPedido(mesaId: string, items: ItemCarrito[]): Promise<string> {
    if (!items.length) {
      throw new Error('El pedido no tiene productos.');
    }

    const importeTotal = items.reduce((acc, i) => acc + i.precioUnitario * i.cantidad, 0);
    const tiempoEstimadoMinutos = Math.max(...items.map((i) => i.tiempoElaboracionMinutos));

    // creado_por es NOT NULL y la policy "pedidos_cliente_inserta" exige
    // que coincida con auth.uid() -- mismo criterio explícito que ya usa
    // MesaService.crearMesa (no un default en la base).
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

  async obtenerPedido(pedidoId: string): Promise<Pedido> {
    const { data, error } = await this.client
      .from('pedidos')
      .select('id, mesa_id, estado, importe_total, tiempo_estimado_minutos, created_at')
      .eq('id', pedidoId)
      .single();

    if (error) throw new Error('No se pudo obtener el estado del pedido.');
    return this.mapPedido(data);
  }

  // Punto 12, requisito "el cliente termina el pedido y espera la
  // confirmación por parte del mozo (push notification)": usamos
  // Supabase Realtime en vez de un push nativo (FCM) -- mismo patrón que
  // ClienteService.escucharCambioEstado (ya usado para el punto 6). Cero
  // dependencias nuevas y funciona mientras la app está abierta, que es
  // el caso esperado: el cliente está sentado en la mesa esperando.
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
      // Log de diagnóstico: SUBSCRIBED confirma que la conexión de
      // Realtime quedó bien armada; CHANNEL_ERROR/TIMED_OUT/CLOSED
      // explican por qué nunca llegaría el evento de confirmación.
      .subscribe((status, err) => {
        console.log('[PedidoService] Realtime pedido', pedidoId, 'status:', status, err ?? '');
      });
  }

  // Listado para la pantalla del mozo: solo lo que todavía nadie confirmó.
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

  // Mozo confirma: pendiente_confirmacion -> confirmado. La policy RLS
  // (pedidos_mozo_confirma) es la que de verdad impide cualquier otra
  // transición -- esto solo dispara el update.
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
