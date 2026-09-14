import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonButton,
  IonContent, IonFooter, IonIcon
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  warning, eyeOutline, eyeOffOutline,
} from 'ionicons/icons';
import { AuthService } from '../../core/services/auth.service';
import { Router } from '@angular/router';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { AccesosRapidosComponent } from '../../shared/accesos-rapidos/accesos-rapidos.component';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    IonContent, IonFooter, IonIcon,
   CommonModule, ReactiveFormsModule, IonButton, AccesosRapidosComponent
  ]
})
export class LoginPage implements OnInit {
  formularioLogin: FormGroup;
  cargando: boolean = false;
  mensajeError: string = '';
  mostrarClave: boolean = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    addIcons({ warning, eyeOutline, eyeOffOutline });

    this.formularioLogin = this.fb.group({
      correo: ['', [Validators.required, Validators.email]],
      clave: ['', [Validators.required, Validators.minLength(6)]]
    });
   }

  ngOnInit() {}

  async onAccesoRapidoSeleccionado(credenciales: { correo: string; clave: string }) {
    this.formularioLogin.patchValue(credenciales);
    await this.iniciarSesion();
  }

  async iniciarSesion() {
    // Validacion de todos los datos en todos los formularios
    if (this.formularioLogin.invalid) {
      this.dispararError('Por favor, complete correctamente los campos requeridos.');
      return;
    }

    this.cargando = true;
    this.mensajeError = '';
    const { correo, clave } = this.formularioLogin.value;

    try {
      await this.authService.iniciarSesion(correo, clave);
      // Simulacion de espera para que se aprecie el spinner con logo
      setTimeout(() => {
        this.cargando = false;
        // Supabase resuelve fuera del ciclo de detección de cambios de
        // Angular: sin este detectChanges() la vista queda congelada
        // mostrando el spinner de carga.
        this.cdr.detectChanges();
        this.router.navigate(['/home']); // Ajustar a la ruta principal post-login
      }, 1500);
    } catch (error) {
      this.cargando = false;
      this.cdr.detectChanges();
      this.dispararError('Credenciales incorrectas. Verifique su correo electrónico y contraseña.');
    }
  }

  // Vibracion al detectar error
  private async dispararError(mensaje: string) {
    this.mensajeError = mensaje;
    this.cdr.detectChanges();
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {

    }

    setTimeout(() => {
      this.mensajeError = '';
      this.cdr.detectChanges();
    }, 4000);
  }

  toggleMostrarClave() {
    this.mostrarClave = !this.mostrarClave;
  }

  irARegistro() {
    this.router.navigate(['/registro-cliente']);
  }
}