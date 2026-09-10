import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { SplashInicioComponent } from '../../splash/splash.inicio.component';

@Component({
  selector: 'app-splash',
  standalone: true,
  imports: [SplashInicioComponent],
  template: `<app-splash-inicio (splashListo)="irALogin()" />`,
})
export class SplashPage {
  constructor(private router: Router) {}

  irALogin(): void {
    this.router.navigate(['/login'], { replaceUrl: true });
  }
}