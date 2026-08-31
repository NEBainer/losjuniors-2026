import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonIcon, IonSpinner } from '@ionic/angular';
import { ClienteService } from '../../core/services/cliente.service';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { checkmarkCircle, closeCircle, timeOutline } from 'ionicons/icons';

@Component({
  selector: 'app-registro-pendiente',
  templateUrl: './registro-pendiente.page.html',
  styleUrls: ['./registro-pendiente.page.scss'],
  imports: [IonContent, IonSpinner, IonIcon, CommonModule]
})
export class RegistroPendientePage implements OnInit, OnDestroy {
  estado: 'pendiente' | 'aceptado' | 'rechazado' = 'pendiente';
  private canal: any;

  constructor(private clienteService: ClienteService, private router: Router) { 
    addIcons({ checkmarkCircle, closeCircle, timeOutline });
  }

  ngOnInit() {
    const clienteId = history.state.clienteId;
    if (!clienteId) {
      this.router.navigate(['/login']);
      return;
    }

    this.canal = this.clienteService.escucharCambioEstado(clienteId, (nuevoEstado) => {
        this.estado = nuevoEstado.estado_aprobacion;
        if (this.estado === 'aceptado') {
          setTimeout(() => this.router.navigate(['/home']), 2500);
        }
      });
  }

  ngOnDestroy() {
    this.canal?.unsubscribe();
  }

}
