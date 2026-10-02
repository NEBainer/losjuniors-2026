import { Component, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowBackOutline, warning } from 'ionicons/icons';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { JuegosService } from '../../../core/services/juegos.service';
import { ContextoJuego, PORCENTAJE_POR_JUEGO, ResultadoPartida } from '../../../core/models/juego.model';
import { ResultadoJuegoComponent } from '../resultado-juego.component';
import {
  EstadoAhorcado, LETRAS_TECLADO, MAX_ERRORES, ahorcadoGanado, ahorcadoPerdido,
  nuevaPartidaAhorcado, palabraVisible, probarLetra,
} from './ahorcado.logica';

@Component({
  selector: 'app-ahorcado',
  templateUrl: './ahorcado.page.html',
  styleUrls: ['./ahorcado.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon, ResultadoJuegoComponent],
})
export class AhorcadoPage {
  readonly letras = LETRAS_TECLADO;
  readonly maxErrores = MAX_ERRORES;
  readonly porcentaje = PORCENTAJE_POR_JUEGO.ahorcado;

  readonly cargando = signal(true);
  readonly mensajeError = signal('');
  readonly esPrimerIntento = signal(false);
  readonly estado = signal<EstadoAhorcado>(nuevaPartidaAhorcado());
  readonly resultado = signal<ResultadoPartida | null>(null);
  readonly guardando = signal(false);
  readonly errorGuardado = signal('');

  readonly visible = computed(() => palabraVisible(this.estado()));
  readonly terminado = computed(() => ahorcadoGanado(this.estado()) || ahorcadoPerdido(this.estado()));

  private contexto: ContextoJuego | null = null;
  private readonly mesaId: string;

  constructor(private juegosService: JuegosService, private route: ActivatedRoute, private router: Router) {
    this.mesaId = this.route.snapshot.paramMap.get('mesaId')!;
    addIcons({ arrowBackOutline, warning });
  }

  async ionViewWillEnter() {
    this.cargando.set(true);
    try {
      this.contexto = await this.juegosService.resolverContexto(this.mesaId);
      // El primer intento queda registrado desde acá (schema.sql v12):
      // si el cliente sale a mitad de partida, ya lo usó.
      this.esPrimerIntento.set(await this.juegosService.iniciarPartida(this.contexto, 'ahorcado'));
      this.reiniciar();
    } catch (e: unknown) {
      this.dispararError(e instanceof Error ? e.message : 'No se pudo iniciar el juego.');
    } finally {
      this.cargando.set(false);
    }
  }

  probada(letra: string): boolean {
    return this.estado().letrasProbadas.includes(letra);
  }

  acertada(letra: string): boolean {
    return this.probada(letra) && this.estado().palabra.includes(letra);
  }

  async tocar(letra: string) {
    if (!this.contexto) return;
    this.estado.set(probarLetra(this.estado(), letra));
    if (this.terminado()) await this.guardarResultado();
  }

  async guardarResultado() {
    // Doble toque o reintento mientras se guarda: no se vuelve a llamar a la base.
    if (!this.contexto || this.guardando() || this.resultado()) return;
    this.guardando.set(true);
    this.errorGuardado.set('');
    try {
      const r = await this.juegosService.terminarPartida(
        this.contexto, 'ahorcado', ahorcadoGanado(this.estado()), this.esPrimerIntento(),
      );
      this.resultado.set(r);
      this.esPrimerIntento.set(false);
    } catch (e: unknown) {
      this.errorGuardado.set(e instanceof Error ? e.message : 'No se pudo guardar el resultado.');
      this.vibrar();
    } finally {
      this.guardando.set(false);
    }
  }

  // "Jugar de nuevo" siempre es juego libre: el primer intento ya se usó.
  reiniciar() {
    this.estado.set(nuevaPartidaAhorcado());
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
