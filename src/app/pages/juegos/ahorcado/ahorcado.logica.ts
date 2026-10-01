// Punto 15: ahorcado gastronómico (10% de descuento en el primer intento).
// Se eligieron palabras que no llevan tilde, así el teclado no necesita
// vocales acentuadas y ninguna queda mal escrita.
export const PALABRAS_AHORCADO = [
  'MILANESA', 'EMPANADA', 'ÑOQUIS', 'PROVOLETA', 'CHIMICHURRI',
  'ALFAJOR', 'LOCRO', 'MATAMBRE', 'FLAN', 'TALLARINES',
  'ASADO', 'MOLLEJAS', 'HUMITA', 'CANELONES', 'RAVIOLES',
];

export const MAX_ERRORES = 6;

export const LETRAS_TECLADO = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('');

export interface EstadoAhorcado {
  palabra: string;
  letrasProbadas: string[];
  errores: number;
}

export function nuevaPartidaAhorcado(
  azar: () => number = Math.random,
  palabras: string[] = PALABRAS_AHORCADO,
): EstadoAhorcado {
  const palabra = palabras[Math.floor(azar() * palabras.length)];
  return { palabra, letrasProbadas: [], errores: 0 };
}

export function ahorcadoGanado(estado: EstadoAhorcado): boolean {
  return estado.palabra.split('').every((l) => estado.letrasProbadas.includes(l));
}

export function ahorcadoPerdido(estado: EstadoAhorcado): boolean {
  return estado.errores >= MAX_ERRORES;
}

// Devuelve el mismo objeto si la jugada no cambia nada (letra repetida o
// partida terminada): así un doble toque no cuenta dos veces.
export function probarLetra(estado: EstadoAhorcado, letra: string): EstadoAhorcado {
  const l = letra.toUpperCase();
  if (estado.letrasProbadas.includes(l) || ahorcadoGanado(estado) || ahorcadoPerdido(estado)) {
    return estado;
  }
  return {
    ...estado,
    letrasProbadas: [...estado.letrasProbadas, l],
    errores: estado.palabra.includes(l) ? estado.errores : estado.errores + 1,
  };
}

export function palabraVisible(estado: EstadoAhorcado): string[] {
  return estado.palabra.split('').map((l) => (estado.letrasProbadas.includes(l) ? l : '_'));
}
