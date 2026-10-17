import { Component, signal, computed } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  refreshOutline,
  warning,
  checkmarkCircleOutline,
  checkmarkCircle,
  closeCircle,
  restaurantOutline,
  timeOutline,
  checkmarkDoneCircle,
  checkmarkDoneCircleOutline,
  closeCircleOutline,
  cashOutline,
} from 'ionicons/icons';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { PedidoService } from '../../core/services/pedido.service';
import { PedidoPendiente } from '../../core/models/pedido.model';

//Funcion vieja
// function haceCuanto(fechaIso: string): string {
//   const minutos = Math.max(0, Math.round((Date.now() - new Date(fechaIso).getTime()) / 60000));
//   if (minutos < 1) return 'recién';
//   if (minutos === 1) return 'hace 1 min';
//   return `hace ${minutos} min`;
// }

//funcion nueva
function haceCuanto(fechaIso: string): string {
  const minutos = Math.max(0, Math.round((Date.now() - new Date(fechaIso).getTime()) / 60000));
  if (minutos < 1) return 'recién';
  if (minutos < 60) return minutos === 1 ? 'hace 1 min' : `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'hace 1 día' : `hace ${dias} días`;
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
  // Punto 18: pedidos 'completo' (cocina y bar terminaron) que el mozo
  // todavía no llevó a la mesa.
  readonly listos = signal<(PedidoPendiente & { hace: string })[]>([]);
  readonly cargando = signal(false);
  readonly procesandoId = signal<string | null>(null);
  // Pestaña visible: viene del home (?vista=pendientes|listos) según qué
  // sección tocó el mozo.
  readonly vista = signal<'pendientes' | 'listos'>('pendientes');
  readonly visibles = computed(() => (this.vista() === 'pendientes' ? this.pendientes() : this.listos()));

  readonly mensajeError = signal('');
  readonly mensajeOk = signal('');

  constructor(private pedidos: PedidoService, private router: Router, private route: ActivatedRoute) {
    addIcons({ arrowBackOutline, refreshOutline, warning, checkmarkCircleOutline, checkmarkCircle, closeCircle, restaurantOutline, timeOutline, checkmarkDoneCircle, checkmarkDoneCircleOutline, closeCircleOutline, cashOutline });
  }

  volver() {
    this.router.navigate(['/home']);
  }

  ionViewWillEnter() {
    this.vista.set(this.route.snapshot.queryParamMap.get('vista') === 'listos' ? 'listos' : 'pendientes');
    this.cargar();
  }

  async cargar() {
    this.cargando.set(true);
    this.mensajeError.set('');
    try {
      const [filas, filasListos] = await Promise.all([
        this.pedidos.listarPendientes(),
        this.pedidos.listarListosParaEntregar(),
      ]);
      this.pendientes.set(filas.map((p) => ({ ...p, hace: haceCuanto(p.creadoEn) })));
      this.listos.set(filasListos.map((p) => ({ ...p, hace: haceCuanto(p.creadoEn) })));
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

  async rechazar(pedido: PedidoPendiente) {
    this.procesandoId.set(pedido.id);
    try {
      await this.pedidos.rechazarPedido(pedido.id);
      this.pendientes.update((lista) => lista.filter((p) => p.id !== pedido.id));
      this.mensajeOk.set(`Pedido de mesa ${pedido.mesaNumero} rechazado.`);
      setTimeout(() => this.mensajeOk.set(''), 3000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo rechazar el pedido.';
      this.dispararError(msg);
    } finally {
      this.procesandoId.set(null);
    }
  }

  // Punto 19: el mozo llevó el pedido a la mesa. El cliente ve aparecer
  // el botón "Confirmar recepción" por Realtime (PedidoPage).
  async entregar(pedido: PedidoPendiente) {
    this.procesandoId.set(pedido.id);
    try {
      await this.pedidos.marcarEntregado(pedido.id);
      this.listos.update((lista) => lista.filter((p) => p.id !== pedido.id));
      this.mensajeOk.set(`Pedido de mesa ${pedido.mesaNumero} entregado.`);
      setTimeout(() => this.mensajeOk.set(''), 3000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo marcar el pedido como entregado.';
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
