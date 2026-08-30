import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login', 
    pathMatch: 'full',
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
    path: 'mesas/alta',
    loadComponent: () => import('./pages/mesa-alta/mesa-alta.page').then((m) => m.MesaAltaPage),
    canActivate: [authGuard]
  },
];
