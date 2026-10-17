import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular';
import { ActivatedRoute, Router } from '@angular/router';
import { CuentaService } from '../../core/services/cuenta.service';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Cuenta, ETIQUETAS_METODO_PAGO, ItemCuenta, MetodoPago, NIVELES_PROPINA } from '../../core/models/cuenta.model';
import { addIcons } from 'ionicons';
import { alertCircleOutline, arrowBackOutline, arrowForwardOutline, barChartOutline, card, cardOutline, checkmarkCircle, happyOutline, notificationsOutline, qrCodeOutline, radioButtonOff, radioButtonOn, walletOutline, warningOutline } from 'ionicons/icons';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { MesaService } from '../../core/services/mesa.service';
import { QrAppService } from '../../core/services/qr-app.service';


type Fase = 'propina' | 'detalle' | 'pago' | 'pagada' | 'confirmada';

const DEMORA_PAGO_SIMULADO_MS = 1500;
const esperar = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms));

@Component({
  selector: 'app-cuenta',
  templateUrl: './cuenta.page.html',
  styleUrls: ['./cuenta.page.scss'],
  host: { class: 'ion-page' },
  imports: [IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonTitle, IonToolbar]
})
export class CuentaPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cuentaService = inject(CuentaService);
  private readonly mesaService = inject(MesaService);
  private readonly qrAppService = inject(QrAppService);

  private mesaId = '';
  private canal: RealtimeChannel | null = null;

  readonly niveles = NIVELES_PROPINA;
  readonly metodos: { valor: MetodoPago; etiqueta: string; icono: string }[] = [
    { valor: 'dinero_en_cuenta', etiqueta: ETIQUETAS_METODO_PAGO.dinero_en_cuenta, icono: 'wallet-outline' },
    { valor: 'debito', etiqueta: ETIQUETAS_METODO_PAGO.debito, icono: 'card-outline' },
    { valor: 'credito', etiqueta: ETIQUETAS_METODO_PAGO.credito, icono: 'card' },
  ];

  readonly cargando = signal(true);
  readonly procesando = signal<'' | 'propina' | 'pago'>('');
  readonly errorCarga = signal('');
  readonly mensajeError = signal('');
  readonly cuenta = signal<Cuenta | null>(null);
  readonly items = signal<ItemCuenta[]>([]);
  readonly metodoElegido = signal<MetodoPago | null>(null);
  readonly errorMetodo = signal(false);
  readonly escaneando = signal(false);
  readonly mesaVerificada = signal<{ numero: number; libre: boolean } | null>(null);
  readonly enEtapaPago = signal(false);

  readonly fase = computed<Fase | null>(() => {
    const cuenta = this.cuenta();
    if (!cuenta) return null;
    if (cuenta.estado === 'confirmada') return 'confirmada';
    if (cuenta.estado === 'pagada') return 'pagada';
    if (cuenta.propinaPorcentaje === null) return 'propina';
    return this.enEtapaPago() ? 'pago' : 'detalle';
  });

  readonly pantallaFija = computed(() => this.fase() === 'detalle' || this.fase() === 'pago');

  readonly nivelPropina = computed(
    () => NIVELES_PROPINA.find((n) => n.porcentaje === this.cuenta()?.propinaPorcentaje)?.nivel ?? '',
  );

  readonly etiquetaMetodo = computed(() => {
    const metodo = this.cuenta()?.metodoPago;
    return metodo ? ETIQUETAS_METODO_PAGO[metodo].toLowerCase() : '';
  });

  readonly textoEspera = computed(() => {
    switch (this.procesando()) {
      case 'propina': return 'Calculando tu cuenta…';
      case 'pago': return 'Procesando el pago…';
      default: return 'Pidiendo la cuenta…';
    }
  });

  constructor() { 
    addIcons({
      alertCircleOutline,
      arrowBackOutline,
      card,
      cardOutline,
      checkmarkCircle,
      happyOutline,
      notificationsOutline,
      qrCodeOutline,
      radioButtonOff,
      radioButtonOn,
      walletOutline,
      warningOutline,
      barChartOutline,
      arrowForwardOutline
    })
  }

  async ngOnInit(): Promise<void> {
    this.mesaId = this.route.snapshot.paramMap.get('mesaId') ?? '';

    try{
      const cuenta = await this.cuentaService.solicitar();
      this.cuenta.set(cuenta);
      this.canal = this.cuentaService.escucharCuenta(cuenta.id, (actualizada) => this.cuenta.set(actualizada));
      this.items.set(await this.cuentaService.obtenerItems(cuenta));
    } catch (e) {
      this.errorCarga.set(e instanceof Error ? e.message : 'No se pudo abrir tu cuenta.');
      await this.vibrar();
    } finally {
      this.cargando.set(false);
    }
  }

  ngOnDestroy() {
    if (this.canal) {
      this.cuentaService.cerrarCanal(this.canal);
    }
  }

  async escanearPropina(): Promise<void> {
    if (this.procesando()) return;
    try {
      const porcentaje = await this.cuentaService.escanearPropina();
      if (porcentaje === null) return; 
      this.procesando.set('propina');
      this.cuenta.set(await this.cuentaService.aplicarPropina(porcentaje));
    } catch (e) {
      await this.dispararError(e instanceof Error ? e.message : 'No se pudo leer el código.');
    } finally {
      this.procesando.set('');
    }
  }

  elegirMetodo(metodo: MetodoPago): void {
    this.metodoElegido.set(metodo);
    this.errorMetodo.set(false);
  }

  irAlPago(): void {
    this.enEtapaPago.set(true);
  }

  volverAlDetalle(): void {
    this.enEtapaPago.set(false);
    this.errorMetodo.set(false);
  }

  async pagar(): Promise<void> {
    if (this.procesando()) return;

    const metodo = this.metodoElegido();
    if (!metodo) {
      this.errorMetodo.set(true);
      await this.dispararError('Elegí un medio de pago para continuar.');
      return;
    }

    this.procesando.set('pago');
    try {
      const [cuenta] = await Promise.all([this.cuentaService.pagar(metodo), esperar(DEMORA_PAGO_SIMULADO_MS)]);
      this.cuenta.set(cuenta);
    } catch (e) {
      await this.dispararError(e instanceof Error ? e.message : 'No se pudo realizar el pago.');
    } finally {
      this.procesando.set('');
    }
  }

  async verificarMesa(): Promise<void> {
    if (this.escaneando()) return;
    this.escaneando.set(true);
    try {
      const datos = await this.qrAppService.escanear();
      if (!datos) return; // el usuario canceló el escaneo
      if (datos.tipo !== 'mesa') {
        throw new Error('Ese código no es el de una mesa.');
      }
      const mesa = await this.mesaService.buscarPorNumero(datos.numero);
      if (!mesa) {
        throw new Error(`No encontramos la mesa ${datos.numero}.`);
      }
      this.mesaVerificada.set({ numero: mesa.numero, libre: mesa.disponibilidad === 'vacia' });
    } catch (e) {
      await this.dispararError(e instanceof Error ? e.message : 'No se pudo leer el código.');
    } finally {
      this.escaneando.set(false);
    }
  }

  async escanearIngreso(): Promise<void> {
    if (this.escaneando()) return;
    this.escaneando.set(true);
    try {
      const datos = await this.qrAppService.escanear();
      if (!datos) return; // el usuario canceló el escaneo
      if (datos.tipo !== 'ingreso_local') {
        throw new Error('Ese código no es el de ingreso al local.');
      }
      this.router.navigate(['/encuestas/resultados']);
    } catch (e) {
      await this.dispararError(e instanceof Error ? e.message : 'No se pudo leer el código.');
    } finally {
      this.escaneando.set(false);
    }
  }

  irAlInicio(): void {
    this.router.navigate(['/home'], { replaceUrl: true });
  }

  formatear(importe: number | null): string {
    return (importe ?? 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
  }

  volver(): void {
    if (this.fase() === 'pago') {
      this.volverAlDetalle();
      return;
    }
    if (this.mesaId) {
      this.router.navigate(['/mesa', this.mesaId, 'pedido']);
    } else {
      this.router.navigate(['/home']);
    }
  }

  private async dispararError(mensaje: string): Promise<void> {
    this.mensajeError.set(mensaje);
    await this.vibrar();
    setTimeout(() => this.mensajeError.set(''), 4000);
  }

  private async vibrar(): Promise<void> {
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {
      // Ignorar si el dispositivo/navegador no soporta vibración.
    }
  }

}
