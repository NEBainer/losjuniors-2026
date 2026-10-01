import {
  MAX_ERRORES, PALABRAS_AHORCADO, ahorcadoGanado, ahorcadoPerdido,
  nuevaPartidaAhorcado, palabraVisible, probarLetra,
} from './ahorcado.logica';

describe('ahorcado.logica', () => {
  const partida = (palabra: string) => nuevaPartidaAhorcado(() => 0, [palabra]);

  it('el banco tiene 15 palabras en mayúsculas y sin tildes en las vocales', () => {
    expect(PALABRAS_AHORCADO.length).toBe(15);
    for (const p of PALABRAS_AHORCADO) expect(p).toMatch(/^[A-ZÑ]+$/);
  });

  it('arranca con todas las letras ocultas y sin errores', () => {
    const e = partida('FLAN');
    expect(palabraVisible(e)).toEqual(['_', '_', '_', '_']);
    expect(e.errores).toBe(0);
  });

  it('una letra correcta se muestra en todas sus posiciones', () => {
    const e = probarLetra(partida('ASADO'), 'A');
    expect(palabraVisible(e)).toEqual(['A', '_', 'A', '_', '_']);
    expect(e.errores).toBe(0);
  });

  it('una letra incorrecta suma un error', () => {
    expect(probarLetra(partida('FLAN'), 'Z').errores).toBe(1);
  });

  it('probar dos veces la misma letra no suma otro error', () => {
    const e = probarLetra(probarLetra(partida('FLAN'), 'Z'), 'Z');
    expect(e.errores).toBe(1);
  });

  it('acepta minúsculas y la Ñ', () => {
    const e = probarLetra(partida('ÑOQUIS'), 'ñ');
    expect(palabraVisible(e)[0]).toBe('Ñ');
  });

  it('gana al descubrir todas las letras', () => {
    let e = partida('FLAN');
    for (const l of ['F', 'L', 'A', 'N']) e = probarLetra(e, l);
    expect(ahorcadoGanado(e)).toBe(true);
    expect(ahorcadoPerdido(e)).toBe(false);
  });

  it(`pierde al llegar a ${MAX_ERRORES} errores y ya no acepta letras`, () => {
    let e = partida('FLAN');
    for (const l of ['B', 'C', 'D', 'E', 'G', 'H']) e = probarLetra(e, l);
    expect(ahorcadoPerdido(e)).toBe(true);
    expect(probarLetra(e, 'F')).toBe(e);
  });

  it('después de ganar no acepta más letras', () => {
    let e = partida('FLAN');
    for (const l of ['F', 'L', 'A', 'N']) e = probarLetra(e, l);
    expect(probarLetra(e, 'Z')).toBe(e);
  });
});
