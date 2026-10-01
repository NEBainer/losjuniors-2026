import { armarResultado, estadoTarjeta, mezclar, textoBanner } from './juegos.logica';

describe('juegos.logica', () => {
  describe('mezclar', () => {
    it('devuelve los mismos elementos sin modificar la lista original', () => {
      const original = [1, 2, 3, 4, 5];
      const mezclada = mezclar(original, () => 0.3);
      expect([...mezclada].sort()).toEqual([1, 2, 3, 4, 5]);
      expect(original).toEqual([1, 2, 3, 4, 5]);
    });

    it('con azar fijo da siempre el mismo orden', () => {
      expect(mezclar([1, 2, 3], () => 0)).toEqual(mezclar([1, 2, 3], () => 0));
    });
  });

  describe('armarResultado', () => {
    it('registrado que gana el primer intento con porcentaje', () => {
      const r = armarResultado({ gano: true, esRegistrado: true, esPrimerIntento: true, porcentaje: 15 });
      expect(r.titulo).toBe('¡Ganaste un 15% de descuento!');
      expect(r.porcentaje).toBe(15);
    });

    it('registrado que gana pero ya tenía descuento', () => {
      const r = armarResultado({ gano: true, esRegistrado: true, esPrimerIntento: true, porcentaje: 0 });
      expect(r.titulo).toBe('¡Ganaste!');
      expect(r.detalle).toContain('no se acumulan');
    });

    it('registrado que pierde el primer intento', () => {
      const r = armarResultado({ gano: false, esRegistrado: true, esPrimerIntento: true, porcentaje: 0 });
      expect(r.titulo).toBe('No ganaste en el primer intento');
    });

    it('juego libre', () => {
      const r = armarResultado({ gano: true, esRegistrado: true, esPrimerIntento: false, porcentaje: 0 });
      expect(r.detalle).toContain('Juego libre');
    });

    it('anónimo nunca ve porcentaje', () => {
      const r = armarResultado({ gano: true, esRegistrado: false, esPrimerIntento: false, porcentaje: 0 });
      expect(r.detalle).toContain('Registrate');
      expect(r.porcentaje).toBe(0);
    });
  });

  describe('estadoTarjeta', () => {
    it('sin intento muestra el porcentaje a ganar', () => {
      expect(estadoTarjeta('trivia', [], true)).toBe('Primer intento: ganá 20%');
    });

    it('intento ganado con porcentaje', () => {
      expect(estadoTarjeta('ahorcado', [{ juego: 'ahorcado', gano: true, porcentajeObtenido: 10 }], true))
        .toBe('Jugado: ganaste 10%');
    });

    it('intento abandonado cuenta como no ganado', () => {
      expect(estadoTarjeta('memotest', [{ juego: 'memotest', gano: null, porcentajeObtenido: 0 }], true))
        .toBe('Jugado: no ganaste. Ahora es juego libre');
    });

    it('anónimo siempre ve juego libre', () => {
      expect(estadoTarjeta('trivia', [], false)).toBe('Juego libre');
    });
  });

  describe('textoBanner', () => {
    it('con descuento ganado', () => {
      expect(textoBanner([{ juego: 'trivia', gano: true, porcentajeObtenido: 20 }], true))
        .toBe('Tenés 20% de descuento en tu cuenta');
    });

    it('sin descuento todavía', () => {
      expect(textoBanner([], true)).toBe('Ganá hasta 20% de descuento en tu primer intento');
    });

    it('anónimo', () => {
      expect(textoBanner([], false)).toBe('Registrate para ganar descuentos en tu cuenta');
    });
  });
});
