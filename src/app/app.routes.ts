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
    // Ahora lleva :mesaId (punto 12, nuevo enfoque: el botón "Crear
    // pedido" y el lock de armado necesitan saber en qué mesa está el
    // comensal). Cuando esté armado el flujo de QR, ver si esta ruta se
    // reemplaza directo por él — sin guard todavía, mismo motivo que
    // 'mesa/:mesaId/pedido'.
    path: 'carta/:mesaId',
    loadComponent: () => import('./pages/carta/carta.ver.component').then(m => m.CartaVerComponent)
  },
  {
    // Punto 12: pedido completo de la mesa. Ruta con :mesaId siguiendo el
    // mismo criterio que dejamos anotado en 'carta' — cuando el punto 10
    // (QR de mesa) esté resuelto, el cliente va a llegar acá navegando
    // directo con el id de su mesa, en vez de por un link fijo. Sin guard
    // por ahora, mismo motivo que 'carta': todavía no hay sesión de
    // cliente_anonimo resuelta (ver aviso en supabase/schema.sql).
    path: 'mesa/:mesaId/pedido',
    loadComponent: () => import('./pages/pedido/pedido.page').then(m => m.PedidoPage)
  },
  {
    path: 'mozo/pedidos',
    loadComponent: () => import('./pages/pedidos-mozo/pedidos-mozo.page').then(m => m.PedidosMozoPage),
    canActivate: [authGuard, guardPerfil(['mozo'])]
  },
];