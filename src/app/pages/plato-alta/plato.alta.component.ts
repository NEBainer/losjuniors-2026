import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ProductoAltaComponent, DatosProductoAlta } from '../producto/producto.alta.component';
import { ProductoService } from '../producto/producto.service';
import { Haptics, NotificationType } from '@capacitor/haptics';

/**
 * plato.alta.component.ts
 * -------------------------
 * Punto 2 del TP (perfil cocinero). Calcado de bebida.alta.component.ts —
 * mismo formulario reutilizable (producto.alta.component.ts) y mismo
 * service (producto.service.ts), solo cambia tipo/ruta/perfil.
 *
 * Ruteo sugerido (ajustar a como esté armado el resto de las rutas):
 *   { path: 'cocinero/plato-alta', component: PlatoAltaComponent,
 *     canActivate: [guardPerfil(['cocinero'])] }
 */
@Component({
  selector: 'app-plato-alta',
  standalone: true,
  imports: [ProductoAltaComponent],
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
export class PlatoAltaComponent implements OnInit {
  private readonly productoService = inject(ProductoService);
  private readonly router = inject(Router);

  protected readonly nombresExistentes = signal<string[]>([]);
  protected readonly guardando = signal(false);
  protected readonly errorGuardado = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    // Reusamos el mismo spinner-con-logo del guardado para esta espera
    // inicial también — así no hace falta un indicador aparte, y "todas
    // las esperas" quedan cubiertas con la misma pieza.
    this.guardando.set(true);
    try {
      const nombres = await this.productoService.obtenerNombresPorTipo('plato');
      this.nombresExistentes.set(nombres);
    } catch (error) {
      // Si esto falla, el chequeo de duplicados queda "vacío" (no bloquea
      // el alta) pero no debería tumbar la pantalla — se loguea nomás.
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

  private async vibrarError(): Promise<void> {
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch {
      // Web sin soporte de vibración - no rompe el flujo.
    }
  }
}
