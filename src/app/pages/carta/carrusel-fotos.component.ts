import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronBack, chevronForward, imageOutline } from 'ionicons/icons';
@Component({
  selector: 'app-carrusel-fotos',
  standalone: true,
  imports: [CommonModule, IonIcon],
  template: `
<div class="marco-foto">
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
}

.foto {
  width: 100%;
  height: 100%;
  object-fit: contain; 
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

  protected readonly indiceActual = signal(0);

  constructor() {
    addIcons({ 'chevron-back': chevronBack, 'chevron-forward': chevronForward, 'image-outline': imageOutline });
  }

  protected siguiente(): void {
    this.indiceActual.update((i) => (i + 1) % this.fotos.length);
  }

  protected anterior(): void {
    this.indiceActual.update((i) => (i - 1 + this.fotos.length) % this.fotos.length);
  }
}