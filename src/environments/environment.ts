// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  supabaseUrl: 'https://gbclocrtlezunqnmzdhx.supabase.co',
  supabaseKey: 'sb_publishable_i5Lj7kSpAg6LAF6qSmYD0g_EhXGaoWz',
  // Clave compartida de los usuarios de prueba del seed (supabase/schema.sql).
  // Los accesos rápidos del login solo traen email/perfil/foto de la DB -- la
  // contraseña real nunca se puede leer (Supabase Auth la guarda hasheada).
  claveAccesoRapido: 'Test1234!'
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
