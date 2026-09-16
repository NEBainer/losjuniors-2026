import { vi } from 'vitest';
import { UsuariosService } from './usuarios.service';

describe('UsuariosService.getFotoPublicUrl', () => {
  function crearServicio(getPublicUrl: ReturnType<typeof vi.fn>) {
    const client = { storage: { from: vi.fn().mockReturnValue({ getPublicUrl }) } };
    const supabaseServiceMock = { client } as any;
    const authServiceMock = {} as any;
    return new UsuariosService(supabaseServiceMock, authServiceMock);
  }

  it('devuelve null si no hay foto', () => {
    const servicio = crearServicio(vi.fn());
    expect(servicio.getFotoPublicUrl(null)).toBeNull();
  });

  it('arma la URL pública a partir de un path guardado', () => {
    const getPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'https://x.supabase.co/.../usuarios/u1/foto.jpg' } });
    const servicio = crearServicio(getPublicUrl);

    const resultado = servicio.getFotoPublicUrl('usuarios/u1/foto.jpg');

    expect(getPublicUrl).toHaveBeenCalledWith('usuarios/u1/foto.jpg');
    expect(resultado).toBe('https://x.supabase.co/.../usuarios/u1/foto.jpg');
  });

  it('devuelve tal cual una URL completa ya guardada (filas viejas), sin volver a envolverla', () => {
    const getPublicUrl = vi.fn();
    const servicio = crearServicio(getPublicUrl);
    const urlCompleta = 'https://x.supabase.co/storage/v1/object/public/fotos/usuarios/u1/foto.jpg';

    const resultado = servicio.getFotoPublicUrl(urlCompleta);

    expect(getPublicUrl).not.toHaveBeenCalled();
    expect(resultado).toBe(urlCompleta);
  });
});
