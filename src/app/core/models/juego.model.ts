// Puntos 14/15: juegos con descuento (schema.sql v12).
export type Juego = 'ahorcado' | 'memotest' | 'trivia';

// Mismo valor que usa registrar_resultado_juego en la base; acá solo se
// usa para mostrarlo en pantalla (la base es la que decide).
export const PORCENTAJE_POR_JUEGO: Record<Juego, number> = {
  ahorcado: 10,
  memotest: 15,
  trivia: 20,
};

// Lo que necesita cualquier pantalla de juego: el pedido confirmado de la
// mesa (= la estadía) y si el cliente puede ganar descuento.
export interface ContextoJuego {
  mesaId: string;
  pedidoId: string;
  esRegistrado: boolean;
}

// Primer intento guardado en juegos_intentos. gano = null: la partida se
// abandonó (cuenta como perdida).
export interface IntentoJuego {
  juego: Juego;
  gano: boolean | null;
  porcentajeObtenido: number;
}

export interface ResultadoPartida {
  gano: boolean;
  porcentaje: number;
  titulo: string;
  detalle: string;
}
