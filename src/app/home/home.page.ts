import { Component } from '@angular/core';
import { IonContent, IonButton, IonIcon } from '@ionic/angular';
import { AuthService } from '../core/services/auth.service';
import { Router } from '@angular/router';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { addIcons } from 'ionicons';
import { listOutline, logOutOutline, restaurantOutline } from 'ionicons/icons';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [IonContent, IonIcon],
})
export class HomePage {
  cargando: boolean = false;
  constructor(
    private authService: AuthService,
    private router: Router,
  ) {
    addIcons({ logOutOutline, restaurantOutline, listOutline });
  }

  async ejecutarCierreSesion() {
    this.cargando = true;
    try {
      await this.authService.cerrarSesion();
      
      // Verificar que las credenciales se borren
      // Limpiamos la caché local de Capacitor/Navegador por seguridad extra
      localStorage.clear(); 
      sessionStorage.clear();
      
      this.router.navigate(['/login'], { replaceUrl: true });
    } catch (error) {
      this.cargando = false;
      // Vibracion al detectarse un error
      await Haptics.impact({ style: ImpactStyle.Heavy });
      console.error('Error al cerrar sesión', error);
    }
  }
}
