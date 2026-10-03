import { vi } from 'vitest';
import { AhorcadoPage } from './ahorcado/ahorcado.page';
import { MemotestPage } from './memotest/memotest.page';
import { TriviaPage } from './trivia/trivia.page';

// Revisión final: un doble toque (o un reintento mientras se guarda) no
// tiene que volver a llamar a la base ni pisar un resultado ya guardado.
describe('guardarResultado en las pantallas de juego', () => {
  const route = { snapshot: { paramMap: { get: () => 'm1' } } } as any;
  const router = { navigate: vi.fn() } as any;
  const productos = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, nombre: `P${i}`, fotos: [`f${i}.jpg`] }));

  function juegosMock() {
    return {
      resolverContexto: vi.fn().mockResolvedValue({ mesaId: 'm1', pedidoId: 'p1', esRegistrado: true }),
      iniciarPartida: vi.fn().mockResolvedValue(true),
      terminarPartida: vi.fn().mockResolvedValue({ gano: true, porcentaje: 10, titulo: 't', detalle: 'd' }),
    } as any;
  }

  const crear: Record<string, (j: any) => any> = {
    ahorcado: (j) => new AhorcadoPage(j, route, router),
    memotest: (j) => new MemotestPage(j, { obtenerCarta: vi.fn().mockResolvedValue(productos) } as any, route, router),
    trivia: (j) => new TriviaPage(j, route, router),
  };

  for (const [nombre, fabrica] of Object.entries(crear)) {
    it(`${nombre}: dos llamadas seguidas guardan una sola vez`, async () => {
      const juegos = juegosMock();
      const pagina = fabrica(juegos);
      await pagina.ionViewWillEnter();

      await Promise.all([pagina.guardarResultado(), pagina.guardarResultado()]);

      expect(juegos.terminarPartida).toHaveBeenCalledTimes(1);
      expect(pagina.errorGuardado()).toBe('');
    });

    it(`${nombre}: con un resultado ya guardado no vuelve a llamar a la base`, async () => {
      const juegos = juegosMock();
      const pagina = fabrica(juegos);
      await pagina.ionViewWillEnter();

      await pagina.guardarResultado();
      await pagina.guardarResultado();

      expect(juegos.terminarPartida).toHaveBeenCalledTimes(1);
    });
  }
});
