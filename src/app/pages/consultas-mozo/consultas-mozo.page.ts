import { Component, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { RealtimeChannel } from '@supabase/supabase-js';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowBackOutline, chatbubblesOutline, refreshOutline, warning } from 'ionicons/icons';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { ConsultaMozoService, ConsultaResumen } from '../../core/services/consulta-mozo.service';

/**
 * consultas-mozo.page.ts
 * -----------------------
 * Punto 11 (bandeja del mozo): listado de todas las mesas con consulta
 * abierta, una fila por mesa con su último mensaje -- estilo bandeja de
 * WhatsApp. Al tocar una fila se entra al hilo completo (ConsultaMozoPage,
 * reutilizada tal cual, ver app.routes.ts 'mesa/:numero/consulta-mozo').
 *
 * Se refresca sola con Realtime (cualquier mensaje nuevo, de cualquier
 * mesa, reordena la lista) además de al volver a entrar a la pantalla.
 */
@Component({
  selector: 'app-consultas-mozo',
  standalone: true,
  templateUrl: './consultas-mozo.page.html',
  styleUrls: ['./consultas-mozo.page.scss'],
  imports: [CommonModule, IonContent, IonIcon],
})
export class ConsultasMozoPage implements OnDestroy {
  readonly consultas = signal<ConsultaResumen[]>([]);
  readonly cargando = signal(false);
  readonly mensajeError = signal('');

  private canal: RealtimeChannel | null = null;

  constructor(
    private consultaMozoService: ConsultaMozoService,
    private router: Router,
  ) {
    addIcons({ arrowBackOutline, chatbubblesOutline, refreshOutline, warning });
  }

  // Lifecycle de Ionic: corre cada vez que se entra a la pantalla (mismo
  // patrón que ClientesPendientesPage) y abre el canal de Realtime una
  // sola vez por visita.
  ionViewWillEnter(): void {
    this.cargar();
    this.canal = this.consultaMozoService.escucharTodasLasConsultas(() => this.cargar());
  }

  ionViewWillLeave(): void {
    if (this.canal) {
      this.consultaMozoService.cerrarCanal(this.canal);
      this.canal = null;
    }
  }

  ngOnDestroy(): void {
    if (this.canal) {
      this.consultaMozoService.cerrarCanal(this.canal);
      this.canal = null;
    }
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.mensajeError.set('');
    try {
      this.consultas.set(await this.consultaMozoService.listarConsultasActivas());
    } catch {
      this.dispararError('No se pudo cargar la bandeja de consultas.');
    } finally {
      this.cargando.set(false);
    }
  }

  abrir(consulta: ConsultaResumen): void {
    this.router.navigate(['/mesa', consulta.numeroMesa, 'consulta-mozo']);
  }

  volver(): void {
    this.router.navigate(['/home']);
  }

  private async dispararError(mensaje: string): Promise<void> {
    this.mensajeError.set(mensaje);
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {
      // Ignorar si el dispositivo/navegador no soporta vibración.
    }
    setTimeout(() => this.mensajeError.set(''), 4000);
  }
}
