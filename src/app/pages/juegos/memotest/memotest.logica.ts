import { mezclar } from '../juegos.logica';

// Punto 15: memotest con fotos reales de la carta (15% en el primer intento).
export const PARES_MEMOTEST = 6;
export const MIN_PARES_MEMOTEST = 3;
// Movimiento = dar vuelta 2 cartas. Con 6 pares el mínimo posible es 6.
export const MAX_MOVIMIENTOS = 16;

export interface ImagenMemotest {
  parId: string;
  imagen: string;
  nombre: string;
}

export interface CartaMemotest extends ImagenMemotest {
  id: number;
  descubierta: boolean;
  emparejada: boolean;
}

export interface EstadoMemotest {
  cartas: CartaMemotest[];
  seleccionadas: number[];
  movimientos: number;
}

export function nuevaPartidaMemotest(imagenes: ImagenMemotest[], azar: () => number = Math.random): EstadoMemotest {
  if (imagenes.length < MIN_PARES_MEMOTEST) {
    throw new Error('No hay suficientes productos con foto para jugar.');
  }
  const elegidas = imagenes.slice(0, PARES_MEMOTEST);
  const cartas = mezclar([...elegidas, ...elegidas], azar).map((img, id) => ({
    ...img,
    id,
    descubierta: false,
    emparejada: false,
  }));
  return { cartas, seleccionadas: [], movimientos: 0 };
}

export function memotestGanado(estado: EstadoMemotest): boolean {
  return estado.cartas.every((c) => c.emparejada) && estado.movimientos <= MAX_MOVIMIENTOS;
}

export function memotestPerdido(estado: EstadoMemotest): boolean {
  return !estado.cartas.every((c) => c.emparejada) && estado.movimientos >= MAX_MOVIMIENTOS;
}

// Dos cartas distintas a la vista: la página espera un momento y llama a
// ocultarNoEmparejadas().
export function hayQueOcultar(estado: EstadoMemotest): boolean {
  return estado.seleccionadas.length === 2;
}

// Devuelve el mismo objeto si la jugada no vale (carta ya visible, dos a
// la vista esperando ocultarse, o partida terminada).
export function darVuelta(estado: EstadoMemotest, cartaId: number): EstadoMemotest {
  const carta = estado.cartas.find((c) => c.id === cartaId);
  if (
    !carta || carta.descubierta || carta.emparejada || hayQueOcultar(estado) ||
    memotestGanado(estado) || memotestPerdido(estado)
  ) {
    return estado;
  }

  const seleccionadas = [...estado.seleccionadas, cartaId];
  let cartas = estado.cartas.map((c) => (c.id === cartaId ? { ...c, descubierta: true } : c));

  if (seleccionadas.length < 2) {
    return { ...estado, cartas, seleccionadas };
  }

  const [a, b] = seleccionadas.map((id) => cartas.find((c) => c.id === id)!);
  const movimientos = estado.movimientos + 1;
  if (a.parId === b.parId) {
    cartas = cartas.map((c) => (c.id === a.id || c.id === b.id ? { ...c, emparejada: true } : c));
    return { cartas, seleccionadas: [], movimientos };
  }
  return { cartas, seleccionadas, movimientos };
}

export function ocultarNoEmparejadas(estado: EstadoMemotest): EstadoMemotest {
  return {
    ...estado,
    cartas: estado.cartas.map((c) => (c.emparejada ? c : { ...c, descubierta: false })),
    seleccionadas: [],
  };
}
