import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service'; // asume que este archivo vive en src/app/pages/producto/, junto a producto.alta.component.ts
import type { DatosProductoAlta, FotoProducto } from './producto.alta.component';

/**
 * producto.service.ts
 * --------------------
 * Habla con Supabase para el alta de plato/bebida (puntos 2 y 3 del TP).
 * No hace falta un service por tipo: la única diferencia entre plato y
 * bebida es el valor de `tipo`, así que un solo service alcanza para los
 * dos — mismo criterio que usamos para no duplicar el formulario.
 *
 * Sigue el patrón que ya estableció el equipo: no crea su propio
 * createClient(), inyecta SupabaseService y usa su getter `client`.
 *
 * ⚠️ Cosas que tuve que asumir porque no tengo tu esquema real de DB —
 * ajustalas antes de probar esto contra Supabase de verdad:
 *   - Nombre de tabla: 'productos' (con columna 'tipo' = 'plato' | 'bebida')
 *   - Columnas: nombre, descripcion, tiempo_elaboracion_minutos, precio
 *   - Las fotos NO tienen columna en 'productos' — confirmado que viven
 *     solo en Storage, bucket 'fotos', carpeta 'productos/{id}/'. La
 *     asociación producto↔fotos es implícita por esa carpeta, ya que no
 *     hay columna ni tabla de vínculo.
 */
@Injectable({ providedIn: 'root' })
export class ProductoService {
  private readonly supabaseService = inject(SupabaseService);
  private get client() {
    return this.supabaseService.client;
  }

  /** Nombres ya cargados de un tipo, para el chequeo de duplicados del formulario. */
  async obtenerNombresPorTipo(tipo: 'plato' | 'bebida'): Promise<string[]> {
    const { data, error } = await this.client
      .from('productos')
      .select('nombre')
      .eq('tipo', tipo);

    if (error) throw error;
    return (data ?? []).map((fila: any) => fila.nombre as string);
  }

  /**
   * Sube las 3 fotos capturadas al bucket 'fotos', carpeta 'productos/{id}/'.
   * El id del producto ya insertado es lo que las vincula — no hay columna
   * 'fotos' en la tabla, según confirmaron: las fotos viven solo en Storage.
   */
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

  /** webPath de Capacitor Camera es una URL (blob: en web, capacitor: en nativo) — fetch() funciona en ambos casos. */
  private async obtenerBlobDeFoto(foto: FotoProducto): Promise<Blob> {
    const respuesta = await fetch(foto.webPath);
    return respuesta.blob();
  }

  /**
   * Crea el registro primero (sin fotos) y usa el id devuelto para nombrar
   * las fotos en Storage. Si falla la subida de fotos, el producto ya quedó
   * creado igual — ⚠️ si eso no es lo que quieren (por ejemplo, preferir
   * todo o nada), avisame y lo cambio a insertar-borrar-si-falla.
   */
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
}
