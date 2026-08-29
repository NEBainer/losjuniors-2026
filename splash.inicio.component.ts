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

/**
 * splash.inicio.component.ts
 * ---------------------------
 * Splash de arranque de LA MESA (Los Juniors — TFI Gestión de Restaurante).
 *
 * Convención de archivos del equipo: rol.estado.extensión
 *   rol    -> splash   (a qué pantalla/pieza pertenece)
 *   estado -> inicio   (la app todavía no terminó de montar/cargar)
 *
 * Se usa como cualquier componente standalone:
 *   <app-splash-inicio (splashListo)="onSplashListo()" />
 *
 * Mientras `splashListo` no se emitió, conviene ocultar el resto del layout
 * (por ejemplo con *ngIf="appLista" en el AppComponent) para no pagar el
 * costo de renderizar la app real por debajo del splash.
 *
 * no estaban pedidas explícitamente pero evitan objeciones
 *   - Caché con vencimiento (no un flag para siempre): si el diseño cambia,
 *     alcanza con subir VERSION y todos lo vuelven a ver una vez.
 *   - Salida manual en cualquier momento (click, tecla, botón "Saltar").
 *   - prefers-reduced-motion respetado (ver .scss).
 *   - Manejo defensivo de localStorage (modo privado / cuota llena no rompe nada).
 */
@Component({
  selector: 'app-splash-inicio',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './splash.inicio.component.html',
  styleUrl: './splash.inicio.component.scss',
})
export class SplashInicioComponent implements OnInit, OnDestroy {
  @Output() splashListo = new EventEmitter<void>();

  private static readonly CLAVE = 'lm_splash';
  private static readonly VERSION = 1;
  private static readonly VIGENCIA_MS = 1000 * 60 * 60 * 6; 
  protected readonly oculto = signal(false);
  protected readonly animacionRapida = signal(false);

  private yaCerrado = false;
  private temporizadorCierre?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    if (this.debeSaltarAnimacionCompleta()) {
      this.animacionRapida.set(true);
      this.temporizadorCierre = setTimeout(() => this.cerrar(), 150);
    } else {
      this.temporizadorCierre = setTimeout(() => this.cerrar(), 5000);
    }
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
    this.guardarCache();
    this.oculto.set(true);

    setTimeout(
      () => this.splashListo.emit(),
      this.animacionRapida() ? 150 : 500
    );
  }

  private leerCache(): { v: number; ts: number } | null {
    try {
      const crudo = localStorage.getItem(SplashInicioComponent.CLAVE);
      return crudo ? JSON.parse(crudo) : null;
    } catch {
      return null;
    }
  }

  private guardarCache(): void {
    try {
      localStorage.setItem(
        SplashInicioComponent.CLAVE,
        JSON.stringify({ v: SplashInicioComponent.VERSION, ts: Date.now() })
      );
    } catch {
    }
  }

  private debeSaltarAnimacionCompleta(): boolean {
    const datos = this.leerCache();
    if (!datos || datos.v !== SplashInicioComponent.VERSION) return false;
    return Date.now() - datos.ts < SplashInicioComponent.VIGENCIA_MS;
  }
}
