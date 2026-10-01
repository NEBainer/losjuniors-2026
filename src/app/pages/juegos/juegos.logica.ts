import { IntentoJuego, Juego, PORCENTAJE_POR_JUEGO, ResultadoPartida } from '../../core/models/juego.model';

// Fisher-Yates sobre una copia. `azar` se puede fijar en los tests.
export function mezclar<T>(lista: T[], azar: () => number = Math.random): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// Texto de la tarjeta de fin de partida. El porcentaje lo decide la base
// (registrar_resultado_juego); acá solo se elige qué mensaje mostrar.
export function armarResultado(datos: {
  gano: boolean;
  esRegistrado: boolean;
  esPrimerIntento: boolean;
  porcentaje: number;
}): ResultadoPartida {
  const { gano, esRegistrado, esPrimerIntento, porcentaje } = datos;
  const tituloLibre = gano ? '¡Ganaste!' : 'Esta vez no fue';

  if (!esRegistrado) {
    return { gano, porcentaje: 0, titulo: tituloLibre, detalle: 'Registrate para ganar descuentos en tu cuenta.' };
  }
  if (!esPrimerIntento) {
    return { gano, porcentaje: 0, titulo: tituloLibre, detalle: 'Juego libre: el descuento se gana solo en el primer intento.' };
  }
  if (gano && porcentaje > 0) {
    return { gano, porcentaje, titulo: `¡Ganaste un ${porcentaje}% de descuento!`, detalle: 'Se aplica automáticamente en tu cuenta.' };
  }
  if (gano) {
    return { gano, porcentaje: 0, titulo: '¡Ganaste!', detalle: 'Ya tenías un descuento de otro juego: los descuentos no se acumulan.' };
  }
  return { gano, porcentaje: 0, titulo: 'No ganaste en el primer intento', detalle: 'Podés seguir jugando libremente, sin descuento.' };
}

export function estadoTarjeta(juego: Juego, intentos: IntentoJuego[], esRegistrado: boolean): string {
  if (!esRegistrado) return 'Juego libre';
  const intento = intentos.find((i) => i.juego === juego);
  if (!intento) return `Primer intento: ganá ${PORCENTAJE_POR_JUEGO[juego]}%`;
  if (intento.gano && intento.porcentajeObtenido > 0) return `Jugado: ganaste ${intento.porcentajeObtenido}%`;
  if (intento.gano) return 'Jugado: ganaste. Ahora es juego libre';
  return 'Jugado: no ganaste. Ahora es juego libre';
}

export function textoBanner(intentos: IntentoJuego[], esRegistrado: boolean): string {
  if (!esRegistrado) return 'Registrate para ganar descuentos en tu cuenta';
  const descuento = Math.max(0, ...intentos.map((i) => i.porcentajeObtenido));
  if (descuento > 0) return `Tenés ${descuento}% de descuento en tu cuenta`;
  return 'Ganá hasta 20% de descuento en tu primer intento';
}
