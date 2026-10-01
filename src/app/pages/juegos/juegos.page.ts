import { Component, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowBackOutline, textOutline, imagesOutline, helpCircleOutline, pricetagOutline, warning } from 'ionicons/icons';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { JuegosService } from '../../core/services/juegos.service';
import { ContextoJuego, IntentoJuego, Juego } from '../../core/models/juego.model';
import { estadoTarjeta, textoBanner } from './juegos.logica';

interface TarjetaJuego {
  juego: Juego;
  titulo: string;
  descripcion: string;
  icono: string;
}

// Punto 14/15: menú de juegos. Se llega desde la pantalla del pedido
// (fases confirmado, completo y entregado).
@Component({
  selector: 'app-juegos',
  templateUrl: './juegos.page.html',
  styleUrls: ['./juegos.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon],
})
export class JuegosPage {
  readonly tarjetas: TarjetaJuego[] = [
    { juego: 'ahorcado', titulo: 'Ahorcado', descripcion: 'Adiviná la comida letra por letra', icono: 'text-outline' },
    { juego: 'memotest', titulo: 'Memotest', descripcion: 'Encontrá los pares de la carta', icono: 'images-outline' },
    { juego: 'trivia', titulo: 'Trivia', descripcion: 'Respondé 5 preguntas gastronómicas', icono: 'help-circle-outline' },
  ];

  readonly cargando = signal(true);
  readonly mensajeError = signal('');
  readonly contexto = signal<ContextoJuego | null>(null);
  readonly intentos = signal<IntentoJuego[]>([]);

  private readonly mesaId: string;

  constructor(
    private juegosService: JuegosService,
    private route: ActivatedRoute,
    private router: Router,
  ) {
    this.mesaId = this.route.snapshot.paramMap.get('mesaId')!;
    addIcons({ arrowBackOutline, textOutline, imagesOutline, helpCircleOutline, pricetagOutline, warning });
  }

  // Se recarga cada vez que se vuelve de un juego, para reflejar el
  // intento recién jugado.
  async ionViewWillEnter() {
    this.cargando.set(true);
    this.mensajeError.set('');
    try {
      const ctx = await this.juegosService.resolverContexto(this.mesaId);
      this.contexto.set(ctx);
      this.intentos.set(ctx.esRegistrado ? await this.juegosService.obtenerIntentos(ctx.pedidoId) : []);
    } catch (e: unknown) {
      this.dispararError(e instanceof Error ? e.message : 'No se pudieron cargar los juegos.');
    } finally {
      this.cargando.set(false);
    }
  }

  banner(): string {
    const ctx = this.contexto();
    return ctx ? textoBanner(this.intentos(), ctx.esRegistrado) : '';
  }

  estado(juego: Juego): string {
    const ctx = this.contexto();
    return ctx ? estadoTarjeta(juego, this.intentos(), ctx.esRegistrado) : '';
  }

  jugar(juego: Juego) {
    this.router.navigate(['/mesa', this.mesaId, 'juegos', juego]);
  }

  volver() {
    this.router.navigate(['/mesa', this.mesaId, 'pedido']);
  }

  private async dispararError(mensaje: string) {
    this.mensajeError.set(mensaje);
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {
    }
  }
}
