import { vi } from 'vitest';
import { ConsultasMozoPage } from './consultas-mozo.page';

describe('ConsultasMozoPage', () => {
  function crearPagina(overrides: { consultaMozoServiceMock?: any } = {}) {
    const consultaMozoServiceMock = overrides.consultaMozoServiceMock ?? {};
    const routerMock = { navigate: vi.fn() } as any;

    return new ConsultasMozoPage(consultaMozoServiceMock, routerMock);
  }

  it('carga el listado de consultas al entrar a la pantalla', async () => {
    const consultas = [
      { mesaId: 'm1', numeroMesa: 4, ultimoTexto: 'Hola', ultimaFecha: '2026-09-16T10:00:00Z', pendiente: true },
    ];
    const listarConsultasActivas = vi.fn().mockResolvedValue(consultas);
    const escucharTodasLasConsultas = vi.fn().mockReturnValue({} as any);
    const pagina = crearPagina({ consultaMozoServiceMock: { listarConsultasActivas, escucharTodasLasConsultas } });

    await pagina.cargar();

    expect(pagina.consultas()).toEqual(consultas);
    expect(pagina.cargando()).toBe(false);
  });

  it('muestra un error si no se puede cargar el listado', async () => {
    const listarConsultasActivas = vi.fn().mockRejectedValue(new Error('falló'));
    const pagina = crearPagina({ consultaMozoServiceMock: { listarConsultasActivas } });

    await pagina.cargar();

    expect(pagina.mensajeError()).toBe('No se pudo cargar la bandeja de consultas.');
  });

  it('navega al hilo de la mesa al abrir una consulta', () => {
    const pagina = crearPagina();

    pagina.abrir({ mesaId: 'm1', numeroMesa: 7, ultimoTexto: '', ultimaFecha: '', pendiente: false });

    expect((pagina as any).router.navigate).toHaveBeenCalledWith(['/mesa', 7, 'consulta-mozo']);
  });

  it('vuelve al panel principal', () => {
    const pagina = crearPagina();

    pagina.volver();

    expect((pagina as any).router.navigate).toHaveBeenCalledWith(['/home']);
  });
});
