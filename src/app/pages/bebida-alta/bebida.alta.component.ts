import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ViewDidEnter } from '@ionic/angular';
import { ProductoAltaComponent, DatosProductoAlta } from '../producto/producto.alta.component';
import { ProductoService } from '../producto/producto.service';
import { Haptics, NotificationType } from '@capacitor/haptics';

/**
 * bebida.alta.component.ts
 * -------------------------
 * Punto 3 del TP (perfil cantinero). Calcado de plato.alta.component.ts —
 * mismo formulario reutilizable (producto.alta.component.ts) y mismo
 * service (producto.service.ts), solo cambia tipo/ruta/perfil.
 *
 * Reescrito de cero (09/2026), mismos tres cambios que en plato.alta:
 *   1) `host: { class: 'ion-page' }` para que el router de Ionic oculte
 *      correctamente la pantalla anterior al entrar acá.
 *   2) `ionViewDidEnter()` dispara un resize cuando la página termina de
 *      entrar — arregla el "formulario a medio pintar" por hidratación
 *      tardía de los custom elements de Ionic en rutas lazy.
 *   3) Caché en localStorage de la lista de bebidas existentes.
 *
 * Ruteo sugerido (ajustar a como esté armado el resto de las rutas):
 *   { path: 'cantinero/bebida-alta', component: BebidaAltaComponent,
 *     canActivate: [guardPerfil(['cantinero'])] }
 */

const CLAVE_CACHE = 'la-mesa:nombres:bebida';
const TTL_CACHE_MS = 5 * 60 * 1000; // 5 minutos.

interface CacheNombres {
  nombres: string[];
  guardadoEn: number;
}

@Component({
  selector: 'app-bebida-alta',
  standalone: true,
  imports: [ProductoAltaComponent],
  host: { class: 'ion-page' },
  template: `
    <app-producto-alta
      tipo="bebida"
      [nombresExistentes]="nombresExistentes()"
      [guardando]="guardando()"
      [errorGuardado]="errorGuardado()"
      (guardar)="alGuardar($event)"
      (cancelar)="alCancelar()"
    />
  `,
})
export class BebidaAltaComponent implements OnInit, ViewDidEnter {
  private readonly productoService = inject(ProductoService);
  private readonly router = inject(Router);

  protected readonly nombresExistentes = signal<string[]>([]);
  protected readonly guardando = signal(false);
  protected readonly errorGuardado = signal<string | null>(null);

  ionViewDidEnter(): void {
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }

  async ngOnInit(): Promise<void> {
    const cache = this.leerCache();
    if (cache) {
      this.nombresExistentes.set(cache.nombres);
    } else {
      this.guardando.set(true);
    }

    try {
      const nombres = await this.productoService.obtenerNombresPorTipo('bebida');
      this.nombresExistentes.set(nombres);
      this.guardarCache(nombres);
    } catch (error) {
      console.error('No se pudieron traer las bebidas existentes', error);
    } finally {
      this.guardando.set(false);
    }
  }

  async alGuardar(datos: DatosProductoAlta): Promise<void> {
    this.guardando.set(true);
    this.errorGuardado.set(null);
    try {
      await this.productoService.crearProducto(datos);
      this.router.navigateByUrl('/cantinero'); // ⚠️ AJUSTAR: ruta real de vuelta
    } catch (error) {
      console.error('No se pudo guardar la bebida', error);
      this.errorGuardado.set('No se pudo guardar la bebida. Probá de nuevo.');
      await this.vibrarError();
    } finally {
      this.guardando.set(false);
    }
  }

  alCancelar(): void {
    this.router.navigateByUrl('/cantinero'); // ⚠️ AJUSTAR: ruta real de vuelta
  }

  private leerCache(): CacheNombres | null {
    try {
      const crudo = localStorage.getItem(CLAVE_CACHE);
      if (!crudo) return null;
      const datos: CacheNombres = JSON.parse(crudo);
      const vencio = Date.now() - datos.guardadoEn > TTL_CACHE_MS;
      return vencio ? null : datos;
    } catch {
      return null;
    }
  }

  private guardarCache(nombres: string[]): void {
    try {
      const datos: CacheNombres = { nombres, guardadoEn: Date.now() };
      localStorage.setItem(CLAVE_CACHE, JSON.stringify(datos));
    } catch {
      // No es crítico si falla.
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