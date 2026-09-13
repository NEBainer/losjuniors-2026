import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import {
  AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators,
} from '@angular/forms';
import { IonButton, IonContent, IonFooter, IonIcon, IonInput, IonLabel, IonModal, IonSpinner } from '@ionic/angular';
import { ClienteService } from '../../core/services/cliente.service';
import { Router } from '@angular/router';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { addIcons } from 'ionicons';
import {
  camera, closeOutline, warning, personAddOutline, cameraOutline, warningOutline, eyeOutline, eyeOffOutline,
  qrCodeOutline,
} from 'ionicons/icons';
import { SupabaseService } from '../../core/services/supabase.service';
import { DniScannerService } from '../../core/services/dni-scanner.service';

// Las dos contraseñas deben coincidir. Va en el FormGroup (no en un solo
// control) porque necesita comparar dos campos entre sí.
function clavesCoincidenValidator(): ValidatorFn {
  return (grupo: AbstractControl): ValidationErrors | null => {
    const clave = grupo.get('clave')?.value;
    const confirmarClave = grupo.get('confirmarClave')?.value;
    return clave === confirmarClave ? null : { clavesNoCoinciden: true };
  };
}

@Component({
  selector: 'app-registro-cliente',
  templateUrl: './registro-cliente.page.html',
  styleUrls: ['./registro-cliente.page.scss'],
  imports: [
    CommonModule, ReactiveFormsModule, IonContent, IonFooter, IonButton, IonInput, IonSpinner, IonIcon, IonLabel,
    IonModal,
  ],
})
export class RegistroClientePage  implements OnInit {
  formulario: FormGroup;
  readonly fotoUri = signal<string | null>(null);
  readonly fotoAmpliada = signal(false);
  readonly cargando = signal(false);
  readonly mensajeError = signal('');
  readonly escaneando = signal(false);
  readonly lectorQrDisponible = signal(false);
  readonly datosVienenDeQr = signal(false);
  readonly mostrarClave = signal(false);
  readonly mostrarConfirmarClave = signal(false);

  constructor(
    private fb: FormBuilder,
    private supabaseService: SupabaseService,
    private clienteService: ClienteService,
    private dniScanner: DniScannerService,
    private router: Router
  ) {
    this.formulario = this.fb.group({
      nombres: ['', [Validators.required, Validators.minLength(2)]],
      apellidos: ['', [Validators.required, Validators.minLength(2)]],
      dni: ['', [Validators.required, Validators.pattern(/^\d{7,8}$/)]],
      email: ['', [Validators.required, Validators.email]],
      clave: ['', [Validators.required, Validators.minLength(6)]],
      confirmarClave: ['', [Validators.required]],
    }, { validators: clavesCoincidenValidator() });

    addIcons({
      camera, warning, warningOutline, personAddOutline, cameraOutline, closeOutline, eyeOutline, eyeOffOutline,
      qrCodeOutline,
    });
   }

  async ngOnInit() {
    this.lectorQrDisponible.set(await this.dniScanner.lectorDisponible());
  }

  async capturarFoto() {
    try {
      const uri = await this.clienteService.tomarFoto();
      this.fotoUri.set(uri);
    } catch {
      this.dispararError('No se pudo acceder a la cámara.');
    }
  }

  async registrarse() {
    if (this.formulario.invalid || !this.fotoUri()) {
      this.dispararError('Complete todos los campos y tome una foto antes de continuar.');
      return;
    }

    this.cargando.set(true);
    const { nombres, apellidos, dni, email, clave } = this.formulario.value;

    try {
      const { data, error: errorAuth } = await this.supabaseService.client.auth.signUp({
        email, password: clave
      });
      console.log('¿Hay sesión activa?', data.session); // Si en consola vemos  null, "Confirm email" está activada y se resuelve desactivando "Confirm email" en el dashboard. Sino se ejecuta como usuario anonimo.
      if (errorAuth || !data.user) throw errorAuth;

      const fotoUrl = await this.clienteService.subirFoto(this.fotoUri()!, data.user.id);

      await this.clienteService.registrarCliente({
        id: data.user.id, nombres, apellidos, dni, email, fotoUrl
      });
      await this.clienteService.enviarCorreoEstado(email, `${nombres} ${apellidos}`, 'pendiente');

      this.cargando.set(false);
      this.router.navigate(['/registro-pendiente'], { state: { clienteId: data.user.id } });

    } catch (error) {
      this.cargando.set(false);
      this.dispararError('No se pudo completar el registro. Intente nuevamente.');
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
        apellidos: datos.apellidos
      });
      this.datosVienenDeQr.set(true);

    } catch (error) {
      // Los mensajes de permiso de cámara vienen listos desde el service;
      // cualquier otro fallo (formato no reconocido, lectura fallida) usa
      // el mensaje genérico de siempre.
      const mensaje = error instanceof Error && error.message.includes('permiso')
        ? error.message
        : 'No se pudo leer el código del DNI. Probá enfocar bien el frente del documento.';
      this.dispararError(mensaje);
    } finally {
      this.escaneando.set(false);
    }
  }

  toggleMostrarClave() {
    this.mostrarClave.update((valor) => !valor);
  }

  toggleMostrarConfirmarClave() {
    this.mostrarConfirmarClave.update((valor) => !valor);
  }

  private async dispararError(mensaje: string) {
    this.mensajeError.set(mensaje);
    try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch {}
    setTimeout(() => {
      this.mensajeError.set('');
    }, 4000);
  }

}
