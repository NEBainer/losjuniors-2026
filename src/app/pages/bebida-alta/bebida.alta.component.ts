import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ProductoAltaComponent, DatosProductoAlta } from '../producto/producto.alta.component';
import { ProductoService } from '../producto/producto.service';
import { Haptics, NotificationType } from '@capacitor/haptics';

/**
 * bebida.alta.component.ts
 * -------------------------
 * Punto 3 del TP (perfil cantinero). Es la pantalla real que conecta
 * <app-producto-alta tipo="bebida"> con Supabase — el formulario en sí
 * vive en producto.alta.component.ts y se reutiliza tal cual para plato.
 *
 * Ruteo sugerido (ajustar a como esté armado el resto de las rutas):
 *   { path: 'cantinero/bebida-alta', component: BebidaAltaComponent,
 *     canActivate: [guardPerfil(['cantinero'])] }
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
    // Reusamos el mismo spinner-con-logo del guardado para esta espera
    // inicial también — así no hace falta un indicador aparte, y "todas
    // las esperas" quedan cubiertas con la misma pieza.
    this.guardando.set(true);
    try {
      const nombres = await this.productoService.obtenerNombresPorTipo('bebida');
      this.nombresExistentes.set(nombres);
    } catch (error) {
      // Si esto falla, el chequeo de duplicados queda "vacío" (no bloquea
      // el alta) pero no debería tumbar la pantalla — se loguea nomás.
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

  private async vibrarError(): Promise<void> {
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch {
      // Web sin soporte de vibración - no rompe el flujo.
    }
  }
}
