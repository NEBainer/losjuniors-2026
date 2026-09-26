import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonContent,
  IonSpinner,
  IonNote,
  IonButton,
  IonIcon,
  IonFab,
  IonFabButton,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  fastFoodOutline,
  wineOutline,
  timeOutline,
  pricetagOutline,
  refreshOutline,
  restaurantOutline,
  receiptOutline,
  personOutline,
  warning,
  chatbubbleEllipsesOutline,
} from 'ionicons/icons';
import { ProductoService, ProductoCarta } from '../producto/producto.service';
import { MesaService } from '../../core/services/mesa.service';
import { CarruselFotosComponent } from './carrusel-fotos.component';
import { NotificacionesService } from '../../core/services/notificaciones.service';

@Component({
  selector: 'app-carta-ver',
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonContent,
    IonSpinner,
    IonNote,
    IonButton,
    IonIcon,
    IonFab,
    IonFabButton,
    CarruselFotosComponent,
  ],
  host: { class: 'ion-page' },
  template: `
<ion-header>
  <ion-toolbar>
    <ion-title>La Carta</ion-title>
    <ion-buttons slot="end">
      <ion-button *ngIf="mesaId() && !pedidoEnCurso()" fill="clear" [disabled]="tomandoLock()" (click)="crearPedido()">
        <ion-icon name="receipt-outline" slot="start"></ion-icon>
        Pedido
      </ion-button>
      <div class="badge-pedido-en-curso" *ngIf="pedidoEnCurso()">
        <ion-icon name="person-outline"></ion-icon>
        <span>{{ pedidoEnCurso() }}</span>
      </div>
    </ion-buttons>
  </ion-toolbar>
</ion-header>

<!-- scrollY desactivado: el feed de abajo maneja su propio scroll con
     scroll-snap (correcciones-profesor 13-09: "cada producto ocupa toda
     la pantalla, formato página; scroll vertical pasa al
     siguiente/anterior producto"). -->
<ion-content class="fondo-carta" [scrollY]="false">

  <div class="banner-error" *ngIf="mensajeError()">
    <ion-icon name="warning"></ion-icon>
    <span>{{ mensajeError() }}</span>
  </div>

  <div class="velo-cargando" *ngIf="cargando()">
    <img src="assets/icon/logo_lamesa.png" alt="LA MESA" class="logo-spinner" />
    <ion-spinner name="crescent" color="light"></ion-spinner>
    <p>Cargando…</p>
  </div>

  <div class="estado-error" *ngIf="!cargando() && error()">
    <ion-note color="danger">{{ error() }}</ion-note>
    <ion-button fill="outline" size="small" (click)="cargarCarta()">
      <ion-icon name="refresh-outline" slot="start"></ion-icon>
      Reintentar
    </ion-button>
  </div>

  <div class="estado-vacio" *ngIf="!cargando() && !error() && !productos().length">
    <ion-icon name="restaurant-outline"></ion-icon>
    <p>Sin productos todavía</p>
  </div>

  <!-- Un producto = una página completa. Scroll vertical con snap pasa al
       siguiente/anterior; el swipe horizontal sobre la foto (adentro de
       app-carrusel-fotos) pasa a la siguiente/anterior imagen de ESE
       producto, sin interferir con el scroll de la página. -->
  <div class="feed" *ngIf="!cargando() && !error() && productos().length">
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
      </div>
    </article>
  </div>

  <!-- Punto 11: solo aparece cuando se conoce el número de mesa, o sea
       cuando se entró por 'mesa/:numero/carta' (QR) -- la ruta vieja
       'carta/:mesaId' (acceso directo con uuid) no tiene número para
       armar el link de "consultar al mozo". -->
  @if (mesaNumero !== null) {
    <ion-fab class="fab-consultar-mozo" vertical="bottom" horizontal="end" slot="fixed">
      <ion-fab-button (click)="irAConsultarMozo()" [class.con-respuestas]="respuestasSinLeer() > 0">
        <ion-icon name="chatbubble-ellipses-outline"></ion-icon>
      </ion-fab-button>
      @if (respuestasSinLeer() > 0) {
        <span class="badge-respuestas" aria-label="Respuestas sin leer del mozo">{{ respuestasSinLeer() }}</span>
      }
    </ion-fab>
  }

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
  // Contenedor de posicionamiento para .feed/.estado-error/.estado-vacio
  // (position:absolute; inset:0).
  position: relative;
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

.estado-error {
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

.estado-vacio {
  position: absolute;
  inset: 0;
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

/* Feed vertical tipo "página" (correcciones-profesor 13-09): cada
   producto ocupa el 100% del alto disponible y el scroll con snap pasa
   al siguiente/anterior, uno a la vez -- como Reels/TikTok pero para el
   menú. El swipe horizontal de fotos (adentro de app-carrusel-fotos) es
   independiente de este scroll vertical. */
.feed {
  // position:absolute + inset:0 en vez de height:100% -- probado en
  // dispositivo real: ion-content con [scrollY]="false" no le da una
  // altura definida a su wrapper interno, así que un height:100% acá
  // colapsaba al alto del contenido en vez de llenar la pantalla. Con
  // position:absolute alcanza con que ion-content (el host, no su scroll
  // interno) sea el contenedor de posicionamiento -- eso sí tiene la
  // altura real asignada por flex más arriba.
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
  padding: 16px;
  // El contenido llegaba hasta abajo de todo, tapado por la barra de
  // gestos de Android (probado en dispositivo real) -- el box-sizing:
  // border-box hace que este padding le reste alto a la foto (que se
  // adapta sola, es la única flexible) en vez de desbordar la página.
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

// app-carrusel-fotos es un componente Angular (etiqueta HTML propia), no
// un <div> -- sin esto, el navegador lo trata como display:inline y el
// hijo flex real de .pagina-producto queda sin ningún tamaño definido.
// Los estilos de flex puestos solo en el <div class="marco-foto"> de
// ADENTRO del componente no alcanzan: ese div necesita que SU padre
// (esta etiqueta) tenga una altura ya resuelta para poder llenarla al
// 100% (probado en dispositivo real: cada foto, según su relación de
// aspecto natural, terminaba ocupando un tamaño distinto).
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

.badge-pedido-en-curso {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(244, 234, 218, 0.18);
  color: var(--crema);
  font-size: 0.85rem;
  font-weight: 600;
  max-width: 160px;
}
.badge-pedido-en-curso span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.banner-error {
  position: absolute;
  top: 12px;
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

ion-fab-button {
  --background: var(--marron);
  --color: var(--crema);
  --box-shadow: 0 4px 10px rgba(91, 42, 23, 0.35);
}

// Probado en dispositivo real (gestos de Android): pegado al borde,
// ion-fab quedaba justo debajo de la barra de gestos del sistema y
// costaba tocarlo. 20px de aire además del safe-area, no solo el inset.
.fab-consultar-mozo {
  margin-bottom: calc(20px + env(safe-area-inset-bottom));
  margin-right: 4px;

  ion-fab-button.con-respuestas {
    animation: latido-respuesta 1.4s ease-in-out infinite;
  }

  .badge-respuestas {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 24px;
    height: 24px;
    padding: 0 6px;
    border-radius: 12px;
    background: var(--rojo-error);
    color: #fff;
    font-size: 0.8rem;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid var(--crema);
    pointer-events: none;
    z-index: 2;
  }
}

@keyframes latido-respuesta {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.12); }
}

@media (prefers-reduced-motion: reduce) {
  .fab-consultar-mozo ion-fab-button.con-respuestas {
    animation: none;
  }
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
export class CartaVerComponent implements OnInit, OnDestroy {
  private readonly productoService = inject(ProductoService);
  private readonly mesaService = inject(MesaService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notificacionesService = inject(NotificacionesService);

  protected readonly respuestasSinLeer = this.notificacionesService.respuestasSinLeer;

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  private readonly carta = signal<ProductoCarta[]>([]);

  // Se completa resolviendo la mesa, sea por 'carta/:mesaId' (uuid
  // directo) o por 'mesa/:numero/carta' (punto 11, QR). mesaNumero solo
  // se conoce en el segundo caso -- lo necesita irAConsultarMozo() para
  // armar la ruta 'mesa/:numero/consulta-mozo'.
  protected readonly mesaId = signal<string | null>(null);
  protected mesaNumero: number | null = null;

  // Punto 12 (nuevo enfoque): lock de armado de pedido por mesa. null =
  // libre; con nombre = alguien ya está adentro armando el suyo.
  protected readonly pedidoEnCurso = signal<string | null>(null);
  protected readonly tomandoLock = signal(false);
  protected readonly mensajeError = signal('');
  private canalLock: ReturnType<MesaService['escucharPedidoEnCurso']> | null = null;

  // Un solo feed (platos primero, bebidas después) en vez de dos listados
  // separados: el formato "página" pide un scroll vertical continuo que
  // pase de un producto al siguiente, no una lista agrupada por sección
  // (correcciones-profesor 13-09). La categoría de cada uno se distingue
  // con la etiqueta que se ve en cada página, no con un título de sección.
  protected readonly productos = computed(() => {
    const todos = this.carta();
    return [...todos.filter((p) => p.tipo === 'plato'), ...todos.filter((p) => p.tipo === 'bebida')];
  });

  constructor() {
    addIcons({
      'fast-food-outline': fastFoodOutline,
      'wine-outline': wineOutline,
      'time-outline': timeOutline,
      'pricetag-outline': pricetagOutline,
      'refresh-outline': refreshOutline,
      'restaurant-outline': restaurantOutline,
      'receipt-outline': receiptOutline,
      'person-outline': personOutline,
      warning,
      'chatbubble-ellipses-outline': chatbubbleEllipsesOutline,
    });
  }

  ngOnInit(): void {
    this.cargarCarta();
    this.resolverMesa();
  }

  ngOnDestroy(): void {
    this.canalLock?.unsubscribe();
  }

  // Resuelve la mesa sea cual sea la ruta por la que se entró: con
  // 'numero' (punto 11, QR) busca por buscarPorNumero(); con 'mesaId'
  // (ruta vieja 'carta/:mesaId', acceso directo) trae la mesa por id
  // directo. Una vez resuelta, arranca el lock de pedido en curso (punto
  // 12) -- estado inicial + Realtime de cambios futuros.
  private async resolverMesa(): Promise<void> {
    const numeroParam = this.route.snapshot.paramMap.get('numero');
    const mesaIdParam = this.route.snapshot.paramMap.get('mesaId');

    try {
      const mesa = numeroParam
        ? await this.mesaService.buscarPorNumero(Number(numeroParam))
        : mesaIdParam
          ? await this.mesaService.obtenerMesa(mesaIdParam)
          : null;

      if (!mesa) return;

      this.mesaId.set(mesa.id);
      this.mesaNumero = mesa.numero;
      // A 'mesa/:numero/carta' solo llega el cliente vinculado (desde el
      // home o, el anónimo, desde la lista de espera, que no pasa por el
      // home): se arranca acá también la escucha de respuestas del mozo.
      if (numeroParam) {
        this.notificacionesService.iniciarEscuchaRespuestasCliente();
      }
      this.pedidoEnCurso.set(mesa.pedido_en_armado_por);
      this.canalLock = this.mesaService.escucharPedidoEnCurso(mesa.id, (nombre) => {
        this.pedidoEnCurso.set(nombre);
      });
    } catch {
      // Sin mesa resuelta, ni el FAB de "consultar al mozo" ni el botón
      // de "Crear pedido" hacen nada -- no es un error bloqueante para
      // ver el menú.
    }
  }

  protected irAConsultarMozo(): void {
    if (this.mesaNumero === null) return;
    this.router.navigate(['/mesa', this.mesaNumero, 'consulta-mozo']);
  }

  protected async crearPedido(): Promise<void> {
    const mesaId = this.mesaId();
    if (!mesaId || this.tomandoLock() || this.pedidoEnCurso()) return;
    this.tomandoLock.set(true);
    try {
      const obtuvoLock = await this.mesaService.tomarPedidoEnCurso(mesaId);
      if (obtuvoLock) {
        this.router.navigate(['/mesa', mesaId, 'pedido']);
      }
      // Si no lo obtuvo, alguien lo tomó una fracción de segundo antes --
      // el mensaje "Fulano está armando el pedido" ya aparece solo por
      // Realtime, no hace falta avisar nada más acá.
    } catch (e) {
      console.error('No se pudo iniciar el pedido', e);
      this.dispararErrorTransitorio(e instanceof Error ? e.message : 'No se pudo iniciar el pedido.');
    } finally {
      this.tomandoLock.set(false);
    }
  }

  private dispararErrorTransitorio(mensaje: string): void {
    this.mensajeError.set(mensaje);
    setTimeout(() => this.mensajeError.set(''), 4000);
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
