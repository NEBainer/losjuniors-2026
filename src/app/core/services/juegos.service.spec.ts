import { vi } from 'vitest';
import { JuegosService } from './juegos.service';
import { ContextoJuego } from '../models/juego.model';

describe('JuegosService', () => {
  const ctxRegistrado: ContextoJuego = { mesaId: 'm1', pedidoId: 'p1', esRegistrado: true };
  const ctxAnonimo: ContextoJuego = { mesaId: 'm1', pedidoId: 'p1', esRegistrado: false };

  function crear(opciones: { rpc?: any; from?: any; pedido?: any; perfil?: any } = {}) {
    const client = { rpc: opciones.rpc ?? vi.fn(), from: opciones.from ?? vi.fn() };
    const pedidoService = { obtenerPedidoActivoDeMesa: vi.fn().mockResolvedValue(opciones.pedido ?? null) } as any;
    const usuariosService = { getPerfilActual: vi.fn().mockResolvedValue(opciones.perfil ?? null) } as any;
    const servicio = new JuegosService({ client } as any, pedidoService, usuariosService);
    return { servicio, client };
  }

  it('resolverContexto arma el contexto con el pedido confirmado', async () => {
    const { servicio } = crear({ pedido: { id: 'p1', estado: 'confirmado' }, perfil: 'cliente_registrado' });
    await expect(servicio.resolverContexto('m1')).resolves.toEqual({ mesaId: 'm1', pedidoId: 'p1', esRegistrado: true });
  });

  it('resolverContexto rechaza si el pedido todavía no está confirmado', async () => {
    const { servicio } = crear({ pedido: { id: 'p1', estado: 'pendiente_confirmacion' }, perfil: 'cliente_registrado' });
    await expect(servicio.resolverContexto('m1')).rejects.toThrow('Los juegos se habilitan cuando el mozo confirma tu pedido.');
  });

  it('resolverContexto marca al anónimo como no registrado', async () => {
    const { servicio } = crear({ pedido: { id: 'p1', estado: 'entregado' }, perfil: 'cliente_anonimo' });
    expect((await servicio.resolverContexto('m1')).esRegistrado).toBe(false);
  });

  it('iniciarPartida no llama a la base para el anónimo', async () => {
    const rpc = vi.fn();
    const { servicio } = crear({ rpc });
    await expect(servicio.iniciarPartida(ctxAnonimo, 'trivia')).resolves.toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('iniciarPartida devuelve false si la base dice que ya se jugó (abandono previo)', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    const { servicio } = crear({ rpc });
    await expect(servicio.iniciarPartida(ctxRegistrado, 'ahorcado')).resolves.toBe(false);
    expect(rpc).toHaveBeenCalledWith('iniciar_intento_juego', { p_pedido_id: 'p1', p_juego: 'ahorcado' });
  });

  it('iniciarPartida propaga el error con mensaje en español', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'x' } });
    const { servicio } = crear({ rpc });
    await expect(servicio.iniciarPartida(ctxRegistrado, 'ahorcado')).rejects.toThrow('No se pudo iniciar la partida. Reintentá.');
  });

  it('terminarPartida en primer intento guarda y devuelve el porcentaje de la base', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 15, error: null });
    const { servicio } = crear({ rpc });
    const r = await servicio.terminarPartida(ctxRegistrado, 'memotest', true, true);
    expect(rpc).toHaveBeenCalledWith('registrar_resultado_juego', { p_pedido_id: 'p1', p_juego: 'memotest', p_gano: true });
    expect(r.porcentaje).toBe(15);
  });

  it('terminarPartida en juego libre no llama a la base', async () => {
    const rpc = vi.fn();
    const { servicio } = crear({ rpc });
    const r = await servicio.terminarPartida(ctxRegistrado, 'memotest', true, false);
    expect(rpc).not.toHaveBeenCalled();
    expect(r.porcentaje).toBe(0);
  });

  it('terminarPartida propaga el error para poder reintentar', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'red' } });
    const { servicio } = crear({ rpc });
    await expect(servicio.terminarPartida(ctxRegistrado, 'trivia', true, true))
      .rejects.toThrow('No se pudo guardar el resultado. Reintentá.');
  });

  it('obtenerIntentos mapea las columnas', async () => {
    const eq = vi.fn().mockResolvedValue({ data: [{ juego: 'trivia', gano: true, porcentaje_obtenido: 20 }], error: null });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const { servicio } = crear({ from });
    await expect(servicio.obtenerIntentos('p1')).resolves.toEqual([{ juego: 'trivia', gano: true, porcentajeObtenido: 20 }]);
    expect(from).toHaveBeenCalledWith('juegos_intentos');
    expect(eq).toHaveBeenCalledWith('pedido_id', 'p1');
  });

  it('descuentoJuegos devuelve el número de la base', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 10, error: null });
    const { servicio } = crear({ rpc });
    await expect(servicio.descuentoJuegos('p1')).resolves.toBe(10);
    expect(rpc).toHaveBeenCalledWith('descuento_juegos', { p_pedido_id: 'p1' });
  });
});
