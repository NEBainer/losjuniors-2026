import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import {
  AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators,
} from '@angular/forms';
import {
  IonButton, IonCol, IonContent, IonFooter, IonGrid, IonIcon, IonInput, IonLabel, IonModal, IonRow, IonSelect,
  IonSelectOption, IonSpinner, IonToast,
} from '@ionic/angular';
import { Router } from '@angular/router';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { addIcons } from 'ionicons';
import {
  arrowBack, cameraOutline, closeOutline, qrCodeOutline, warningOutline,
} from 'ionicons/icons';
import { AuthService } from '../../core/services/auth.service';
import { DniScannerService } from '../../core/services/dni-scanner.service';
import { EmpleadoService, PerfilEmpleado } from '../../core/services/empleado.service';

// Solo dígitos, longitud exacta según el documento (DNI: 7-8, CUIL: 11).
// El input puede traer puntos/guiones/espacios -> se ignoran para validar.
function validadorDocumento(longitudes: number[]): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const normalizado = soloDigitos(control.value);
    return longitudes.includes(normalizado.length) ? null : { formato: true };
  };
}

function soloDigitos(valor: string | null): string {
  return (valor ?? '').replace(/\D/g, '');
}

@Component({
  selector: 'app-alta-empleado',
  templateUrl: './alta-empleado.page.html',
  styleUrls: ['./alta-empleado.page.scss'],
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, IonContent, IonFooter, IonButton, IonInput, IonSpinner, IonIcon,
    IonGrid, IonRow, IonCol, IonSelect, IonSelectOption, IonModal, IonToast, IonLabel,
  ],
})
export class AltaEmpleadoPage implements OnInit {
  formulario: FormGroup;

  readonly perfiles: { valor: PerfilEmpleado; etiqueta: string }[] = [
    { valor: 'supervisor', etiqueta: 'Supervisor' },
    { valor: 'metre', etiqueta: 'Metre' },
    { valor: 'mozo', etiqueta: 'Mozo' },
    { valor: 'cocinero', etiqueta: 'Cocinero' },
    { valor: 'cantinero', etiqueta: 'Cantinero' },
  ];

  readonly cargando = signal(true); // arranca comprobando permisos del usuario
  readonly tienePermiso = signal(false);
  readonly guardando = signal(false);
  readonly mensajeError = signal('');
  readonly mostrarExito = signal(false);

  readonly fotoUri = signal<string | null>(null);
  readonly fotoAmpliada = signal(false);

  readonly escaneando = signal(false);
  readonly lectorDisponible = signal(false);
  readonly datosVienenDeQr = signal(false);

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private empleadoService: EmpleadoService,
    private dniScanner: DniScannerService,
    private router: Router,
  ) {
    addIcons({ arrowBack, cameraOutline, closeOutline, qrCodeOutline, warningOutline });

    this.formulario = this.fb.group({
      apellidos: ['', [Validators.required, Validators.minLength(2)]],
      nombres: ['', [Validators.required, Validators.minLength(2)]],
      dni: ['', [Validators.required, validadorDocumento([7, 8])]],
      cuil: ['', [Validators.required, validadorDocumento([11])]],
      email: ['', [Validators.required, Validators.email]],
      clave: ['', [Validators.required, Validators.minLength(6)]],
      perfil: ['mozo', [Validators.required]],
    });
  }

  async ngOnInit() {
    const usuario = await this.authService.obtenerUsuarioActual();
    this.tienePermiso.set(!!usuario && ['dueño', 'supervisor'].includes(usuario.perfil));
    this.cargando.set(false);

    this.lectorDisponible.set(await this.dniScanner.lectorDisponible());
  }

  async capturarFoto() {
    try {
      this.fotoUri.set(await this.empleadoService.tomarFoto());
    } catch {
      this.dispararError('No se pudo acceder a la cámara.');
    }
  }

  async escanearDni() {
    this.escaneando.set(true);
    try {
      const datos = await this.dniScanner.escanearDni();
      if (!datos) return;

      this.formulario.patchValue({
        dni: datos.dni,
        nombres: datos.nombres,
        apellidos: datos.apellidos,
      });
      this.datosVienenDeQr.set(true);
    } catch (error) {
      // Los mensajes de permiso de cámara vienen listos desde el service;
      // cualquier otro fallo (formato no reconocido, lectura fallida) usa
      // el mensaje genérico.
      const mensaje = error instanceof Error && error.message.includes('permiso')
        ? error.message
        : 'No se pudo leer el código del DNI. Probá enfocar bien el frente del documento.';
      this.dispararError(mensaje);
    } finally {
      this.escaneando.set(false);
    }
  }

  async darDeAlta() {
    if (this.formulario.invalid || !this.fotoUri()) {
      this.dispararError('Complete todos los campos y tome la foto del empleado antes de continuar.');
      return;
    }

    this.guardando.set(true);
    const { apellidos, nombres, dni, cuil, email, clave, perfil } = this.formulario.value;

    try {
      await this.empleadoService.crearEmpleado({
        apellidos,
        nombres,
        dni: soloDigitos(dni),
        cuil: soloDigitos(cuil),
        email,
        password: clave,
        perfil,
        fotoWebPath: this.fotoUri()!,
      });

      this.mostrarExito.set(true);
      this.formulario.reset({ perfil: 'mozo' });
      this.fotoUri.set(null);
      this.datosVienenDeQr.set(false);
    } catch (error) {
      this.dispararError(error instanceof Error ? error.message : 'No se pudo dar de alta al empleado.');
    } finally {
      this.guardando.set(false);
    }
  }

  volver() {
    this.router.navigate(['/home']);
  }

  private async dispararError(mensaje: string) {
    this.mensajeError.set(mensaje);
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {
      // Ignorar si el dispositivo/navegador no soporta vibración.
    }
    setTimeout(() => this.mensajeError.set(''), 4000);
  }
}
