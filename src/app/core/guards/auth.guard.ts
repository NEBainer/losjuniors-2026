import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { AuthService } from '../services/auth.service';
import { SupabaseService } from '../services/supabase.service';

export const authGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const supabaseService = inject(SupabaseService);
  const router = inject(Router);

  const sesion = await authService.obtenerSesionActual();

  if (!sesion) {
    await Haptics.impact({ style: ImpactStyle.Heavy });
    
    router.navigate(['/login'], { replaceUrl: true });
    return false;
  }

  const { data, error } = await supabaseService.client
    .from('usuarios')
    .select('perfil, estado_aprobacion')
    .eq('id', sesion.user.id)
    .single();

  if (!error && data?.perfil === 'cliente_registrado' && data.estado_aprobacion !== 'aceptado') {
    await authService.cerrarSesion();
    router.navigate(['/registro-pendiente'], { state: { clienteId: sesion.user.id } });
    return false;
  }

  return true; // Hay sesion, lo dejamos pasar a la vista principal
};