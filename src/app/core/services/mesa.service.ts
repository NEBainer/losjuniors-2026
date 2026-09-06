import { Injectable, inject } from '@angular/core';
import { Camera } from '@capacitor/camera';
import { SupabaseService } from './supabase.service';

export interface NuevaMesa {
  numero: number;
  cantidad_comensales: number;
  tipo: 'vip' | 'estandar' | 'movilidad_reducida';
}

export interface Mesa {
  id: string;
  numero: number;
  cantidad_comensales: number;
  tipo: 'vip' | 'estandar' | 'movilidad_reducida';
  disponibilidad: 'vacia' | 'ocupada';
  foto_url: string | null;
  qr_code: string;
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

  // Listado de gestión de mesas (punto 4): trae todas las mesas para
  // verificar la existencia de la recién creada y poder modificar su
  // disponibilidad.
  async listarMesas(): Promise<Mesa[]> {
    const { data, error } = await this.supabase
      .from('mesas')
      .select('id, numero, cantidad_comensales, tipo, disponibilidad, foto_url, qr_code')
      .order('numero', { ascending: true });

    if (error) {
      throw new Error('No se pudieron cargar las mesas.');
    }

    return data;
  }

  async actualizarDisponibilidad(id: string, disponibilidad: 'vacia' | 'ocupada') {
    // .select().single() para que, si RLS bloquea el update (0 filas
    // afectadas), Supabase lo reporte como error en vez de un éxito vacío.
    const { error } = await this.supabase
      .from('mesas')
      .update({ disponibilidad })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error('No se pudo actualizar la disponibilidad de la mesa.');
    }
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
