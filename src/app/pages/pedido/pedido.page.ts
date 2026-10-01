import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSpinner,
  IonNote,
  IonButton,
  IonIcon,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  fastFoodOutline,
  wineOutline,
  timeOutline,
  pricetagOutline,
  refreshOutline,
  restaurantOutline,
  removeCircleOutline,
  addCircleOutline,
  checkmarkCircleOutline,
  peopleOutline,
  warning,
  closeCircle,
  checkmarkCircle,
  checkmarkDoneCircleOutline,
  gameControllerOutline,
  clipboardOutline,
  cashOutline,
} from 'ionicons/icons';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { ProductoService, ProductoCarta } from '../producto/producto.service';
import { MesaService, Mesa } from '../../core/services/mesa.service';
import { PedidoService } from '../../core/services/pedido.service';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { ItemCarrito, Pedido } from '../../core/models/pedido.model';
import { CarruselFotosComponent } from '../carta/carrusel-fotos.component';

type FasePedido = 'armando' | 'esperando' | 'confirmado' | 'completo' | 'entregado';

@Component({
  selector: 'app-pedido',
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonSpinner,
    IonNote,
    IonButton,
    IonIcon,
    CarruselFotosComponent,
  ],
  host: { class: 'ion-page' },
  template: `
<ion-header>
  <ion-toolbar>
    <ion-title>{{ mesa() ? 'Mesa ' + mesa()!.numero : 'Pedido' }}</ion-title>
  </ion-toolbar>
</ion-header>

<ion-content class="fondo-pedido" [scrollY]="false">

  <div class="velo-cargando" *ngIf="cargando()">
    <img src="assets/icon/logo_lamesa.png" alt="LA MESA" class="logo-spinner" />
    <ion-spinner name="crescent" color="light"></ion-spinner>
    <p>Cargando…</p>
  </div>

  <div class="estado-error" *ngIf="!cargando() && error()">
    <ion-note color="danger">{{ error() }}</ion-note>
    <ion-button fill="outline" size="small" (click)="cargarTodo()">
      <ion-icon name="refresh-outline" slot="start"></ion-icon>
      Reintentar
    </ion-button>
  </div>

  <ng-container *ngIf="!cargando() && !error() && fase() === 'armando'">

    <div class="banner-error" *ngIf="mensajeError()">
      <ion-icon name="warning"></ion-icon>
      <span>{{ mensajeError() }}</span>
    </div>

    <!-- Punto 13: aviso en pantalla (además de la push) cuando el mozo
         rechaza. Al tocar "Revisar pedido" se cierra y el cliente sigue
         en el armado con sus productos cargados, listo para reenviar. -->
    <div class="aviso-overlay" *ngIf="avisoRechazo()">
      <div class="aviso-card">
        <ion-icon name="close-circle" color="danger" class="aviso-icono"></ion-icon>
        <h2>Pedido rechazado</h2>
        <p>Revisalo y volvé a enviarlo.</p>
        <ion-button expand="block" (click)="cerrarAvisoRechazo()">Revisar pedido</ion-button>
      </div>
    </div>

    <div class="selector-comensales">
      <button
        *ngFor="let n of comensales()"
        class="chip-comensal"
        [class.activo]="n === comensalActual()"
        (click)="seleccionarComensal(n)"
      >
        <ion-icon name="people-outline"></ion-icon>
        Comensal {{ n }}
      </button>
    </div>

    <div class="estado-vacio" *ngIf="!productos().length">
      <ion-icon name="restaurant-outline"></ion-icon>
      <p>Todavía no hay productos cargados en la carta</p>
    </div>

    <div class="feed" *ngIf="productos().length">
      <article class="pagina-producto" *ngFor="let producto of productos()">
        <span class="etiqueta-categoria">
          <ion-icon [name]="producto.tipo === 'plato' ? 'fast-food-outline' : 'wine-outline'"></ion-icon>
          {{ producto.tipo === 'plato' ? 'Plato' : 'Bebida' }}
        </span>

        <app-carrusel-fotos
          modo="pagina"
          [fotos]="producto.fotos"
          [nombre]="producto.nombre"
        ></app-carrusel-fotos>

        <div class="info-producto-pagina">
          <div class="fila-nombre-precio">
            <h3 class="nombre-producto">{{ producto.nombre }}</h3>
            <span class="precio-producto"><ion-icon name="pricetag-outline"></ion-icon>{{ formatearPrecio(producto.precio) }}</span>
          </div>
          <p class="descripcion-producto">{{ producto.descripcion }}</p>
          <p class="tiempo-producto"><ion-icon name="time-outline"></ion-icon> {{ producto.tiempoElaboracionMinutos }} min</p>

          <div class="stepper">
            <ion-icon
              name="remove-circle-outline"
              [class.deshabilitado]="cantidadDe(producto) === 0"
              (click)="restar(producto)"
            ></ion-icon>
            <span class="cantidad">{{ cantidadDe(producto) }}</span>
            <ion-icon name="add-circle-outline" (click)="sumar(producto)"></ion-icon>
          </div>
        </div>
      </article>
    </div>

    <div class="barra-carrito">
      <div class="resumen-carrito">
        <span class="total-carrito">{{ formatearPrecio(importeAcumulado()) }}</span>
        <span class="tiempo-carrito"><ion-icon name="time-outline"></ion-icon> ~{{ tiempoEstimado() }} min</span>
      </div>
      <ion-button expand="block" [disabled]="enviando() || !carritoItems().length" (click)="confirmarPedido()">
        <ion-icon name="checkmark-circle-outline" slot="start"></ion-icon>
        {{ enviando() ? 'Enviando…' : 'Confirmar pedido' }}
      </ion-button>
    </div>
  </ng-container>

  <!-- Aviso en pantalla (además de la push) cuando el mozo confirma. -->
  <div class="banner-ok" *ngIf="avisoConfirmado()">
    <ion-icon name="checkmark-circle"></ion-icon>
    <span>El mozo confirmó tu pedido</span>
  </div>

  <div class="estado-pedido" *ngIf="fase() === 'esperando' || fase() === 'confirmado'">
    <img src="assets/icon/logo_lamesa.png" alt="LA MESA" class="logo-estado" />
    <ion-spinner *ngIf="fase() === 'esperando'" name="crescent" color="light"></ion-spinner>
    <ion-icon *ngIf="fase() === 'confirmado'" name="checkmark-circle-outline" class="icono-confirmado"></ion-icon>
    <h2>{{ fase() === 'esperando' ? 'Esperando confirmación del mozo…' : '¡Pedido confirmado!' }}</h2>
    <!-- Puntos 16/17: estado de cada sector en vivo (Realtime). Solo
         aparecen los sectores que intervienen en el pedido. -->
    <div class="estado-sectores" *ngIf="fase() === 'confirmado' && pedidoActual() as p">
      <p *ngIf="sectoresPedido().cocina">
        <ion-icon name="fast-food-outline"></ion-icon>
        Cocina: <strong>{{ p.cocinaLista ? 'listo' : 'en preparación' }}</strong>
      </p>
      <p *ngIf="sectoresPedido().bar">
        <ion-icon name="wine-outline"></ion-icon>
        Bar: <strong>{{ p.barListo ? 'listo' : 'en preparación' }}</strong>
      </p>
    </div>
    <div class="resumen-final" *ngIf="pedidoActual() as p">
      <p><ion-icon name="time-outline"></ion-icon> {{ p.tiempoEstimadoMinutos }} min estimados</p>
      <p class="total-final">{{ formatearPrecio(p.importeTotal) }}</p>
    </div>
    <!-- Punto 14: con el pedido confirmado el cliente ya accede a juegos. -->
    <div class="acciones-estado" *ngIf="fase() === 'confirmado'">
      <ion-button expand="block" class="boton-estado" (click)="irAJuegos()">
        <ion-icon name="game-controller-outline" slot="start"></ion-icon>
        Juegos
      </ion-button>
    </div>
  </div>

  <!-- Punto 18/19: cocina y bar terminaron. El botón aparece recién
       cuando el mozo marca que lo entregó (entregadoPorMozo, llega por
       Realtime sin que cambie la fase). -->
  <div class="estado-pedido" *ngIf="fase() === 'completo'">
    <div class="banner-error" *ngIf="mensajeError()">
      <ion-icon name="warning"></ion-icon>
      <span>{{ mensajeError() }}</span>
    </div>

    <img src="assets/icon/logo_lamesa.png" alt="LA MESA" class="logo-estado" />
    <ng-container *ngIf="!pedidoActual()?.entregadoPorMozo; else yaEntregado">
      <ion-spinner name="crescent" color="light"></ion-spinner>
      <h2>¡Tu pedido está listo!</h2>
      <p>El mozo te lo está llevando a la mesa.</p>
    </ng-container>
    <ng-template #yaEntregado>
      <ion-icon name="checkmark-circle-outline" class="icono-confirmado"></ion-icon>
      <h2>El mozo te entregó el pedido</h2>
      <p>Confirmá que lo recibiste para seguir.</p>
    </ng-template>

    <div class="resumen-final" *ngIf="pedidoActual() as p">
      <p class="total-final">{{ formatearPrecio(p.importeTotal) }}</p>
    </div>

    <div class="acciones-estado">
      <ion-button
        *ngIf="pedidoActual()?.entregadoPorMozo"
        expand="block"
        class="boton-estado boton-principal"
        [disabled]="confirmandoRecepcion()"
        (click)="confirmarRecepcion()"
      >
        <ion-icon name="checkmark-done-circle-outline" slot="start"></ion-icon>
        {{ confirmandoRecepcion() ? 'Confirmando…' : 'Confirmar recepción' }}
      </ion-button>
      <ion-button expand="block" class="boton-estado" (click)="irAJuegos()">
        <ion-icon name="game-controller-outline" slot="start"></ion-icon>
        Juegos
      </ion-button>
    </div>
  </div>

  <!-- Punto 19: pedido recibido, se habilitan juegos, encuesta y cuenta.
       La ruta mesa/:mesaId/juegos ya existe (puntos 14/15); encuesta y
       cuenta las agregan los dueños de los puntos 20/21. -->
  <div class="estado-pedido" *ngIf="fase() === 'entregado'">
    <img src="assets/icon/logo_lamesa.png" alt="LA MESA" class="logo-estado" />
    <h2>¡Buen provecho!</h2>
    <p>Mientras disfrutás tu pedido podés jugar, dejarnos tu opinión o pedir la cuenta.</p>

    <div class="acciones-estado">
      <ion-button expand="block" class="boton-estado" (click)="irAJuegos()">
        <ion-icon name="game-controller-outline" slot="start"></ion-icon>
        Juegos
      </ion-button>
      <ion-button expand="block" class="boton-estado" (click)="irAEncuesta()">
        <ion-icon name="clipboard-outline" slot="start"></ion-icon>
        Encuesta
      </ion-button>
      <ion-button expand="block" class="boton-estado" (click)="irACuenta()">
        <ion-icon name="cash-outline" slot="start"></ion-icon>
        Pedir la cuenta
      </ion-button>
    </div>
  </div>

</ion-content>
  `,
  styles: [`
:host {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;

  --crema: #f4eada;
  --marron: #7a3a22;
  --marron-osc: #5b2a17;
  --dorado: #c68a34;
  --texto-gris: #9c9186;
  --rojo-error: #b3261e;
  --verde-ok: #3a7d44;
  color-scheme: only light;
}

ion-content {
  flex: 1 1 auto;
  position: relative;
}

ion-header ion-toolbar {
  --background: var(--marron);
  --color: var(--crema);
}

.fondo-pedido {
  --background: var(--crema);
}
.fondo-pedido::part(background) {
  background-color: var(--crema);
}

.estado-error, .estado-pedido {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  text-align: center;
  box-sizing: border-box;
}

.estado-pedido {
  background: var(--marron-osc);
  color: var(--crema);
  gap: 16px;
  z-index: 25;
}
.logo-estado {
  width: 110px;
  height: 110px;
  border-radius: 50%;
}
.icono-confirmado {
  font-size: 4rem;
  color: #7fd894;
}
.estado-pedido h2 {
  font-family: 'EB Garamond', Georgia, serif;
  margin: 0;
}
.resumen-final {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.estado-sectores {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: rgba(244, 234, 218, 0.12);
  border-radius: 12px;
  padding: 12px 18px;
}
.estado-sectores p {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.05rem;
}
.resumen-final p {
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.total-final {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--dorado);
}

// Puntos 18/19: botones sobre el fondo marrón de .estado-pedido. Dorado y
// no el primary del tema (#9C3B14), que casi no contrasta con ese fondo.
.acciones-estado {
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
}
.boton-estado {
  --background: var(--dorado);
  --color: var(--marron-osc);
  min-height: 52px;
  font-size: 1.05rem;
  font-weight: 700;
}
.boton-principal {
  min-height: 60px;
  font-size: 1.2rem;
}

.estado-vacio {
  position: absolute;
  inset: 56px 0 0 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
  color: var(--texto-gris);
  font-family: 'EB Garamond', Georgia, serif;
  box-sizing: border-box;
}
.estado-vacio ion-icon {
  font-size: 2.5rem;
  color: var(--dorado);
}

.selector-comensales {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 56px;
  z-index: 15;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  overflow-x: auto;
  background: var(--marron);
  box-sizing: border-box;
}
.chip-comensal {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 999px;
  border: none;
  background: rgba(244, 234, 218, 0.18);
  color: var(--crema);
  font-size: 0.85rem;
  font-weight: 600;
}
.chip-comensal.activo {
  background: var(--dorado);
  color: var(--marron-osc);
}

.banner-error {
  position: absolute;
  top: 64px;
  left: 16px;
  right: 16px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--rojo-error);
  color: #fff;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 0.85rem;
}

.feed {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  scrollbar-width: none;
}
.feed::-webkit-scrollbar {
  display: none;
}

.pagina-producto {
  height: 100%;
  scroll-snap-align: start;
  scroll-snap-stop: always;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 72px 16px 16px;
  padding-bottom: calc(150px + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.pagina-producto app-carrusel-fotos {
  display: block;
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
}

.etiqueta-categoria {
  align-self: flex-start;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--marron);
  color: var(--crema);
  padding: 5px 14px;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.info-producto-pagina {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.fila-nombre-precio {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.nombre-producto {
  color: var(--marron-osc);
  font-family: 'EB Garamond', Georgia, serif;
  font-size: 1.4rem;
  font-weight: 700;
  margin: 0;
}

.precio-producto {
  color: var(--marron);
  font-weight: 700;
  font-size: 1.15rem;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.descripcion-producto {
  color: var(--texto-gris);
  font-size: 0.95rem;
  margin: 0;
  line-height: 1.4;
}

.tiempo-producto {
  color: var(--dorado);
  font-size: 0.8rem;
  margin: 2px 0 0;
  display: flex;
  align-items: center;
  gap: 4px;
}

.stepper {
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 14px;
}
.stepper ion-icon {
  font-size: 2.4rem;
  color: var(--marron);
  padding: 6px;
}
.stepper ion-icon.deshabilitado {
  color: var(--texto-gris);
  opacity: 0.5;
}
.stepper .cantidad {
  min-width: 28px;
  text-align: center;
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--marron-osc);
}

.barra-carrito {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 15;
  background: var(--marron-osc);
  padding: 10px 16px calc(12px + env(safe-area-inset-bottom));
  box-sizing: border-box;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.25);
}
.resumen-carrito {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 8px;
  color: var(--crema);
}
.total-carrito {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--dorado);
}
.tiempo-carrito {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.85rem;
}

.banner-ok {
  position: absolute;
  top: 16px;
  left: 16px;
  right: 16px;
  z-index: 30; // por encima de .estado-pedido (25)
  display: flex;
  align-items: center;
  gap: 8px;
  background: #2d7a3e;
  color: #fff;
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 0.95rem;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}
.banner-ok ion-icon {
  font-size: 1.4rem;
}

.aviso-overlay {
  position: fixed;
  inset: 0;
  z-index: 20000;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  box-sizing: border-box;
}
.aviso-card {
  width: 100%;
  max-width: 340px;
  background: var(--crema);
  border-radius: 20px;
  padding: 28px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
}
.aviso-card h2 {
  margin: 0;
  color: var(--marron-osc);
  font-family: 'EB Garamond', Georgia, serif;
  font-size: 1.5rem;
}
.aviso-card p {
  margin: 0 0 8px;
  color: var(--marron);
}
.aviso-card ion-button {
  width: 100%;
}
.aviso-icono {
  font-size: 4rem;
}

.velo-cargando {
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
  width: 140px;
  height: 140px;
  border-radius: 50%;
}
  `],
})
export class PedidoPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly productoService = inject(ProductoService);
  private readonly mesaService = inject(MesaService);
  private readonly pedidoService = inject(PedidoService);
  private readonly notificacionesService = inject(NotificacionesService);
  private readonly mesaId = this.route.snapshot.paramMap.get('mesaId')!;

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly mesa = signal<Mesa | null>(null);
  private readonly carta = signal<ProductoCarta[]>([]);

  protected readonly productos = computed(() => {
    const todos = this.carta();
    return [...todos.filter((p) => p.tipo === 'plato'), ...todos.filter((p) => p.tipo === 'bebida')];
  });

  protected readonly fase = signal<FasePedido>('armando');
  protected readonly enviando = signal(false);
  protected readonly mensajeError = signal('');
  protected readonly comensalActual = signal(1);
  protected readonly pedidoActual = signal<Pedido | null>(null);

  // Punto 13: avisos en pantalla, además de la push del sistema (que solo
  // aparece en la barra de notificaciones y es fácil de no ver).
  protected readonly avisoRechazo = signal(false);
  protected readonly avisoConfirmado = signal(false);

  // Punto 19: evita el doble toque en "Confirmar recepción" mientras
  // viaja el llamado.
  protected readonly confirmandoRecepcion = signal(false);

  // Puntos 16/17: qué sectores intervienen en el pedido (para mostrar
  // "Cocina: ..." / "Bar: ..." solo si corresponde).
  protected readonly sectoresPedido = signal({ cocina: false, bar: false });

  private readonly carritoMapa = signal<Map<string, ItemCarrito>>(new Map());
  protected readonly carritoItems = computed(() => Array.from(this.carritoMapa().values()));
  protected readonly importeAcumulado = computed(() =>
    this.carritoItems().reduce((acc, i) => acc + i.precioUnitario * i.cantidad, 0),
  );
  protected readonly tiempoEstimado = computed(() => {
    const items = this.carritoItems();
    return items.length ? Math.max(...items.map((i) => i.tiempoElaboracionMinutos)) : 0;
  });

  protected readonly comensales = computed(() => {
    const cantidad = this.mesa()?.cantidad_comensales ?? 1;
    return Array.from({ length: cantidad }, (_, i) => i + 1);
  });

  private canalRealtime: ReturnType<PedidoService['escucharConfirmacion']> | null = null;

  constructor() {
    addIcons({
      'fast-food-outline': fastFoodOutline,
      'wine-outline': wineOutline,
      'time-outline': timeOutline,
      'pricetag-outline': pricetagOutline,
      'refresh-outline': refreshOutline,
      'restaurant-outline': restaurantOutline,
      'remove-circle-outline': removeCircleOutline,
      'add-circle-outline': addCircleOutline,
      'checkmark-circle-outline': checkmarkCircleOutline,
      'people-outline': peopleOutline,
      'close-circle': closeCircle,
      'checkmark-circle': checkmarkCircle,
      'checkmark-done-circle-outline': checkmarkDoneCircleOutline,
      'game-controller-outline': gameControllerOutline,
      'clipboard-outline': clipboardOutline,
      'cash-outline': cashOutline,
      warning,
    });
  }

  ngOnInit(): void {
    this.cargarTodo();
  }

  ngOnDestroy(): void {
    this.canalRealtime?.unsubscribe();
    if (this.fase() === 'armando') {
      this.mesaService.liberarPedidoEnCurso(this.mesaId);
    }
  }

  protected async cargarTodo(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const [mesa, carta, pedidoActivo] = await Promise.all([
        this.mesaService.obtenerMesa(this.mesaId),
        this.productoService.obtenerCarta(),
        this.pedidoService.obtenerPedidoActivoDeMesa(this.mesaId),
      ]);
      this.mesa.set(mesa);
      this.carta.set(carta);

      if (pedidoActivo?.estado === 'rechazado') {
        // Punto 13: si el cliente salió de esta pantalla (o cerró la app)
        // y el mozo rechazó el pedido mientras tanto, vuelve a "armando"
        // con los productos del pedido rechazado ya cargados -- antes
        // quedaba trabado en "Esperando confirmación" para siempre.
        await this.cargarCarritoDesde(pedidoActivo.id, carta);
        this.avisoRechazo.set(true);
      } else if (pedidoActivo) {
        this.pedidoActual.set(pedidoActivo);
        if (pedidoActivo.estado === 'pendiente_confirmacion') {
          this.fase.set('esperando');
        } else if (
          pedidoActivo.estado === 'confirmado' ||
          pedidoActivo.estado === 'completo' ||
          pedidoActivo.estado === 'entregado'
        ) {
          this.fase.set(pedidoActivo.estado);
        }
        // Puntos 18/19: se suscribe en cualquier fase, no solo esperando --
        // 'confirmado' ya no es terminal (sigue a 'completo' y
        // 'entregado'), y si el cliente vuelve a entrar con el pedido
        // confirmado tiene que enterarse de esos cambios igual.
        this.suscribirConfirmacion(pedidoActivo.id);
        this.detectarSectores(pedidoActivo.id, carta);
      }
    } catch (e) {
      console.error('No se pudo cargar la mesa/carta', e);
      this.error.set('No pudimos cargar la carta de esta mesa. Probá de nuevo en un momento.');
    } finally {
      this.cargando.set(false);
    }
  }

  private sectoresDe(productoIds: string[], carta: ProductoCarta[]): { cocina: boolean; bar: boolean } {
    const tipos = productoIds.map((id) => carta.find((p) => p.id === id)?.tipo);
    // Todo lo que no es bebida va a cocina (mismo criterio que schema.sql v9).
    return { cocina: tipos.some((t) => t !== 'bebida'), bar: tipos.some((t) => t === 'bebida') };
  }

  private async detectarSectores(pedidoId: string, carta: ProductoCarta[]): Promise<void> {
    try {
      const items = await this.pedidoService.obtenerItems(pedidoId);
      this.sectoresPedido.set(this.sectoresDe(items.map((i) => i.productoId), carta));
    } catch {
      // Sin esto solo no se muestra el detalle por sector; no bloquea nada.
    }
  }

  private async cargarCarritoDesde(pedidoId: string, carta: ProductoCarta[]): Promise<void> {
    try {
      const items = await this.pedidoService.obtenerItems(pedidoId);
      const mapa = new Map<string, ItemCarrito>();
      for (const item of items) {
        const producto = carta.find((p) => p.id === item.productoId);
        if (!producto) continue; // producto dado de baja desde el pedido original
        mapa.set(this.claveItem(item.productoId, item.comensalNumero), {
          productoId: item.productoId,
          nombre: producto.nombre,
          precioUnitario: producto.precio,
          tiempoElaboracionMinutos: producto.tiempoElaboracionMinutos,
          comensalNumero: item.comensalNumero,
          cantidad: item.cantidad,
        });
      }
      this.carritoMapa.set(mapa);
    } catch (e) {
      // Si falla, el cliente arma el pedido de nuevo desde cero -- no es
      // bloqueante, sigue pudiendo pedir.
      console.error('No se pudo recuperar el pedido rechazado', e);
    }
  }

  protected cerrarAvisoRechazo(): void {
    this.avisoRechazo.set(false);
  }

  protected seleccionarComensal(numero: number): void {
    this.comensalActual.set(numero);
  }

  private claveItem(productoId: string, comensalNumero: number): string {
    return `${productoId}-${comensalNumero}`;
  }

  protected cantidadDe(producto: ProductoCarta): number {
    return this.carritoMapa().get(this.claveItem(producto.id, this.comensalActual()))?.cantidad ?? 0;
  }

  protected sumar(producto: ProductoCarta): void {
    this.actualizarCantidad(producto, 1);
  }

  protected restar(producto: ProductoCarta): void {
    this.actualizarCantidad(producto, -1);
  }

  private actualizarCantidad(producto: ProductoCarta, delta: number): void {
    const comensalNumero = this.comensalActual();
    const clave = this.claveItem(producto.id, comensalNumero);
    const mapa = new Map(this.carritoMapa());
    const actual = mapa.get(clave);
    const nuevaCantidad = Math.max(0, (actual?.cantidad ?? 0) + delta);

    if (nuevaCantidad === 0) {
      mapa.delete(clave);
    } else {
      mapa.set(clave, {
        productoId: producto.id,
        nombre: producto.nombre,
        precioUnitario: producto.precio,
        tiempoElaboracionMinutos: producto.tiempoElaboracionMinutos,
        comensalNumero,
        cantidad: nuevaCantidad,
      });
    }
    this.carritoMapa.set(mapa);
  }

  private suscribirConfirmacion(pedidoId: string): void {
    this.canalRealtime?.unsubscribe();
    this.canalRealtime = this.pedidoService.escucharConfirmacion(pedidoId, (pedido) => {
      // Puntos 18/19: además de los cambios de estado llegan UPDATE que
      // solo tocan banderas con el estado igual (cocina_lista/bar_listo
      // en 'confirmado', entregado_por_mozo en 'completo'). pedidoActual
      // se actualiza siempre -- así aparece el botón "Confirmar
      // recepción" -- pero los avisos solo salen cuando cambia la fase,
      // si no se repetían cada vez que terminaba un sector.
      const faseAnterior = this.fase();
      if (pedido.estado !== 'rechazado') {
        this.pedidoActual.set(pedido);
      }

      if (pedido.estado === 'confirmado' && faseAnterior !== 'confirmado') {
        this.fase.set('confirmado');
        this.notificacionesService.avisarPedidoConfirmado(this.mesa()?.numero);
        this.avisoConfirmado.set(true);
        setTimeout(() => this.avisoConfirmado.set(false), 4000);
      } else if (pedido.estado === 'completo' && faseAnterior !== 'completo') {
        this.fase.set('completo');
        this.notificacionesService.avisarPedidoCompleto(this.mesa()?.numero);
      } else if (pedido.estado === 'entregado') {
        this.fase.set('entregado');
      } else if (pedido.estado === 'rechazado') {
        this.notificacionesService.avisarPedidoRechazado(this.mesa()?.numero);
        // El carrito (carritoMapa) sigue en memoria desde que se armó
        // el pedido -- no hace falta reconstruirlo: al volver a
        // "armando" el cliente ya ve sus productos y cantidades
        // cargadas, listos para modificar/agregar/quitar y reenviar.
        this.pedidoActual.set(null);
        this.fase.set('armando');
        this.avisoRechazo.set(true);
        // Se había liberado el lock de la mesa al enviar el pedido
        // (punto 12); como el cliente vuelve a editar, lo retomamos
        // para que otro comensal no arranque un pedido en paralelo.
        this.mesaService.tomarPedidoEnCurso(this.mesaId).catch((e) => {
          console.error('No se pudo retomar el lock de la mesa tras el rechazo', e);
        });
      }
    });
  }

  protected async confirmarPedido(): Promise<void> {
    if (!this.carritoItems().length || this.enviando()) return;
    this.enviando.set(true);
    try {
      const items = this.carritoItems();
      const importeTotal = this.importeAcumulado();
      const tiempoEstimadoMinutos = this.tiempoEstimado();
      const pedidoId = await this.pedidoService.crearPedido(this.mesaId, items);
      this.sectoresPedido.set(this.sectoresDe(items.map((i) => i.productoId), this.carta()));
      await this.mesaService.liberarPedidoEnCurso(this.mesaId);

      this.pedidoActual.set({
        id: pedidoId,
        mesaId: this.mesaId,
        estado: 'pendiente_confirmacion',
        importeTotal,
        tiempoEstimadoMinutos,
        creadoEn: new Date().toISOString(),
        cocinaLista: false,
        barListo: false,
        entregadoPorMozo: false,
      });
      this.fase.set('esperando');
      this.suscribirConfirmacion(pedidoId);
    } catch (e) {
      console.error('No se pudo enviar el pedido', e);
      await this.dispararErrorTransitorio(e instanceof Error ? e.message : 'No se pudo enviar el pedido.');
    } finally {
      this.enviando.set(false);
    }
  }

  // Punto 19: el cliente confirma que recibió el pedido. El pase a
  // 'entregado' llega solo por Realtime (suscribirConfirmacion), no se
  // setea acá.
  protected async confirmarRecepcion(): Promise<void> {
    const pedido = this.pedidoActual();
    if (!pedido || this.confirmandoRecepcion()) return;
    this.confirmandoRecepcion.set(true);
    try {
      await this.pedidoService.confirmarRecepcion(pedido.id);
    } catch (e) {
      console.error('No se pudo confirmar la recepción', e);
      await this.dispararErrorTransitorio(
        e instanceof Error ? e.message : 'No se pudo confirmar la recepción del pedido.',
      );
    } finally {
      this.confirmandoRecepcion.set(false);
    }
  }

  // Puntos 15/20/21: accesos que se habilitan recién con el pedido
  // entregado. Las pantallas las arma cada dueño del punto.
  protected irAJuegos(): void {
    this.router.navigate(['/mesa', this.mesaId, 'juegos']);
  }

  protected irAEncuesta(): void {
    this.router.navigate(['/mesa', this.mesaId, 'encuesta']);
  }

  protected irACuenta(): void {
    this.router.navigate(['/mesa', this.mesaId, 'cuenta']);
  }

  protected formatearPrecio(precio: number): string {
    return precio.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
  }

  private async dispararErrorTransitorio(mensaje: string): Promise<void> {
    this.mensajeError.set(mensaje);
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {
    }
    setTimeout(() => this.mensajeError.set(''), 4000);
  }
}
