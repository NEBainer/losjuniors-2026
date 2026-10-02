export type EstadoCuenta = 'solicitada' | 'pagada' | 'confirmada';
export type MetodoPago = 'dinero_en_cuenta' | 'debito' | 'credito';
export type PorcentajePropina = 0 | 5 | 10 | 15 | 20;

export const NIVELES_PROPINA: { porcentaje: PorcentajePropina; nivel: string }[] = [
  { porcentaje: 20, nivel: 'Excelente' },
  { porcentaje: 15, nivel: 'Muy bueno' },
  { porcentaje: 10, nivel: 'Bueno' },
  { porcentaje: 5, nivel: 'Regular' },
  { porcentaje: 0, nivel: 'Malo' },
];

export const ETIQUETAS_METODO_PAGO: Record<MetodoPago, string> = {
  dinero_en_cuenta: 'Dinero en cuenta',
  debito: 'Tarjeta de débito',
  credito: 'Tarjeta de crédito',
};

export interface Cuenta {
  id: string;
  mesaId: string;
  estadiaInicio: string;
  estado: EstadoCuenta;
  propinaPorcentaje: PorcentajePropina | null;
  subtotal: number | null;
  descuentoPorcentaje: number | null;
  descuentoImporte: number | null;
  propinaImporte: number | null;
  total: number | null;
  metodoPago: MetodoPago | null;
  pagadaEn: string | null;
}

export interface ItemCuenta {
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  importe: number;
}

export interface CuentaAbierta extends Cuenta {
  mesaNumero: number;
  solicitadaEn: string;
}