import { Component } from '@angular/core';
import { Router } from '@angular/router';
<<<<<<< HEAD
import { SplashScreen } from '@capacitor/splash-screen';
=======
import { SplashInicioComponent } from '../../splash/splash.inicio.component';
>>>>>>> origin/dev

@Component({
  selector: 'app-splash',
  standalone: true,
  imports: [SplashInicioComponent],
  template: `<app-splash-inicio (splashListo)="irALogin()" />`,
})
export class SplashPage {
  constructor(private router: Router) {}

<<<<<<< HEAD
  ngOnInit() {
    SplashScreen.hide(); // <-- agregado: oculta la splash nativa apenas Angular ya puede pintar esta pantalla

    this.temporizador = setTimeout(() => {
      this.irALogin();
    }, 3000);
  }

  ngOnDestroy() {
    clearTimeout(this.temporizador);
  }

  irALogin() {
=======
  irALogin(): void {
>>>>>>> origin/dev
    this.router.navigate(['/login'], { replaceUrl: true });
  }
}