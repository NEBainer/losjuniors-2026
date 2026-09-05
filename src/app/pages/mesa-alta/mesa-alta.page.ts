import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowBack, camera, checkmarkCircle, warning } from 'ionicons/icons';
import { toDataURL } from 'qrcode';
import { Router } from '@angular/router';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { AuthService } from '../../core/services/auth.service';
import { MesaService } from '../../core/services/mesa.service';

@Component({
  selector: 'app-mesa-alta',
  templateUrl: './mesa-alta.page.html',
  styleUrls: ['./mesa-alta.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon, CommonModule, ReactiveFormsModule],
})
export class MesaAltaPage implements OnInit {
  formularioMesa: FormGroup;

  cargando = true; // arranca comprobando permisos del usuario
  guardando = false;
  tienePermiso = false;
  mensajeError = '';

  fotoSeleccionada: File | null = null;
  previewFoto: string | null = null;

  mesaCreada: { numero: number; qr_code: string } | null = null;
  qrDataUrl: string | null = null;

  tiposDeMesa = [
    { valor: 'estandar', etiqueta: 'Estándar' },
    { valor: 'vip', etiqueta: 'VIP' },
    { valor: 'movilidad_reducida', etiqueta: 'Movilidad reducida' },
  ];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private mesaService: MesaService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    addIcons({ arrowBack, camera, checkmarkCircle, warning });

    this.formularioMesa = this.fb.group({
      numero: ['', [Validators.required, Validators.min(1)]],
      cantidad_comensales: ['', [Validators.required, Validators.min(1)]],
      tipo: ['estandar', [Validators.required]],
    });
  }

  async ngOnInit() {
    const usuario = await this.authService.obtenerUsuarioActual();
    this.tienePermiso = !!usuario && ['dueño', 'supervisor'].includes(usuario.perfil);
    this.cargando = false;
    // Supabase resuelve esta promesa fuera del ciclo de detección de cambios
    // de Angular: sin este detectChanges() la vista queda congelada en
    // "Verificando permisos...".
    this.cdr.detectChanges();
  }

  seleccionarFoto(evento: Event) {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;
    this.fotoSeleccionada = archivo;
    this.previewFoto = archivo ? URL.createObjectURL(archivo) : null;
  }

  async darDeAlta() {
    if (this.formularioMesa.invalid) {
      this.dispararError('Por favor, complete correctamente los campos requeridos.');
      return;
    }

    this.guardando = true;
    this.mensajeError = '';

    try {
      const usuario = await this.authService.obtenerUsuarioActual();
      if (!usuario) {
        throw new Error('No se pudo identificar al usuario logueado.');
      }

      const { numero, cantidad_comensales, tipo } = this.formularioMesa.value;
      const mesa = await this.mesaService.crearMesa(
        { numero: Number(numero), cantidad_comensales: Number(cantidad_comensales), tipo },
        usuario.id,
        this.fotoSeleccionada ?? undefined
      );
      const qrDataUrl = await toDataURL(mesa.qr_code, { width: 220, margin: 1 });

      this.mesaCreada = mesa;
      this.qrDataUrl = qrDataUrl;
      this.guardando = false;
      this.cdr.detectChanges();
    } catch (error: any) {
      this.guardando = false;
      this.cdr.detectChanges();
      this.dispararError(error?.message ?? 'No se pudo crear la mesa. Intente nuevamente.');
    }
  }

  darDeAltaOtraMesa() {
    this.mesaCreada = null;
    this.qrDataUrl = null;
    this.fotoSeleccionada = null;
    this.previewFoto = null;
    this.formularioMesa.reset({ numero: '', cantidad_comensales: '', tipo: 'estandar' });
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
