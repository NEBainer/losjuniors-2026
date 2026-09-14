// Tipos compartidos de la tabla `usuarios`.
// Ver supabase/schema.sql: enum `estado_aprobacion` y columna
// `usuarios.estado_aprobacion` (nullable).

export type EstadoAprobacion = 'pendiente' | 'aceptado' | 'rechazado';

// Mismos valores que el enum `perfil_usuario` de supabase/schema.sql.
export type PerfilUsuario =
  | 'dueño'
  | 'supervisor'
  | 'metre'
  | 'mozo'
  | 'cocinero'
  | 'cantinero'
  | 'cliente_registrado'
  | 'cliente_anonimo';

// Fila mínima que necesita el listado de clientes pendientes (punto 6):
// apellidos, nombres y foto. `foto_url` es el PATH dentro del bucket
// `fotos` (no la URL completa) -> usar UsuariosService.getFotoPublicUrl().
export interface ClientePendiente {
  id: string;
  apellidos: string;
  nombres: string;
  foto_url: string | null;
}

// Fila que devuelve la vista `accesos_rapidos` (supabase/schema.sql): un
// usuario real por perfil, para los botones de acceso rápido del login.
// `foto_url` es el PATH dentro del bucket `fotos`, no la URL completa ->
// usar UsuariosService.getFotoPublicUrl().
export interface AccesoRapido {
  perfil: PerfilUsuario;
  nombres: string;
  apellidos: string;
  foto_url: string | null;
  email: string;
}
