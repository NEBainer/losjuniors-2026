import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { fastFoodOutline, wineOutline, timeOutline, pricetagOutline, refreshOutline, restaurantOutline } from 'ionicons/icons';
import { ProductoService, ProductoCarta } from '../producto/producto.service';
import { CarruselFotosComponent } from './carrusel-fotos.component';
@Component({
  selector: 'app-carta-ver',
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
    <ion-title>La Carta</ion-title>
  </ion-toolbar>
</ion-header>

<ion-content class="fondo-carta">

  <div class="velo-cargando" *ngIf="cargando()">
    <img src="assets/icon/logo_lamesa.png" alt="LA MESA" class="logo-spinner" />
    <ion-spinner name="crescent" color="light"></ion-spinner>
    <p>Cargando…</p>
  </div>

  <div class="contenedor" *ngIf="!cargando()">

    <div class="estado-error" *ngIf="error()">
      <ion-note color="danger">{{ error() }}</ion-note>
      <ion-button fill="outline" size="small" (click)="cargarCarta()">
        <ion-icon name="refresh-outline" slot="start"></ion-icon>
        Reintentar
      </ion-button>
    </div>

    <ng-container *ngIf="!error()">

      <div class="estado-vacio" *ngIf="!platos().length && !bebidas().length">
        <ion-icon name="restaurant-outline"></ion-icon>
        <p>Sin productos todavía</p>
      </div>

      <section class="seccion" *ngIf="platos().length">
        <h2 class="titulo-seccion"><ion-icon name="fast-food-outline"></ion-icon> Platos</h2>
        <article class="tarjeta-producto" *ngFor="let producto of platos()">
          <app-carrusel-fotos [fotos]="producto.fotos" [nombre]="producto.nombre"></app-carrusel-fotos>
          <div class="info-producto">
            <div class="fila-nombre-precio">
              <h3 class="nombre-producto">{{ producto.nombre }}</h3>
              <span class="precio-producto"><ion-icon name="pricetag-outline"></ion-icon>{{ formatearPrecio(producto.precio) }}</span>
            </div>
            <p class="descripcion-producto">{{ producto.descripcion }}</p>
            <p class="tiempo-producto"><ion-icon name="time-outline"></ion-icon> {{ producto.tiempoElaboracionMinutos }} min</p>
          </div>
        </article>
      </section>

      <section class="seccion" *ngIf="bebidas().length">
        <h2 class="titulo-seccion"><ion-icon name="wine-outline"></ion-icon> Bebidas</h2>
        <article class="tarjeta-producto" *ngFor="let producto of bebidas()">
          <app-carrusel-fotos [fotos]="producto.fotos" [nombre]="producto.nombre"></app-carrusel-fotos>
          <div class="info-producto">
            <div class="fila-nombre-precio">
              <h3 class="nombre-producto">{{ producto.nombre }}</h3>
              <span class="precio-producto"><ion-icon name="pricetag-outline"></ion-icon>{{ formatearPrecio(producto.precio) }}</span>
            </div>
            <p class="descripcion-producto">{{ producto.descripcion }}</p>
            <p class="tiempo-producto"><ion-icon name="time-outline"></ion-icon> {{ producto.tiempoElaboracionMinutos }} min</p>
          </div>
        </article>
      </section>

    </ng-container>
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
  color-scheme: only light;
}

ion-content {
  flex: 1 1 auto;
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

.contenedor {
  padding: 16px;
  padding-bottom: 40px;
}

.estado-error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  padding: 14px;
  background: rgba(179, 38, 30, 0.08);
  border: 1px solid var(--rojo-error);
  border-radius: 10px;
  margin-bottom: 16px;
}

.estado-vacio {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
  color: var(--texto-gris);
  font-family: 'EB Garamond', Georgia, serif;
  padding: 40px 20px;
}
.estado-vacio ion-icon {
  font-size: 2.5rem;
  color: var(--dorado);
}

.seccion {
  margin-bottom: 24px;
}

.titulo-seccion {
  color: var(--marron);
  font-family: 'EB Garamond', Georgia, serif;
  font-size: 1.3rem;
  font-weight: 700;
  margin: 0 0 12px;
  padding-bottom: 6px;
  border-bottom: 2px solid var(--dorado);
  display: flex;
  align-items: center;
  gap: 6px;
}

.tarjeta-producto {
  display: flex;
  gap: 12px;
  background: rgba(255, 253, 248, 0.6);
  border: 1px solid rgba(198, 138, 52, 0.3);
  border-radius: 14px;
  padding: 10px;
  margin-bottom: 14px;
}
.tarjeta-producto app-carrusel-fotos {
  flex: 0 0 120px;
  width: 120px;
}

.info-producto {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
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
  font-size: 1.05rem;
  font-weight: 700;
  margin: 0;
}

.precio-producto {
  color: var(--marron);
  font-weight: 700;
  font-size: 0.95rem;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.descripcion-producto {
  color: var(--texto-gris);
  font-size: 0.85rem;
  margin: 0;
  line-height: 1.35;
}

.tiempo-producto {
  color: var(--dorado);
  font-size: 0.8rem;
  margin: 2px 0 0;
  display: flex;
  align-items: center;
  gap: 4px;
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
  width: 96px;
  height: 96px;
  border-radius: 50%;
}
  `],
})
export class CartaVerComponent implements OnInit {
  private readonly productoService = inject(ProductoService);

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  private readonly carta = signal<ProductoCarta[]>([]);

  protected readonly platos = computed(() => this.carta().filter((p) => p.tipo === 'plato'));
  protected readonly bebidas = computed(() => this.carta().filter((p) => p.tipo === 'bebida'));

  constructor() {
    addIcons({
      'fast-food-outline': fastFoodOutline,
      'wine-outline': wineOutline,
      'time-outline': timeOutline,
      'pricetag-outline': pricetagOutline,
      'refresh-outline': refreshOutline,
      'restaurant-outline': restaurantOutline,
    });
  }

  ngOnInit(): void {
    this.cargarCarta();
  }

  protected async cargarCarta(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      const datos = await this.productoService.obtenerCarta();
      this.carta.set(datos);
    } catch (e) {
      console.error('No se pudo cargar la carta', e);
      this.error.set('No pudimos cargar la carta. Probá de nuevo en un momento.');
    } finally {
      this.cargando.set(false);
    }
  }

  protected formatearPrecio(precio: number): string {
    return precio.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
  }
}