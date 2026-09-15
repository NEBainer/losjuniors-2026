import { Component, OnInit } from '@angular/core';
import { IonButton, IonContent, IonIcon } from '@ionic/angular';
import { ClienteService } from '../../core/services/cliente.service';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { timeOutline } from 'ionicons/icons';

@Component({
  selector: 'app-lista-espera',
  templateUrl: './lista-espera.page.html',
  styleUrls: ['./lista-espera.page.scss'],
  imports: [IonContent, IonIcon, IonButton]
})
export class ListaEsperaPage implements OnInit {
  private clienteId = '';

  constructor(private clienteService: ClienteService, private router: Router) {
    addIcons({ timeOutline });
   }

  ngOnInit() {
    this.clienteId = history.state.clienteId;
    if (!this.clienteId) {
      this.router.navigate(['/login']);
    }
  }

   async salir() {
    try { await this.clienteService.salirDeListaEspera(this.clienteId); } catch {}
    this.router.navigate(['/login'], { replaceUrl: true });
  }

}
