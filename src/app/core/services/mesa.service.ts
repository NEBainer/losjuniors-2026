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
  // Punto 10: cliente vinculado a la mesa (el metre lo asigna desde la
  // lista de espera).
  cliente_actual_id: string | null;
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
  // la sube antes al bucket "fotos/mesas". El qr_code se arma con el mismo
  // formato JSON que lee QrAppService del lado del cliente (punto 11):
  // {"tipo":"mesa","numero":N} — así el QR generado acá y el que escanea
  // el cliente son el mismo contrato, sin parseo especial de string.
  async crearMesa(datos: NuevaMesa, creadoPor: string, fotoWebPath?: string) {
    let fotoUrl: string | null = null;

    if (fotoWebPath) {
      fotoUrl = await this.subirFotoMesa(fotoWebPath);
    }

    const qrCode = JSON.stringify({ tipo: 'mesa', numero: datos.numero });

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
      .select('id, numero, cantidad_comensales, tipo, disponibilidad, foto_url, qr_code, cliente_actual_id, pedido_en_armado_por')
      .order('numero', { ascending: true });

    if (error) {
      throw new Error('No se pudieron cargar las mesas.');
    }

    return data;
  }

  // Punto 11: resuelve la mesa a partir del número que viene en el QR
  // escaneado ({"tipo":"mesa","numero":N}). null si no existe (QR de una
  // mesa borrada, por ejemplo) en vez de tirar excepción — el llamador
  // decide qué mensaje mostrar.
  async buscarPorNumero(numero: number): Promise<Mesa | null> {
    const { data, error } = await this.supabase
      .from('mesas')
      .select('id, numero, cantidad_comensales, tipo, disponibilidad, foto_url, qr_code, cliente_actual_id, pedido_en_armado_por')
      .eq('numero', numero)
      .maybeSingle();

    if (error) {
      throw new Error('No se pudo buscar la mesa.');
    }

    return data;
  }

  // Mesa puntual por id (punto 12: la pantalla de pedido necesita saber
  // cuántos comensales tiene esa mesa antes de mostrar el selector; y
  // CartaVerComponent la usa cuando se entra por la ruta vieja
  // 'carta/:mesaId', sin número en la URL).
  async obtenerMesa(id: string): Promise<Mesa> {
    const { data, error } = await this.supabase
      .from('mesas')
      .select('id, numero, cantidad_comensales, tipo, disponibilidad, foto_url, qr_code, cliente_actual_id, pedido_en_armado_por')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error('No se pudo cargar la mesa.');
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

  // Punto 10: la mesa que tiene asignada (si tiene) el cliente logueado.
  // `mesas_lectura_autenticados` (using true) ya alcanza para esto — no
  // hace falta ninguna policy nueva, cualquier autenticado puede leer
  // cualquier mesa, acá solo filtramos por su propio id.
  async obtenerMesaAsignada(clienteId: string): Promise<Mesa | null> {
    const { data, error } = await this.supabase
      .from('mesas')
      .select('id, numero, cantidad_comensales, tipo, disponibilidad, foto_url, qr_code, cliente_actual_id, pedido_en_armado_por')
      .eq('cliente_actual_id', clienteId)
      .maybeSingle();

    if (error) {
      throw new Error('No se pudo verificar si ya tenés una mesa asignada.');
    }

    return data;
  }

  // Punto 10: el metre asigna una mesa vacía a un cliente. La policy
  // `mesas_metre_asigna` exige perfil metre Y disponibilidad = 'vacia' en
  // el `using` — si otro metre ya la tomó justo antes (o el usuario no es
  // metre), el update no afecta ninguna fila y `.single()` lo reporta como
  // error, no como éxito silencioso. El índice único parcial
  // `mesas_cliente_actual_unico` cubre el otro caso (mismo cliente en dos
  // mesas): llega como error 23505.
  async asignarCliente(mesaId: string, clienteId: string) {
    const { error } = await this.supabase
      .from('mesas')
      .update({ disponibilidad: 'ocupada', cliente_actual_id: clienteId })
      .eq('id', mesaId)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('Ese cliente ya tiene una mesa asignada.');
      }
      throw new Error('La mesa ya no está disponible. Elegí otra.');
    }

    // Una vez asignada la mesa, el cliente deja de estar "esperando" ->
    // sale de lista_espera acá mismo, no como paso aparte que la pantalla
    // del metre podría olvidarse de llamar. Policy `lista_espera_metre_elimina`
    // (metre/dueño/supervisor) ya cubre este delete, sin policy nueva.
    // Si este paso fallara no deshacemos la asignación (ya está confirmada
    // y es lo importante) — solo queda una fila vieja en la cola, que el
    // gap #27 de AVANCES.md ya identifica como limpieza pendiente antes
    // de demo, no como un problema de seguridad.
    try {
      await this.supabase.from('lista_espera').delete().eq('cliente_id', clienteId);
    } catch {
      // No bloquea el éxito de la asignación.
    }
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
