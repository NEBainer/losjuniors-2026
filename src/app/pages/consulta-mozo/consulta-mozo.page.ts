import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonSpinner,
  IonFooter,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowBackOutline, chatbubblesOutline, sendOutline, warningOutline } from 'ionicons/icons';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { MesaService } from '../../core/services/mesa.service';
import { UsuariosService } from '../../core/services/usuarios.service';
import { ConsultaMozoService, MensajeMozo } from '../../core/services/consulta-mozo.service';

/**
 * consulta-mozo.page.ts
 * -----------------------
 * Punto 11: botón "consultar al mozo" — chat estilo WhatsApp entre el
 * cliente vinculado a la mesa y cualquier mozo. Misma pantalla para los
 * dos lados (cliente y mozo): manda mensajes y ve el historial en vivo
 * (Realtime). El mozo entra acá desde la bandeja (consultas-mozo.page.ts,
 * que lista todas las mesas con consulta abierta); el cliente entra desde
 * el FAB de la carta. El aviso "notifica a todos los mozos" al llegar una
 * consulta vive en NotificacionesService.iniciarEscuchaConsultasMozo(), y
 * el aviso al cliente cuando le responden en
 * NotificacionesService.iniciarEscuchaRespuestasCliente() (las dos
 * arrancan en home.page.ts, así llegan aunque este chat no esté abierto).
 */
@Component({
  selector: 'app-consulta-mozo',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonSpinner,
    IonFooter,
  ],
  host: { class: 'ion-page' },
  templateUrl: './consulta-mozo.page.html',
  styleUrls: ['./consulta-mozo.page.scss'],
})
export class ConsultaMozoPage implements OnInit, OnDestroy {
  // Decorador clásico (no viewChild() de señales): ese necesita contexto
  // de inyección de Angular, y esta página se instancia con `new` directo
  // en los tests (mismo criterio que MesasGestionPage).
  @ViewChild('finDeLista') private finDeLista?: ElementRef<HTMLDivElement>;

  // Sin `protected`: los métodos/signals de acá abajo se prueban desde
  // consulta-mozo.page.spec.ts (mismo criterio que MesasGestionPage).
  readonly numeroMesa = signal<number | null>(null);
  protected readonly horaApertura = new Date();

  protected readonly cargando = signal(true);
  protected readonly enviando = signal(false);
  protected readonly error = signal('');
  protected readonly mensajes = signal<MensajeMozo[]>([]);
  readonly texto = signal('');

  private mesaId: string | null = null;
  private usuarioId: string | null = null;
  private esMozo = false;
  private canal: RealtimeChannel | null = null;

  protected readonly hayMensajes = computed(() => this.mensajes().length > 0);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private mesaService: MesaService,
    private usuariosService: UsuariosService,
    private consultaMozoService: ConsultaMozoService,
  ) {
    addIcons({ arrowBackOutline, chatbubblesOutline, sendOutline, warningOutline });
  }

  async ngOnInit(): Promise<void> {
    const numeroParam = Number(this.route.snapshot.paramMap.get('numero'));
    this.numeroMesa.set(numeroParam);

    try {
      const [mesa, usuario] = await Promise.all([
        this.mesaService.buscarPorNumero(numeroParam),
        this.usuariosService.obtenerUsuarioActual(),
      ]);

      if (!mesa || !usuario) {
        this.dispararError('No se pudo abrir la consulta para esta mesa.');
        return;
      }

      this.mesaId = mesa.id;
      this.usuarioId = usuario.id;
      this.esMozo = usuario.perfil === 'mozo';

      this.mensajes.set(await this.consultaMozoService.obtenerHistorial(mesa.id));
      this.canal = this.consultaMozoService.escucharMensajesNuevos(mesa.id, (mensaje) => {
        this.mensajes.update((lista) => [...lista, mensaje]);
        this.desplazarAlFinal();
      });
    } catch {
      this.dispararError('No se pudo cargar la consulta. Intentá de nuevo.');
    } finally {
      this.cargando.set(false);
      this.desplazarAlFinal();
    }
  }

  ngOnDestroy(): void {
    if (this.canal) {
      this.consultaMozoService.cerrarCanal(this.canal);
    }
  }

  esMio(mensaje: MensajeMozo): boolean {
    return mensaje.remitente_id === this.usuarioId;
  }

  async enviar(): Promise<void> {
    const texto = this.texto().trim();
    if (!texto || !this.mesaId || this.enviando()) return;

    this.enviando.set(true);
    try {
      await this.consultaMozoService.enviarMensaje(this.mesaId, texto);
      this.texto.set('');
    } catch {
      this.dispararError('No se pudo enviar el mensaje. Probá de nuevo.');
    } finally {
      this.enviando.set(false);
    }
  }

  volver(): void {
    // El mozo llega desde la bandeja de consultas, no desde la carta de
    // esta mesa puntual -- volver ahí en vez de mandarlo a ver el menú.
    if (this.esMozo) {
      this.router.navigate(['/consultas-mozo']);
    } else if (this.numeroMesa() !== null) {
      this.router.navigate(['/mesa', this.numeroMesa(), 'carta']);
    } else {
      this.router.navigate(['/carta']);
    }
  }

  private desplazarAlFinal(): void {
    setTimeout(() => {
      this.finDeLista?.nativeElement.scrollIntoView({ behavior: 'smooth' });
    });
  }

  private async dispararError(mensaje: string): Promise<void> {
    this.error.set(mensaje);
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {
      // Ignorar si el dispositivo/navegador no soporta vibración.
    }
    setTimeout(() => this.error.set(''), 4000);
  }
}
