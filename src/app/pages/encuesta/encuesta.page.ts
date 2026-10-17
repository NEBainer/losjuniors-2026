import { Component, ElementRef, OnInit, inject, signal, computed, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonIcon,
  IonRadio,
  IonRadioGroup,
  IonRange,
  IonTextarea,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/angular';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  arrowBackOutline,
  barChartOutline,
  checkmarkCircleOutline,
  chevronBackOutline,
  chevronForwardOutline,
  sendOutline,
  star,
  starOutline,
  warningOutline,
} from 'ionicons/icons';
import { EncuestaService } from '../../core/services/encuesta.service';
import {
  AspectoDestacado,
  AtencionMozo,
  ETIQUETAS_ASPECTO,
  ETIQUETAS_ATENCION,
  EstadiaActual,
} from '../../core/models/encuesta.model';

// Validators.minLength cuenta los espacios: "          " pasaría. Este
// recorta antes de medir, igual que el check de la base (btrim).
function textoMinimo(minimo: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null =>
    String(control.value ?? '').trim().length >= minimo ? null : { textoCorto: true };
}

function alMenosUno(control: AbstractControl): ValidationErrors | null {
  return Array.isArray(control.value) && control.value.length > 0 ? null : { sinSeleccion: true };
}

const TEXTOS_CALIFICACION = ['Tocá una estrella', 'Muy mala', 'Mala', 'Buena', 'Muy buena', 'Excelente'];

const CAMPOS = [
  'calificacionGeneral',
  'atencionMozo',
  'limpieza',
  'aspectosDestacados',
  'recomendaria',
  'comentario',
] as const;

/**
 * encuesta.page.ts
 * -----------------
 * Punto 20: el cliente con mesa asignada completa la encuesta de
 * satisfacción, una sola vez por estadía (EncuestaService.obtenerEstadiaActual).
 * Cada pregunta usa un control distinto (requisito excluyente "variedad de
 * controles"): estrellas, opciones, deslizador, casillas, interruptor y
 * texto libre.
 */

@Component({
  selector: 'app-encuesta',
  host: { class: 'ion-page' },
  templateUrl: './encuesta.page.html',
  styleUrls: ['./encuesta.page.scss'],
  imports: [IonButton, IonButtons, IonCheckbox, IonContent, IonHeader, IonIcon,IonRadio, IonRadioGroup, IonRange, IonTextarea, IonTitle,IonToggle, IonToolbar, CommonModule, ReactiveFormsModule,]
})
export class EncuestaPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly encuestaService = inject(EncuestaService);
  private readonly pista = viewChild<ElementRef<HTMLDivElement>>('pista');

  readonly estrellas = [1, 2, 3, 4, 5];
  readonly opcionesAtencion = (Object.keys(ETIQUETAS_ATENCION) as AtencionMozo[]).map((valor) => ({
    valor,
    etiqueta: ETIQUETAS_ATENCION[valor],
  }));
  readonly opcionesAspecto = (Object.keys(ETIQUETAS_ASPECTO) as AspectoDestacado[]).map((valor) => ({
    valor,
    etiqueta: ETIQUETAS_ASPECTO[valor],
  }));

  readonly numeroMesa = signal<number | null>(null);
  readonly cargando = signal(true);
  readonly enviando = signal(false);
  readonly estadia = signal<EstadiaActual | null>(null);
  readonly errorCarga = signal('');
  readonly mensajeError = signal('');
  readonly indice = signal(0);
  readonly totalPreguntas = CAMPOS.length;
  readonly esUltima = computed(() => this.indice() === CAMPOS.length - 1);

  readonly formulario = this.fb.nonNullable.group({
    calificacionGeneral: [0, [Validators.min(1), Validators.max(5)]],
    atencionMozo: this.fb.control<AtencionMozo | null>(null, Validators.required),
    limpieza: [5, [Validators.required, Validators.min(1), Validators.max(10)]],
    aspectosDestacados: [[] as AspectoDestacado[], alMenosUno],
    recomendaria: [false],
    comentario: ['', [textoMinimo(10), Validators.maxLength(300)]],
  });  

  constructor() { 
     addIcons({
      alertCircleOutline,
      arrowBackOutline,
      barChartOutline,
      checkmarkCircleOutline,
      sendOutline,
      star,
      starOutline,
      warningOutline,
      chevronBackOutline,
      chevronForwardOutline,
    });
  }

  async ngOnInit(): Promise<void> {
    try {
      const estadia = await this.encuestaService.obtenerEstadiaActual();
      if (!estadia) {
        this.errorCarga.set('No tenés una mesa asignada. La encuesta se completa durante tu estadía en el local.');
        await this.vibrar();
        return;
      }
      this.estadia.set(estadia);
      this.numeroMesa.set(estadia.mesaNumero);
    } catch (e) {
      this.errorCarga.set(e instanceof Error ? e.message : 'No se pudo abrir la encuesta.');
      await this.vibrar();
    } finally {
      this.cargando.set(false);
    }
  }

  calificacion(): number {
    return this.formulario.controls.calificacionGeneral.value;
  }

  textoCalificacion(): string {
    return TEXTOS_CALIFICACION[this.calificacion()];
  }

  elegirCalificacion(estrellas: number): void {
    const control = this.formulario.controls.calificacionGeneral;
    control.setValue(estrellas);
    control.markAsTouched();
  }

  estaSeleccionado(aspecto: AspectoDestacado): boolean {
    return this.formulario.controls.aspectosDestacados.value.includes(aspecto);
  }

  // Las casillas no van con formControlName (son varias para un solo
  // valor): cada una suma o saca su aspecto del arreglo del control.
  alternarAspecto(aspecto: AspectoDestacado, marcado: boolean): void {
    const control = this.formulario.controls.aspectosDestacados;
    const actuales = control.value.filter((a) => a !== aspecto);
    control.setValue(marcado ? [...actuales, aspecto] : actuales);
    control.markAsTouched();
  }

  mostrarError(campo: keyof typeof this.formulario.controls): boolean {
    const control = this.formulario.controls[campo];
    return control.invalid && control.touched;
  }

  alDesplazar(): void {
    const pista = this.pista()?.nativeElement;
    if (!pista || !pista.clientWidth) return;
    this.indice.set(Math.round(pista.scrollLeft / pista.clientWidth));
  }

  irA(indice: number): void {
    const pista = this.pista()?.nativeElement;
    if (!pista || indice < 0 || indice >= CAMPOS.length) return;
    const sinAnimacion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    pista.scrollTo({ left: indice * pista.clientWidth, behavior: sinAnimacion ? 'auto' : 'smooth' });
  }

  anterior(): void {
    this.irA(this.indice() - 1);
  }

  async siguiente(): Promise<void> {
    const control = this.formulario.controls[CAMPOS[this.indice()]];
    control.markAsTouched();
    if (control.invalid) {
      await this.dispararError('Respondé esta pregunta para seguir.');
      return;
    }
    this.irA(this.indice() + 1);
  }

  async enviar(): Promise<void> {
    const estadia = this.estadia();
    if (!estadia || this.enviando()) return;

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      const faltante = CAMPOS.findIndex((campo) => this.formulario.controls[campo].invalid);
      this.irA(faltante);
      await this.dispararError(`Te falta responder la pregunta ${faltante + 1}.`);
      return;
    }

    const valores = this.formulario.getRawValue();
    this.enviando.set(true);
    try {
      await this.encuestaService.enviar(estadia, {
        calificacionGeneral: valores.calificacionGeneral,
        atencionMozo: valores.atencionMozo!,
        limpieza: valores.limpieza,
        aspectosDestacados: valores.aspectosDestacados,
        recomendaria: valores.recomendaria,
        comentario: valores.comentario,
      });
      // replaceUrl: volver desde los resultados lleva a la carta, no de
      // nuevo a una encuesta que ya no se puede completar.
      this.router.navigate(['/encuestas/resultados'], { replaceUrl: true });
    } catch (e) {
      await this.dispararError(e instanceof Error ? e.message : 'No se pudo enviar la encuesta.');
    } finally {
      this.enviando.set(false);
    }
  }

  verResultados(): void {
    this.router.navigate(['/encuestas/resultados']);
  }

  volver(): void {
    const mesaId = this.route.snapshot.paramMap.get('mesaId') ?? this.estadia()?.mesaId;
    if (mesaId) {
      this.router.navigate(['/mesa', mesaId, 'pedido']);
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
