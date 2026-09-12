import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ViewDidEnter } from '@ionic/angular';
import { ProductoAltaComponent, DatosProductoAlta } from '../producto/producto.alta.component';
import { ProductoService } from '../producto/producto.service';
import { Haptics, NotificationType } from '@capacitor/haptics';

/**
 * plato.alta.component.ts
 * -------------------------
 * Punto 2 del TP (perfil cocinero). Es la pantalla real que conecta
 * <app-producto-alta tipo="plato"> con Supabase — el formulario en sí
 * vive en producto.alta.component.ts y se reutiliza tal cual para bebida.
 *
 * Reescrito de cero (09/2026), con tres cambios respecto a la primera
 * versión:
 *   1) `host: { class: 'ion-page' }` — sin esto, el router de Ionic no
 *      puede identificar este componente como "una página" y no le aplica
 *      `ion-page-hidden` a las pantallas anteriores al navegar acá, así
 *      que quedan todas superpuestas en el DOM (confirmado con el
 *      inspector: sin esto, login/home quedaban visibles debajo).
 *   2) `ionViewDidEnter()` (ciclo de vida propio de Ionic, no de Angular)
 *      dispara un resize apenas la página termina de entrar en pantalla.
 *      Es el arreglo real del bug de "formulario a medio pintar" que
 *      veíamos en el primer video — los custom elements de Ionic
 *      (ion-item, ion-icon) en una ruta con lazy-loading a veces terminan
 *      de hidratarse recién ahí, más tarde que `ngAfterViewInit` de
 *      Angular (por eso ese primer intento no alcanzaba).
 *   3) Caché en localStorage de la lista de nombres existentes, para que
 *      el formulario no tenga que esperar a Supabase cada vez que se
 *      entra y se sale rápido de esta pantalla.
 *
 * Ruteo sugerido (ajustar a como esté armado el resto de las rutas):
 *   { path: 'cocinero/plato-alta', component: PlatoAltaComponent,
 *     canActivate: [guardPerfil(['cocinero'])] }
 */

const CLAVE_CACHE = 'la-mesa:nombres:plato';
const TTL_CACHE_MS = 5 * 60 * 1000; // 5 minutos.

interface CacheNombres {
  nombres: string[];
  guardadoEn: number;
}

@Component({
  selector: 'app-plato-alta',
  standalone: true,
  imports: [ProductoAltaComponent],
  host: { class: 'ion-page' },
  template: `
    <app-producto-alta
      tipo="plato"
      [nombresExistentes]="nombresExistentes()"
      [guardando]="guardando()"
      [errorGuardado]="errorGuardado()"
      (guardar)="alGuardar($event)"
      (cancelar)="alCancelar()"
    />
  `,
})
export class PlatoAltaComponent implements OnInit, ViewDidEnter {
  private readonly productoService = inject(ProductoService);
  private readonly router = inject(Router);

  protected readonly nombresExistentes = signal<string[]>([]);
  protected readonly guardando = signal(false);
  protected readonly errorGuardado = signal<string | null>(null);

  /**
   * Se dispara cuando Ionic termina la transición de entrada de la página
   * (más tarde y más confiable que ngAfterViewInit de Angular). Forzamos
   * un resize para que los custom elements de Ionic que hayan quedado
   * "a medio hidratar" en el primer paint recalculen su layout.
   */
  ionViewDidEnter(): void {
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }

  async ngOnInit(): Promise<void> {
    // 1) Si hay caché vigente, la mostramos ya mismo — así el formulario no
    //    arranca con el spinner tapando todo mientras esperamos Supabase.
    const cache = this.leerCache();
    if (cache) {
      this.nombresExistentes.set(cache.nombres);
    } else {
      this.guardando.set(true);
    }

    // 2) Igual refrescamos siempre contra Supabase (haya caché o no), para
    //    que el chequeo de duplicados nunca quede desactualizado mucho
    //    tiempo — la caché es solo para la primera pintada, no la fuente
    //    de verdad.
    try {
      const nombres = await this.productoService.obtenerNombresPorTipo('plato');
      this.nombresExistentes.set(nombres);
      this.guardarCache(nombres);
    } catch (error) {
      console.error('No se pudieron traer los platos existentes', error);
      // Si falló y no teníamos caché, el chequeo de duplicados queda
      // "vacío" pero no bloqueamos el alta por esto.
    } finally {
      this.guardando.set(false);
    }
  }

  async alGuardar(datos: DatosProductoAlta): Promise<void> {
    this.guardando.set(true);
    this.errorGuardado.set(null);
    try {
      await this.productoService.crearProducto(datos);
      this.router.navigateByUrl('/cocinero'); // ⚠️ AJUSTAR: ruta real de vuelta
    } catch (error) {
      console.error('No se pudo guardar el plato', error);
      this.errorGuardado.set('No se pudo guardar el plato. Probá de nuevo.');
      await this.vibrarError();
    } finally {
      this.guardando.set(false);
    }
  }

  alCancelar(): void {
    this.router.navigateByUrl('/cocinero'); // ⚠️ AJUSTAR: ruta real de vuelta
  }

  private leerCache(): CacheNombres | null {
    try {
      const crudo = localStorage.getItem(CLAVE_CACHE);
      if (!crudo) return null;
      const datos: CacheNombres = JSON.parse(crudo);
      const vencio = Date.now() - datos.guardadoEn > TTL_CACHE_MS;
      return vencio ? null : datos;
    } catch {
      return null; // localStorage no disponible o dato corrupto — seguimos sin caché.
    }
  }

  private guardarCache(nombres: string[]): void {
    try {
      const datos: CacheNombres = { nombres, guardadoEn: Date.now() };
      localStorage.setItem(CLAVE_CACHE, JSON.stringify(datos));
    } catch {
      // Cuota llena / modo privado — seguimos sin caché, no es crítico.
    }
  }

  private async vibrarError(): Promise<void> {
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch {
      // Web sin soporte de vibración - no rompe el flujo.
    }
  }
}