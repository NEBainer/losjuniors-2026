import { Component, input, output } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { trophyOutline, sadOutline, refreshOutline, gameControllerOutline, warning } from 'ionicons/icons';
import { ResultadoPartida } from '../../core/models/juego.model';

// Fin de partida, compartida por los 3 juegos. Si falla el guardado del
// resultado (primer intento), muestra el error con "Reintentar guardar"
// sin perder lo que se jugó.
@Component({
  selector: 'app-resultado-juego',
  standalone: true,
  imports: [IonIcon],
  template: `
    <div class="velo">
      <div class="tarjeta">
        @if (guardando()) {
          <img src="assets/icon/logo_lamesa.png" alt="Logo de La Mesa" class="logo-spinner" />
          <div class="spinner-css"></div>
          <p>Guardando resultado…</p>
        } @else if (errorGuardado()) {
          <ion-icon name="warning" class="icono error"></ion-icon>
          <h2>{{ errorGuardado() }}</h2>
          <button class="boton-principal" (click)="reintentar.emit()">
            <ion-icon name="refresh-outline"></ion-icon> Reintentar guardar
          </button>
          <!-- La tarjeta tapa toda la pantalla: sin esto, si el reintento
               sigue fallando el cliente no tiene cómo salir. -->
          <button class="boton-secundario" (click)="volver.emit()">
            <ion-icon name="game-controller-outline"></ion-icon> Volver a juegos
          </button>
        } @else if (resultado()) {
          @let r = resultado()!;
          <ion-icon [name]="r.gano ? 'trophy-outline' : 'sad-outline'" class="icono"></ion-icon>
          <h2>{{ r.titulo }}</h2>
          <p>{{ r.detalle }}</p>
          <button class="boton-principal" (click)="jugarDeNuevo.emit()">
            <ion-icon name="refresh-outline"></ion-icon> Jugar de nuevo
          </button>
          <button class="boton-secundario" (click)="volver.emit()">
            <ion-icon name="game-controller-outline"></ion-icon> Volver a juegos
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    .velo {
      position: fixed; inset: 0; z-index: 50;
      background: var(--overlay-cargando-bg);
      display: flex; align-items: center; justify-content: center; padding: 24px;
    }
    .tarjeta {
      width: 100%; max-width: 420px;
      background: var(--ion-color-step-100);
      border: 2px solid var(--ion-color-step-150);
      border-radius: 16px; padding: 28px 20px;
      display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center;
    }
    .icono { font-size: 4.5rem; color: var(--ion-color-primary); }
    .icono.error { color: var(--ion-color-danger); }
    h2 { margin: 0; font-size: 1.5rem; font-weight: bold; color: var(--ion-color-primary); }
    p { margin: 0; font-size: 1.05rem; }
    button {
      width: 100%; min-height: 52px; border-radius: 12px; font-size: 1.1rem; font-weight: 600;
      display: flex; align-items: center; justify-content: center; gap: 8px;
    }
    .boton-principal { border: none; background: var(--ion-color-primary); color: var(--ion-color-primary-contrast); }
    .boton-secundario { background: transparent; border: 2px solid var(--ion-color-primary); color: var(--ion-color-primary); }
    ion-icon { font-size: 1.4rem; }
  `],
})
export class ResultadoJuegoComponent {
  readonly resultado = input<ResultadoPartida | null>(null);
  readonly guardando = input(false);
  readonly errorGuardado = input('');
  readonly jugarDeNuevo = output<void>();
  readonly volver = output<void>();
  readonly reintentar = output<void>();

  constructor() {
    addIcons({ trophyOutline, sadOutline, refreshOutline, gameControllerOutline, warning });
  }
}
