import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { Router } from '@angular/router';
import { SplashScreen } from '@capacitor/splash-screen';

@Component({
  selector: 'app-splash',
  templateUrl: './splash.page.html',
  styleUrls: ['./splash.page.scss'],
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule]
})
export class SplashPage implements OnInit, OnDestroy {
  private temporizador: ReturnType<typeof setTimeout> | undefined;

  constructor(private router: Router) {}

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
    this.router.navigate(['/login'], { replaceUrl: true });
  }
}