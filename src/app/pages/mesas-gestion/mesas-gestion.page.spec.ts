import { ChangeDetectorRef } from '@angular/core';
import { vi } from 'vitest';
import { MesasGestionPage } from './mesas-gestion.page';
import { Mesa } from '../../core/services/mesa.service';

describe('MesasGestionPage', () => {
  function crearPagina(mesaServiceMock: any) {
    const cdrMock = { detectChanges: () => {} } as ChangeDetectorRef;
    const routerMock = { navigate: () => {} } as any;
    const authServiceMock = { obtenerUsuarioActual: () => Promise.resolve(null) } as any;

    return new MesasGestionPage(authServiceMock, mesaServiceMock, routerMock, cdrMock);
  }

  function mesaDePrueba(): Mesa {
    return {
      id: 'm1',
      numero: 1,
      cantidad_comensales: 4,
      tipo: 'estandar',
      disponibilidad: 'vacia',
      foto_url: null,
      qr_code: 'MESA-1',
      cliente_actual_id: null,
    };
  }

  it('alterna la disponibilidad y avisa al servicio', async () => {
    const actualizarDisponibilidad = vi.fn().mockResolvedValue(undefined);
    const pagina = crearPagina({ actualizarDisponibilidad });
    const mesa = mesaDePrueba();

    await pagina.alternarDisponibilidad(mesa);

    expect(mesa.disponibilidad).toBe('ocupada');
    expect(actualizarDisponibilidad).toHaveBeenCalledWith('m1', 'ocupada');
  });

  it('revierte el cambio si el servicio falla', async () => {
    const actualizarDisponibilidad = vi.fn().mockRejectedValue(new Error('falló'));
    const pagina = crearPagina({ actualizarDisponibilidad });
    const mesa = mesaDePrueba();

    await pagina.alternarDisponibilidad(mesa);

    expect(mesa.disponibilidad).toBe('vacia');
  });
});
