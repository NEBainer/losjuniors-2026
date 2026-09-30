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
}
