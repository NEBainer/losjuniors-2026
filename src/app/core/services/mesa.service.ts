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
  // Punto 12 (nuevo enfoque): quién está armando el pedido de esta mesa
  // ahora mismo -- null si está libre.
  pedido_en_armado_por: string | null;
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
      .select('id, numero, cantidad_comensales, tipo, disponibilidad, foto_url, qr_code, pedido_en_armado_por')
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

  // Mesa puntual por id (punto 12: la pantalla de pedido necesita saber
  // cuántos comensales tiene esa mesa antes de mostrar el selector).
  async obtenerMesa(id: string): Promise<Mesa> {
    const { data, error } = await this.supabase
      .from('mesas')
      .select('id, numero, cantidad_comensales, tipo, disponibilidad, foto_url, qr_code, pedido_en_armado_por')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error('No se pudo cargar la mesa.');
    }

    return data;
  }

  // Punto 12 (nuevo enfoque): lock de "quién está armando el pedido" de
  // esta mesa, para que solo un comensal a la vez pueda entrar a la
  // pantalla de armado. Va por RPC (funciones security definer en
  // schema.sql) y no por un .update() directo: "authenticated" ya tiene
  // UPDATE de toda la tabla "mesas" por el grant amplio que deja
  // Supabase por default, así que una policy nueva de UPDATE hubiera
  // dejado reescribir numero/tipo/foto_url/qr_code de cualquier mesa
  // ocupada -- la función evita ese hueco sin tocar los grants
  // existentes (ver conversación del equipo).
  //
  // Devuelve true si se pudo tomar el lock, false si ya lo tenía otro
  // comensal (perdiste la carrera por una fracción de segundo -- no es
  // un error). El nombre a mostrar sale de "usuarios.nombres" del
  // usuario logueado -- mismo patrón que ya usa
  // PedidoService.crearPedido() para "creado_por" (no hace falta esperar
  // a que el flujo de cliente_anonimo del punto 9/10 esté resuelto).
  async tomarPedidoEnCurso(mesaId: string): Promise<boolean> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();

    if (!user) {
      throw new Error('No hay una sesión activa para iniciar el pedido.');
    }

    const { data: usuario, error: errorUsuario } = await this.supabase
      .from('usuarios')
      .select('nombres')
      .eq('id', user.id)
      .single();

    if (errorUsuario || !usuario) {
      throw new Error('No se pudo identificar al comensal.');
    }

    const { data, error } = await this.supabase.rpc('tomar_pedido_en_curso', {
      p_mesa_id: mesaId,
      p_nombre: (usuario as any).nombres,
    });

    if (error) {
      throw new Error('No se pudo iniciar el pedido. Probá de nuevo.');
    }

    return !!data;
  }

  // Libera el lock -- se llama al confirmar el pedido con éxito, o al
  // salir de la pantalla de armado sin enviarlo.
  async liberarPedidoEnCurso(mesaId: string): Promise<void> {
    const { error } = await this.supabase.rpc('liberar_pedido_en_curso', { p_mesa_id: mesaId });

    if (error) {
      // No relanzo: si esto falla, lo peor que pasa es que la mesa queda
      // trabada -- no queremos que un fallo acá tape el hecho de que el
      // pedido SÍ se mandó bien (cuando se llama después de confirmar).
      console.error('[MesaService] No se pudo liberar el lock de la mesa', mesaId, error);
    }
  }

  // Tiempo real: para que la carta de todos los comensales de la mesa se
  // entere apenas alguien toma o libera el lock (mismo patrón que
  // PedidoService.escucharConfirmacion).
  escucharPedidoEnCurso(mesaId: string, callback: (nombreComensal: string | null) => void) {
    return this.supabase
      .channel(`mesa-lock-${mesaId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'mesas', filter: `id=eq.${mesaId}` },
        (payload) => callback((payload.new as any).pedido_en_armado_por ?? null),
      )
      .subscribe((status, err) => {
        console.log('[MesaService] Realtime lock mesa', mesaId, 'status:', status, err ?? '');
      });
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
