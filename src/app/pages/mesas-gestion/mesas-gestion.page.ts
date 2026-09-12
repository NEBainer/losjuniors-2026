import { ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, arrowBack, restaurantOutline, warning } from 'ionicons/icons';
import { Router } from '@angular/router';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { AuthService } from '../../core/services/auth.service';
import { Mesa, MesaService } from '../../core/services/mesa.service';

@Component({
  selector: 'app-mesas-gestion',
  templateUrl: './mesas-gestion.page.html',
  styleUrls: ['./mesas-gestion.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon, CommonModule],
})
export class MesasGestionPage {
  cargando = true;
  tienePermiso = false;
  mensajeError = '';

  mesas: Mesa[] = [];

  readonly etiquetasTipo: Record<Mesa['tipo'], string> = {
    estandar: 'Estándar',
    vip: 'VIP',
    movilidad_reducida: 'Movilidad reducida',
  };

  constructor(
    private authService: AuthService,
    private mesaService: MesaService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    addIcons({ add, arrowBack, restaurantOutline, warning });
  }

  // Lifecycle de Ionic: corre cada vez que se entra a la pantalla (incluido
  // volver de "Alta de mesa"), así el listado siempre refleja los cambios
  // recién guardados. Con ngOnInit solo, Ionic reutiliza la instancia
  // cacheada al volver atrás y el listado quedaba desactualizado.
  async ionViewWillEnter() {
    this.cargando = true;

    const usuario = await this.authService.obtenerUsuarioActual();
    this.tienePermiso = !!usuario && ['dueño', 'supervisor'].includes(usuario.perfil);

    if (this.tienePermiso) {
      await this.cargarMesas();
    }

    this.cargando = false;
    this.cdr.detectChanges();
  }

  private async cargarMesas() {
    try {
      this.mesas = await this.mesaService.listarMesas();
    } catch {
      this.dispararError('No se pudieron cargar las mesas.');
    }
  }

  async alternarDisponibilidad(mesa: Mesa) {
    const anterior = mesa.disponibilidad;
    const nueva = anterior === 'vacia' ? 'ocupada' : 'vacia';

    // Actualización optimista: se refleja al toque y se revierte si falla.
    mesa.disponibilidad = nueva;
    this.cdr.detectChanges();

    try {
      await this.mesaService.actualizarDisponibilidad(mesa.id, nueva);
    } catch {
      mesa.disponibilidad = anterior;
      this.cdr.detectChanges();
      this.dispararError('No se pudo actualizar la disponibilidad de la mesa.');
    }
  }

  irAAltaDeMesa() {
    this.router.navigate(['/mesas/alta']);
  }

  volver() {
    this.router.navigate(['/home']);
  }

  private async dispararError(mensaje: string) {
    this.mensajeError = mensaje;
    this.cdr.detectChanges();
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {
      // Ignorar si el dispositivo/navegador no soporta vibración
    }

    setTimeout(() => {
      this.mensajeError = '';
      this.cdr.detectChanges();
    }, 4000);
  }
}
