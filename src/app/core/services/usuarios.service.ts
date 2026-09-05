import { Injectable } from '@angular/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { AuthService } from './auth.service';
import { ClientePendiente, EstadoAprobacion } from '../models/usuario.model';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class UsuariosService {

  // Reutilizamos el MISMO cliente Supabase que AuthService (getter `client`).(SupabaseService)
  // Crear otro createClient() acá daría dos instancias de GoTrue y la nueva
  // podría no ver la sesión del usuario logueado -> RLS te trataría como
  // anónimo. Ver AVANCES.md (gotcha del punto 6).
  constructor(private supabaseService: SupabaseService) {}

  private get sb() {
    return this.supabaseService.client;
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
      .select('id');

    if (error || !data || data.length === 0) {
      await Haptics.impact({ style: ImpactStyle.Heavy });
      throw new Error(
        'No se pudo actualizar el estado del cliente. Verificá que tu perfil sea dueño o supervisor.'
      );
    }
  }

  // El bucket `fotos` es público: a partir de un path guardado en
  // `foto_url` (ej. 'usuarios/<id>.jpg') devolvemos la URL pública para
  // usar en un <img>. Si el cliente no tiene foto cargada, null.
  getFotoPublicUrl(path: string | null): string | null {
    if (!path) {
      return null;
    }
    return this.sb.storage.from('fotos').getPublicUrl(path).data.publicUrl;
  }
}
