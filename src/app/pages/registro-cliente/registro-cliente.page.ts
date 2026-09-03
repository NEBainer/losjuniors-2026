import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton, IonContent, IonIcon, IonInput, IonLabel, IonSpinner } from '@ionic/angular';
import { ClienteService } from '../../core/services/cliente.service';
import { Router } from '@angular/router';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { addIcons } from 'ionicons';
import { camera, warning ,personAddOutline, cameraOutline, warningOutline} from 'ionicons/icons';
import { SupabaseService } from '../../core/services/supabase.service';

@Component({
  selector: 'app-registro-cliente',
  templateUrl: './registro-cliente.page.html',
  styleUrls: ['./registro-cliente.page.scss'],
  imports: [CommonModule, ReactiveFormsModule, IonContent, IonButton, IonInput, IonSpinner, IonIcon, IonLabel],
})
export class RegistroClientePage  implements OnInit {
  formulario: FormGroup;
  fotoUri: string | null = null;
  cargando = false;
  mensajeError = '';

  constructor(
    private fb: FormBuilder,
    private supabaseService: SupabaseService,
    private clienteService: ClienteService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.formulario = this.fb.group({
      nombres: ['', [Validators.required, Validators.minLength(2)]],
      apellidos: ['', [Validators.required, Validators.minLength(2)]],
      dni: ['', [Validators.required, Validators.pattern(/^\d{7,8}$/)]],
      email: ['', [Validators.required, Validators.email]],
      clave: ['', [Validators.required, Validators.minLength(6)]]
    });

    addIcons({ camera, warning, warningOutline, personAddOutline, cameraOutline });
   }

  ngOnInit() {}

  async capturarFoto() {
    try {
      this.fotoUri = await this.clienteService.tomarFoto();
    } catch {
      this.dispararError('No se pudo acceder a la cámara.');
    }
  }

  async registrarse() {
    if (this.formulario.invalid || !this.fotoUri) {
      this.dispararError('Complete todos los campos y tome una foto antes de continuar.');
      return;
    }

    this.cargando = true;
    const { nombres, apellidos, dni, email, clave } = this.formulario.value;

    try {
      const { data, error: errorAuth } = await this.supabaseService.client.auth.signUp({
        email, password: clave
      });
      if (errorAuth || !data.user) throw errorAuth;

      const fotoUrl = await this.clienteService.subirFoto(this.fotoUri, data.user.id);

      await this.clienteService.registrarCliente({
        id: data.user.id, nombres, apellidos, dni, email, fotoUrl
      });

      this.cargando = false;
      this.router.navigate(['/registro-pendiente'], { state: { clienteId: data.user.id } });

    } catch (error) {
      this.cargando = false;
      this.cdr.detectChanges();
      this.dispararError('No se pudo completar el registro. Intente nuevamente.');
    }
  }

  private async dispararError(mensaje: string) {
    this.mensajeError = mensaje;
    try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch {}
    setTimeout(() => {
      this.mensajeError = '';
      this.cdr.detectChanges();
    }, 4000);
  }

}
