import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service'; // ⚠️ AJUSTAR: ruta real de tu AuthService
import type { DatosProductoAlta, FotoProducto } from './producto.alta.component';

/**
 * Habla con Supabase para el alta de plato/bebida.
 *
 * Cosas que tuve que asumir porque no tengo tu esquema real de DB —
 * ajustalas antes de probar esto contra Supabase de verdad:
 *   - Nombre de tabla: 'productos' (con columna 'tipo' = 'plato' | 'bebida')
 *   - Columna de fotos: 'fotos' como array de texto (text[]). Si en tu
 *     esquema son 3 columnas separadas (foto_1, foto_2, foto_3), avisame
 *     y adapto el insert.
 *   - Columnas: nombre, descripcion, tiempo_elaboracion_minutos, precio
 *   - Carpeta de Storage: 'productos/' dentro del bucket 'fotos' (según
 *     lo que ya contaron que está probado con curl para cocinero/cantinero)
 */

@Injectable({ providedIn: 'root' })
export class ProductoService {
  private readonly auth = inject(AuthService);
  private get client() {
    return this.auth.client;
  }

  async obtenerNombresPorTipo(tipo: 'plato' | 'bebida'): Promise<string[]> {
    const { data, error } = await this.client
      .from('productos')
      .select('nombre')
      .eq('tipo', tipo);

    if (error) throw error;
    return (data ?? []).map((fila: any) => fila.nombre as string);
  }

  private async subirFotos(fotos: FotoProducto[], nombreProducto: string): Promise<string[]> {
    const slugNombre = nombreProducto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const urls: string[] = [];
    for (let i = 0; i < fotos.length; i++) {
      const blob = await this.obtenerBlobDeFoto(fotos[i]);
      const extension = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      const ruta = `productos/${slugNombre}-${Date.now()}-${i + 1}.${extension}`;

      const { error: errorSubida } = await this.client.storage
        .from('fotos')
        .upload(ruta, blob, { contentType: blob.type, upsert: false });
      if (errorSubida) throw errorSubida;

      const { data } = this.client.storage.from('fotos').getPublicUrl(ruta);
      urls.push(data.publicUrl);
    }
    return urls;
  }

  private async obtenerBlobDeFoto(foto: FotoProducto): Promise<Blob> {
    const respuesta = await fetch(foto.webPath);
    return respuesta.blob();
  }

  async crearProducto(datos: DatosProductoAlta): Promise<void> {
    const urlsFotos = await this.subirFotos(datos.fotos, datos.nombre);

    const { error } = await this.client.from('productos').insert({
      tipo: datos.tipo,
      nombre: datos.nombre,
      descripcion: datos.descripcion,
      tiempo_elaboracion_minutos: datos.tiempoElaboracionMinutos,
      precio: datos.precio,
      fotos: urlsFotos,
    });

    if (error) throw error;
  }
}
