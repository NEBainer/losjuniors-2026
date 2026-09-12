import {
  Component,
  DestroyRef,
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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { camera, images, close, addCircleOutline, refreshOutline } from 'ionicons/icons';
import { Camera, MediaTypeSelection } from '@capacitor/camera';
import { Haptics, NotificationType } from '@capacitor/haptics';

/**
 * producto.alta.component.ts
 * ---------------------------
 * Alta de plato (perfil cocinero, punto 2 del TP) y alta de bebida (perfil
 * cantinero, punto 3) — mismo formulario, dos etiquetas. Un solo componente
 * con @Input() tipo decide el texto y qué se emite, en vez de mantener dos
 * pantallas casi idénticas por separado.
 *
 * Reescrito de cero (09/2026) para resolver de raíz varios quilombos que
 * habían quedado del primer intento: formulario que se congelaba con un
 * error de tipeo, borrador de datos que se perdía si alguien salía sin
 * querer, y el botón "volver" que no siempre preguntaba antes de tirar
 * todo lo cargado. Ver notas en cada sección.
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
 * los datos, y los emite por (guardar). La pantalla que lo use hace el
 * insert real (mismo patrón que ya usan con AuthService.client: un solo
 * dueño de la conexión, todo lo demás lo recibe inyectado/emitido).
 *
 * Fotos: a diferencia del alta de empleado/cliente (que fuerza cámara), acá
 * el TP permite elegir cámara O galería, por eso hay un selector propio
 * (no depende de un action-sheet nativo) usando la API vigente del plugin:
 *   Camera.takePhoto()         -> cámara
 *   Camera.chooseFromGallery() -> galería
 * (getPhoto() quedó deprecado en la versión instalada).
 *
 * Vibración en error: Haptics.notification({ type: NotificationType.Error })
 * se dispara con formulario inválido o fotos faltantes — cumple "vibración
 * en TODOS los errores" sin usar alert().
 *
 * Borrador automático: mientras se tipea, los campos de texto se van
 * guardando en localStorage (con debounce, para no escribir en cada tecla).
 * Si el cocinero/cantinero cierra la app o se corta la luz a mitad de carga,
 * al volver a entrar el formulario aparece tal como lo dejaron. Las FOTOS
 * no se pueden restaurar así (son blobs temporales de la cámara/galería,
 * mueren si se reinicia la app) — eso se avisa si corresponde.
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

interface BorradorProducto {
  nombre: string;
  descripcion: string;
  tiempoElaboracion: string;
  precio: string;
  guardadoEn: number;
}

const TIEMPO_MAXIMO_MINUTOS = 480; // 8 horas — tope razonable, evita cargas por error tipo "9999".
const PRECIO_MAXIMO = 999999.99;
const DEMORA_AUTOGUARDADO_MS = 800;
const DURACION_AVISO_BORRADOR_MS = 5000;

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
      <ion-back-button defaultHref="/" text="" (click)="alPresionarVolver($event)"></ion-back-button>
    </ion-buttons>
    <ion-title>{{ tipo === 'plato' ? 'Nuevo plato' : 'Nueva bebida' }}</ion-title>
  </ion-toolbar>
</ion-header>

<ion-content class="fondo-carta">
<form [formGroup]="formulario" (ngSubmit)="alEnviar()" class="formulario" novalidate>

  <div class="aviso-borrador" role="status" *ngIf="mostrarAvisoBorrador()">
    <ion-icon name="refresh-outline"></ion-icon>
    <span>Recuperamos lo que habías empezado a cargar. Las fotos hay que volver a elegirlas.</span>
    <button type="button" class="cerrar-aviso" (click)="mostrarAvisoBorrador.set(false)" aria-label="Cerrar aviso">
      <ion-icon name="close"></ion-icon>
    </button>
  </div>

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
          [max]="tiempoMaximo"
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
          [max]="precioMaximo"
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
      *ngFor="let foto of fotos(); let i = index; trackBy: trackByIndice"
      [class.contenedor-foto-error]="intentoGuardar() && !foto"
      [attr.aria-label]="foto ? 'Cambiar foto ' + (i + 1) : 'Agregar foto ' + (i + 1)"
      (click)="abrirSelector(i)"
    >
      <img *ngIf="foto" [src]="foto.webPath" [alt]="'Foto ' + (i + 1) + ' del producto'" class="imagen-foto" />
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

<!-- confirmación al querer salir con datos sin guardar -->
<div class="velo-confirmar" *ngIf="mostrarConfirmarSalida()">
  <div class="tarjeta-confirmar" role="alertdialog" aria-modal="true">
    <p class="titulo-confirmar">¿Salir sin terminar de cargar {{ tipo === 'plato' ? 'el plato' : 'la bebida' }}?</p>
    <p class="texto-confirmar">Guardamos tu progreso — vas a poder retomarlo la próxima vez que entres acá.</p>
    <div class="botones-confirmar">
      <button type="button" class="boton-seguir" (click)="mostrarConfirmarSalida.set(false)">Seguir cargando</button>
      <button type="button" class="boton-salir" (click)="confirmarSalida()">Salir</button>
    </div>
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
  color-scheme: only light; /* el TP prohíbe modo oscuro — forzamos también los controles nativos del navegador */
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

.aviso-borrador {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(198, 138, 52, 0.18);
  border: 1px solid var(--dorado);
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 14px;
  font-family: 'EB Garamond', Georgia, serif;
  font-size: 0.85rem;
  color: var(--marron-osc);
}
.aviso-borrador ion-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
}
.aviso-borrador span {
  flex: 1;
}
.cerrar-aviso {
  background: none;
  border: none;
  padding: 4px;
  color: var(--marron-osc);
  flex-shrink: 0;
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

.velo-confirmar {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 20002;
}
.tarjeta-confirmar {
  background: var(--crema);
  border-radius: 16px;
  padding: 22px 20px;
  max-width: 340px;
  width: 100%;
  font-family: 'EB Garamond', Georgia, serif;
  border: 1px solid var(--dorado);
}
.titulo-confirmar {
  color: var(--marron-osc);
  font-weight: 600;
  font-size: 1.05rem;
  margin: 0 0 8px;
}
.texto-confirmar {
  color: var(--texto-gris);
  font-size: 0.9rem;
  margin: 0 0 18px;
}
.botones-confirmar {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.boton-seguir,
.boton-salir {
  width: 100%;
  padding: 12px;
  border-radius: 999px;
  border: none;
  font-family: 'EB Garamond', Georgia, serif;
  font-weight: 600;
  font-size: 0.95rem;
}
.boton-seguir {
  background: var(--marron);
  color: var(--crema);
}
.boton-salir {
  background: transparent;
  color: var(--texto-gris);
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

  protected readonly tiempoMaximo = TIEMPO_MAXIMO_MINUTOS;
  protected readonly precioMaximo = PRECIO_MAXIMO;

  protected readonly fotos = signal<(FotoProducto | null)[]>([null, null, null]);
  protected readonly fotosCompletas = computed(() =>
    this.fotos().every((f) => f !== null)
  );
  protected readonly intentoGuardar = signal(false);
  protected readonly mostrarSelector = signal(false);
  protected readonly mostrarConfirmarSalida = signal(false);
  protected readonly mostrarAvisoBorrador = signal(false);
  private indiceFotoActiva: number | null = null;

  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  // Se usan para detectar "terminó de guardar con éxito" comparando el
  // valor anterior y el actual de @Input() guardando en ngOnChanges.
  private guardandoAnterior = false;
  private envioEnCurso = false;

  protected readonly formulario = this.fb.group({
    nombre: [
      '',
      [Validators.required, Validators.minLength(2), Validators.maxLength(60)],
    ],
    descripcion: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(300)]],
    tiempoElaboracion: [
      '',
      [Validators.required, Validators.pattern(/^[1-9][0-9]*$/), Validators.max(TIEMPO_MAXIMO_MINUTOS)],
    ],
    precio: [
      '',
      [
        Validators.required,
        Validators.pattern(/^\d+(\.\d{1,2})?$/),
        Validators.min(0.01),
        Validators.max(PRECIO_MAXIMO),
      ],
    ],
  });

  constructor() {
    addIcons({
      camera,
      images,
      close,
      'add-circle-outline': addCircleOutline,
      'refresh-outline': refreshOutline,
    });
  }

  ngOnInit(): void {
    this.formulario
      .get('nombre')!
      .addValidators(validadorNombreDuplicado(() => this.nombresExistentes));

    this.restaurarBorradorSiExiste();

    // Autoguardado: cada cambio en el form (con un pequeño debounce para no
    // escribir en localStorage en cada tecla) queda como borrador. Se corta
    // solo cuando el componente se destruye — sin necesidad de un
    // ngOnDestroy manual gracias a takeUntilDestroyed.
    this.formulario.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.programarAutoguardado());
  }

  ngOnChanges(cambios: SimpleChanges): void {
    if (cambios['nombresExistentes'] && !cambios['nombresExistentes'].firstChange) {
      this.formulario.get('nombre')!.updateValueAndValidity({ emitEvent: false });
    }

    if (cambios['guardando']) {
      const terminoDeGuardar = this.guardandoAnterior && !this.guardando;
      if (terminoDeGuardar && this.envioEnCurso) {
        if (!this.errorGuardado) {
          // Se guardó bien: limpiamos el borrador y dejamos el formulario
          // listo para una carga nueva. Si falló, dejamos todo como está —
          // errorGuardado ya se muestra, y así no hacemos re-tipear nada.
          this.limpiarBorrador();
          this.formulario.reset();
          this.fotos.set([null, null, null]);
          this.intentoGuardar.set(false);
        }
        this.envioEnCurso = false;
      }
      this.guardandoAnterior = this.guardando;
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
    if (campo === 'tiempoElaboracion' && control.errors['max'])
      return `No puede superar los ${TIEMPO_MAXIMO_MINUTOS} minutos (8 horas).`;
    if (campo === 'precio' && (control.errors['pattern'] || control.errors['min']))
      return 'Ingresá un precio válido, mayor a 0 (hasta 2 decimales).';
    if (campo === 'precio' && control.errors['max'])
      return `No puede superar los $${PRECIO_MAXIMO.toLocaleString('es-AR')}.`;
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

  protected trackByIndice(indice: number): number {
    return indice;
  }

  protected async alEnviar(): Promise<void> {
    this.intentoGuardar.set(true);
    this.formulario.markAllAsTouched();

    if (this.formulario.invalid || !this.fotosCompletas()) {
      await this.vibrarError();
      return;
    }

    const valores = this.formulario.getRawValue();
    this.envioEnCurso = true;
    this.guardar.emit({
      tipo: this.tipo,
      nombre: (valores.nombre ?? '').trim(),
      descripcion: (valores.descripcion ?? '').trim(),
      tiempoElaboracionMinutos: Number(valores.tiempoElaboracion),
      precio: Number(valores.precio),
      fotos: this.fotos() as FotoProducto[],
    });
  }

  /** Botón "atrás" del header: si hay datos sin guardar, confirmamos antes de salir. */
  protected alPresionarVolver(evento: Event): void {
    // ion-back-button navega solo por su cuenta (defaultHref) si no frenamos
    // el evento — lo hacemos siempre nosotros, para decidir con calma.
    evento.preventDefault();
    this.intentarCancelar();
  }

  protected intentarCancelar(): void {
    if (this.hayCambiosSinGuardar()) {
      this.mostrarConfirmarSalida.set(true);
      return;
    }
    this.cancelar.emit();
  }

  protected confirmarSalida(): void {
    this.mostrarConfirmarSalida.set(false);
    this.cancelar.emit();
  }

  private hayCambiosSinGuardar(): boolean {
    return this.formulario.dirty || this.fotos().some((f) => f !== null);
  }

  private async vibrarError(): Promise<void> {
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch {
      // Web sin soporte de vibración - no rompe el flujo.
    }
  }

  // --- Borrador en localStorage -------------------------------------------

  private claveBorrador(): string {
    return `la-mesa:borrador:${this.tipo}`;
  }

  private autoguardadoPendiente: ReturnType<typeof setTimeout> | null = null;

  private programarAutoguardado(): void {
    if (this.autoguardadoPendiente) clearTimeout(this.autoguardadoPendiente);
    this.autoguardadoPendiente = setTimeout(
      () => this.guardarBorrador(),
      DEMORA_AUTOGUARDADO_MS
    );
  }

  private guardarBorrador(): void {
    const valores = this.formulario.getRawValue();
    const vacio =
      !valores.nombre?.trim() &&
      !valores.descripcion?.trim() &&
      !valores.tiempoElaboracion &&
      !valores.precio;
    if (vacio) {
      this.limpiarBorrador();
      return;
    }
    const borrador: BorradorProducto = {
      nombre: valores.nombre ?? '',
      descripcion: valores.descripcion ?? '',
      tiempoElaboracion: valores.tiempoElaboracion ?? '',
      precio: valores.precio ?? '',
      guardadoEn: Date.now(),
    };
    try {
      localStorage.setItem(this.claveBorrador(), JSON.stringify(borrador));
    } catch {
      // Cuota llena / modo privado / lo que sea — no bloqueamos la carga por esto.
    }
  }

  private limpiarBorrador(): void {
    try {
      localStorage.removeItem(this.claveBorrador());
    } catch {
      // Idem — no es crítico.
    }
  }

  private restaurarBorradorSiExiste(): void {
    try {
      const crudo = localStorage.getItem(this.claveBorrador());
      if (!crudo) return;
      const borrador: BorradorProducto = JSON.parse(crudo);
      this.formulario.patchValue(
        {
          nombre: borrador.nombre,
          descripcion: borrador.descripcion,
          tiempoElaboracion: borrador.tiempoElaboracion,
          precio: borrador.precio,
        },
        { emitEvent: false }
      );
      this.mostrarAvisoBorrador.set(true);
      setTimeout(() => this.mostrarAvisoBorrador.set(false), DURACION_AVISO_BORRADOR_MS);
    } catch {
      // Borrador corrupto o localStorage no disponible — seguimos con el form vacío.
    }
  }
}