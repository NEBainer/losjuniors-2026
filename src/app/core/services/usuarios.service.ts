import { Injectable } from '@angular/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { AuthService } from './auth.service';
import { AccesoRapido, ClientePendiente, EstadoAprobacion, PerfilUsuario } from '../models/usuario.model';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class UsuariosService {

  // Reutilizamos el MISMO cliente Supabase que AuthService (getter `client`).(SupabaseService)
  // Crear otro createClient() acá daría dos instancias de GoTrue y la nueva
  // podría no ver la sesión del usuario logueado -> RLS te trataría como
  // anónimo. Ver AVANCES.md (gotcha del punto 6).
  constructor(
    private supabaseService: SupabaseService,
    private authService: AuthService,
  ) {}

  private get sb() {
    return this.supabaseService.client;
  }

  // Perfil ('dueño', 'cocinero', etc.) del usuario logueado. Vive en la
  // tabla `usuarios`, no en supabase.auth -> hay que cruzarlo con la
  // sesión. La policy `usuarios_pueden_ver_su_propio_perfil` habilita
  // este select para cualquier usuario autenticado sobre su propia fila.
  async getPerfilActual(): Promise<PerfilUsuario | null> {
    const sesion = await this.authService.obtenerSesionActual();
    if (!sesion) {
      return null;
    }

    const { data, error } = await this.sb
      .from('usuarios')
      .select('perfil')
      .eq('id', sesion.user.id)
      .single();

    if (error || !data) {
      console.error('Error obteniendo el perfil del usuario:', error);
      return null;
    }

    return data.perfil as PerfilUsuario;
  }

  // Punto 11 (consulta al mozo): id + perfil + nombre del usuario logueado
  // en un solo llamado, para desnormalizar en `mensajes_mozo` al enviar un
  // mensaje. `apellidos` puede ser null (cliente_anonimo no lo carga).
  async obtenerUsuarioActual(): Promise<{ id: string; perfil: PerfilUsuario; nombre: string } | null> {
    const sesion = await this.authService.obtenerSesionActual();
    if (!sesion) {
      return null;
    }

    const { data, error } = await this.sb
      .from('usuarios')
      .select('perfil, nombres, apellidos')
      .eq('id', sesion.user.id)
      .single();

    if (error || !data) {
      console.error('Error obteniendo el usuario actual:', error);
      return null;
    }

    return {
      id: sesion.user.id,
      perfil: data.perfil as PerfilUsuario,
      nombre: [data.nombres, data.apellidos].filter(Boolean).join(' '),
    };
  }

  // Listado del punto 6: clientes registrados en estado 'pendiente'.
  // La lectura de filas ajenas la habilita la policy
  // `dueño_supervisor_ven_todos_usuarios`: con otro perfil esto vuelve [].
  async getClientesPendientes(): Promise<ClientePendiente[]> {
    const { data, error } = await this.sb
      .from('usuarios')
      .select('id, apellidos, nombres, foto_url')
      .eq('perfil', 'cliente_registrado')
      .eq('estado_aprobacion', 'pendiente')
      .order('apellidos', { ascending: true });

    if (error) {
      await Haptics.impact({ style: ImpactStyle.Heavy });
      throw new Error('No se pudo obtener el listado de clientes pendientes.');
    }

    return (data ?? []) as ClientePendiente[];
  }

  // Aceptar / rechazar un cliente (puntos 6, 7, 8). El UPDATE lo habilita
  // la policy `usuarios_dueño_supervisor_actualiza_clientes` (solo
  // dueño/supervisor, solo sobre filas de cliente_registrado).
  // `.select()` al final: si RLS bloquea el update NO tira error, devuelve
  // data vacío -> lo tomamos como fallo explícito.
  async setEstadoCliente(
    id: string,
    estado: Extract<EstadoAprobacion, 'aceptado' | 'rechazado'>
  ): Promise<void> {
    const { data, error } = await this.sb
      .from('usuarios')
      .update({ estado_aprobacion: estado })
      .eq('id', id)
      .eq('perfil', 'cliente_registrado')
      .select('id, email, nombres');

    if (error || !data || data.length === 0) {
      await Haptics.impact({ style: ImpactStyle.Heavy });
      throw new Error(
        'No se pudo actualizar el estado del cliente. Verificá que tu perfil sea dueño o supervisor.'
      );
    }

    const cliente = data[0];
    this.sb.functions.invoke('enviar-correo-estado', {
      body: { email: cliente.email, nombre: cliente.nombres, estado }
    }).catch((err) => console.error('No se pudo enviar el correo', err));
  }

  // Accesos rápidos del login (corrección profesor 13-09): un usuario
  // real por perfil, leído en vivo desde la vista `accesos_rapidos` (sin
  // sesión -> RLS de `usuarios` no aplica, por eso la vista aparte). Se
  // consulta de nuevo en cada carga del login para reflejar cambios de
  // foto sin tocar código.
  async getAccesosRapidos(): Promise<AccesoRapido[]> {
    const { data, error } = await this.sb
      .from('accesos_rapidos')
      .select('perfil, nombres, apellidos, foto_url, email');

    if (error) {
      await Haptics.impact({ style: ImpactStyle.Heavy });
      throw new Error('No se pudieron obtener los accesos rápidos.');
    }

    return (data ?? []) as AccesoRapido[];
  }

  // El bucket `fotos` es público: a partir de un path guardado en
  // `foto_url` (ej. 'usuarios/<id>.jpg') devolvemos la URL pública para
  // usar en un <img>. Si el cliente no tiene foto cargada, null.
  //
  // Filas viejas (de antes de estandarizar a "guardar solo el path")
  // tienen `foto_url` con la URL pública completa ya armada -- pasarla
  // de nuevo por getPublicUrl() la duplica y rompe la imagen (detectado
  // 16/09: fotos de clientes pendientes rotas en la pantalla del dueño).
  // Si ya viene como http(s), se devuelve tal cual.
  getFotoPublicUrl(path: string | null): string | null {
    if (!path) {
      return null;
    }
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    return this.sb.storage.from('fotos').getPublicUrl(path).data.publicUrl;
  }
}
