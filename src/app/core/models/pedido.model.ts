export type EstadoPedido = 'pendiente_confirmacion' | 'confirmado' | 'rechazado';

// Puntos 16/17 (y 18): estado de cada sector dentro de un pedido
// confirmado. null = el pedido no tiene productos de ese sector.
export type EstadoSector = 'pendiente' | 'en_preparacion' | 'listo';
export type Sector = 'cocina' | 'bar';
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
  estadoCocina: EstadoSector | null;
  estadoBar: EstadoSector | null;
}

export interface PedidoPendiente extends Pedido {
  mesaNumero: number;
}

// Puntos 16/17: un pedido tal como lo ve cocina o bar -- solo los ítems
// de ese sector, sumados por producto (sin separar por comensal).
export interface PedidoSector {
  id: string;
  mesaNumero: number;
  creadoEn: string;
  estado: EstadoSector;
  items: { nombre: string; cantidad: number }[];
}
