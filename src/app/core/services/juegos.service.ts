import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { PedidoService } from './pedido.service';
import { UsuariosService } from './usuarios.service';
import { EstadoPedido } from '../models/pedido.model';
import { ContextoJuego, IntentoJuego, Juego, ResultadoPartida } from '../models/juego.model';
import { armarResultado } from '../../pages/juegos/juegos.logica';

// Punto 14: los juegos se habilitan desde que el mozo confirma.
const ESTADOS_CON_JUEGOS: EstadoPedido[] = ['confirmado', 'completo', 'entregado'];

// Puntos 14/15. La regla del descuento (primer intento, no acumulativo,
// solo registrados) la aplica la base en las funciones de schema.sql v11;
// este service solo las llama y traduce los errores a mensajes.
@Injectable({ providedIn: 'root' })
export class JuegosService {
  constructor(
    private supabaseService: SupabaseService,
    private pedidoService: PedidoService,
    private usuariosService: UsuariosService,
  ) {}

  private get client() {
    return this.supabaseService.client;
  }

  // Estadía = pedido confirmado de la mesa (ver schema.sql v11).
  async resolverContexto(mesaId: string): Promise<ContextoJuego> {
    const [pedido, perfil] = await Promise.all([
      this.pedidoService.obtenerPedidoActivoDeMesa(mesaId),
      this.usuariosService.getPerfilActual(),
    ]);

    if (!pedido || !ESTADOS_CON_JUEGOS.includes(pedido.estado)) {
      throw new Error('Los juegos se habilitan cuando el mozo confirma tu pedido.');
    }

    return { mesaId, pedidoId: pedido.id, esRegistrado: perfil === 'cliente_registrado' };
  }

  // true = este es el primer intento (cuenta para el descuento). El
  // anónimo juega libre: no se llama a la base.
  async iniciarPartida(ctx: ContextoJuego, juego: Juego): Promise<boolean> {
    if (!ctx.esRegistrado) return false;

    const { data, error } = await this.client.rpc('iniciar_intento_juego', {
      p_pedido_id: ctx.pedidoId,
      p_juego: juego,
    });

    if (error) throw new Error('No se pudo iniciar la partida. Reintentá.');
    return data === true;
  }

  async terminarPartida(
    ctx: ContextoJuego,
    juego: Juego,
    gano: boolean,
    esPrimerIntento: boolean,
  ): Promise<ResultadoPartida> {
    if (!ctx.esRegistrado || !esPrimerIntento) {
      return armarResultado({ gano, esRegistrado: ctx.esRegistrado, esPrimerIntento: false, porcentaje: 0 });
    }

    const { data, error } = await this.client.rpc('registrar_resultado_juego', {
      p_pedido_id: ctx.pedidoId,
      p_juego: juego,
      p_gano: gano,
    });

    if (error) throw new Error('No se pudo guardar el resultado. Reintentá.');
    return armarResultado({ gano, esRegistrado: true, esPrimerIntento: true, porcentaje: Number(data) || 0 });
  }

  async obtenerIntentos(pedidoId: string): Promise<IntentoJuego[]> {
    const { data, error } = await this.client
      .from('juegos_intentos')
      .select('juego, gano, porcentaje_obtenido')
      .eq('pedido_id', pedidoId);

    if (error) throw new Error('No se pudo cargar el estado de los juegos.');

    return (data ?? []).map((fila: any) => ({
      juego: fila.juego,
      gano: fila.gano,
      porcentajeObtenido: fila.porcentaje_obtenido,
    }));
  }

  // Punto 21 (cuenta): descuento ganado en la estadía, 0 si no hay.
  async descuentoJuegos(pedidoId: string): Promise<number> {
    const { data, error } = await this.client.rpc('descuento_juegos', { p_pedido_id: pedidoId });

    if (error) throw new Error('No se pudo obtener el descuento de los juegos.');
    return Number(data) || 0;
  }
}
