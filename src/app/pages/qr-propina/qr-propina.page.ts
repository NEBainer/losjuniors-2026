import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular';
import { NIVELES_PROPINA, PorcentajePropina } from '../../core/models/cuenta.model';
import { QrAppService } from '../../core/services/qr-app.service';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { alertCircleOutline, arrowBackOutline, chevronBackOutline, chevronForwardOutline, closeOutline, refreshOutline } from 'ionicons/icons';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { toDataURL } from 'qrcode';

interface CodigoPropina {
  porcentaje: PorcentajePropina;
  nivel: string;
  imagen: string;
}

@Component({
  selector: 'app-qr-propina',
  templateUrl: './qr-propina.page.html',
  styleUrls: ['./qr-propina.page.scss'],
  host: { class: 'ion-page' },
  imports: [IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar]
})
export class QrPropinaPage implements OnInit {
  private readonly router = inject(Router);
  private readonly qrAppService = inject(QrAppService);

  readonly cargando = signal(true);
  readonly error = signal('');
  readonly codigos = signal<CodigoPropina[]>([]);
  readonly indiceAmpliado = signal<number | null>(null);

  readonly ampliado = computed(() => {
    const indice = this.indiceAmpliado();
    return indice === null ? null : (this.codigos()[indice] ?? null);
  });

  constructor() { 
    addIcons({
      alertCircleOutline,
      arrowBackOutline,
      chevronBackOutline,
      chevronForwardOutline,
      closeOutline,
      refreshOutline,
    });
  }

  ngOnInit(): void {
    this.generar();
  }

  async generar(): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    try {
      const oscuro = this.color('--ion-color-tertiary', '#1A252C');
      const claro = this.color('--ion-background-color', '#FCF7EE');

      const codigos = await Promise.all(
        NIVELES_PROPINA.map(async (nivel) => ({
          ...nivel,
          imagen: await toDataURL(
            this.qrAppService.generarContenido({ tipo: 'propina', porcentaje: nivel.porcentaje }),
            { width: 600, margin: 2, color: { dark: oscuro, light: claro } },
          ),
        })),
      );
      this.codigos.set(codigos);
    } catch {
      this.error.set('No se pudieron generar los códigos QR.');
      try {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      } catch {
        // Ignorar si el dispositivo/navegador no soporta vibración.
      }
    } finally {
      this.cargando.set(false);
    }
  }

  ampliar(indice: number): void {
    this.indiceAmpliado.set(indice);
  }

  cerrar(): void {
    this.indiceAmpliado.set(null);
  }

  anterior(): void {
    const indice = this.indiceAmpliado();
    if (indice !== null && indice > 0) this.indiceAmpliado.set(indice - 1);
  }

  siguiente(): void {
    const indice = this.indiceAmpliado();
    if (indice !== null && indice < this.codigos().length - 1) this.indiceAmpliado.set(indice + 1);
  }

  volver(): void {
    this.router.navigate(['/home']);
  }

  private color(variable: string, porDefecto: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || porDefecto;
  }

}
