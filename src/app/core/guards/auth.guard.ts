import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const sesion = await authService.obtenerSesionActual();

  if (!sesion) {
    await Haptics.impact({ style: ImpactStyle.Heavy });
    
    router.navigate(['/login'], { replaceUrl: true });
    return false;
  }

  return true; // Hay sesion, lo dejamos pasar a la vista principal
};