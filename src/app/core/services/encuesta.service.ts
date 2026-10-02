import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { EstadiaActual, RespuestasEncuesta, ResultadosEncuestas } from '../models/encuesta.model';

@Injectable({ providedIn: 'root' })
export class EncuestaService {
  private supabase = inject(SupabaseService).client;

  // Punto 20: "una por estadía". La estadía es la asignación actual del
  // cliente a una mesa (mesas.cliente_actual_id + asignada_en, ver v9 en
  // schema.sql). Devuelve null si el cliente no tiene mesa asignada: sin
  // estadía en curso no hay encuesta que completar.
  async obtenerEstadiaActual(): Promise<EstadiaActual | null> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) {
      throw new Error('Tu sesión expiró. Volvé a ingresar.');
    }

    const { data: mesa, error } = await this.supabase
      .from('mesas')
      .select('id, numero, asignada_en')
      .eq('cliente_actual_id', user.id)
      .maybeSingle();

    if (error) {
      throw new Error('No se pudo verificar tu mesa asignada.');
    }
    if (!mesa) return null;
    if (!mesa.asignada_en) {
      throw new Error('Tu mesa todavía no tiene la estadía registrada. Pedile ayuda al mozo.');
    }

    const { count, error: errorEncuesta } = await this.supabase
      .from('encuestas')
      .select('id', { count: 'exact', head: true })
      .eq('cliente_id', user.id)
      .eq('estadia_inicio', mesa.asignada_en);

    if (errorEncuesta) {
      throw new Error('No se pudo verificar si ya completaste la encuesta.');
    }

    return {
      mesaId: mesa.id,
      mesaNumero: mesa.numero,
      estadiaInicio: mesa.asignada_en,
      yaRespondio: (count ?? 0) > 0,
    };
  }

  async enviar(estadia: EstadiaActual, respuestas: RespuestasEncuesta): Promise<void> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (!user) {
      throw new Error('Tu sesión expiró. Volvé a ingresar.');
    }

    const { error } = await this.supabase.from('encuestas').insert({
      cliente_id: user.id,
      mesa_id: estadia.mesaId,
      estadia_inicio: estadia.estadiaInicio,
      calificacion_general: respuestas.calificacionGeneral,
      atencion_mozo: respuestas.atencionMozo,
      limpieza: respuestas.limpieza,
      aspectos_destacados: respuestas.aspectosDestacados,
      recomendaria: respuestas.recomendaria,
      comentario: respuestas.comentario.trim(),
    });

    if (error) {
      // unique (cliente_id, estadia_inicio): ya había una encuesta de esta
      // estadía (por ejemplo, enviada desde otro dispositivo).
      if (error.code === '23505') {
        throw new Error('Ya completaste la encuesta en esta visita.');
      }
      // La policy de insert rechaza si la mesa ya no es tuya (el mozo la
      // liberó mientras completabas la encuesta).
      if (error.code === '42501') {
        throw new Error('Tu mesa ya no está asignada, no se puede guardar la encuesta.');
      }
      throw new Error('No se pudo enviar la encuesta. Intentá de nuevo.');
    }
  }

  // Va por RPC y no por un select a `encuestas`: la función devuelve solo
  // totales y la puede llamar también alguien sin sesión (QR de ingreso).
  async obtenerResultados(): Promise<ResultadosEncuestas> {
    const { data, error } = await this.supabase.rpc('resultados_encuestas');

    if (error || !data) {
      throw new Error('No se pudieron cargar los resultados de las encuestas.');
    }

    return {
      total: Number(data.total ?? 0),
      promedioPorDia: (data.promedio_por_dia ?? []).map((fila: { dia: string; promedio: number | string }) => ({
        dia: fila.dia,
        promedio: Number(fila.promedio),
      })),
      atencionMozo: data.atencion_mozo ?? {},
      limpieza: data.limpieza ?? {},
      aspectosDestacados: data.aspectos_destacados ?? {},
      recomendaria: {
        si: Number(data.recomendaria?.si ?? 0),
        no: Number(data.recomendaria?.no ?? 0),
      },
    };
  }
}