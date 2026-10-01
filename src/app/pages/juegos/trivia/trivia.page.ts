import { Component, computed, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowBackOutline, warning, arrowForwardOutline } from 'ionicons/icons';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { JuegosService } from '../../../core/services/juegos.service';
import { ContextoJuego, PORCENTAJE_POR_JUEGO, ResultadoPartida } from '../../../core/models/juego.model';
import { ResultadoJuegoComponent } from '../resultado-juego.component';
import { EstadoTrivia, nuevaPartidaTrivia, responder, siguiente, triviaGanada, triviaTerminada } from './trivia.logica';

@Component({
  selector: 'app-trivia',
  templateUrl: './trivia.page.html',
  styleUrls: ['./trivia.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon, ResultadoJuegoComponent],
})
export class TriviaPage {
  readonly porcentaje = PORCENTAJE_POR_JUEGO.trivia;

  readonly cargando = signal(true);
  readonly mensajeError = signal('');
  readonly esPrimerIntento = signal(false);
  readonly estado = signal<EstadoTrivia>(nuevaPartidaTrivia());
  readonly resultado = signal<ResultadoPartida | null>(null);
  readonly guardando = signal(false);
  readonly errorGuardado = signal('');
  // La tarjeta de resultado aparece al tocar "Ver resultado", no apenas
  // se responde la última, para que se vea si esa fue correcta.
  readonly mostrandoResultado = signal(false);

  readonly pregunta = computed(() => this.estado().preguntas[this.estado().indice]);
  readonly terminada = computed(() => triviaTerminada(this.estado()));

  private contexto: ContextoJuego | null = null;
  private readonly mesaId: string;

  constructor(private juegosService: JuegosService, private route: ActivatedRoute, private router: Router) {
    this.mesaId = this.route.snapshot.paramMap.get('mesaId')!;
    addIcons({ arrowBackOutline, warning, arrowForwardOutline });
  }

  async ionViewWillEnter() {
    this.cargando.set(true);
    try {
      this.contexto = await this.juegosService.resolverContexto(this.mesaId);
      this.esPrimerIntento.set(await this.juegosService.iniciarPartida(this.contexto, 'trivia'));
      this.reiniciar();
    } catch (e: unknown) {
      this.dispararError(e instanceof Error ? e.message : 'No se pudo iniciar el juego.');
    } finally {
      this.cargando.set(false);
    }
  }

  elegir(opcion: number) {
    if (!this.contexto) return;
    this.estado.set(responder(this.estado(), opcion));
  }

  claseOpcion(indice: number): string {
    const elegida = this.estado().respuestaElegida;
    if (elegida === null) return '';
    if (indice === this.pregunta().correcta) return 'correcta';
    if (indice === elegida) return 'incorrecta';
    return '';
  }

  async avanzar() {
    if (this.terminada()) {
      this.mostrandoResultado.set(true);
      await this.guardarResultado();
    } else {
      this.estado.set(siguiente(this.estado()));
    }
  }

  async guardarResultado() {
    // Doble toque o reintento mientras se guarda: no se vuelve a llamar a la base.
    if (!this.contexto || this.guardando() || this.resultado()) return;
    this.guardando.set(true);
    this.errorGuardado.set('');
    try {
      this.resultado.set(
        await this.juegosService.terminarPartida(this.contexto, 'trivia', triviaGanada(this.estado()), this.esPrimerIntento()),
      );
      this.esPrimerIntento.set(false);
    } catch (e: unknown) {
      this.errorGuardado.set(e instanceof Error ? e.message : 'No se pudo guardar el resultado.');
      this.vibrar();
    } finally {
      this.guardando.set(false);
    }
  }

  reiniciar() {
    this.estado.set(nuevaPartidaTrivia());
    this.resultado.set(null);
    this.mostrandoResultado.set(false);
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
