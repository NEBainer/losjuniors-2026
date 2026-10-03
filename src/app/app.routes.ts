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
    // Punto 11: "Ver la Carta" desde el home (home.page.ts / irALaCarta()),
    // sin mesa asociada -- cualquier usuario logueado puede consultar el
    // menú completo. Faltaba esta ruta: el botón navegaba a '/carta' pero
    // solo existía 'carta/:mesaId', así que el router no matcheaba nada y
    // no pasaba nada al tocarlo. CartaVerComponent ya soporta entrar sin
    // 'numero' ni 'mesaId' (ver resolverMesa()): carga la carta igual,
    // solo quedan sin efecto el FAB de consultar al mozo y "Crear pedido".
    path: 'carta',
    loadComponent: () => import('./pages/carta/carta.ver.component').then(m => m.CartaVerComponent)
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
    // al mozo" y el de "Crear pedido" (punto 12).
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
  {
    // Punto 10: solo metre, es quien tiene la policy `mesas_metre_asigna`
    // (dueño/supervisor ven la cola por otra policy, pero no es su flujo
    // de asignación acá).
    path: 'metre/lista-espera',
    loadComponent: () => import('./pages/metre-lista-espera/metre-lista-espera.page').then(m => m.MetreListaEsperaPage),
    canActivate: [authGuard, guardPerfil(['metre'])]
  },
  {
    // Punto 12: pedido completo de la mesa. Ruta con :mesaId siguiendo el
    // mismo criterio que 'carta/:mesaId' — cuando el punto 10 (QR de
    // mesa) esté resuelto del todo, ver si conviene pasarla a :numero
    // igual que 'mesa/:numero/carta'. Sin guard por ahora, mismo motivo
    // que 'carta': todavía no hay sesión de cliente_anonimo resuelta (ver
    // aviso en supabase/schema.sql).
    path: 'mesa/:mesaId/pedido',
    loadComponent: () => import('./pages/pedido/pedido.page').then(m => m.PedidoPage)
  },
  {
    path: 'mozo/pedidos',
    loadComponent: () => import('./pages/pedidos-mozo/pedidos-mozo.page').then(m => m.PedidosMozoPage),
    canActivate: [authGuard, guardPerfil(['mozo'])]
  },
  {
    path: 'mesa/:mesaId/encuesta',
    loadComponent: () => import('./pages/encuesta/encuesta.page').then( m => m.EncuestaPage),
    canActivate: [authGuard, guardPerfil(['cliente_registrado', 'cliente_anonimo'])]
  },
  {
    path: 'encuestas/resultados',
    loadComponent: () => import('./pages/encuestas-resultados/encuestas-resultados.page').then( m => m.EncuestasResultadosPage)
  },
  {
    // Puntos 16/17: misma pantalla para cocina y bar -- el sector sale
    // del perfil logueado (cocinero -> cocina, cantinero -> bar).
    path: 'sector/pedidos',
    loadComponent: () => import('./pages/pedidos-sector/pedidos-sector.page').then(m => m.PedidosSectorPage),
    canActivate: [authGuard, guardPerfil(['cocinero', 'cantinero'])]
  },
  {
    // Puntos 14/15: menú de juegos. Se entra desde la pantalla del
    // pedido (confirmado, completo o entregado). El anónimo juega libre;
    // el descuento es solo para cliente_registrado (schema.sql v12).
    path: 'mesa/:mesaId/juegos',
    loadComponent: () => import('./pages/juegos/juegos.page').then(m => m.JuegosPage),
    canActivate: [authGuard, guardPerfil(['cliente_registrado', 'cliente_anonimo'])]
  },
  {
    path: 'mesa/:mesaId/juegos/ahorcado',
    loadComponent: () => import('./pages/juegos/ahorcado/ahorcado.page').then(m => m.AhorcadoPage),
    canActivate: [authGuard, guardPerfil(['cliente_registrado', 'cliente_anonimo'])]
  },
  {
    path: 'mesa/:mesaId/juegos/memotest',
    loadComponent: () => import('./pages/juegos/memotest/memotest.page').then(m => m.MemotestPage),
    canActivate: [authGuard, guardPerfil(['cliente_registrado', 'cliente_anonimo'])]
  },
  {
    path: 'mesa/:mesaId/juegos/trivia',
    loadComponent: () => import('./pages/juegos/trivia/trivia.page').then(m => m.TriviaPage),
    canActivate: [authGuard, guardPerfil(['cliente_registrado', 'cliente_anonimo'])]
  },
  {
    path: 'mesa/:mesaId/cuenta',
    loadComponent: () => import('./pages/cuenta/cuenta.page').then(m => m.CuentaPage),
    canActivate: [authGuard, guardPerfil(['cliente_registrado', 'cliente_anonimo'])]
  },
  {
    path: 'qr-propina',
    loadComponent: () => import('./pages/qr-propina/qr-propina.page').then(m => m.QrPropinaPage),
    canActivate: [authGuard, guardPerfil(['mozo', 'dueño', 'supervisor'])]
  },
  {
    path: 'mozo/cuentas',
    loadComponent: () => import('./pages/cuentas-mozo/cuentas-mozo.page').then(m => m.CuentasMozoPage),
    canActivate: [authGuard, guardPerfil(['mozo'])]
  }
]
