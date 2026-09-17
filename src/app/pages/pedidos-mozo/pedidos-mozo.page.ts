import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  refreshOutline,
  warning,
  checkmarkCircleOutline,
  restaurantOutline,
  timeOutline,
} from 'ionicons/icons';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { PedidoService } from '../../core/services/pedido.service';
import { PedidoPendiente } from '../../core/models/pedido.model';

function haceCuanto(fechaIso: string): string {
  const minutos = Math.max(0, Math.round((Date.now() - new Date(fechaIso).getTime()) / 60000));
  if (minutos < 1) return 'recién';
  if (minutos === 1) return 'hace 1 min';
  return `hace ${minutos} min`;
}

@Component({
  selector: 'app-pedidos-mozo',
  templateUrl: './pedidos-mozo.page.html',
  styleUrls: ['./pedidos-mozo.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon],
})
export class PedidosMozoPage {
  readonly pendientes = signal<(PedidoPendiente & { hace: string })[]>([]);
  readonly cargando = signal(false);
  readonly procesandoId = signal<string | null>(null);

  readonly mensajeError = signal('');
  readonly mensajeOk = signal('');

  constructor(private pedidos: PedidoService, private router: Router) {
    addIcons({ arrowBackOutline, refreshOutline, warning, checkmarkCircleOutline, restaurantOutline, timeOutline });
  }

  volver() {
    this.router.navigate(['/home']);
  }

  ionViewWillEnter() {
    this.cargar();
  }

  async cargar() {
    this.cargando.set(true);
    this.mensajeError.set('');
    try {
      const filas = await this.pedidos.listarPendientes();
      this.pendientes.set(filas.map((p) => ({ ...p, hace: haceCuanto(p.creadoEn) })));
    } catch {
      this.dispararError('No se pudo cargar el listado. Reintentá con el botón de refrescar.');
    } finally {
      this.cargando.set(false);
    }
  }

  async confirmar(pedido: PedidoPendiente) {
    this.procesandoId.set(pedido.id);
    try {
      await this.pedidos.confirmarPedido(pedido.id);
      this.pendientes.update((lista) => lista.filter((p) => p.id !== pedido.id));
      this.mensajeOk.set(`Pedido de mesa ${pedido.mesaNumero} confirmado.`);
      setTimeout(() => this.mensajeOk.set(''), 3000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo confirmar el pedido.';
      this.dispararError(msg);
    } finally {
      this.procesandoId.set(null);
    }
  }

  formatearPrecio(precio: number): string {
    return precio.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
  }

  private async dispararError(mensaje: string) {
    this.mensajeError.set(mensaje);
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {
    }
    setTimeout(() => this.mensajeError.set(''), 4000);
  }
}
