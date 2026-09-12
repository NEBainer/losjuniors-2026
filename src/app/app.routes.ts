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
];
