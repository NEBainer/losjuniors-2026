export type EstadoPedido = 'pendiente_confirmacion' | 'confirmado';
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
}

export interface PedidoPendiente extends Pedido {
  mesaNumero: number;
}
