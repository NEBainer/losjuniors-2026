import { Injectable } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  private canalMetre: RealtimeChannel | null = null;
  private canalPendientes: RealtimeChannel | null = null;
  private canalConsultasMozo: RealtimeChannel | null = null;
  private canalRespuestasCliente: RealtimeChannel | null = null;
  private canalPedidosMozo: RealtimeChannel | null = null;
  private alLlegarPedido: (() => void) | null = null;
  private permisosConcedidos = false;

  constructor(private supabaseService: SupabaseService) {}

  private get sb() {
    return this.supabaseService.client;
  }

  private async asegurarPermisos(): Promise<boolean> {
    if (this.permisosConcedidos) return true;
    try {
      let estado = await LocalNotifications.checkPermissions();
      if (estado.display !== 'granted') {
        estado = await LocalNotifications.requestPermissions();
      }
      this.permisosConcedidos = estado.display === 'granted';
      return this.permisosConcedidos;
    } catch {
      return false;
    }
  }

  private async notificar(titulo: string, cuerpo: string) {
    const permitido = await this.asegurarPermisos();
    if (!permitido) return;
    try {
      await LocalNotifications.schedule({
        notifications: [
          { id: Math.floor(Math.random() * 100000), title: titulo, body: cuerpo },
        ],
      });
    } catch {
    }
  }

  iniciarEscuchaMetre() {
    if (this.canalMetre) return; 
    this.canalMetre = this.sb
      .channel('metre-lista-espera')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'lista_espera' },
        () => this.notificar('Nuevo cliente en la lista de espera', 'Hay un cliente nuevo esperando mesa.'),
      )
      .subscribe();
  }

  detenerEscuchaMetre() {
    if (this.canalMetre) {
      this.sb.removeChannel(this.canalMetre);
      this.canalMetre = null;
    }
  }

  async avisarPedidoConfirmado(mesaNumero?: number): Promise<void> {
    await this.notificar(
      '¡Pedido confirmado!',
      mesaNumero ? `El mozo confirmó el pedido de la mesa ${mesaNumero}.` : 'El mozo confirmó tu pedido.',
    );
  }

  async avisarPedidoRechazado(mesaNumero?: number): Promise<void> {
    await this.notificar(
      'El mozo rechazó el pedido',
      mesaNumero
        ? `Revisá el pedido de la mesa ${mesaNumero} y volvé a enviarlo.`
        : 'Revisá tu pedido y volvé a enviarlo.',
    );
  }

  // Punto 6: dueño/supervisor se entera de un cliente registrado nuevo
  // esperando aprobación. `estado_aprobacion` es NULL para empleados/dueño/
  // supervisor (ver schema.sql) -- solo el alta de un cliente registrado
  // (punto 5) inserta la fila ya en 'pendiente', así que alcanza con
  // filtrar por ese valor sin distinguir perfil.
  iniciarEscuchaPendientes() {
    if (this.canalPendientes) return;
    this.canalPendientes = this.sb
      .channel('dueno-clientes-pendientes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'usuarios', filter: 'estado_aprobacion=eq.pendiente' },
        () => this.notificar('Nuevo cliente pendiente', 'Hay un cliente registrado esperando aprobación.'),
      )
      .subscribe();
  }

  detenerEscuchaPendientes() {
    if (this.canalPendientes) {
      this.sb.removeChannel(this.canalPendientes);
      this.canalPendientes = null;
    }
  }

  // Punto 11: "notifica a todos los mozos" cuando llega una consulta nueva
  // de un cliente. `remitente_perfil=neq.mozo` cubre cliente_registrado y
  // cliente_anonimo sin enumerarlos -- así un mensaje de otro mozo
  // respondiendo no vuelve a notificar al resto del equipo de sala.
  iniciarEscuchaConsultasMozo() {
    if (this.canalConsultasMozo) return;
    this.canalConsultasMozo = this.sb
      .channel('mozo-consultas-nuevas')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensajes_mozo', filter: 'remitente_perfil=neq.mozo' },
        () => this.notificar('Nueva consulta', 'Un cliente escribió una consulta.'),
      )
      .subscribe();
  }

  detenerEscuchaConsultasMozo() {
    if (this.canalConsultasMozo) {
      this.sb.removeChannel(this.canalConsultasMozo);
      this.canalConsultasMozo = null;
    }
  }

  // Punto 11: "un mozo responde (push al cliente)". Vive acá (singleton,
  // arranca en home.page.ts) y no en consulta-mozo.page.ts para que el
  // aviso llegue aunque el cliente no tenga el chat abierto. No hace falta
  // filtrar por mesa: la policy `mensajes_mozo_cliente_ve_su_mesa` (ver
  // schema.sql) también aplica a Realtime, así que el cliente solo recibe
  // los mensajes del hilo de su propia mesa.
  iniciarEscuchaRespuestasCliente() {
    if (this.canalRespuestasCliente) return;
    this.canalRespuestasCliente = this.sb
      .channel('cliente-respuestas-mozo')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensajes_mozo', filter: 'remitente_perfil=eq.mozo' },
        () => this.notificar('El mozo respondió', 'Tenés una respuesta nueva del mozo.'),
      )
      .subscribe();
  }

  detenerEscuchaRespuestasCliente() {
    if (this.canalRespuestasCliente) {
      this.sb.removeChannel(this.canalRespuestasCliente);
      this.canalRespuestasCliente = null;
    }
  }

  // Punto 12/13: "el cliente termina el pedido (nuevamente) -> push al
  // mozo". Cada envío (y cada reenvío después de un rechazo) inserta una
  // fila nueva en `pedidos` en estado pendiente_confirmacion, así que
  // alcanza con escuchar los INSERT. onNuevo se reemplaza en cada llamada
  // (home lo vuelve a pasar al entrar) para refrescar la lista embebida.
  iniciarEscuchaPedidosMozo(onNuevo?: () => void) {
    this.alLlegarPedido = onNuevo ?? null;
    if (this.canalPedidosMozo) return;
    this.canalPedidosMozo = this.sb
      .channel('mozo-pedidos-nuevos')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pedidos' },
        () => {
          this.notificar('Nuevo pedido', 'Hay un pedido esperando tu confirmación.');
          this.alLlegarPedido?.();
        },
      )
      .subscribe();
  }

  detenerEscuchaPedidosMozo() {
    this.alLlegarPedido = null;
    if (this.canalPedidosMozo) {
      this.sb.removeChannel(this.canalPedidosMozo);
      this.canalPedidosMozo = null;
    }
  }

  escucharMesaAsignada(clienteId: string, onAsignada: (mesa: { numero: number }) => void): () => void {
    const canal = this.sb
      .channel(`mesa-asignada-${clienteId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'mesas',
          filter: `cliente_actual_id=eq.${clienteId}`,
        },
        (payload) => {
          const mesa = payload.new as { numero: number };
          this.notificar('¡Te asignamos una mesa!', `Mesa Nº ${mesa.numero}. Dirigite al metre.`);
          onAsignada(mesa);
        },
      )
      .subscribe();

    return () => this.sb.removeChannel(canal);
  }
}
