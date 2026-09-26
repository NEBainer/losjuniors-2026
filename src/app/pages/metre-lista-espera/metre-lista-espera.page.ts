import { Component, OnDestroy, signal } from '@angular/core';
import { IonContent, IonIcon, IonSpinner } from '@ionic/angular';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline, checkmarkCircleOutline, peopleOutline, refreshOutline,
  restaurantOutline, timeOutline, warning,
} from 'ionicons/icons';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { RealtimeChannel } from '@supabase/supabase-js';
import { ClienteService, FilaListaEspera } from '../../core/services/cliente.service';
import { Mesa, MesaService } from '../../core/services/mesa.service';
import { SupabaseService } from '../../core/services/supabase.service';

// Fila lista para pintar: foto resuelta e inicial para el avatar, mismo
// patrón que ClientesPendientesPage / HomePage.
type FilaVista = FilaListaEspera & { fotoUrl: string | null; inicial: string };

@Component({
  selector: 'app-metre-lista-espera',
  templateUrl: './metre-lista-espera.page.html',
  styleUrls: ['./metre-lista-espera.page.scss'],
  standalone: true,
  imports: [IonContent, IonIcon, IonSpinner],
})
export class MetreListaEsperaPage implements OnDestroy {
  readonly cola = signal<FilaVista[]>([]);
  readonly mesasVacias = signal<Mesa[]>([]);
  readonly seleccionadoId = signal<string | null>(null);
  readonly cargando = signal(false);
  readonly asignandoMesaId = signal<string | null>(null);
  readonly mensajeError = signal('');
  readonly mensajeOk = signal('');
  // Distinto de "cola().length === 0": una cola vacía de verdad y una
  // carga que falló se ven exactamente igual en el array, y el banner de
  // mensajeError se autolimpia a los 4s — sin esto, el metre podría leer
  // "nadie está esperando" y en realidad fue un error de red que ya no
  // se ve en pantalla.
  readonly errorCargaCola = signal(false);
  readonly errorCargaMesas = signal(false);

  readonly etiquetasTipo: Record<Mesa['tipo'], string> = {
    estandar: 'Estándar',
    vip: 'VIP',
    movilidad_reducida: 'Movilidad reducida',
  };

  // Canales atados a ESTA pantalla, distintos y sin relación con el canal
  // singleton de NotificacionesService (ese vive en el service a propósito
  // para sobrevivir la navegación — no se toca desde acá). Nombres de
  // canal deliberadamente distintos ('metre-cola-lista-espera' /
  // 'metre-mesas-disponibles' vs. 'metre-lista-espera' del service) para
  // no confundirlos. Se abren al entrar y se cierran al salir, sin
  // excepción, para no acumular canales huérfanos en cada entrada/salida.
  private canalCola: RealtimeChannel | null = null;
  private canalMesas: RealtimeChannel | null = null;

  constructor(
    private clienteService: ClienteService,
    private mesaService: MesaService,
    private supabaseService: SupabaseService,
    private router: Router,
  ) {
    addIcons({
      arrowBackOutline, checkmarkCircleOutline, peopleOutline, refreshOutline,
      restaurantOutline, timeOutline, warning,
    });
  }

  async ionViewWillEnter() {
    this.cargando.set(true);
    try {
      await Promise.all([this.cargarCola(), this.cargarMesas()]);
    } finally {
      this.cargando.set(false);
    }
    this.suscribirRealtime();
  }

  ionViewWillLeave() {
    this.desuscribirRealtime();
  }

  ngOnDestroy() {
    this.desuscribirRealtime();
  }

  private suscribirRealtime() {
    if (this.canalCola || this.canalMesas) return; // ya suscripto
    const sb = this.supabaseService.client;

    // Cualquier evento sobre lista_espera (INSERT: entra alguien nuevo,
    // DELETE: se fue o ya se le asignó mesa) -> se vuelve a traer la cola
    // completa. Nada de parchear el array a mano con el payload: la cola
    // es chica, un refetch completo es más simple y evita bugs de
    // sincronización entre lo que dice el evento y lo que hay en pantalla.
    this.canalCola = sb
      .channel('metre-cola-lista-espera')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lista_espera' },
        () => this.cargarCola(),
      )
      .subscribe();

    // Mismo criterio para mesas: cualquier UPDATE (otro metre asignó, o
    // dueño/supervisor liberó una) -> refetch completo de disponibles.
    this.canalMesas = sb
      .channel('metre-mesas-disponibles')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'mesas' },
        () => this.cargarMesas(),
      )
      .subscribe();
  }

  private desuscribirRealtime() {
    const sb = this.supabaseService.client;
    if (this.canalCola) {
      sb.removeChannel(this.canalCola);
      this.canalCola = null;
    }
    if (this.canalMesas) {
      sb.removeChannel(this.canalMesas);
      this.canalMesas = null;
    }
  }

  async cargarCola() {
    try {
      const filas = await this.clienteService.listarListaEspera();
      this.cola.set(
        filas.map((f) => ({
          ...f,
          fotoUrl: f.foto_url ? this.resolverFotoPublica(f.foto_url) : null,
          inicial: (f.apellidos?.[0] ?? f.nombres?.[0] ?? '?').toUpperCase(),
        })),
      );
      this.errorCargaCola.set(false);
      // Si el cliente seleccionado ya no está en la cola (se lo asignó,
      // salió de la lista), soltamos la selección.
      if (this.seleccionadoId() && !filas.some((f) => f.cliente_id === this.seleccionadoId())) {
        this.seleccionadoId.set(null);
      }
    } catch {
      this.errorCargaCola.set(true);
      this.dispararError('No se pudo cargar la lista de espera.');
    }
  }

  private resolverFotoPublica(path: string): string {
    return this.supabaseService.client.storage.from('fotos').getPublicUrl(path).data.publicUrl;
  }

  async cargarMesas() {
    try {
      const todas = await this.mesaService.listarMesas();
      this.mesasVacias.set(todas.filter((m) => m.disponibilidad === 'vacia'));
      this.errorCargaMesas.set(false);
    } catch {
      this.errorCargaMesas.set(true);
      this.dispararError('No se pudieron cargar las mesas disponibles.');
    }
  }

  seleccionarCliente(fila: FilaVista) {
    this.seleccionadoId.set(this.seleccionadoId() === fila.cliente_id ? null : fila.cliente_id);
  }

  async asignar(mesa: Mesa) {
    const clienteId = this.seleccionadoId();
    if (!clienteId) {
      this.dispararError('Seleccioná primero un cliente de la lista.');
      return;
    }

    this.asignandoMesaId.set(mesa.id);
    try {
      await this.mesaService.asignarCliente(mesa.id, clienteId);
      this.mensajeOk.set(`Mesa ${mesa.numero} asignada.`);
      setTimeout(() => this.mensajeOk.set(''), 3000);
      this.seleccionadoId.set(null);
      // El realtime ya va a disparar el refetch (delete en lista_espera +
      // update en mesas), pero refrescamos también acá para feedback
      // inmediato sin depender del round-trip del canal.
      await Promise.all([this.cargarCola(), this.cargarMesas()]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo asignar la mesa.';
      this.dispararError(msg);
    } finally {
      this.asignandoMesaId.set(null);
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
