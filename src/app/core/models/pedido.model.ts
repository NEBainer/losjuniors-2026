// Puntos 18/19 (schema.sql v9): confirmado -> completo (cocina y bar
// terminaron) -> entregado (el cliente confirmó la recepción).
export type EstadoPedido = 'pendiente_confirmacion' | 'confirmado' | 'rechazado' | 'completo' | 'entregado';
export interface ItemCarrito {
  productoId: string;
  nombre: string;
  precioUnitario: number;
  tiempoElaboracionMinutos: number;
  comensalNumero: number;
  cantidad: number;
}

export interface Pedido {
  id: string;
  mesaId: string;
  estado: EstadoPedido;
  importeTotal: number;
  tiempoEstimadoMinutos: number;
  creadoEn: string;
  cocinaLista: boolean;
  barListo: boolean;
  // Punto 19: el mozo marcó que lo entregó. No cambia `estado` (sigue en
  // 'completo') -- recién el cliente lo pasa a 'entregado'.
  entregadoPorMozo: boolean;
}

export interface PedidoPendiente extends Pedido {
  mesaNumero: number;
  // Pantalla de pedidos del mozo: qué pidió la mesa, sumado por producto
  // (mismo criterio que PedidoSector).
  items: { nombre: string; cantidad: number }[];
}

// Puntos 16/17: cocina prepara todo lo que no es bebida (decisión de
// equipo 13/09: postre cuenta como plato) y bar las bebidas.
export type Sector = 'cocina' | 'bar';

// Un pedido tal como lo ve cocina o bar: solo los ítems de ese sector,
// sumados por producto (sin separar por comensal).
export interface PedidoSector {
  id: string;
  mesaNumero: number;
  creadoEn: string;
  items: { nombre: string; cantidad: number }[];
}
