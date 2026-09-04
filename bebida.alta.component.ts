import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ProductoAltaComponent, DatosProductoAlta } from '../producto/producto.alta.component';
import { ProductoService } from '../producto/producto.service';
import { Haptics, NotificationType } from '@capacitor/haptics';

/**
 * Punto 3 del TP (perfil cantinero). Es la pantalla real que conecta
 * <app-producto-alta tipo="bebida"> con Supabase — el formulario en sí
 * vive en producto.alta.component.ts y se reutiliza tal cual para plato.
 */

@Component({
  selector: 'app-bebida-alta',
  standalone: true,
  imports: [ProductoAltaComponent],
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
export class BebidaAltaComponent implements OnInit {
  private readonly productoService = inject(ProductoService);
  private readonly router = inject(Router);

  protected readonly nombresExistentes = signal<string[]>([]);
  protected readonly guardando = signal(false);
  protected readonly errorGuardado = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    this.guardando.set(true);
    try {
      const nombres = await this.productoService.obtenerNombresPorTipo('bebida');
      this.nombresExistentes.set(nombres);
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
      this.router.navigateByUrl('/cantinero'); // AJUSTAR: ruta real de vuelta
    } catch (error) {
      console.error('No se pudo guardar la bebida', error);
      this.errorGuardado.set('No se pudo guardar la bebida. Probá de nuevo.');
      await this.vibrarError();
    } finally {
      this.guardando.set(false);
    }
  }

  alCancelar(): void {
    this.router.navigateByUrl('/cantinero'); //  AJUSTAR: ruta real de vuelta
  }

  private async vibrarError(): Promise<void> {
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch {
    }
  }
}
