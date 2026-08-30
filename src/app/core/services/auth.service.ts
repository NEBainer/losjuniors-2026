import { Injectable, inject } from '@angular/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private supabase = inject(SupabaseService).client;

  // Metodo para el login manual y el ingreso rapido
  async iniciarSesion(correo: string, clave: string) {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: correo,
        password: clave,
      });

      if (error) throw error;
      
      return data;
    } catch (error: any) {
      // Vibracion al detectarse un error
      await Haptics.impact({ style: ImpactStyle.Heavy });
      
      // Delegar al componente UI
      throw new Error('Credenciales inválidas. Por favor, intente nuevamente.');
    }
  }

  async cerrarSesion() {
    const { error } = await this.supabase.auth.signOut();
    if (error) {
      await Haptics.impact({ style: ImpactStyle.Heavy });
      throw error;
    }
    // Logica adicional para limpiar variables globales si las hubiera
  }

  async obtenerSesionActual() {
    const { data, error } = await this.supabase.auth.getSession();
    if (error) {
      console.error('Error obteniendo sesión:', error);
      return null;
    }
    return data.session;
  }

  // Datos del usuario logueado (perfil, nombre, etc.) para decidir qué puede ver/hacer
  async obtenerUsuarioActual() {
    const sesion = await this.obtenerSesionActual();
    if (!sesion) return null;

    const { data, error } = await this.supabase
      .from('usuarios')
      .select('id, nombres, apellidos, perfil')
      .eq('id', sesion.user.id)
      .single();

    if (error) {
      console.error('Error obteniendo usuario:', error);
      return null;
    }
    return data;
  }
}