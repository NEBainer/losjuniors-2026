import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ViewDidEnter } from '@ionic/angular';
import { ProductoAltaComponent, DatosProductoAlta } from '../producto/producto.alta.component';
import { ProductoService } from '../producto/producto.service';
import { Haptics, NotificationType } from '@capacitor/haptics';

const CLAVE_CACHE = 'la-mesa:nombres:plato';
const TTL_CACHE_MS = 5 * 60 * 1000; 

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
      const nombres = await this.productoService.obtenerNombresPorTipo('plato');
      this.nombresExistentes.set(nombres);
      this.guardarCache(nombres);
    } catch (error) {
      console.error('No se pudieron traer los platos existentes', error);
    } finally {
      this.guardando.set(false);
    }
  }

  async alGuardar(datos: DatosProductoAlta): Promise<void> {
    this.guardando.set(true);
    this.errorGuardado.set(null);
    try {
      await this.productoService.crearProducto(datos);
      this.router.navigate(['/home']);
    } catch (error) {
      console.error('No se pudo guardar el plato', error);
      this.errorGuardado.set('No se pudo guardar el plato. Probá de nuevo.');
      await this.vibrarError();
    } finally {
      this.guardando.set(false);
    }
  }

  alCancelar(): void {
    this.router.navigate(['/home']);
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
    }
  }

  private async vibrarError(): Promise<void> {
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch {
    }
  }
}