import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service'; // ⚠️ asume que este archivo vive en src/app/core/guards/

/**
 * perfil.guard.ts
 * ----------------
 * Guard genérico por perfil — no es solo para bebida, sirve para
 * cualquier pantalla que necesite "solo puede entrar tal/cual perfil".
 *
 * Uso en las rutas:
 *   { path: 'cantinero/bebida-alta', component: BebidaAltaComponent,
 *     canActivate: [guardPerfil(['cantinero'])] }
 *   { path: 'cocinero/plato-alta', component: PlatoAltaComponent,
 *     canActivate: [guardPerfil(['cocinero'])] }
 *
 * Esto es la mitad "de entrada" de la seguridad — la otra mitad (que
 * ya deberían tener) es la policy de RLS del lado de la base, que igual
 * hay que mantener porque el guard es solo UX (evita que alguien VEA la
 * pantalla), no es lo que impide que alguien manipule el insert a mano.
 *
 * ⚠️ Asume que tu SupabaseService expone `client` (el patrón que ya usan) y
 * que la tabla `usuarios` tiene una columna `perfil`.
 */
export function guardPerfil(perfilesPermitidos: string[]): CanActivateFn {
  return async () => {
    const supabaseService = inject(SupabaseService);
    const router = inject(Router);
    const client = supabaseService.client;

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
      router.navigateByUrl('/'); // ⚠️ AJUSTAR: idealmente una pantalla de "no autorizado"
      return false;
    }

    return true;
  };
}
