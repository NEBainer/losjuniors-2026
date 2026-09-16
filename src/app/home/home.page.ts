import { Component, computed, signal } from '@angular/core';
import { IonContent, IonIcon } from '@ionic/angular';
import { AuthService } from '../core/services/auth.service';
import { UsuariosService } from '../core/services/usuarios.service';
import { Mesa, MesaService } from '../core/services/mesa.service';
import { QrAppService } from '../core/services/qr-app.service';
import { ClientePendiente, PerfilUsuario } from '../core/models/usuario.model';
import { Router } from '@angular/router';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { addIcons } from 'ionicons';
import {
  bookOutline, chatbubblesOutline, checkmarkOutline, closeOutline, fastFoodOutline,
  informationCircleOutline, listOutline, logOutOutline, peopleOutline, personAddOutline,
  qrCodeOutline, restaurantOutline, wineOutline,
} from 'ionicons/icons';

// Fila lista para pintar en la lista embebida de pendientes: mismo patrón
// que ClientesPendientesPage (ver clientes-pendientes.page.ts), resuelto
// una sola vez al cargar en vez de en cada ciclo de detección de cambios.
type ClienteVista = ClientePendiente & { fotoUrl: string | null; inicial: string };

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [IonContent, IonIcon],
})
export class HomePage {
  cargando: boolean = false;

  // Perfil del usuario logueado, para filtrar qué módulos se muestran.
  // Signal en vez de campo plano: se resuelve en una promesa (fuera de la
  // zona de Angular) y así la vista se refresca sola al llegar el dato.
  private readonly perfil = signal<PerfilUsuario | null>(null);

  readonly puedeAgregarPlato = computed(() =>
    this.esUnoDe(this.perfil(), ['cocinero']),
  );
  readonly puedeAgregarBebida = computed(() =>
    this.esUnoDe(this.perfil(), ['cantinero']),
  ); 
  readonly puedeVerMesas = computed(() =>
    this.esUnoDe(this.perfil(), ['dueño', 'supervisor']),
  );
  readonly puedeVerPedidos = computed(() =>
    this.esUnoDe(this.perfil(), ['cocinero', 'cantinero']),
  );
  readonly puedeVerAltaEmpleado = computed(() =>
    this.esUnoDe(this.perfil(), ['dueño', 'supervisor']),
  );
  // Punto 11: solo un cliente (registrado o anónimo) escanea la mesa —
  // no tiene sentido para empleados.
  readonly puedeEscanearMesa = computed(() =>
    this.esUnoDe(this.perfil(), ['cliente_registrado', 'cliente_anonimo']),
  );
  // Punto 11: bandeja de consultas al mozo — solo el perfil mozo.
  readonly puedeVerConsultas = computed(() =>
    this.esUnoDe(this.perfil(), ['mozo']),
  );
  // Requisito excluyente "QR de mesa" (no es un punto numerado propio):
  // el personal de sala escanea el mismo QR que el cliente, pero en vez
  // de entrar al menú solo ve los datos de la mesa (número, capacidad,
  // tipo, disponibilidad) -- no se vincula ni accede al chat/carta.
  readonly puedeVerInfoMesa = computed(() =>
    this.esUnoDe(this.perfil(), ['metre', 'mozo', 'dueño', 'supervisor']),
  );

  // Panel especial del dueño/supervisor (correcciones-profesor 13-09):
  // mitad de arriba con los accesos rápidos, mitad de abajo con la lista
  // de pendientes embebida (en vez de una tarjeta que navega aparte).
  readonly esPanelDueno = computed(() =>
    this.esUnoDe(this.perfil(), ['dueño', 'supervisor']),
  );

  readonly pendientes = signal<ClienteVista[]>([]);
  readonly cargandoPendientes = signal(false);
  readonly confirmandoId = signal<string | null>(null);
  readonly procesandoId = signal<string | null>(null);
  readonly mensajeErrorPendientes = signal('');
  readonly mensajeOkPendientes = signal('');

  readonly escaneandoMesa = signal(false);
  readonly mensajeErrorEscaneo = signal('');

  // Panel de solo lectura para el personal de sala (ver puedeVerInfoMesa).
  readonly escaneandoInfoMesa = signal(false);
  readonly mesaInfoEscaneada = signal<Mesa | null>(null);
  readonly etiquetasTipo: Record<Mesa['tipo'], string> = {
    estandar: 'Estándar',
    vip: 'VIP',
    movilidad_reducida: 'Movilidad reducida',
  };

  constructor(
    private authService: AuthService,
    private usuariosService: UsuariosService,
    private mesaService: MesaService,
    private qrAppService: QrAppService,
    private router: Router,
  ) {
    addIcons({
      logOutOutline, restaurantOutline, listOutline, peopleOutline, personAddOutline,
      fastFoodOutline, wineOutline, bookOutline, checkmarkOutline, qrCodeOutline,
      chatbubblesOutline, informationCircleOutline, closeOutline,
    });
  }

  // Lifecycle de Ionic: corre cada vez que se entra a la pantalla
  // (incluido volver de otra), así el panel siempre refleja el perfil
  // del usuario logueado en ese momento.
  async ionViewWillEnter() {
    this.perfil.set(await this.usuariosService.getPerfilActual());
    if (this.esPanelDueno()) {
      await this.cargarPendientes();
    }
  }

  async cargarPendientes() {
    this.cargandoPendientes.set(true);
    this.confirmandoId.set(null);
    try {
      const filas = await this.usuariosService.getClientesPendientes();
      this.pendientes.set(
        filas.map((c) => ({
          ...c,
          fotoUrl: this.usuariosService.getFotoPublicUrl(c.foto_url),
          inicial: (c.apellidos?.[0] ?? c.nombres?.[0] ?? '?').toUpperCase(),
        })),
      );
    } catch {
      this.dispararErrorPendientes('No se pudo cargar el listado de pendientes.');
    } finally {
      this.cargandoPendientes.set(false);
    }
  }

  verDetalle(_cliente: ClienteVista) {
    // El detalle completo (con rechazar) vive en la pantalla dedicada;
    // acá solo se resuelve el caso frecuente (aceptar) sin navegar.
    this.router.navigate(['/clientes-pendientes']);
  }

  pedirConfirmacionAceptar(id: string) {
    this.confirmandoId.set(id);
    this.mensajeErrorPendientes.set('');
    this.mensajeOkPendientes.set('');
  }

  cancelarConfirmacionPendiente() {
    this.confirmandoId.set(null);
  }

  async confirmarAceptar(cliente: ClienteVista) {
    this.procesandoId.set(cliente.id);
    try {
      await this.usuariosService.setEstadoCliente(cliente.id, 'aceptado');
      this.pendientes.update((lista) => lista.filter((c) => c.id !== cliente.id));
      this.mensajeOkPendientes.set(`Cliente ${cliente.apellidos}, ${cliente.nombres} aceptado.`);
      setTimeout(() => this.mensajeOkPendientes.set(''), 3000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo aceptar al cliente.';
      this.dispararErrorPendientes(msg);
    } finally {
      this.procesandoId.set(null);
      this.confirmandoId.set(null);
    }
  }

  private async dispararErrorPendientes(mensaje: string) {
    this.mensajeErrorPendientes.set(mensaje);
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {
      // Ignorar si el dispositivo/navegador no soporta vibración.
    }
    setTimeout(() => this.mensajeErrorPendientes.set(''), 4000);
  }

  private esUnoDe(perfil: PerfilUsuario | null, permitidos: PerfilUsuario[]): boolean {
    return perfil !== null && permitidos.includes(perfil);
  }

  irAAltaEmpleado() {
    this.router.navigate(['/empleados/alta']);
  }

  irAGestionMesas() {
    this.router.navigate(['/mesas']);
  }

  irAConsultasMozo() {
    this.router.navigate(['/consultas-mozo']);
  }

  irAAltaPlato() {
    this.router.navigate(['/cocinero/plato-alta']);
  }

  irAAltaBebida() {
    this.router.navigate(['/cantinero/bebida-alta']);
  }

  // Punto 11: ver la carta completa. No depende de ningún perfil en
  // particular (a diferencia del resto de las tarjetas) — cualquier
  // usuario logueado la puede consultar, igual que la vería un cliente
  // escaneando el QR de la mesa.
  irALaCarta() {
    this.router.navigate(['/carta']);
  }

  // Punto 11: escanea el QR de la mesa ({"tipo":"mesa","numero":N}, ver
  // QrAppService) y navega al menú de esa mesa puntual. Mismo patrón de
  // manejo de errores que escanearIngreso() en login.page.ts.
  async escanearMesa() {
    this.escaneandoMesa.set(true);
    try {
      const datos = await this.qrAppService.escanear();
      if (!datos) return; // el usuario canceló el escaneo

      if (datos.tipo !== 'mesa') {
        this.dispararErrorEscaneo('Ese código no es el de una mesa.');
        return;
      }

      const mesa = await this.mesaService.buscarPorNumero(datos.numero);
      if (!mesa) {
        this.dispararErrorEscaneo(`No encontramos la mesa ${datos.numero}.`);
        return;
      }

      this.router.navigate(['/mesa', mesa.numero, 'carta']);
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'No se pudo leer el código.';
      this.dispararErrorEscaneo(mensaje);
    } finally {
      this.escaneandoMesa.set(false);
    }
  }

  private async dispararErrorEscaneo(mensaje: string) {
    this.mensajeErrorEscaneo.set(mensaje);
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {
      // Ignorar si el dispositivo/navegador no soporta vibración.
    }
    setTimeout(() => this.mensajeErrorEscaneo.set(''), 4000);
  }

  // Requisito excluyente "QR de mesa": mismo QR que escanearMesa(), pero
  // acá el personal de sala solo consulta el estado de la mesa -- no se
  // vincula a ella ni navega a ningún lado, se queda en el home.
  async escanearMesaInfo() {
    this.escaneandoInfoMesa.set(true);
    try {
      const datos = await this.qrAppService.escanear();
      if (!datos) return; // el usuario canceló el escaneo

      if (datos.tipo !== 'mesa') {
        this.dispararErrorEscaneo('Ese código no es el de una mesa.');
        return;
      }

      const mesa = await this.mesaService.buscarPorNumero(datos.numero);
      if (!mesa) {
        this.dispararErrorEscaneo(`No encontramos la mesa ${datos.numero}.`);
        return;
      }

      this.mesaInfoEscaneada.set(mesa);
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'No se pudo leer el código.';
      this.dispararErrorEscaneo(mensaje);
    } finally {
      this.escaneandoInfoMesa.set(false);
    }
  }

  cerrarInfoMesa() {
    this.mesaInfoEscaneada.set(null);
  }

  async ejecutarCierreSesion() {
    this.cargando = true;
    try {
      await this.authService.cerrarSesion();

      // Verificar que las credenciales se borren
      // Limpiamos la caché local de Capacitor/Navegador por seguridad extra
      localStorage.clear();
      sessionStorage.clear();

      this.router.navigate(['/login'], { replaceUrl: true });
    } catch (error) {
      this.cargando = false;
      console.error('Error al cerrar sesión', error);
      // Vibracion al detectarse un error
      try {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      } catch { }
    }
  }
}