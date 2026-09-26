import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { IonButton, IonContent, IonIcon, IonSpinner } from '@ionic/angular';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { AuthService } from '../../core/services/auth.service';
import { ClienteService } from '../../core/services/cliente.service';
import { MesaService } from '../../core/services/mesa.service';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { checkmarkCircleOutline, qrCodeOutline, timeOutline } from 'ionicons/icons';

@Component({
  selector: 'app-lista-espera',
  templateUrl: './lista-espera.page.html',
  styleUrls: ['./lista-espera.page.scss'],
  imports: [IonContent, IonIcon, IonButton, IonSpinner]
})
export class ListaEsperaPage implements OnInit, OnDestroy {
  private clienteId = '';
  readonly mesaAsignada = signal<{ numero: number } | null>(null);
  readonly escaneando = signal(false);
  readonly mensajeError = signal('');

  // Se arranca y se para junto con esta pantalla (a diferencia del canal
  // del metre en NotificacionesService, que vive en el service para
  // sobrevivir la navegación): el cliente no tiene otra pantalla a la que
  // ir mientras espera, así que no hace falta que sobreviva a salir de acá.
  private detenerEscucha: (() => void) | null = null;

  constructor(
    private authService: AuthService,
    private clienteService: ClienteService,
    private mesaService: MesaService,
    private notificacionesService: NotificacionesService,
    private router: Router,
  ) {
    addIcons({ timeOutline, checkmarkCircleOutline, qrCodeOutline });
   }

  async ngOnInit() {
    this.clienteId = history.state.clienteId;

    // Fallback: si Android recreó este componente después de que la app
    // pasó a segundo plano, history.state puede venir vacío aunque la
    // sesión siga siendo válida y el cliente siga en la cola. Antes de
    // mandarlo a /login, confirmamos si hay sesión activa.
    if (!this.clienteId) {
      const sesion = await this.authService.obtenerSesionActual();
      if (sesion) {
        this.clienteId = sesion.user.id;
      }
    }

    if (!this.clienteId) {
      this.router.navigate(['/login']);
      return;
    }

    // Por si la asignación ya ocurrió antes de que este listener llegara
    // a suscribirse (ventana entre la navegación y el subscribe()) — sin
    // esto, el cliente vería "esperando" indefinidamente pese a tener
    // mesa, hasta el próximo UPDATE (que podría no llegar nunca más).
    try {
      const mesa = await this.mesaService.obtenerMesaAsignada(this.clienteId);
      if (mesa) {
        this.mesaAsignada.set({ numero: mesa.numero });
      }
    } catch {
      // Si falla, seguimos esperando el evento en vivo (no bloquea la
      // pantalla, hay una segunda vía además de esta verificación inicial).
    }

    this.detenerEscucha = this.notificacionesService.escucharMesaAsignada(
      this.clienteId,
      (mesa) => this.mesaAsignada.set(mesa),
    );
  }

  ngOnDestroy() {
    this.detenerEscucha?.();
  }

  // Punto 10: el cliente anónimo no pasa por el home (entra por el QR del
  // local y queda acá), así que escanea el QR de su mesa desde esta misma
  // pantalla, sin un paso intermedio.
  async escanearMiMesa() {
    this.escaneando.set(true);
    try {
      const mesa = await this.mesaService.escanearMesaAsignada(this.clienteId);
      if (!mesa) return; // el usuario canceló el escaneo
      this.router.navigate(['/mesa', mesa.numero, 'carta'], { replaceUrl: true });
    } catch (error) {
      this.dispararError(error instanceof Error ? error.message : 'No se pudo leer el código.');
    } finally {
      this.escaneando.set(false);
    }
  }

  private async dispararError(mensaje: string) {
    this.mensajeError.set(mensaje);
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {
      // Ignorar si el dispositivo/navegador no soporta vibración.
    }
    setTimeout(() => this.mensajeError.set(''), 4000);
  }

   async salir() {
    try { await this.clienteService.salirDeListaEspera(this.clienteId); } catch {}
    this.router.navigate(['/login'], { replaceUrl: true });
  }

}
