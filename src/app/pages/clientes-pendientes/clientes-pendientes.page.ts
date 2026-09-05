import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline, refreshOutline, warning, checkmarkCircleOutline,
  peopleOutline, checkmarkOutline, closeOutline,
} from 'ionicons/icons';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { UsuariosService } from '../../core/services/usuarios.service';
import { ClientePendiente } from '../../core/models/usuario.model';

// Fila lista para pintar: ya resolvimos la URL pública de la foto y la
// inicial para el avatar cuando no hay foto. Así el template no llama
// funciones en cada ciclo de detección de cambios.
type ClienteVista = ClientePendiente & { fotoUrl: string | null; inicial: string };

@Component({
  selector: 'app-clientes-pendientes',
  templateUrl: './clientes-pendientes.page.html',
  styleUrls: ['./clientes-pendientes.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon],
})
export class ClientesPendientesPage {
  // OJO: estado como signals, no campos planos. Motivo: @supabase/supabase-js
  // resuelve sus promesas FUERA de la zona de Angular, así que asignar un
  // campo normal después del `await` no refresca la vista ni apaga el
  // spinner. Un signal le avisa a Angular por su cuenta, sin depender de
  // zone.js. Cualquier pantalla futura que cargue datos de Supabase y se
  // quede visible necesita esto (o un ChangeDetectorRef.detectChanges()).
  readonly pendientes = signal<ClienteVista[]>([]);
  readonly cargando = signal(false);

  // Confirmación inline (no usamos ion-alert: el enunciado pide "NO alerts").
  // Qué fila está pidiendo confirmación y qué acción se aplicaría.
  readonly confirmandoId = signal<string | null>(null);
  readonly accion = signal<'aceptado' | 'rechazado'>('aceptado');
  readonly procesandoId = signal<string | null>(null);

  readonly mensajeError = signal('');
  readonly mensajeOk = signal('');

  constructor(
    private usuarios: UsuariosService,
    private router: Router,
  ) {
    addIcons({
      arrowBackOutline, refreshOutline, warning, checkmarkCircleOutline,
      peopleOutline, checkmarkOutline, closeOutline,
    });
  }

  // Lifecycle de Ionic: corre cada vez que se ENTRA a la pantalla,
  // incluido volver desde otra. Es el reemplazo del push notification
  // del enunciado (punto 6): la lista se refresca al entrar.
  ionViewWillEnter() {
    this.cargar();
  }

  async cargar() {
    this.cargando.set(true);
    this.mensajeError.set('');
    this.confirmandoId.set(null);
    try {
      const filas = await this.usuarios.getClientesPendientes();
      this.pendientes.set(
        filas.map((c) => ({
          ...c,
          fotoUrl: this.usuarios.getFotoPublicUrl(c.foto_url),
          inicial: (c.apellidos?.[0] ?? c.nombres?.[0] ?? '?').toUpperCase(),
        })),
      );
    } catch {
      this.dispararError('No se pudo cargar el listado. Reintentá con el botón de refrescar.');
    } finally {
      this.cargando.set(false);
    }
  }

  pedirConfirmacion(id: string, accion: 'aceptado' | 'rechazado') {
    this.confirmandoId.set(id);
    this.accion.set(accion);
    this.mensajeError.set('');
    this.mensajeOk.set('');
  }

  cancelarConfirmacion() {
    this.confirmandoId.set(null);
  }

  async confirmar(cliente: ClienteVista) {
    this.procesandoId.set(cliente.id);
    this.cargando.set(true);
    try {
      await this.usuarios.setEstadoCliente(cliente.id, this.accion());
      this.pendientes.update((lista) => lista.filter((c) => c.id !== cliente.id));
      this.mensajeOk.set(
        this.accion() === 'aceptado'
          ? `Cliente ${cliente.apellidos}, ${cliente.nombres} aceptado.`
          : `Cliente ${cliente.apellidos}, ${cliente.nombres} rechazado.`,
      );
      setTimeout(() => this.mensajeOk.set(''), 3000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo actualizar el cliente.';
      this.dispararError(msg);
    } finally {
      this.procesandoId.set(null);
      this.confirmandoId.set(null);
      this.cargando.set(false);
    }
  }

  volver() {
    this.router.navigate(['/home']);
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
}
