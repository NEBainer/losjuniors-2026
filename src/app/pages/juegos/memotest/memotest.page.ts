import { Component, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowBackOutline, warning, restaurantOutline } from 'ionicons/icons';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { JuegosService } from '../../../core/services/juegos.service';
import { ProductoService } from '../../producto/producto.service';
import { ContextoJuego, PORCENTAJE_POR_JUEGO, ResultadoPartida } from '../../../core/models/juego.model';
import { ResultadoJuegoComponent } from '../resultado-juego.component';
import { mezclar } from '../juegos.logica';
import {
  EstadoMemotest, ImagenMemotest, MAX_MOVIMIENTOS, PARES_MEMOTEST, darVuelta, hayQueOcultar,
  memotestGanado, memotestPerdido, nuevaPartidaMemotest, ocultarNoEmparejadas,
} from './memotest.logica';

// Tiempo que quedan a la vista dos cartas distintas antes de darse vuelta.
const ESPERA_OCULTAR_MS = 900;

@Component({
  selector: 'app-memotest',
  templateUrl: './memotest.page.html',
  styleUrls: ['./memotest.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon, ResultadoJuegoComponent],
})
export class MemotestPage {
  readonly maxMovimientos = MAX_MOVIMIENTOS;
  readonly porcentaje = PORCENTAJE_POR_JUEGO.memotest;

  readonly cargando = signal(true);
  readonly mensajeError = signal('');
  readonly esPrimerIntento = signal(false);
  readonly estado = signal<EstadoMemotest | null>(null);
  readonly resultado = signal<ResultadoPartida | null>(null);
  readonly guardando = signal(false);
  readonly errorGuardado = signal('');

  readonly terminado = computed(() => {
    const e = this.estado();
    return !!e && (memotestGanado(e) || memotestPerdido(e));
  });

  private contexto: ContextoJuego | null = null;
  private imagenes: ImagenMemotest[] = [];
  private readonly mesaId: string;

  constructor(
    private juegosService: JuegosService,
    private productoService: ProductoService,
    private route: ActivatedRoute,
    private router: Router,
  ) {
    this.mesaId = this.route.snapshot.paramMap.get('mesaId')!;
    addIcons({ arrowBackOutline, warning, restaurantOutline });
  }

  async ionViewWillEnter() {
    this.cargando.set(true);
    try {
      this.contexto = await this.juegosService.resolverContexto(this.mesaId);
      const carta = await this.productoService.obtenerCarta();
      this.imagenes = carta
        .filter((p) => p.fotos.length > 0)
        .map((p) => ({ parId: p.id, imagen: p.fotos[0], nombre: p.nombre }));
      // Se valida antes de iniciar el intento: si no hay fotos suficientes
      // no se "gasta" el primer intento del cliente.
      this.reiniciar();
      this.esPrimerIntento.set(await this.juegosService.iniciarPartida(this.contexto, 'memotest'));
    } catch (e: unknown) {
      this.dispararError(e instanceof Error ? e.message : 'No se pudo iniciar el juego.');
    } finally {
      this.cargando.set(false);
    }
  }

  async tocar(cartaId: number) {
    const actual = this.estado();
    if (!actual || !this.contexto) return;
    const nuevo = darVuelta(actual, cartaId);
    this.estado.set(nuevo);

    if (memotestGanado(nuevo) || memotestPerdido(nuevo)) {
      await this.guardarResultado();
    } else if (hayQueOcultar(nuevo)) {
      setTimeout(() => {
        const e = this.estado();
        if (e) this.estado.set(ocultarNoEmparejadas(e));
      }, ESPERA_OCULTAR_MS);
    }
  }

  async guardarResultado() {
    const e = this.estado();
    // Doble toque o reintento mientras se guarda: no se vuelve a llamar a la base.
    if (!e || !this.contexto || this.guardando() || this.resultado()) return;
    this.guardando.set(true);
    this.errorGuardado.set('');
    try {
      this.resultado.set(
        await this.juegosService.terminarPartida(this.contexto, 'memotest', memotestGanado(e), this.esPrimerIntento()),
      );
      this.esPrimerIntento.set(false);
    } catch (err: unknown) {
      this.errorGuardado.set(err instanceof Error ? err.message : 'No se pudo guardar el resultado.');
      this.vibrar();
    } finally {
      this.guardando.set(false);
    }
  }

  // Cada partida elige 6 productos al azar de la carta.
  reiniciar() {
    this.estado.set(nuevaPartidaMemotest(mezclar(this.imagenes).slice(0, PARES_MEMOTEST)));
    this.resultado.set(null);
  }

  volverAJuegos() {
    this.router.navigate(['/mesa', this.mesaId, 'juegos']);
  }

  private dispararError(mensaje: string) {
    this.mensajeError.set(mensaje);
    this.vibrar();
  }

  private async vibrar() {
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {
    }
  }
}
