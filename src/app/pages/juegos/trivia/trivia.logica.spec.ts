import {
  BANCO_TRIVIA, EstadoTrivia, PREGUNTAS_POR_PARTIDA, nuevaPartidaTrivia,
  responder, siguiente, triviaGanada, triviaTerminada,
} from './trivia.logica';

// Responde la pregunta actual bien o mal.
function jugar(e: EstadoTrivia, bien: boolean): EstadoTrivia {
  const p = e.preguntas[e.indice];
  const opcion = bien ? p.correcta : (p.correcta + 1) % p.opciones.length;
  return responder(e, opcion);
}

describe('trivia.logica', () => {
  it('el banco tiene 15 preguntas con 4 opciones distintas cada una', () => {
    expect(BANCO_TRIVIA.length).toBe(15);
    for (const p of BANCO_TRIVIA) {
      expect(new Set([p.correcta, ...p.incorrectas]).size).toBe(4);
    }
  });

  it('una partida tiene 5 preguntas distintas y la correcta está entre las opciones', () => {
    const e = nuevaPartidaTrivia();
    expect(e.preguntas.length).toBe(PREGUNTAS_POR_PARTIDA);
    expect(new Set(e.preguntas.map((p) => p.texto)).size).toBe(PREGUNTAS_POR_PARTIDA);
    for (const p of e.preguntas) {
      const original = BANCO_TRIVIA.find((b) => b.texto === p.texto)!;
      expect(p.opciones[p.correcta]).toBe(original.correcta);
    }
  });

  it('responder dos veces la misma pregunta no suma dos veces', () => {
    let e = nuevaPartidaTrivia();
    const correcta = e.preguntas[0].correcta;
    e = responder(responder(e, correcta), correcta);
    expect(e.correctas).toBe(1);
  });

  it('no avanza si no respondió', () => {
    const e = nuevaPartidaTrivia();
    expect(siguiente(e)).toBe(e);
  });

  it('gana con 5 de 5', () => {
    let e = nuevaPartidaTrivia();
    for (let i = 0; i < PREGUNTAS_POR_PARTIDA; i++) {
      e = jugar(e, true);
      if (i < PREGUNTAS_POR_PARTIDA - 1) e = siguiente(e);
    }
    expect(triviaTerminada(e)).toBe(true);
    expect(triviaGanada(e)).toBe(true);
  });

  it('pierde con 4 de 5', () => {
    let e = nuevaPartidaTrivia();
    for (let i = 0; i < PREGUNTAS_POR_PARTIDA; i++) {
      e = jugar(e, i !== 2);
      if (i < PREGUNTAS_POR_PARTIDA - 1) e = siguiente(e);
    }
    expect(triviaTerminada(e)).toBe(true);
    expect(triviaGanada(e)).toBe(false);
    expect(e.correctas).toBe(4);
  });
});
