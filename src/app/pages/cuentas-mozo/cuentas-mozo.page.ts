import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular';
import { CuentaAbierta, ETIQUETAS_METODO_PAGO } from '../../core/models/cuenta.model';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { CuentaService } from '../../core/services/cuenta.service';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { arrowBackOutline, checkmarkCircleOutline, qrCodeOutline, receiptOutline, warningOutline } from 'ionicons/icons';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

type CuentaVista = CuentaAbierta & { hace: string; detalle: string };

function haceCuanto(fechaIso: string): string {
  const minutos = Math.max(0, Math.round((Date.now() - new Date(fechaIso).getTime()) / 60000));
  if (minutos < 1) return 'recién';
  if (minutos === 1) return 'hace 1 minuto';
  return `hace ${minutos} minutos`;
}

function formatear(importe: number | null): string {
  return (importe ?? 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
}

@Component({
  selector: 'app-cuentas-mozo',
  templateUrl: './cuentas-mozo.page.html',
  styleUrls: ['./cuentas-mozo.page.scss'],
  host: { class: 'ion-page' },
  imports: [IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar]
})
export class CuentasMozoPage {
  private readonly cuentaService = inject(CuentaService);
  private readonly notificacionesService = inject(NotificacionesService);
  private readonly router = inject(Router);

  readonly cargando = signal(true);
  readonly procesandoId = signal<string | null>(null);
  readonly confirmandoId = signal<string | null>(null);
  readonly mensajeError = signal('');
  readonly mensajeOk = signal('');
  readonly cuentas = signal<CuentaVista[]>([]);

  readonly porConfirmar = computed(() => this.cuentas().filter((c) => c.estado === 'pagada'));
  readonly enCurso = computed(() => this.cuentas().filter((c) => c.estado === 'solicitada'));

  constructor() {
    addIcons({ arrowBackOutline, checkmarkCircleOutline, qrCodeOutline, receiptOutline, warningOutline });
   }

   ionViewWillEnter(): void {
    this.cargar();
    this.notificacionesService.iniciarEscuchaCuentas(true, () => this.cargar(false));
  }

  async cargar(conSpinner = true): Promise<void> {
    if (conSpinner) this.cargando.set(true);
    try {
      const cuentas = await this.cuentaService.listarAbiertas();
      this.cuentas.set(cuentas.map((c) => ({ ...c, hace: haceCuanto(c.solicitadaEn), detalle: this.detalle(c) })));
    } catch (e) {
      await this.dispararError(e instanceof Error ? e.message : 'No se pudieron cargar las cuentas.');
    } finally {
      this.cargando.set(false);
    }
  }

  pedirConfirmacion(cuenta: CuentaVista): void {
    this.confirmandoId.set(cuenta.id);
    this.mensajeError.set('');
    this.mensajeOk.set('');
  }

  cancelarConfirmacion(): void {
    this.confirmandoId.set(null);
  }

  async confirmarPago(cuenta: CuentaVista): Promise<void> {
    this.procesandoId.set(cuenta.id);
    try {
      await this.cuentaService.confirmarPago(cuenta.id);
      this.cuentas.update((lista) => lista.filter((c) => c.id !== cuenta.id));
      this.mensajeOk.set(`Pago de la mesa ${cuenta.mesaNumero} confirmado. La mesa quedó libre.`);
      setTimeout(() => this.mensajeOk.set(''), 4000);
    } catch (e) {
      await this.dispararError(e instanceof Error ? e.message : 'No se pudo confirmar el pago.');
    } finally {
      this.procesandoId.set(null);
      this.confirmandoId.set(null);
    }
  }

  mostrarQrPropina(): void {
    this.router.navigate(['/qr-propina']);
  }

  formatear(importe: number | null): string {
    return formatear(importe);
  }

  volver(): void {
    this.router.navigate(['/home']);
  }

  private detalle(cuenta: CuentaAbierta): string {
    if (cuenta.estado === 'pagada') {
      return cuenta.metodoPago ? `Pagó con ${ETIQUETAS_METODO_PAGO[cuenta.metodoPago].toLowerCase()}` : 'Pagada';
    }
    return cuenta.propinaPorcentaje === null
      ? 'Esperando que elija la propina'
      : `Propina del ${cuenta.propinaPorcentaje}%: esperando el pago`;
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
