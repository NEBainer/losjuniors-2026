import { Component, computed, signal } from '@angular/core';
import { IonContent, IonIcon } from '@ionic/angular';
import { AuthService } from '../core/services/auth.service';
import { UsuariosService } from '../core/services/usuarios.service';
import { PerfilUsuario } from '../core/models/usuario.model';
import { Router } from '@angular/router';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { addIcons } from 'ionicons';
import { listOutline, logOutOutline, peopleOutline, restaurantOutline } from 'ionicons/icons';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [IonContent, IonIcon],
})
export class HomePage {
  cargando: boolean = false;

  // Perfil del usuario logueado, para filtrar qué módulos se muestran.
  // Signal en vez de campo plano: se resuelve en una promesa (fuera de la
  // zona de Angular) y así la vista se refresca sola al llegar el dato.
  private readonly perfil = signal<PerfilUsuario | null>(null);

  readonly puedeVerMesas = computed(() =>
    this.esUnoDe(this.perfil(), ['dueño', 'supervisor']),
  );
  readonly puedeVerPedidos = computed(() =>
    this.esUnoDe(this.perfil(), ['cocinero', 'cantinero']),
  );
  readonly puedeVerClientesPendientes = computed(() =>
    this.esUnoDe(this.perfil(), ['dueño', 'supervisor']),
  );

  constructor(
    private authService: AuthService,
    private usuariosService: UsuariosService,
    private router: Router,
  ) {
    addIcons({ logOutOutline, restaurantOutline, listOutline, peopleOutline });
  }

  // Lifecycle de Ionic: corre cada vez que se entra a la pantalla
  // (incluido volver de otra), así el panel siempre refleja el perfil
  // del usuario logueado en ese momento.
  async ionViewWillEnter() {
    this.perfil.set(await this.usuariosService.getPerfilActual());
  }

  private esUnoDe(perfil: PerfilUsuario | null, permitidos: PerfilUsuario[]): boolean {
    return perfil !== null && permitidos.includes(perfil);
  }

  irAClientesPendientes() {
    this.router.navigate(['/clientes-pendientes']);
  }

  irAAltaDeMesa() {
    this.router.navigate(['/mesas/alta']);
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
      console.error('Error al cerrar sesión', error);
      // Vibracion al detectarse un error
      try {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      } catch { }
    }
  }
}
