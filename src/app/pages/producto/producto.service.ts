import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service'; 
import type { DatosProductoAlta, FotoProducto } from './producto.alta.component';

@Injectable({ providedIn: 'root' })
export class ProductoService {
  private readonly supabaseService = inject(SupabaseService);
  private get client() {
    return this.supabaseService.client;
  }

  async obtenerNombresPorTipo(tipo: 'plato' | 'bebida'): Promise<string[]> {
    const { data, error } = await this.client
      .from('productos')
      .select('nombre')
      .eq('tipo', tipo);

    if (error) throw error;
    return (data ?? []).map((fila: any) => fila.nombre as string);
  }

  private async subirFotos(fotos: FotoProducto[], productoId: string): Promise<void> {
    for (let i = 0; i < fotos.length; i++) {
      const blob = await this.obtenerBlobDeFoto(fotos[i]);
      const extension = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      const ruta = `productos/${productoId}/${i + 1}.${extension}`;

      const { error: errorSubida } = await this.client.storage
        .from('fotos')
        .upload(ruta, blob, { contentType: blob.type, upsert: true });
      if (errorSubida) throw errorSubida;
    }
  }

  private async obtenerBlobDeFoto(foto: FotoProducto): Promise<Blob> {
    const respuesta = await fetch(foto.webPath);
    return respuesta.blob();
  }

  async crearProducto(datos: DatosProductoAlta): Promise<void> {
    const { data, error: errorInsert } = await this.client
      .from('productos')
      .insert({
        tipo: datos.tipo,
        nombre: datos.nombre,
        descripcion: datos.descripcion,
        tiempo_elaboracion_minutos: datos.tiempoElaboracionMinutos,
        precio: datos.precio,
      })
      .select('id')
      .single();

    if (errorInsert) throw errorInsert;

    await this.subirFotos(datos.fotos, (data as any).id);
  }

  async obtenerCarta(): Promise<ProductoCarta[]> {
    const { data, error } = await this.client
      .from('productos')
      .select('id, tipo, nombre, descripcion, tiempo_elaboracion_minutos, precio')
      // Productos dados de baja a mano en Supabase (activo_en_carta = false)
      // no deben verse en la carta, aunque sigan en la tabla por los
      // pedidos históricos que los referencian (ver pedido_items.producto_id,
      // sin on delete cascade a propósito).
      .eq('activo_en_carta', true)
      .order('nombre', { ascending: true });

    if (error) throw error;

    const filas = (data ?? []) as any[];

    return Promise.all(
      filas.map(async (fila) => ({
        id: fila.id as string,
        tipo: fila.tipo as 'plato' | 'bebida',
        nombre: fila.nombre as string,
        descripcion: fila.descripcion as string,
        tiempoElaboracionMinutos: fila.tiempo_elaboracion_minutos as number,
        precio: fila.precio as number,
        fotos: await this.obtenerFotosDelProducto(fila.id),
      }))
    );
  }

  private async obtenerFotosDelProducto(productoId: string): Promise<string[]> {
    const { data, error } = await this.client.storage
      .from('fotos')
      .list(`productos/${productoId}`);

    if (error || !data) return [];

    return data
      .filter((archivo) => !!archivo.name)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
      .map((archivo) => {
        const ruta = `productos/${productoId}/${archivo.name}`;
        const { data: publica } = this.client.storage.from('fotos').getPublicUrl(ruta);
        return publica.publicUrl;
      });
  }
}

export interface ProductoCarta {
  id: string;
  tipo: 'plato' | 'bebida';
  nombre: string;
  descripcion: string;
  tiempoElaboracionMinutos: number;
  precio: number;
  fotos: string[];
}