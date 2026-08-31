import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private supabase: SupabaseClient;

  constructor() {
    // Inicializar  cliente con credenciales de Supa
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  // Otros services (usuarios.service.ts, etc.) reutilizan ESTA instancia
  // en vez de hacer su propio createClient(). Dos instancias de GoTrue en
  // la misma app se pisan la sesión y la segunda puede quedar "anónima"
  // frente a RLS. Ver AVANCES.md (gotcha del punto 6).
  get client(): SupabaseClient {
    return this.supabase;
  }

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
}