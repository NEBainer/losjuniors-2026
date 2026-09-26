import {
  Component,
  EventEmitter,
  HostListener,
  OnDestroy,
  OnInit,
  Output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonButton } from '@ionic/angular';
import { SplashScreen } from '@capacitor/splash-screen'; 

@Component({
  selector: 'app-splash-inicio',
  standalone: true,
  imports: [CommonModule, IonButton],
  template: `
<div
  class="splash"
  [class.oculto]="oculto()"
  role="img"
  aria-label="LA MESA — Gestión de Restaurante, cargando"
  (click)="alHacerClick()"
>
  <div class="marco">
    <div class="rombo-esquina marron tl"></div>
    <div class="rombo-esquina dorado tr"></div>
    <div class="rombo-esquina dorado bl"></div>
    <div class="rombo-esquina marron br"></div>

    <div class="puntos" aria-hidden="true">
      <span></span><span></span><span></span><span></span><span></span><span></span>
    </div>

    <div class="marco-capa-ext">
    <div class="marco-capa-med">
    <div class="contenido">
      <div>
        <div class="item insignia" style="--i:0">LOS JUNIORS</div>
        <div class="item separador" style="--i:1">
          <span class="linea"></span><span class="rombo"></span><span class="linea"></span>
        </div>
        <div class="item subtitulo" style="--i:2">GESTIÓN DE RESTAURANTE</div>
      </div>

      <div class="sello-central">
        <img class="logo-marca" src="assets/icon/logo_lamesa.png" alt="LA MESA — Desde 2026" />
      </div>

      <div>
        <div class="item separador punteado" style="--i:3">
          <span class="linea"></span><span class="rombo"></span><span class="linea"></span>
        </div>
        <div class="item autores" style="--i:4">
          Cicchelli, Lucía<br />
          Bainer, Ezequiel<br />
          Arcieri, Maximiliano<br />
          Storgato, Noelia
        </div>
        <div class="item pie" style="--i:5">Trabajo Final Integrador</div>
      </div>
    </div>
    </div>
    </div>
  </div>

  <ion-button
    class="btn-saltar"
    fill="outline"
    shape="round"
    size="small"
    (click)="alTocarSaltar($event)"
  >
    Saltar
  </ion-button>
</div>
  `,
  styles: [`
:host {
  --crema: #f4eada;
  --marron: #7a3a22;
  --marron-osc: #5b2a17;
  --dorado: #c68a34;
  --texto-gris: #9c9186;
  --duracion-sello: 0.65s;
}

.splash {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--crema);
  font-family: 'EB Garamond', Georgia, 'Times New Roman', serif;
  z-index: 9999;
  opacity: 1;
  visibility: visible;
  transition: opacity 0.5s ease, visibility 0s linear 0s;
}
.splash.oculto {
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.5s ease, visibility 0s linear 0.5s;
  pointer-events: none;
}

.marco {
  position: relative;
  width: min(92vw, 420px);
  max-height: min(94%, 800px);
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
  clip-path: circle(0% at 50% 50%);
  animation: sello var(--duracion-sello) cubic-bezier(0.2, 0.7, 0.25, 1) forwards;
}
.marco::-webkit-scrollbar {
  display: none;
}
@keyframes sello {
  to {
    clip-path: circle(75% at 50% 50%);
  }
}

.marco-capa-ext {
  margin: 12px;
  border: 3px solid var(--marron);
  border-radius: 26px;
}
.marco-capa-med {
  margin: 8px;
  border: 2px solid var(--dorado);
  border-radius: 20px;
}

.rombo-esquina {
  position: absolute;
  width: 12px;
  height: 12px;
  transform: rotate(45deg) scale(0);
  opacity: 0;
  animation: aparecer-rombo 0.4s ease-out forwards;
}
.rombo-esquina.marron {
  background: var(--marron);
}
.rombo-esquina.dorado {
  background: var(--dorado);
}
.rombo-esquina.tl {
  top: 4px;
  left: 4px;
  animation-delay: 0.55s;
}
.rombo-esquina.tr {
  top: 4px;
  right: 4px;
  animation-delay: 0.62s;
}
.rombo-esquina.bl {
  bottom: 4px;
  left: 4px;
  animation-delay: 0.62s;
}
.rombo-esquina.br {
  bottom: 4px;
  right: 4px;
  animation-delay: 0.55s;
}
@keyframes aparecer-rombo {
  0% {
    transform: rotate(45deg) scale(0);
    opacity: 0;
  }
  60% {
    transform: rotate(45deg) scale(1.3);
    opacity: 1;
  }
  100% {
    transform: rotate(45deg) scale(1);
    opacity: 1;
  }
}

.puntos span {
  position: absolute;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--texto-gris);
  opacity: 0.3;
  animation: titilar 4s ease-in-out infinite;
}
.puntos span:nth-child(1) {
  top: 8%;
  left: 15%;
  animation-delay: 1.8s;
}
.puntos span:nth-child(2) {
  top: 8%;
  right: 15%;
  animation-delay: 2.3s;
}
.puntos span:nth-child(3) {
  top: 27%;
  left: 9%;
  animation-delay: 2.6s;
}
.puntos span:nth-child(4) {
  top: 27%;
  right: 9%;
  animation-delay: 2s;
}
.puntos span:nth-child(5) {
  bottom: 30%;
  left: 10%;
  animation-delay: 2.9s;
}
.puntos span:nth-child(6) {
  bottom: 30%;
  right: 10%;
  animation-delay: 2.1s;
}
@keyframes titilar {
  0%,
  100% {
    opacity: 0.25;
  }
  50% {
    opacity: 0.55;
  }
}

.contenido {
  position: relative;
  border: 1px solid var(--marron);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(1.1rem, 5vh, 2.5rem);
  padding: 9%;
  text-align: center;
}

.item {
  opacity: 0;
  transform: translateY(14px);
  animation: entrar 0.5s cubic-bezier(0.16, 0.8, 0.3, 1) forwards;
  animation-delay: calc(0.55s + (var(--i, 0) * 0.09s));
}
@keyframes entrar {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.insignia {
  border: 2px solid var(--marron);
  border-radius: 999px;
  padding: 0.5em 1.3em;
  font-family: 'Cinzel', 'Playfair Display', serif;
  font-size: clamp(0.8rem, 2.6vw, 1rem);
  letter-spacing: 0.12em;
  color: var(--marron);
  font-weight: 600;
}

.separador {
  display: flex;
  align-items: center;
  gap: 0.5em;
  margin: 0.9em 0;
}
.separador .linea {
  width: 135px;
  height: 2px;
  background: var(--dorado);
}
.separador .rombo {
  width: 8px;
  height: 8px;
  background: var(--dorado);
  transform: rotate(45deg);
}
.separador.punteado .linea {
  width: 135px;
  background: none;
  border-top: 2px dotted var(--texto-gris);
}

.subtitulo {
  font-family: 'Cinzel', 'Playfair Display', serif;
  font-size: clamp(1rem, 3.4vw, 1.3rem);
  letter-spacing: 0.14em;
  color: var(--marron);
  font-weight: 700;
}

.sello-central {
  position: relative;
  width: min(58vw, 250px);
  aspect-ratio: 1;
  flex-shrink: 0;
  border-radius: 50%;
  overflow: hidden;
  box-shadow: 0 3px 14px rgba(0, 0, 0, 0.18);
  opacity: 0;
  transform: scale(0.7) rotate(-6deg);
  animation: golpe-sello 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  animation-delay: 0.95s;
}
.sello-central::before {
  content: '';
  position: absolute;
  inset: -14px;
  border-radius: 50%;
  border: 2px solid var(--marron);
  opacity: 0;
  animation: onda-tinta 0.8s ease-out forwards;
  animation-delay: 1.1s;
  pointer-events: none;
}
.logo-marca {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  mix-blend-mode: multiply;
}

@keyframes golpe-sello {
  0% {
    opacity: 0;
    transform: scale(0.7) rotate(-6deg);
  }
  100% {
    opacity: 1;
    transform: scale(1) rotate(0deg);
  }
}
@keyframes onda-tinta {
  0% {
    opacity: 0.5;
    transform: scale(0.9);
  }
  100% {
    opacity: 0;
    transform: scale(1.12);
  }
}

.autores {
  color: var(--texto-gris);
  font-size: clamp(0.95rem, 3.6vw, 1.15rem);
  line-height: 1.85;
}

.pie {
  font-size: 0.85rem;
  font-style: italic;
  color: var(--texto-gris);
}

.btn-saltar {
  position: absolute;
  bottom: max(18px, env(safe-area-inset-bottom));
  right: 18px;
  --border-color: var(--texto-gris);
  --border-width: 1px;
  --border-style: solid;
  --color: var(--texto-gris);
  --background: transparent;
  --background-hover: transparent;
  --background-activated: transparent;
  --box-shadow: none;
  --padding-start: 1em;
  --padding-end: 1em;
  --padding-top: 0.4em;
  --padding-bottom: 0.4em;
  font-family: inherit;
  font-size: 0.78rem;
  letter-spacing: 0.05em;
  text-transform: none;
  opacity: 0;
  animation: entrar 0.4s ease forwards;
  animation-delay: 1.6s;
}
.btn-saltar::part(native):hover,
.btn-saltar::part(native):focus-visible {
  --border-color: var(--marron);
  --color: var(--marron);
}
.btn-saltar::part(native):focus-visible {
  outline: 2px solid var(--marron);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .marco {
    animation: none;
    clip-path: circle(75% at 50% 50%);
  }
  .item,
  .rombo-esquina,
  .sello-central,
  .btn-saltar {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
  .sello-central::before {
    display: none;
  }
  .puntos span {
    animation: none;
    opacity: 0.3;
  }
}

@media (max-height: 600px) {
  .contenido {
    gap: 0.8rem;
    padding: 4%;
  }
  .sello-central {
    width: min(48vw, 180px);
  }
  .autores {
    line-height: 1.5;
  }
}
  `],
})
export class SplashInicioComponent implements OnInit, OnDestroy {
  @Output() splashListo = new EventEmitter<void>();

  private static readonly DURACION_MS = 2000;
  private static readonly DURACION_TRANSICION_MS = 500; 

  protected readonly oculto = signal(false);

  private yaCerrado = false;
  private temporizadorCierre?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    SplashScreen.hide();
    this.temporizadorCierre = setTimeout(
      () => this.cerrar(),
      SplashInicioComponent.DURACION_MS
    );
  }

  ngOnDestroy(): void {
    if (this.temporizadorCierre) clearTimeout(this.temporizadorCierre);
  }

  @HostListener('document:keydown')
  protected alPresionarTecla(): void {
    this.cerrar();
  }

  protected alHacerClick(): void {
    this.cerrar();
  }

  protected alTocarSaltar(evento: Event): void {
    evento.stopPropagation();
    this.cerrar();
  }

  private cerrar(): void {
    if (this.yaCerrado) return;
    this.yaCerrado = true;
    this.oculto.set(true);

    setTimeout(
      () => this.splashListo.emit(),
      SplashInicioComponent.DURACION_TRANSICION_MS
    );
  }
}