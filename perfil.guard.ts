import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service'; //  AJUSTAR: ruta real de tu AuthService

export function guardPerfil(perfilesPermitidos: string[]): CanActivateFn {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const client = auth.client;

    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) {
      router.navigateByUrl('/login');
      return false;
    }

    const { data, error } = await client
      .from('usuarios')
      .select('perfil')
      .eq('id', user.id)
      .single();

    if (error || !data || !perfilesPermitidos.includes((data as any).perfil)) {
      router.navigateByUrl('/'); // AJUSTAR: idealmente una pantalla de "no autorizado"
      return false;
    }

    return true;
  };
}
