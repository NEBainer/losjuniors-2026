import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
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
} from 'ionicons/icons';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { ProductoService, ProductoCarta } from '../producto/producto.service';
import { MesaService, Mesa } from '../../core/services/mesa.service';
import { PedidoService } from '../../core/services/pedido.service';
import { ItemCarrito, Pedido } from '../../core/models/pedido.model';
import { CarruselFotosComponent } from '../carta/carrusel-fotos.component';

type FasePedido = 'armando' | 'esperando' | 'confirmado';

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

    <div class="barra-carrito" *ngIf="carritoItems().length">
      <div class="resumen-carrito">
        <span class="total-carrito">{{ formatearPrecio(importeAcumulado()) }}</span>
        <span class="tiempo-carrito"><ion-icon name="time-outline"></ion-icon> ~{{ tiempoEstimado() }} min</span>
      </div>
      <ion-button expand="block" [disabled]="enviando()" (click)="confirmarPedido()">
        <ion-icon name="checkmark-circle-outline" slot="start"></ion-icon>
        {{ enviando() ? 'Enviando…' : 'Confirmar pedido' }}
      </ion-button>
    </div>
  </ng-container>

  <div class="estado-pedido" *ngIf="fase() === 'esperando' || fase() === 'confirmado'">
    <img src="assets/icon/logo_lamesa.png" alt="LA MESA" class="logo-estado" />
    <ion-spinner *ngIf="fase() === 'esperando'" name="crescent" color="light"></ion-spinner>
    <ion-icon *ngIf="fase() === 'confirmado'" name="checkmark-circle-outline" class="icono-confirmado"></ion-icon>
    <h2>{{ fase() === 'esperando' ? 'Esperando confirmación del mozo…' : '¡Pedido confirmado!' }}</h2>
    <p *ngIf="fase() === 'confirmado'">Ya se envió a cocina y barra.</p>
    <div class="resumen-final" *ngIf="pedidoActual() as p">
      <p><ion-icon name="time-outline"></ion-icon> {{ p.tiempoEstimadoMinutos }} min estimados</p>
      <p class="total-final">{{ formatearPrecio(p.importeTotal) }}</p>
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
  private readonly productoService = inject(ProductoService);
  private readonly mesaService = inject(MesaService);
  private readonly pedidoService = inject(PedidoService);
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
      warning,
    });
  }

  ngOnInit(): void {
    this.cargarTodo();
  }

  ngOnDestroy(): void {
    this.canalRealtime?.unsubscribe();
    // Si se va de la pantalla sin haber llegado a mandar el pedido (fase
    // 'armando'), libera el lock para que otro comensal pueda entrar a
    // armar el suyo. Si ya confirmó, el lock se liberó en
    // confirmarPedido() -- no hace falta repetirlo acá.
    if (this.fase() === 'armando') {
      this.mesaService.liberarPedidoEnCurso(this.mesaId);
    }
  }

  protected async cargarTodo(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const [mesa, carta] = await Promise.all([
        this.mesaService.obtenerMesa(this.mesaId),
        this.productoService.obtenerCarta(),
      ]);
      this.mesa.set(mesa);
      this.carta.set(carta);
    } catch (e) {
      console.error('No se pudo cargar la mesa/carta', e);
      this.error.set('No pudimos cargar la carta de esta mesa. Probá de nuevo en un momento.');
    } finally {
      this.cargando.set(false);
    }
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

  protected async confirmarPedido(): Promise<void> {
    if (!this.carritoItems().length || this.enviando()) return;
    this.enviando.set(true);
    try {
      const items = this.carritoItems();
      const importeTotal = this.importeAcumulado();
      const tiempoEstimadoMinutos = this.tiempoEstimado();
      const pedidoId = await this.pedidoService.crearPedido(this.mesaId, items);
      // Pedido ya registrado -- se puede liberar el lock, ya cumplió su
      // función (evitar que se arme más de un pedido en simultáneo).
      await this.mesaService.liberarPedidoEnCurso(this.mesaId);

      this.pedidoActual.set({
        id: pedidoId,
        mesaId: this.mesaId,
        estado: 'pendiente_confirmacion',
        importeTotal,
        tiempoEstimadoMinutos,
        creadoEn: new Date().toISOString(),
      });
      this.fase.set('esperando');

      this.canalRealtime = this.pedidoService.escucharConfirmacion(pedidoId, (pedido) => {
        this.pedidoActual.set(pedido);
        if (pedido.estado === 'confirmado') {
          this.fase.set('confirmado');
        }
      });
    } catch (e) {
      console.error('No se pudo enviar el pedido', e);
      await this.dispararErrorTransitorio(e instanceof Error ? e.message : 'No se pudo enviar el pedido.');
    } finally {
      this.enviando.set(false);
    }
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
