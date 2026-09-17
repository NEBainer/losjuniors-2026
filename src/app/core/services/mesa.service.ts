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
  cliente_actual_id: string | null;
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
      .select('id, numero, cantidad_comensales, tipo, disponibilidad, foto_url, qr_code, cliente_actual_id')
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
      .select('id, numero, cantidad_comensales, tipo, disponibilidad, foto_url, qr_code, cliente_actual_id')
      .eq('numero', numero)
      .maybeSingle();

    if (error) {
      throw new Error('No se pudo buscar la mesa.');
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
      .select('id, numero, cantidad_comensales, tipo, disponibilidad, foto_url, qr_code, cliente_actual_id')
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
