import { Injectable } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { UsuariosService } from './usuarios.service';

export interface MensajeMozo {
  id: string;
  mesa_id: string;
  remitente_id: string;
  remitente_perfil: string;
  remitente_nombre: string;
  texto: string;
  created_at: string;
}

// Bandeja del mozo: un resumen por mesa (el último mensaje del hilo), no
// el historial completo. `pendiente` = el último mensaje lo mandó el
// cliente y todavía ningún mozo respondió -- se usa para resaltar la fila.
export interface ConsultaResumen {
  mesaId: string;
  numeroMesa: number;
  ultimoTexto: string;
  ultimaFecha: string;
  pendiente: boolean;
}

@Injectable({ providedIn: 'root' })
export class ConsultaMozoService {
  constructor(
    private supabaseService: SupabaseService,
    private usuariosService: UsuariosService,
  ) {}

  private get client() {
    return this.supabaseService.client;
  }

  async enviarMensaje(mesaId: string, texto: string): Promise<void> {
    const usuario = await this.usuariosService.obtenerUsuarioActual();
    if (!usuario) {
      throw new Error('No se pudo identificar al usuario logueado.');
    }

    const { error } = await this.client.from('mensajes_mozo').insert({
      mesa_id: mesaId,
      remitente_id: usuario.id,
      remitente_perfil: usuario.perfil,
      remitente_nombre: usuario.nombre,
      texto,
    });

    if (error) {
      throw new Error('No se pudo enviar el mensaje.');
    }
  }

  async obtenerHistorial(mesaId: string): Promise<MensajeMozo[]> {
    const { data, error } = await this.client
      .from('mensajes_mozo')
      .select('id, mesa_id, remitente_id, remitente_perfil, remitente_nombre, texto, created_at')
      .eq('mesa_id', mesaId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error('No se pudo cargar la consulta.');
    }

    return data ?? [];
  }

  // Devuelve el canal para que el llamador lo cierre en su ngOnDestroy con
  // cerrarCanal() — a diferencia de escucharCambioEstado() en
  // cliente.service.ts (que vive mientras dura la sesión), este chat se
  // abre y cierra varias veces por sesión, así que necesita limpieza.
  escucharMensajesNuevos(mesaId: string, callback: (mensaje: MensajeMozo) => void): RealtimeChannel {
    return this.client
      .channel(`consulta-mesa-${mesaId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensajes_mozo',
          filter: `mesa_id=eq.${mesaId}`,
        },
        (payload) => callback(payload.new as MensajeMozo)
      )
      .subscribe();
  }

  // Bandeja del mozo: una fila por mesa con su último mensaje. La policy
  // `mensajes_mozo_mozo_ve_todo` (ver schema.sql) es la que habilita este
  // select sin filtrar por mesa -- con otro perfil devuelve [].
  // Se pide TODO el historial ordenado por fecha desc y se colapsa acá
  // (no hay `GROUP BY` últimos-por-grupo simple en la API de Supabase)
  // porque el volumen esperado por mesa es bajo.
  async listarConsultasActivas(): Promise<ConsultaResumen[]> {
    const { data, error } = await this.client
      .from('mensajes_mozo')
      .select('mesa_id, remitente_perfil, texto, created_at, mesas(numero)')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error('No se pudieron cargar las consultas.');
    }

    const vistas = new Set<string>();
    const resumen: ConsultaResumen[] = [];
    for (const fila of (data ?? []) as any[]) {
      if (vistas.has(fila.mesa_id) || !fila.mesas) continue;
      vistas.add(fila.mesa_id);
      resumen.push({
        mesaId: fila.mesa_id,
        numeroMesa: fila.mesas.numero,
        ultimoTexto: fila.texto,
        ultimaFecha: fila.created_at,
        pendiente: fila.remitente_perfil !== 'mozo',
      });
    }
    return resumen;
  }

  // Realtime de la bandeja: a diferencia de escucharMensajesNuevos() (un
  // solo hilo), acá no se filtra por mesa_id -- el mozo necesita enterarse
  // de un mensaje nuevo en CUALQUIER mesa para que la bandeja se reordene
  // sola, sin tener que salir y volver a entrar a la pantalla.
  escucharTodasLasConsultas(callback: (mensaje: MensajeMozo) => void): RealtimeChannel {
    return this.client
      .channel('bandeja-consultas-mozo')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensajes_mozo' },
        (payload) => callback(payload.new as MensajeMozo)
      )
      .subscribe();
  }

  cerrarCanal(canal: RealtimeChannel): void {
    this.client.removeChannel(canal);
  }
}
