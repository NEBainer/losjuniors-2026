import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { 
  IonButton,
  IonContent, IonFab, IonFabButton, IonFabList, IonIcon
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { business, eye, restaurant, person, warning, flash, list, pizza, wine } from 'ionicons/icons';
import { AuthService } from '../../core/services/auth.service';
import { Router } from '@angular/router';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    IonContent, IonFab, IonFabButton, IonFabList, IonIcon,
   CommonModule, ReactiveFormsModule, IonButton
  ]
})
export class LoginPage implements OnInit {
  formularioLogin: FormGroup;
  cargando: boolean = false;
  mensajeError: string = '';

  // Accesos rapidos, usando las credenciales de prueba del script
  // ---- PASARLOS A UNA VARIABLE DE ENTORNO ----
  accesosRapidos = [
    { perfil: 'Dueño', correo: 'dueno@test.com', clave: 'Test1234!', icono: 'business' },
    { perfil: 'Supervisor', correo: 'supervisor@test.com', clave: 'Test1234!', icono: 'eye' },
    { perfil: 'Metre', correo: 'metre@test.com', clave: 'Test1234!', icono: 'list' },
    { perfil: 'Mozo', correo: 'mozo@test.com', clave: 'Test1234!', icono: 'restaurant' },
    { perfil: 'Cocinero', correo: 'cocinero@test.com', clave: 'Test1234!', icono: 'pizza' },
    { perfil: 'Cantinero', correo: 'cantinero@test.com', clave: 'Test1234!', icono: 'wine' },
    { perfil: 'Cliente', correo: 'cliente@test.com', clave: 'Test1234!', icono: 'person' }
  ];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    addIcons({ business, eye, list, restaurant, pizza, wine, person, warning, flash });

    this.formularioLogin = this.fb.group({
      correo: ['', [Validators.required, Validators.email]],
      clave: ['', [Validators.required, Validators.minLength(6)]]
    });
   }

  ngOnInit() {}

  async cargarAccesoRapido(usuario: any) {
    this.formularioLogin.patchValue({
      correo: usuario.correo,
      clave: usuario.clave
    });
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

  irARegistro() {
    this.router.navigate(['/registro-cliente']);
  }
}
