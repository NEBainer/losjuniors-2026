import { Component, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  refreshOutline,
  warning,
  checkmarkCircleOutline,
  fastFoodOutline,
  wineOutline,
  timeOutline,
  checkmarkDoneCircle,
} from 'ionicons/icons';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { PedidoService } from '../../core/services/pedido.service';
import { UsuariosService } from '../../core/services/usuarios.service';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { PedidoSector, Sector } from '../../core/models/pedido.model';

type GrupoMesa = { mesaNumero: number; pedidos: PedidoSector[] };

// Puntos 16/17: listado de pedidos pendientes de cocina (cocinero) o de
// bar (cantinero). Muestra mesa, fecha con hora y minutos, y los ítems a
// preparar (nombre y cantidad), agrupados por número de mesa.
@Component({
  selector: 'app-pedidos-sector',
  templateUrl: './pedidos-sector.page.html',
  styleUrls: ['./pedidos-sector.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon],
})
export class PedidosSectorPage {
  readonly sector = signal<Sector>('cocina');
  readonly pedidos = signal<PedidoSector[]>([]);
  readonly cargando = signal(false);
  readonly procesandoId = signal<string | null>(null);
  readonly mensajeError = signal('');
  readonly mensajeOk = signal('');

  // El service ya los devuelve ordenados por mesa; acá solo se juntan los
  // de la misma mesa en un mismo bloque.
  readonly grupos = computed<GrupoMesa[]>(() => {
    const grupos: GrupoMesa[] = [];
    for (const pedido of this.pedidos()) {
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.mesaNumero === pedido.mesaNumero) {
        ultimo.pedidos.push(pedido);
      } else {
        grupos.push({ mesaNumero: pedido.mesaNumero, pedidos: [pedido] });
      }
    }
    return grupos;
  });

  constructor(
    private pedidoService: PedidoService,
    private usuariosService: UsuariosService,
    private notificacionesService: NotificacionesService,
    private router: Router,
  ) {
    addIcons({
      arrowBackOutline, refreshOutline, warning, checkmarkCircleOutline, fastFoodOutline,
      wineOutline, timeOutline, checkmarkDoneCircle,
    });
  }

  async ionViewWillEnter() {
    const perfil = await this.usuariosService.getPerfilActual();
    this.sector.set(perfil === 'cantinero' ? 'bar' : 'cocina');
    // Mientras esta pantalla está abierta, cualquier cambio en pedidos
    // (el mozo confirma uno nuevo, etc.) recarga el listado solo.
    this.notificacionesService.iniciarEscuchaSector(this.sector(), () => this.cargar(false));
    await this.cargar();
  }

  ionViewWillLeave() {
    // Sigue escuchando para la push (la arrancó el home), pero ya sin
    // recargar esta pantalla.
    this.notificacionesService.iniciarEscuchaSector(this.sector());
  }

  volver() {
    this.router.navigate(['/home']);
  }

  async cargar(mostrarCargando = true) {
    if (mostrarCargando) this.cargando.set(true);
    try {
      this.pedidos.set(await this.pedidoService.listarParaSector(this.sector()));
    } catch {
      this.dispararError('No se pudo cargar el listado. Reintentá con el botón de refrescar.');
    } finally {
      this.cargando.set(false);
    }
  }

  // El sector terminó su parte (marcar_sector_listo, schema.sql v9). El
  // cliente ve el cambio de estado en vivo en su pantalla de pedido, y si
  // ya terminaron todos los sectores el pedido pasa a 'completo' y le
  // llega al mozo para entregar (punto 18).
  async marcarListo(pedido: PedidoSector) {
    this.procesandoId.set(pedido.id);
    try {
      await this.pedidoService.marcarSectorListo(pedido.id, this.sector());
      this.pedidos.update((lista) => lista.filter((p) => p.id !== pedido.id));
      this.mensajeOk.set(`Mesa ${pedido.mesaNumero} lista.`);
      setTimeout(() => this.mensajeOk.set(''), 3000);
    } catch (e: unknown) {
      this.dispararError(e instanceof Error ? e.message : 'No se pudo actualizar el pedido.');
    } finally {
      this.procesandoId.set(null);
    }
  }

  formatearFecha(fechaIso: string): string {
    return new Date(fechaIso).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
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
