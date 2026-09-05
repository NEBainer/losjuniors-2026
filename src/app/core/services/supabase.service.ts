import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

// Cliente único compartido: evitar múltiples instancias de GoTrueClient
// compitiendo por el mismo storage de sesión (ver warning de Supabase).
@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  readonly client: SupabaseClient = createClient(environment.supabaseUrl, environment.supabaseKey);
}