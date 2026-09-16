import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guardPerfil } from './core/guards/perfil.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'splash',
    pathMatch: 'full',
  },
  {
    path: 'splash',
    loadComponent: () => import('./pages/splash/splash.page').then(m => m.SplashPage)
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then( m => m.LoginPage)
  },
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
    canActivate: [authGuard]
  },
  {
    path: 'mesas',
    loadComponent: () => import('./pages/mesas-gestion/mesas-gestion.page').then((m) => m.MesasGestionPage),
    canActivate: [authGuard]
  },
  {
    path: 'mesas/alta',
    loadComponent: () => import('./pages/mesa-alta/mesa-alta.page').then((m) => m.MesaAltaPage),
    canActivate: [authGuard]
  },
  {
    path: 'empleados/alta',
    loadComponent: () => import('./pages/alta-empleado/alta-empleado.page').then((m) => m.AltaEmpleadoPage),
    canActivate: [authGuard, guardPerfil(['dueño', 'supervisor'])]
  },
  {
    path: 'clientes-pendientes',
    loadComponent: () =>
      import('./pages/clientes-pendientes/clientes-pendientes.page').then((m) => m.ClientesPendientesPage),
    canActivate: [authGuard]
  },
  {
    path: 'registro-pendiente',
    loadComponent: () => import('./pages/registro-pendiente/registro-pendiente.page').then( m => m.RegistroPendientePage)
  },
  {
    path: 'registro-cliente',
    loadComponent: () => import('./pages/registro-cliente/registro-cliente.page').then( m => m.RegistroClientePage)
  },
  {
    path: 'cocinero/plato-alta',
    loadComponent: () => import('./pages/plato-alta/plato.alta.component').then(m => m.PlatoAltaComponent),
    canActivate: [authGuard, guardPerfil(['cocinero'])]
  },
  {
    path: 'cantinero/bebida-alta',
    loadComponent: () => import('./pages/bebida-alta/bebida.alta.component').then(m => m.BebidaAltaComponent),
    canActivate: [authGuard, guardPerfil(['cantinero'])]
  },
  {
    // ⚠️ TEMPORAL para probar la pantalla — el punto 11 en el TP se llega
    // escaneando el QR de la mesa (punto 10), no navegando a una ruta fija.
    // Cuando esté armado ese flujo, sacar esta ruta o adaptarla (capaz
    // termine siendo 'mesa/:mesaId/carta' o similar) y decidir si necesita
    // guard — hoy no tiene ninguno.
    path: 'carta',
    loadComponent: () => import('./pages/carta/carta.ver.component').then(m => m.CartaVerComponent)
  },
  {
    path: 'lista-espera',
    loadComponent: () => import('./pages/lista-espera/lista-espera.page').then( m => m.ListaEsperaPage)
  },
  {
    path: 'ingreso-anonimo',
    loadComponent: () => import('./pages/ingreso-anonimo/ingreso-anonimo.page').then( m => m.IngresoAnonimoPage)
  },
  {
    // Punto 11: el cliente llega acá escaneando el QR de la mesa (o desde
    // el botón "Escanear Mesa" en home). Mismo componente que 'carta', con
    // el número de mesa en la ruta para poder mostrar el botón "consultar
    // al mozo".
    path: 'mesa/:numero/carta',
    loadComponent: () => import('./pages/carta/carta.ver.component').then(m => m.CartaVerComponent)
  },
  {
    // 'mozo' se suma al guard: esta misma pantalla la usa tanto el
    // cliente (manda la consulta) como el mozo que la abre desde la
    // bandeja de 'consultas-mozo' para responder.
    path: 'mesa/:numero/consulta-mozo',
    loadComponent: () => import('./pages/consulta-mozo/consulta-mozo.page').then(m => m.ConsultaMozoPage),
    canActivate: [authGuard, guardPerfil(['cliente_registrado', 'cliente_anonimo', 'mozo'])]
  },
  {
    // Bandeja del mozo (punto 11): listado de mesas con consulta abierta.
    path: 'consultas-mozo',
    loadComponent: () => import('./pages/consultas-mozo/consultas-mozo.page').then(m => m.ConsultasMozoPage),
    canActivate: [authGuard, guardPerfil(['mozo'])]
  },
]