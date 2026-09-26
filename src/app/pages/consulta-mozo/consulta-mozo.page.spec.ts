import { vi } from 'vitest';
import { ConsultaMozoPage } from './consulta-mozo.page';

describe('ConsultaMozoPage', () => {
  function crearPagina(overrides: { consultaMozoServiceMock?: any } = {}) {
    const routeMock = { snapshot: { paramMap: { get: () => '4' } } } as any;
    const routerMock = { navigate: vi.fn() } as any;
    const mesaServiceMock = { buscarPorNumero: vi.fn() } as any;
    const usuariosServiceMock = { obtenerUsuarioActual: vi.fn() } as any;
    const consultaMozoServiceMock = overrides.consultaMozoServiceMock ?? {};
    const notificacionesServiceMock = { marcarRespuestasLeidas: vi.fn() } as any;

    return new ConsultaMozoPage(
      routeMock,
      routerMock,
      mesaServiceMock,
      usuariosServiceMock,
      consultaMozoServiceMock,
      notificacionesServiceMock,
    );
  }

  it('reconoce como propio un mensaje del usuario logueado', () => {
    const pagina = crearPagina();
    (pagina as any).usuarioId = 'u1';

    expect(pagina.esMio({ remitente_id: 'u1' } as any)).toBe(true);
    expect(pagina.esMio({ remitente_id: 'otro' } as any)).toBe(false);
  });

  it('no envía un mensaje vacío ni sin mesa resuelta', async () => {
    const enviarMensaje = vi.fn();
    const pagina = crearPagina({ consultaMozoServiceMock: { enviarMensaje } });

    pagina.texto.set('   ');
    await pagina.enviar();

    expect(enviarMensaje).not.toHaveBeenCalled();
  });

  it('envía el mensaje y limpia el input', async () => {
    const enviarMensaje = vi.fn().mockResolvedValue(undefined);
    const pagina = crearPagina({ consultaMozoServiceMock: { enviarMensaje } });
    (pagina as any).mesaId = 'mesa-1';

    pagina.texto.set('¿Puede ser sin sal?');
    await pagina.enviar();

    expect(enviarMensaje).toHaveBeenCalledWith('mesa-1', '¿Puede ser sin sal?');
    expect(pagina.texto()).toBe('');
  });

  it('vuelve a la carta de la mesa actual', () => {
    const pagina = crearPagina();
    pagina.numeroMesa.set(4);

    pagina.volver();

    expect((pagina as any).router.navigate).toHaveBeenCalledWith(['/mesa', 4, 'carta']);
  });
});
