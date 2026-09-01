import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { Camera } from '@capacitor/camera';

export interface EstadoCliente {
  id: string;
  estado_aprobacion: 'pendiente' | 'aceptado' | 'rechazado';
}

@Injectable({ providedIn: 'root' })
export class ClienteService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  async tomarFoto(): Promise<string> {
    const foto = await Camera.takePhoto({ quality: 80 });
    return foto.webPath!;
  }

  async subirFoto(webPath: string, uid: string): Promise<string> {
    const blob = await (await fetch(webPath)).blob();
    const nombreArchivo = `usuarios/${uid}/foto.jpg`; 

    const { error } = await this.supabase.storage
      .from('fotos')
      .upload(nombreArchivo, blob, { contentType: 'image/jpeg', upsert: true });

    if (error) throw error;

    const { data } = this.supabase.storage
      .from('fotos')
      .getPublicUrl(nombreArchivo);

    return data.publicUrl;
  }

  async registrarCliente(datos: {
    id: string; // viene de supabase.auth.signUp()
    nombres: string;
    apellidos: string;
    dni: string;
    email: string;
    fotoUrl: string;
  }) {
    const { error } = await this.supabase.from('usuarios').insert({
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

  escucharCambioEstado(clienteId: string, callback: (estado: EstadoCliente) => void) {
    return this.supabase
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
}