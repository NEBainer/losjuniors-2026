import { Injectable, inject } from '@angular/core';
import { Camera } from '@capacitor/camera';
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

  // Alta de mesa (punto 4): crea la fila en "mesas" y, si se tomó una foto,
  // la sube antes al bucket "fotos/mesas". El qr_code se arma a partir del
  // número de mesa, siguiendo el mismo formato que los datos de prueba.
  async crearMesa(datos: NuevaMesa, creadoPor: string, fotoWebPath?: string) {
    let fotoUrl: string | null = null;

    if (fotoWebPath) {
      fotoUrl = await this.subirFotoMesa(fotoWebPath);
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

  async tomarFoto(): Promise<string> {
    const foto = await Camera.takePhoto({ quality: 80 });
    return foto.webPath!;
  }

  private async subirFotoMesa(webPath: string): Promise<string> {
    const blob = await (await fetch(webPath)).blob();
    const ruta = `mesas/${crypto.randomUUID()}.jpg`;

    const { error } = await this.supabase.storage
      .from('fotos')
      .upload(ruta, blob, { contentType: 'image/jpeg' });

    if (error) {
      throw new Error('No se pudo subir la foto de la mesa.');
    }

    const { data } = this.supabase.storage.from('fotos').getPublicUrl(ruta);
    return data.publicUrl;
  }
}
