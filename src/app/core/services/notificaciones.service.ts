import { Injectable } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

// Punto 10: push notification al metre (entra alguien a la lista de
// espera) y al cliente (le asignaron mesa). Local notification +
// listener de Realtime, no push real (FCM) — decisión de equipo por
// plazo, ver AVANCES.md.
//
// ⚠️ Solo funciona con la app en primer/segundo plano (limitación
// conocida y aceptada de esta opción, no es push real). Lo que SÍ queda
// sin confirmar todavía: si Android suspende/throttlea el WebView y el
// canal de Realtime deja de entregar eventos cuando la app pasa a
// segundo plano en un dispositivo real (bloqueo de pantalla, cambio de
// app). Eso solo se puede probar en dispositivo, no se puede garantizar
// leyendo el código — no darlo por confirmado antes de la demo.
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
      // Dispositivo/navegador sin soporte del plugin: no bloquea la app.
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
      // Que falle la notificación no debe romper el flujo de la app.
    }
  }

  // Vive en este service (singleton, no en un componente) para sobrevivir
  // la navegación entre pantallas: home.page.ts solo dispara el arranque
  // una vez, la suscripción en sí queda en esta instancia, que Angular no
  // destruye al salir de la pantalla (a diferencia de HomePage, que sí se
  // destruye al navegar — la app no usa tabs, ver app.component.ts).
  iniciarEscuchaMetre() {
    if (this.canalMetre) return; // ya está escuchando
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

  // Este listener sí queda scoped a la pantalla de espera del cliente
  // (se arranca y se para junto con ella) — a diferencia del de arriba,
  // el cliente no tiene otra pantalla a la que ir mientras espera.
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
