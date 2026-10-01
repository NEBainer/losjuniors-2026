import { mezclar } from '../juegos.logica';

// Punto 15: trivia gastronómica (20% en el primer intento, hay que
// acertar las 5).
export interface PreguntaBanco {
  texto: string;
  correcta: string;
  incorrectas: [string, string, string];
}

export interface PreguntaTrivia {
  texto: string;
  opciones: string[];
  correcta: number;
}

export interface EstadoTrivia {
  preguntas: PreguntaTrivia[];
  indice: number;
  correctas: number;
  respuestaElegida: number | null;
}

export const PREGUNTAS_POR_PARTIDA = 5;

export const BANCO_TRIVIA: PreguntaBanco[] = [
  { texto: '¿De qué país es originario el sushi?', correcta: 'Japón', incorrectas: ['China', 'Corea', 'Tailandia'] },
  { texto: '¿Cuál es el ingrediente principal del guacamole?', correcta: 'Palta', incorrectas: ['Tomate', 'Pepino', 'Arvejas'] },
  { texto: '¿Qué queso lleva tradicionalmente la pizza margarita?', correcta: 'Mozzarella', incorrectas: ['Roquefort', 'Parmesano', 'Cheddar'] },
  { texto: '¿Con qué se hace el dulce de leche?', correcta: 'Leche y azúcar', incorrectas: ['Leche y miel', 'Crema y cacao', 'Leche y harina'] },
  { texto: '¿Qué es la provoleta?', correcta: 'Un queso a la parrilla', incorrectas: ['Un corte de carne', 'Una salsa', 'Un postre'] },
  { texto: '¿De qué país es típica la paella?', correcta: 'España', incorrectas: ['Italia', 'México', 'Portugal'] },
  { texto: '¿Qué hierba es la base del chimichurri?', correcta: 'Perejil', incorrectas: ['Albahaca', 'Menta', 'Cilantro'] },
  { texto: '¿De qué fruta se hace la sidra?', correcta: 'Manzana', incorrectas: ['Uva', 'Durazno', 'Naranja'] },
  { texto: '¿Con qué cereal se prepara el risotto?', correcta: 'Arroz', incorrectas: ['Trigo', 'Cebada', 'Maíz'] },
  { texto: '¿Cuál de estos es un corte de carne vacuna?', correcta: 'Vacío', incorrectas: ['Bondiola', 'Pechuga', 'Pata muslo'] },
  { texto: '¿De qué está hecho el tofu?', correcta: 'Soja', incorrectas: ['Arroz', 'Garbanzo', 'Leche de vaca'] },
  { texto: '¿Qué bebida se prepara con yerba?', correcta: 'Mate', incorrectas: ['Café', 'Chocolate', 'Cerveza'] },
  { texto: '¿Qué especia le da el color amarillo a la paella?', correcta: 'Azafrán', incorrectas: ['Pimentón', 'Comino', 'Canela'] },
  { texto: '¿Cuál es el ingrediente principal del hummus?', correcta: 'Garbanzo', incorrectas: ['Lenteja', 'Poroto', 'Arveja'] },
  { texto: '¿Cuál de estos alimentos es una legumbre?', correcta: 'Lenteja', incorrectas: ['Papa', 'Zanahoria', 'Arroz'] },
];

export function nuevaPartidaTrivia(
  azar: () => number = Math.random,
  banco: PreguntaBanco[] = BANCO_TRIVIA,
): EstadoTrivia {
  const preguntas = mezclar(banco, azar)
    .slice(0, PREGUNTAS_POR_PARTIDA)
    .map((p) => {
      const opciones = mezclar([p.correcta, ...p.incorrectas], azar);
      return { texto: p.texto, opciones, correcta: opciones.indexOf(p.correcta) };
    });
  return { preguntas, indice: 0, correctas: 0, respuestaElegida: null };
}

// Mismo objeto si ya respondió esta pregunta (doble toque).
export function responder(estado: EstadoTrivia, opcion: number): EstadoTrivia {
  if (estado.respuestaElegida !== null) return estado;
  const acerto = estado.preguntas[estado.indice].correcta === opcion;
  return { ...estado, respuestaElegida: opcion, correctas: estado.correctas + (acerto ? 1 : 0) };
}

export function triviaTerminada(estado: EstadoTrivia): boolean {
  return estado.indice === estado.preguntas.length - 1 && estado.respuestaElegida !== null;
}

export function triviaGanada(estado: EstadoTrivia): boolean {
  return triviaTerminada(estado) && estado.correctas === estado.preguntas.length;
}

export function siguiente(estado: EstadoTrivia): EstadoTrivia {
  if (estado.respuestaElegida === null || triviaTerminada(estado)) return estado;
  return { ...estado, indice: estado.indice + 1, respuestaElegida: null };
}
