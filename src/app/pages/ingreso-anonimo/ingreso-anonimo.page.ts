import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton, IonContent, IonIcon, IonInput, IonLabel, IonSpinner } from '@ionic/angular';
import { Router } from '@angular/router';
import { ClienteService } from '../../core/services/cliente.service';
import { addIcons } from 'ionicons';
import { camera, cameraOutline, personCircleOutline, warning, warningOutline } from 'ionicons/icons';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

@Component({
  selector: 'app-ingreso-anonimo',
  templateUrl: './ingreso-anonimo.page.html',
  styleUrls: ['./ingreso-anonimo.page.scss'],
  imports: [CommonModule, ReactiveFormsModule, IonContent, IonButton, IonInput, IonSpinner, IonIcon, IonLabel]
})
export class IngresoAnonimoPage implements OnInit {
  formulario: FormGroup;
  readonly fotoUri = signal<string | null>(null);
  readonly cargando = signal(false);
  readonly mensajeError = signal('');

  constructor(
    private fb: FormBuilder,
    private clienteService: ClienteService,
    private router: Router
  ) {
    this.formulario = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2)]]
    });
    addIcons({ camera, warning, cameraOutline, warningOutline, personCircleOutline });
  }

  async capturarFoto() {
    try {
      this.fotoUri.set(await this.clienteService.tomarFoto());
    } catch {
      this.dispararError('No se pudo acceder a la cámara.');
    }
  }

  async ingresar() {
    if (this.formulario.invalid || !this.fotoUri()) {
      this.dispararError('Ingresá tu nombre y tomate una foto para continuar.');
      return;
    }

    this.cargando.set(true);
    try {
      const clienteId = await this.clienteService.ingresarComoAnonimo(
        this.formulario.value.nombre,
        this.fotoUri()!
      );
      this.cargando.set(false);
      this.router.navigate(['/lista-espera'], { state: { clienteId } });
    } catch {
      this.cargando.set(false);
      this.dispararError('No se pudo completar el ingreso. Intentá de nuevo.');
    }
  }

  private async dispararError(mensaje: string) {
    this.mensajeError.set(mensaje);
    try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch {}
    setTimeout(() => this.mensajeError.set(''), 4000);
  }

  ngOnInit() {
  }

}
