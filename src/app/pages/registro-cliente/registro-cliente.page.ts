import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton, IonContent, IonIcon, IonInput, IonLabel, IonSpinner } from '@ionic/angular';
import { ClienteService } from '../../core/services/cliente.service';
import { Router } from '@angular/router';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { addIcons } from 'ionicons';
import { camera, warning ,personAddOutline, cameraOutline, warningOutline, qrCodeOutline} from 'ionicons/icons';
import { SupabaseService } from '../../core/services/supabase.service';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';

interface DatosDni {
  apellidos: string;
  nombres: string;
  dni: string;
}

@Component({
  selector: 'app-registro-cliente',
  templateUrl: './registro-cliente.page.html',
  styleUrls: ['./registro-cliente.page.scss'],
  imports: [CommonModule, ReactiveFormsModule, IonContent, IonButton, IonInput, IonSpinner, IonIcon, IonLabel],
})
export class RegistroClientePage  implements OnInit {
  formulario: FormGroup;
  readonly fotoUri = signal<string | null>(null);
  readonly cargando = signal(false);
  readonly mensajeError = signal('');
  readonly escaneando = signal(false);
  readonly lectorQrDisponible = signal(false);
  readonly datosVienenDeQr = signal(false);

  constructor(
    private fb: FormBuilder,
    private supabaseService: SupabaseService,
    private clienteService: ClienteService,
    private router: Router
  ) {
    this.formulario = this.fb.group({
      nombres: ['', [Validators.required, Validators.minLength(2)]],
      apellidos: ['', [Validators.required, Validators.minLength(2)]],
      dni: ['', [Validators.required, Validators.pattern(/^\d{7,8}$/)]],
      email: ['', [Validators.required, Validators.email]],
      clave: ['', [Validators.required, Validators.minLength(6)]]
    });

    addIcons({ camera, warning, warningOutline, personAddOutline, cameraOutline, qrCodeOutline });
   }

  async ngOnInit() {
    const { supported } = await BarcodeScanner.isSupported();
    this.lectorQrDisponible.set(supported);
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
      const { camera } = await BarcodeScanner.checkPermissions();
      if (camera === 'denied') {
        this.dispararError('Activá el permiso de cámara desde Configuración del dispositivo para poder escanear el DNI.');
        return;
      }
      if (camera !== 'granted') {
        const solicitado = await BarcodeScanner.requestPermissions();
        if (solicitado.camera !== 'granted') {
          this.dispararError('Se necesita permiso de cámara para escanear el DNI.');
          return;
        }
      }
      // PDF417, no QrCode: es el formato real del DNI argentino.
      const { barcodes } = await BarcodeScanner.scan({ formats: [BarcodeFormat.Pdf417] });
      if (barcodes.length === 0) return; 
      
      const rawValue = barcodes[0].rawValue;
      if (!rawValue) {
        throw new Error('No se pudo leer el contenido del código.');
      }

      const datos = this.parsearDni(rawValue);

      this.formulario.patchValue({
        dni: datos.dni,
        nombres: datos.nombres,
        apellidos: datos.apellidos
      });
      this.datosVienenDeQr.set(true);

    } catch {
      this.dispararError('No se pudo leer el código del DNI. Probá enfocar bien el frente del documento.');
    } finally {
      this.escaneando.set(false);
    }
  }

  private parsearDni(raw: string): DatosDni {
    const campos = raw.split('@');
    if (campos.length < 8) {
      throw new Error('Formato de DNI no reconocido');
    }
    const [, apellidos, nombres, , dni] = campos;
    return { apellidos, nombres, dni };
  }

  private async dispararError(mensaje: string) {
    this.mensajeError.set(mensaje);
    try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch {}
    setTimeout(() => {
      this.mensajeError.set('');
    }, 4000);
  }

}
