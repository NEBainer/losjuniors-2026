import { ChangeDetectorRef, Component, EventEmitter, OnInit, Output } from '@angular/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { environment } from '../../../environments/environment';
import { AccesoRapido } from '../../core/models/usuario.model';
import { UsuariosService } from '../../core/services/usuarios.service';

// Fila lista para pintar: foto pública resuelta, inicial de respaldo y
// perfil en texto legible -- mismo patrón que ClienteVista en home.page.ts.
type AccesoRapidoVista = AccesoRapido & {
  fotoUrl: string | null;
  inicial: string;
  perfilLabel: string;
};

const ETIQUETAS_PERFIL: Record<string, string> = {
  'dueño': 'Dueño',
  supervisor: 'Supervisor',
  metre: 'Metre',
  mozo: 'Mozo',
  cocinero: 'Cocinero',
  cantinero: 'Cantinero',
  cliente_registrado: 'Cliente',
};

// Componente externo al login (corrección profesor 13-09-2026): trae los
// accesos rápidos en vivo desde la vista `accesos_rapidos` (un usuario
// real por perfil, con foto/nombre/perfil), en vez de una lista fija. El
// login sigue siendo dueño de la lógica de autenticación/loading/error:
// este componente solo muestra los botones y emite qué credenciales usar.
@Component({
  selector: 'app-accesos-rapidos',
  standalone: true,
  templateUrl: './accesos-rapidos.component.html',
  styleUrls: ['./accesos-rapidos.component.scss'],
})
export class AccesosRapidosComponent implements OnInit {
  accesos: AccesoRapidoVista[] = [];

  @Output() seleccionado = new EventEmitter<{ correo: string; clave: string }>();

  constructor(
    private usuariosService: UsuariosService,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit() {
    try {
      const filas = await this.usuariosService.getAccesosRapidos();
      this.accesos = filas.map((a) => ({
        ...a,
        fotoUrl: this.usuariosService.getFotoPublicUrl(a.foto_url),
        inicial: (a.nombres?.[0] ?? '?').toUpperCase(),
        perfilLabel: ETIQUETAS_PERFIL[a.perfil] ?? a.perfil,
      }));
    } catch {
      // Sin accesos rápidos no bloquea el login: el formulario manual
      // sigue funcionando igual, solo no se muestra la fila de botones.
      try {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      } catch {
        // Ignorar si el dispositivo/navegador no soporta vibración.
      }
    }
    // Mismo gotcha que en LoginPage: la promesa de Supabase resuelve
    // fuera del ciclo de detección de cambios de Angular -- sin esto la
    // fila de accesos rápidos queda cargada en memoria pero invisible.
    this.cdr.detectChanges();
  }

  elegir(acceso: AccesoRapido) {
    this.seleccionado.emit({ correo: acceso.email, clave: environment.claveAccesoRapido });
  }
}
