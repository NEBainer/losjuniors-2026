import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { camera, images, close, addCircleOutline } from 'ionicons/icons';
import { Camera, MediaTypeSelection } from '@capacitor/camera';
import { Haptics, NotificationType } from '@capacitor/haptics';

/**
 * producto.alta.component.ts
 * ---------------------------
 * Alta de plato (perfil cocinero, punto 2 del TP) y alta de bebida (perfil
 * cantinero, punto 3) — son el mismo formulario con dos etiquetas distintas,
 * así que en vez de duplicar dos pantallas casi idénticas, un solo componente
 * con @Input() tipo decide el texto y qué se emite.
 *
 * Uso:
 *   <app-producto-alta
 *     tipo="plato"
 *     [nombresExistentes]="nombresDeLaCarta"
 *     [guardando]="guardandoEnSupabase"
 *     [errorGuardado]="errorDelUltimoIntento"
 *     (guardar)="onGuardarProducto($event)"
 *     (cancelar)="volver()"
 *   />
 *
 * Este componente NO habla con Supabase directamente — solo arma y valida
 * los datos, y los emite por (guardar). La pantalla que lo use es la que
 * hace el insert real (mismo patrón que ya usan con AuthService.client:
 * un solo dueño de la conexión, todo lo demás lo recibe inyectado/emitido).
 *
 * Fotos: a diferencia del alta de empleado/cliente (que fuerza cámara),
 * acá el TP permite elegir cámara O galería — por eso se arma un selector
 * propio (ion-action-sheet) y se usa la API actual del plugin:
 *   Camera.takePhoto()        -> cámara
 *   Camera.chooseFromGallery() -> galería
 * (getPhoto() quedó deprecado en la versión que ya tienen instalada).
 *
 * Vibración en error: Haptics.notification({ type: NotificationType.Error })
 * se dispara si se intenta guardar con el formulario inválido o con fotos
 * faltantes — cumple el requisito excluyente "vibraciones en TODOS los
 * errores" sin usar alert().
 */

export interface FotoProducto {
  /** Para mostrar en <img src>, sirve tanto en web como en nativo. */
  webPath: string;
  /** Solo nativo (iOS/Android) — lo necesita quien suba el archivo real a Storage. */
  uri?: string;
}

export interface DatosProductoAlta {
  tipo: 'plato' | 'bebida';
  nombre: string;
  descripcion: string;
  tiempoElaboracionMinutos: number;
  precio: number;
  fotos: FotoProducto[];
}

function validadorNombreDuplicado(obtenerExistentes: () => string[]): ValidatorFn {
  return (control): ValidationErrors | null => {
    const valor = (control.value ?? '').toString().trim().toLowerCase();
    if (!valor) return null;
    const yaExiste = obtenerExistentes().some(
      (n) => n.trim().toLowerCase() === valor
    );
    return yaExiste ? { duplicado: true } : null;
  };
}

@Component({
  selector: 'app-producto-alta',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonItem,
    IonLabel,
    IonInput,
    IonTextarea,
    IonNote,
    IonButton,
    IonIcon,
    IonSpinner,
  ],
  template: `
<ion-header>
  <ion-toolbar>
    <ion-buttons slot="start">
      <ion-back-button defaultHref="/" text="" (click)="cancelar.emit()"></ion-back-button>
    </ion-buttons>
    <ion-title>{{ tipo === 'plato' ? 'Nuevo plato' : 'Nueva bebida' }}</ion-title>
  </ion-toolbar>
</ion-header>

<ion-content class="fondo-carta">
<form [formGroup]="formulario" (ngSubmit)="alEnviar()" class="formulario" novalidate>

  <p class="ayuda">
    Completá los datos {{ tipo === 'plato' ? 'del plato' : 'de la bebida' }} para
    {{ tipo === 'plato' ? 'agregarlo' : 'agregarla' }} a la carta.
  </p>

  <ion-item fill="outline" class="campo" [class.campo-error]="tocadoInvalido('nombre')">
    <ion-label position="stacked">Nombre</ion-label>
    <ion-input
      formControlName="nombre"
      type="text"
      autocomplete="off"
      [placeholder]="tipo === 'plato' ? 'Ej: Milanesa napolitana' : 'Ej: Limonada con menta'"
    ></ion-input>
  </ion-item>
  <ion-note color="danger" class="nota-error" *ngIf="tocadoInvalido('nombre')">
    {{ mensajeError('nombre') }}
  </ion-note>

  <ion-item fill="outline" class="campo" [class.campo-error]="tocadoInvalido('descripcion')">
    <ion-label position="stacked">Descripción</ion-label>
    <ion-textarea
      formControlName="descripcion"
      autoGrow="true"
      rows="3"
      placeholder="Ingredientes principales, forma de preparación, etc."
    ></ion-textarea>
  </ion-item>
  <ion-note color="danger" class="nota-error" *ngIf="tocadoInvalido('descripcion')">
    {{ mensajeError('descripcion') }}
  </ion-note>

  <div class="fila-doble">
    <div class="mitad">
      <ion-item fill="outline" class="campo" [class.campo-error]="tocadoInvalido('tiempoElaboracion')">
        <ion-label position="stacked">Tiempo (min)</ion-label>
        <ion-input
          formControlName="tiempoElaboracion"
          type="number"
          inputmode="numeric"
          min="1"
          placeholder="15"
        ></ion-input>
      </ion-item>
      <ion-note color="danger" class="nota-error" *ngIf="tocadoInvalido('tiempoElaboracion')">
        {{ mensajeError('tiempoElaboracion') }}
      </ion-note>
    </div>

    <div class="mitad">
      <ion-item fill="outline" class="campo" [class.campo-error]="tocadoInvalido('precio')">
        <ion-label position="stacked">Precio</ion-label>
        <ion-input
          formControlName="precio"
          type="number"
          inputmode="decimal"
          min="0.01"
          step="0.01"
          placeholder="0.00"
        >
          <div slot="start" class="prefijo-precio">$</div>
        </ion-input>
      </ion-item>
      <ion-note color="danger" class="nota-error" *ngIf="tocadoInvalido('precio')">
        {{ mensajeError('precio') }}
      </ion-note>
    </div>
  </div>

  <p class="etiqueta-fotos">
    Fotos (3)
    <ion-note color="danger" *ngIf="intentoGuardar() && !fotosCompletas()">
      &nbsp;— faltan fotos
    </ion-note>
  </p>

  <div class="grilla-fotos">
    <button
      type="button"
      class="contenedor-foto"
      *ngFor="let foto of fotos(); let i = index"
      [class.contenedor-foto-error]="intentoGuardar() && !foto"
      (click)="abrirSelector(i)"
    >
      <img *ngIf="foto" [src]="foto.webPath" [alt]="'Foto ' + (i + 1)" class="imagen-foto" />
      <div class="marca-cambiar" *ngIf="foto">Cambiar</div>

      <div class="marcador-vacio" *ngIf="!foto">
        <ion-icon name="add-circle-outline"></ion-icon>
        <span>Foto {{ i + 1 }}</span>
      </div>
    </button>
  </div>

  <ion-note color="danger" class="nota-error" *ngIf="errorGuardado">
    {{ errorGuardado }}
  </ion-note>

  <ion-button
    expand="block"
    type="submit"
    class="boton-guardar"
    [disabled]="guardando"
  >
    {{ guardando ? 'Guardando…' : (tipo === 'plato' ? 'Guardar plato' : 'Guardar bebida') }}
  </ion-button>

  <div class="cierre-decorativo" aria-hidden="true">
    <span class="linea-cierre"></span><span class="rombo-cierre"></span><span class="linea-cierre"></span>
  </div>

</form>

<!-- selector cámara/galería, propio, sin depender de un plugin nativo aparte -->
<div class="velo-selector" *ngIf="mostrarSelector()" (click)="mostrarSelector.set(false)">
  <div class="hoja-selector" (click)="$event.stopPropagation()">
    <button type="button" class="opcion-selector" (click)="elegirFuente('camara')">
      <ion-icon name="camera"></ion-icon>
      <span>Tomar foto</span>
    </button>
    <button type="button" class="opcion-selector" (click)="elegirFuente('galeria')">
      <ion-icon name="images"></ion-icon>
      <span>Elegir de galería</span>
    </button>
    <button type="button" class="opcion-cancelar" (click)="mostrarSelector.set(false)">
      <ion-icon name="close"></ion-icon>
      <span>Cancelar</span>
    </button>
  </div>
</div>

<!-- spinner con logo mientras se guarda -->
<div class="velo-guardando" *ngIf="guardando">
  <img src="assets/icon/logo_lamesa.png" alt="LA MESA" class="logo-spinner" />
  <ion-spinner name="crescent" color="light"></ion-spinner>
  <p>Guardando {{ tipo === 'plato' ? 'el plato' : 'la bebida' }}…</p>
</div>

</ion-content>
  `,
  styles: [`
:host {
  --crema: #f4eada;
  --marron: #7a3a22;
  --marron-osc: #5b2a17;
  --dorado: #c68a34;
  --texto-gris: #9c9186;
  --rojo-error: #b3261e;
}

ion-header ion-toolbar {
  --background: var(--marron);
  --color: var(--crema);
}

.fondo-carta {
  --background: var(--crema);
}
.fondo-carta::part(background) {
  background-color: var(--crema);
  background-image:
    radial-gradient(circle at 14px 14px, rgba(198, 138, 52, 0.18) 1.6px, transparent 1.6px),
    radial-gradient(circle at 46px 42px, rgba(122, 58, 34, 0.10) 1.3px, transparent 1.3px);
  background-size: 64px 64px;
}

.formulario {
  padding: 16px;
  padding-bottom: 48px;
  display: block;
}

.ayuda {
  color: var(--marron);
  font-family: 'EB Garamond', Georgia, serif;
  font-size: 0.95rem;
  margin: 0 0 16px;
}

.campo {
  --background: #fffdf8;
  --border-color: var(--dorado);
  --border-radius: 12px;
  --highlight-color-focused: var(--marron);
  margin-bottom: 4px;
  font-family: 'EB Garamond', Georgia, serif;
}
.campo ion-label {
  color: var(--marron);
  font-weight: 600;
}
.campo-error {
  --border-color: var(--rojo-error);
  --border-width: 2px;
}
.nota-error {
  display: block;
  font-size: 0.8rem;
  margin: 2px 4px 12px;
}

.fila-doble {
  display: flex;
  gap: 12px;
}
.mitad {
  flex: 1;
  min-width: 0;
}

.prefijo-precio {
  color: var(--texto-gris);
  padding-inline-end: 4px;
}

.etiqueta-fotos {
  color: var(--marron);
  font-weight: 600;
  font-family: 'EB Garamond', Georgia, serif;
  margin: 12px 4px 8px;
}

.grilla-fotos {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}

.contenedor-foto {
  position: relative;
  aspect-ratio: 1;
  border-radius: 12px;
  border: 2px dashed var(--dorado);
  background: #fffdf8;
  overflow: hidden;
  padding: 0;
  cursor: pointer;
}
.contenedor-foto-error {
  border-color: var(--rojo-error);
}

.imagen-foto {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.marca-cambiar {
  position: absolute;
  inset: auto 0 0 0;
  background: rgba(90, 42, 23, 0.75);
  color: #fff;
  font-size: 0.7rem;
  text-align: center;
  padding: 3px 0;
}

.marcador-vacio {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: var(--dorado);
  font-size: 0.75rem;
}
.marcador-vacio ion-icon {
  font-size: 1.6rem;
}

.boton-guardar {
  --background: var(--marron);
  --background-activated: var(--marron-osc);
  --border-radius: 999px;
  margin-top: 12px;
  font-weight: 600;
}

.cierre-decorativo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5em;
  margin-top: 28px;
}
.linea-cierre {
  width: 40px;
  height: 2px;
  background: var(--dorado);
}
.rombo-cierre {
  width: 8px;
  height: 8px;
  background: var(--dorado);
  transform: rotate(45deg);
}

.velo-selector {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-end;
  z-index: 20000;
}
.hoja-selector {
  background: var(--crema);
  width: 100%;
  border-radius: 20px 20px 0 0;
  padding: 8px 0 max(8px, env(safe-area-inset-bottom));
}
.opcion-selector,
.opcion-cancelar {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  background: none;
  border: none;
  border-bottom: 1px solid rgba(122, 58, 34, 0.15);
  font-family: 'EB Garamond', Georgia, serif;
  font-size: 1rem;
  color: var(--marron);
  text-align: left;
}
.opcion-cancelar {
  color: var(--texto-gris);
  border-bottom: none;
  font-weight: 600;
}
.opcion-selector ion-icon,
.opcion-cancelar ion-icon {
  font-size: 1.3rem;
}

.velo-guardando {
  position: fixed;
  inset: 0;
  background: rgba(91, 42, 23, 0.92);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--crema);
  font-family: 'EB Garamond', Georgia, serif;
  z-index: 20001;
}
.logo-spinner {
  width: 96px;
  height: 96px;
  border-radius: 50%;
}
  `],
})
export class ProductoAltaComponent implements OnInit, OnChanges {
  @Input() tipo: 'plato' | 'bebida' = 'plato';
  @Input() nombresExistentes: string[] = [];
  @Input() guardando = false;
  @Input() errorGuardado: string | null = null;

  @Output() guardar = new EventEmitter<DatosProductoAlta>();
  @Output() cancelar = new EventEmitter<void>();

  protected readonly fotos = signal<(FotoProducto | null)[]>([null, null, null]);
  protected readonly fotosCompletas = computed(() =>
    this.fotos().every((f) => f !== null)
  );
  protected readonly intentoGuardar = signal(false);
  protected readonly mostrarSelector = signal(false);
  private indiceFotoActiva: number | null = null;

  private readonly fb = inject(FormBuilder);

  protected readonly formulario = this.fb.group({
    nombre: [
      '',
      [Validators.required, Validators.minLength(2), Validators.maxLength(60)],
    ],
    descripcion: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(300)]],
    tiempoElaboracion: ['', [Validators.required, Validators.pattern(/^[1-9][0-9]*$/)]],
    precio: ['', [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/), Validators.min(0.01)]],
  });

  constructor() {
    addIcons({ camera, images, close, 'add-circle-outline': addCircleOutline });
  }

  ngOnInit(): void {
    this.formulario
      .get('nombre')!
      .addValidators(validadorNombreDuplicado(() => this.nombresExistentes));
  }

  ngOnChanges(cambios: SimpleChanges): void {
    if (cambios['nombresExistentes'] && !cambios['nombresExistentes'].firstChange) {
      this.formulario.get('nombre')!.updateValueAndValidity({ emitEvent: false });
    }
  }

  protected tocadoInvalido(campo: string): boolean {
    const control = this.formulario.get(campo);
    return !!control && control.invalid && (control.touched || this.intentoGuardar());
  }

  protected mensajeError(campo: string): string {
    const control = this.formulario.get(campo);
    if (!control || !control.errors) return '';
    if (control.errors['required']) return 'Este campo es obligatorio.';
    if (control.errors['duplicado']) return 'Ya existe un producto con ese nombre en la carta.';
    if (control.errors['minlength'])
      return `Necesita al menos ${control.errors['minlength'].requiredLength} caracteres.`;
    if (control.errors['maxlength'])
      return `No puede superar los ${control.errors['maxlength'].requiredLength} caracteres.`;
    if (campo === 'tiempoElaboracion' && control.errors['pattern'])
      return 'Ingresá un número entero de minutos, mayor a 0.';
    if (campo === 'precio' && (control.errors['pattern'] || control.errors['min']))
      return 'Ingresá un precio válido, mayor a 0 (hasta 2 decimales).';
    return 'Dato inválido.';
  }

  protected abrirSelector(indice: number): void {
    this.indiceFotoActiva = indice;
    this.mostrarSelector.set(true);
  }

  protected async elegirFuente(fuente: 'camara' | 'galeria'): Promise<void> {
    this.mostrarSelector.set(false);
    const indice = this.indiceFotoActiva;
    if (indice === null) return;

    try {
      if (fuente === 'camara') {
        const resultado = await Camera.takePhoto({ quality: 85 });
        this.asignarFoto(indice, { webPath: resultado.webPath!, uri: resultado.uri });
      } else {
        const { results } = await Camera.chooseFromGallery({
          mediaType: MediaTypeSelection.Photo,
        });
        const primera = results[0];
        if (primera) {
          this.asignarFoto(indice, { webPath: primera.webPath!, uri: primera.uri });
        }
      }
    } catch (error) {
      // El usuario canceló el selector nativo o no dio permisos.
      // No es un error de validación del formulario, así que no se muestra nada.
      console.warn('No se pudo obtener la foto', error);
    }
  }

  private asignarFoto(indice: number, foto: FotoProducto): void {
    const copia = [...this.fotos()];
    copia[indice] = foto;
    this.fotos.set(copia);
  }

  protected async alEnviar(): Promise<void> {
    this.intentoGuardar.set(true);
    this.formulario.markAllAsTouched();

    if (this.formulario.invalid || !this.fotosCompletas()) {
      await this.vibrarError();
      return;
    }

    const valores = this.formulario.getRawValue();
    this.guardar.emit({
      tipo: this.tipo,
      nombre: (valores.nombre ?? '').trim(),
      descripcion: (valores.descripcion ?? '').trim(),
      tiempoElaboracionMinutos: Number(valores.tiempoElaboracion),
      precio: Number(valores.precio),
      fotos: this.fotos() as FotoProducto[],
    });
  }

  private async vibrarError(): Promise<void> {
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch {
      // Web sin soporte de vibración - no rompe el flujo.
    }
  }
}
