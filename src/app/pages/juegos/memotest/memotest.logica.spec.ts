import {
  EstadoMemotest, ImagenMemotest, MAX_MOVIMIENTOS, darVuelta, hayQueOcultar,
  memotestGanado, memotestPerdido, nuevaPartidaMemotest, ocultarNoEmparejadas,
} from './memotest.logica';

const imagenes = (n: number): ImagenMemotest[] =>
  Array.from({ length: n }, (_, i) => ({ parId: `p${i}`, imagen: `img${i}.jpg`, nombre: `Producto ${i}` }));

// Las cartas salen mezcladas: se busca cada par por parId para no
// depender del orden.
const idsDelPar = (e: EstadoMemotest, parId: string) => e.cartas.filter((c) => c.parId === parId).map((c) => c.id);

describe('memotest.logica', () => {
  it('arma 2 cartas por imagen, como máximo 6 pares', () => {
    expect(nuevaPartidaMemotest(imagenes(8)).cartas.length).toBe(12);
    expect(nuevaPartidaMemotest(imagenes(4)).cartas.length).toBe(8);
  });

  it('con menos de 3 imágenes no se puede jugar', () => {
    expect(() => nuevaPartidaMemotest(imagenes(2))).toThrow('No hay suficientes productos con foto para jugar.');
  });

  it('dar vuelta un par igual lo deja emparejado y suma 1 movimiento', () => {
    let e = nuevaPartidaMemotest(imagenes(3));
    const [a, b] = idsDelPar(e, 'p0');
    e = darVuelta(darVuelta(e, a), b);
    expect(e.movimientos).toBe(1);
    expect(e.cartas.filter((c) => c.emparejada).length).toBe(2);
    expect(hayQueOcultar(e)).toBe(false);
  });

  it('dar vuelta dos distintas las deja visibles hasta ocultarlas', () => {
    let e = nuevaPartidaMemotest(imagenes(3));
    e = darVuelta(darVuelta(e, idsDelPar(e, 'p0')[0]), idsDelPar(e, 'p1')[0]);
    expect(e.movimientos).toBe(1);
    expect(hayQueOcultar(e)).toBe(true);
    e = ocultarNoEmparejadas(e);
    expect(e.cartas.every((c) => !c.descubierta)).toBe(true);
    expect(e.seleccionadas).toEqual([]);
  });

  it('no deja dar vuelta una tercera carta mientras hay dos a la vista', () => {
    let e = nuevaPartidaMemotest(imagenes(3));
    e = darVuelta(darVuelta(e, idsDelPar(e, 'p0')[0]), idsDelPar(e, 'p1')[0]);
    expect(darVuelta(e, idsDelPar(e, 'p2')[0])).toBe(e);
  });

  it('tocar dos veces la misma carta no cuenta como movimiento', () => {
    let e = nuevaPartidaMemotest(imagenes(3));
    const id = idsDelPar(e, 'p0')[0];
    e = darVuelta(darVuelta(e, id), id);
    expect(e.movimientos).toBe(0);
    expect(e.seleccionadas).toEqual([id]);
  });

  it('gana si empareja todo dentro del límite de movimientos', () => {
    let e = nuevaPartidaMemotest(imagenes(3));
    for (const par of ['p0', 'p1', 'p2']) {
      const [a, b] = idsDelPar(e, par);
      e = darVuelta(darVuelta(e, a), b);
    }
    expect(memotestGanado(e)).toBe(true);
    expect(memotestPerdido(e)).toBe(false);
  });

  it(`pierde al llegar a ${MAX_MOVIMIENTOS} movimientos sin terminar y ya no acepta jugadas`, () => {
    let e = nuevaPartidaMemotest(imagenes(3));
    for (let i = 0; i < MAX_MOVIMIENTOS; i++) {
      e = darVuelta(darVuelta(e, idsDelPar(e, 'p0')[0]), idsDelPar(e, 'p1')[0]);
      e = ocultarNoEmparejadas(e);
    }
    expect(memotestPerdido(e)).toBe(true);
    expect(darVuelta(e, idsDelPar(e, 'p2')[0])).toBe(e);
  });
});
