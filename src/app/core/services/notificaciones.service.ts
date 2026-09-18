import { Injectable } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  private canalMetre: RealtimeChannel | null = null;
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
