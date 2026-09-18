import { Injectable } from '@angular/core';
import { Camera } from '@capacitor/camera';
import { SupabaseService } from './supabase.service';

export interface EstadoCliente {
  id: string;
  estado_aprobacion: 'pendiente' | 'aceptado' | 'rechazado';
}

// Punto 10: fila de la cola para la vista del metre. `nombres`/`apellidos`/
// `foto_url` vienen del embed a `usuarios`, habilitado por la policy
// `usuarios_metre_ve_en_lista_espera` (acotada a quien está en la cola).
export interface FilaListaEspera {
  id: string;
  cliente_id: string;
  created_at: string;
  nombres: string;
  apellidos: string | null;
  foto_url: string | null;
}

@Injectable({ providedIn: 'root' })
export class ClienteService {

  constructor(private supabaseService: SupabaseService) {}

  async tomarFoto(): Promise<string> {
    const foto = await Camera.takePhoto({ quality: 80 });
    return foto.webPath!;
  }

  async subirFoto(webPath: string, uid: string): Promise<string> {
    const blob = await (await fetch(webPath)).blob();
    const nombreArchivo = `usuarios/${uid}/foto.jpg`; 

    const { error } = await this.supabaseService.client.storage
      .from('fotos')
      .upload(nombreArchivo, blob, { contentType: 'image/jpeg', upsert: true });

    if (error) throw error;

    return nombreArchivo;
  }

  async registrarCliente(datos: {
    id: string; // viene de supabase.auth.signUp()
    nombres: string;
    apellidos: string;
    dni: string;
    email: string;
    fotoUrl: string;
  }) {
    const { error } = await this.supabaseService.client.from('usuarios').insert({
      id: datos.id,
      nombres: datos.nombres,
      apellidos: datos.apellidos,
      dni: datos.dni,
      email: datos.email,
      perfil: 'cliente_registrado',
      estado_aprobacion: 'pendiente',
      foto_url: datos.fotoUrl
    });

    if (error) throw error;
  }

  async enviarCorreoEstado(email: string, nombre: string, estado: 'pendiente' | 'aceptado' | 'rechazado', motivo?: string) {
    try {
      await this.supabaseService.client.functions.invoke('enviar-correo-estado', {
        body: { email, nombre, estado, motivo }
      });
    } catch (error) {
      console.error('No se pudo enviar el correo de notificación', error);
      // Que falle el mail no debe bloquear el registro.
    }
  }

  escucharCambioEstado(clienteId: string, callback: (estado: EstadoCliente) => void) {
    return this.supabaseService.client
      .channel(`estado-cliente-${clienteId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'usuarios',
          filter: `id=eq.${clienteId}`
        },
        (payload) => callback(payload.new as EstadoCliente)
      )
      .subscribe();
  }

  async ingresarComoAnonimo(nombre: string, fotoWebPath: string): Promise<string> {
    const { data, error: errorAuth } = await this.supabaseService.client.auth.signInAnonymously();
    if (errorAuth || !data.user) throw errorAuth;

    const fotoUrl = await this.subirFoto(fotoWebPath, data.user.id);

    const { error: errorUsuario } = await this.supabaseService.client.from('usuarios').insert({
      id: data.user.id,
      nombres: nombre,
      perfil: 'cliente_anonimo',
      foto_url: fotoUrl
    });
    if (errorUsuario) throw errorUsuario;

    const { error: errorLista } = await this.supabaseService.client.from('lista_espera').insert({
      cliente_id: data.user.id
    });
    if (errorLista) throw errorLista;

    return data.user.id;
  }

  async salirDeListaEspera(clienteId: string) {
    const { error } = await this.supabaseService.client
      .from('lista_espera')
      .delete()
      .eq('cliente_id', clienteId);
    if (error) throw error;
  }

  // Punto 10: cliente_registrado ya logueado se anota a la lista de espera
  // (a diferencia de ingresarComoAnonimo(), acá no hay que crear sesión ni
  // usuario nuevo, ya existen los dos). La policy `lista_espera_cliente_se_anota`
  // no filtra por perfil (solo auth.uid() = cliente_id), así que no hizo
  // falta ninguna policy nueva para este flujo.
  async unirseAListaEspera(clienteId: string) {
    const { error } = await this.supabaseService.client
      .from('lista_espera')
      .insert({ cliente_id: clienteId });

    if (error) {
      if (error.code === '23505') {
        // cliente_id es unique: ya estaba anotado, no es un error real.
        return;
      }
      throw error;
    }
  }

  // Punto 10: cola completa para la pantalla del metre, con nombre/foto
  // de cada cliente resueltos vía embed (no solo el cliente_id crudo).
  async listarListaEspera(): Promise<FilaListaEspera[]> {
    const { data, error } = await this.supabaseService.client
      .from('lista_espera')
      .select('id, cliente_id, created_at, usuarios(nombres, apellidos, foto_url)')
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error('No se pudo cargar la lista de espera.');
    }

    return (data ?? []).map((fila: any) => ({
      id: fila.id,
      cliente_id: fila.cliente_id,
      created_at: fila.created_at,
      nombres: fila.usuarios?.nombres ?? '(sin nombre)',
      apellidos: fila.usuarios?.apellidos ?? null,
      foto_url: fila.usuarios?.foto_url ?? null,
    }));
  }
}