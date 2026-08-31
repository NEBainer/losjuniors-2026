import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

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
    canActivate: [authGuard] // Bloqueo de seguridad aplicado
  },
  {
    path: 'registro-pendiente',
    loadComponent: () => import('./pages/registro-pendiente/registro-pendiente.page').then( m => m.RegistroPendientePage)
  },
  {
    path: 'registro-cliente',
    loadComponent: () => import('./pages/registro-cliente/registro-cliente.page').then( m => m.RegistroClientePage)
  },
];
