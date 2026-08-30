import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface NuevaMesa {
  numero: number;
  cantidad_comensales: number;
  tipo: 'vip' | 'estandar' | 'movilidad_reducida';
}

@Injectable({
  providedIn: 'root'
})
export class MesaService {
  private supabase = inject(SupabaseService).client;

  // Alta de mesa (punto 4): crea la fila en "mesas" y, si se cargó una foto,
  // la sube antes al bucket "fotos/mesas". El qr_code se arma a partir del
  // número de mesa, siguiendo el mismo formato que los datos de prueba.
  async crearMesa(datos: NuevaMesa, creadoPor: string, foto?: File) {
    let fotoUrl: string | null = null;

    if (foto) {
      fotoUrl = await this.subirFotoMesa(foto);
    }

    const qrCode = `MESA-${datos.numero}`;

    const { data, error } = await this.supabase
      .from('mesas')
      .insert({
        numero: datos.numero,
        cantidad_comensales: datos.cantidad_comensales,
        tipo: datos.tipo,
        qr_code: qrCode,
        foto_url: fotoUrl,
        creado_por: creadoPor,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error(`Ya existe una mesa con el número ${datos.numero}.`);
      }
      if (error.code === '42501') {
        throw new Error('No tenés permisos para dar de alta una mesa.');
      }
      throw new Error('No se pudo crear la mesa. Intente nuevamente.');
    }

    return data;
  }

  private async subirFotoMesa(foto: File): Promise<string> {
    const extension = foto.name.split('.').pop();
    const ruta = `mesas/${crypto.randomUUID()}.${extension}`;

    const { error } = await this.supabase.storage
      .from('fotos')
      .upload(ruta, foto);

    if (error) {
      throw new Error('No se pudo subir la foto de la mesa.');
    }

    const { data } = this.supabase.storage.from('fotos').getPublicUrl(ruta);
    return data.publicUrl;
  }
}
