import { vi } from 'vitest';
import { ConsultaMozoService } from './consulta-mozo.service';

describe('ConsultaMozoService', () => {
  function crearServicio(supabaseMock: any, usuarioActual: any) {
    const supabaseServiceMock = { client: supabaseMock } as any;
    const usuariosServiceMock = { obtenerUsuarioActual: () => Promise.resolve(usuarioActual) } as any;
    return new ConsultaMozoService(supabaseServiceMock, usuariosServiceMock);
  }

  it('envía el mensaje con el remitente desnormalizado', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ insert });
    const servicio = crearServicio(
      { from },
      { id: 'u1', perfil: 'cliente_registrado', nombre: 'Ana Pérez' }
    );

    await servicio.enviarMensaje('mesa-1', 'Hola, ¿tienen sin gluten?');

    expect(from).toHaveBeenCalledWith('mensajes_mozo');
    expect(insert).toHaveBeenCalledWith({
      mesa_id: 'mesa-1',
      remitente_id: 'u1',
      remitente_perfil: 'cliente_registrado',
      remitente_nombre: 'Ana Pérez',
      texto: 'Hola, ¿tienen sin gluten?',
    });
  });

  it('tira error si no hay usuario logueado', async () => {
    const servicio = crearServicio({ from: vi.fn() }, null);

    await expect(servicio.enviarMensaje('mesa-1', 'hola')).rejects.toThrow();
  });

  it('propaga el error de Supabase al enviar', async () => {
    const insert = vi.fn().mockResolvedValue({ error: { message: 'RLS' } });
    const from = vi.fn().mockReturnValue({ insert });
    const servicio = crearServicio(
      { from },
      { id: 'u1', perfil: 'mozo', nombre: 'Juan' }
    );

    await expect(servicio.enviarMensaje('mesa-1', 'hola')).rejects.toThrow();
  });

  it('devuelve el historial ordenado por fecha', async () => {
    const mensajes = [{ id: 'm1' }, { id: 'm2' }];
    const order = vi.fn().mockResolvedValue({ data: mensajes, error: null });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const servicio = crearServicio({ from }, null);

    const resultado = await servicio.obtenerHistorial('mesa-1');

    expect(eq).toHaveBeenCalledWith('mesa_id', 'mesa-1');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(resultado).toBe(mensajes);
  });
});
