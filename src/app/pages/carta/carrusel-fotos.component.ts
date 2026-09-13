import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronBack, chevronForward, imageOutline } from 'ionicons/icons';

/**
 * carrusel-fotos.component.ts
 * ----------------------------
 * Visor de fotos de solo lectura (no confundir con el selector de
 * cámara/galería de producto.alta — ese sube fotos, este solo las muestra).
 * Se usa en carta.ver.component.ts para el punto 11: cada foto en su
 * propio contenedor, sin recortar (object-fit: contain), centrada, con
 * flechas para "visualizar otra imagen" cuando hay más de una.
 */
@Component({
  selector: 'app-carrusel-fotos',
  standalone: true,
  imports: [CommonModule, IonIcon],
  template: `
<div
  class="marco-foto"
  [class.marco-foto-pagina]="modo === 'pagina'"
  (pointerdown)="alEmpezarArrastre($event)"
  (pointerup)="alTerminarArrastre($event)"
  (pointercancel)="cancelarArrastre()"
>
  <img
    *ngIf="fotos.length; else sinFoto"
    [src]="fotos[indiceActual()]"
    [alt]="'Foto ' + (indiceActual() + 1) + ' de ' + nombre"
    class="foto"
  />
  <ng-template #sinFoto>
    <div class="marcador-vacio" aria-hidden="true">
      <ion-icon name="image-outline"></ion-icon>
    </div>
  </ng-template>

  <ng-container *ngIf="fotos.length > 1">
    <button type="button" class="flecha flecha-izq" (click)="anterior()" aria-label="Foto anterior">
      <ion-icon name="chevron-back"></ion-icon>
    </button>
    <button type="button" class="flecha flecha-der" (click)="siguiente()" aria-label="Foto siguiente">
      <ion-icon name="chevron-forward"></ion-icon>
    </button>
    <div class="puntos" aria-hidden="true">
      <span *ngFor="let f of fotos; let i = index" class="punto" [class.punto-activo]="i === indiceActual()"></span>
    </div>
  </ng-container>
</div>
  `,
  styles: [`
.marco-foto {
  position: relative;
  aspect-ratio: 4 / 3;
  border-radius: 12px;
  background: #fffdf8;
  border: 1px solid rgba(198, 138, 52, 0.35);
  overflow: hidden;
  touch-action: pan-y; /* deja el swipe horizontal libre para nosotros, sin pelear con el scroll vertical de la página */
}

/* Modo "página" (menú tipo Reels): la foto ocupa el 100% del alto que le
   da su padre (<app-carrusel-fotos>, ver carta.ver.component.ts -- ese sí
   tiene un tamaño flex resuelto) en vez de un aspect-ratio fijo. */
.marco-foto-pagina {
  aspect-ratio: unset;
  width: 100%;
  height: 100%;
}

.foto {
  width: 100%;
  height: 100%;
  object-fit: contain; /* el TP prohíbe recortar imágenes */
  display: block;
}

.marcador-vacio {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c68a34;
  font-size: 2rem;
}

.flecha {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: rgba(90, 42, 23, 0.55);
  color: #f4eada;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
}
.flecha-izq { left: 6px; }
.flecha-der { right: 6px; }

.puntos {
  position: absolute;
  bottom: 6px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  gap: 5px;
}
.punto {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 253, 248, 0.6);
}
.punto-activo {
  background: #f4eada;
}
  `],
})
export class CarruselFotosComponent {
  @Input({ required: true }) fotos: string[] = [];
  @Input() nombre = 'producto';
  // 'tarjeta' (listado clásico, aspect-ratio fijo) o 'pagina' (menú tipo
  // Reels: la foto ocupa toda la altura que le da el padre).
  @Input() modo: 'tarjeta' | 'pagina' = 'tarjeta';

  protected readonly indiceActual = signal(0);

  // Umbral en px para distinguir un swipe de un tap accidental.
  private static readonly UMBRAL_SWIPE_PX = 40;
  private inicioX: number | null = null;

  constructor() {
    addIcons({ 'chevron-back': chevronBack, 'chevron-forward': chevronForward, 'image-outline': imageOutline });
  }

  protected siguiente(): void {
    this.indiceActual.update((i) => (i + 1) % this.fotos.length);
  }

  protected anterior(): void {
    this.indiceActual.update((i) => (i - 1 + this.fotos.length) % this.fotos.length);
  }

  protected alEmpezarArrastre(evento: PointerEvent): void {
    this.inicioX = evento.clientX;
  }

  protected alTerminarArrastre(evento: PointerEvent): void {
    if (this.inicioX === null || this.fotos.length < 2) return;

    const delta = evento.clientX - this.inicioX;
    this.inicioX = null;

    if (Math.abs(delta) < CarruselFotosComponent.UMBRAL_SWIPE_PX) return;
    // Arrastrar hacia la izquierda (delta negativo) = foto siguiente, como
    // deslizar la foto de abajo hacia arriba a la vista, igual que en
    // cualquier carrusel horizontal.
    delta < 0 ? this.siguiente() : this.anterior();
  }

  protected cancelarArrastre(): void {
    this.inicioX = null;
  }
}