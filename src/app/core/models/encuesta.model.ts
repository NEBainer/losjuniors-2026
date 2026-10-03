// Punto 20: encuesta de satisfacción. Los valores de cada tipo tienen que
// coincidir con el enum `atencion_mozo` y el check de `aspectos_destacados`
// de la tabla `encuestas` (ver supabase/schema.sql, v9).
export type AtencionMozo = 'excelente' | 'buena' | 'regular' | 'mala';
export type AspectoDestacado = 'comida' | 'bebida' | 'atencion' | 'ambiente' | 'precio';

export const ETIQUETAS_ATENCION: Record<AtencionMozo, string> = {
  excelente: 'Excelente',
  buena: 'Buena',
  regular: 'Regular',
  mala: 'Mala',
};

export const ETIQUETAS_ASPECTO: Record<AspectoDestacado, string> = {
  comida: 'La comida',
  bebida: 'Las bebidas',
  atencion: 'La atención',
  ambiente: 'El ambiente',
  precio: 'Los precios',
};

export interface RespuestasEncuesta {
  calificacionGeneral: number;
  atencionMozo: AtencionMozo;
  limpieza: number;
  aspectosDestacados: AspectoDestacado[];
  recomendaria: boolean;
  comentario: string;
}

// La estadía en curso del cliente logueado: la mesa que tiene asignada y
// desde cuándo (mesas.asignada_en). estadiaInicio se manda tal cual se lee,
// sin recalcular.
export interface EstadiaActual {
  mesaId: string;
  mesaNumero: number;
  estadiaInicio: string;
  yaRespondio: boolean;
}

// Lo que devuelve resultados_encuestas() de la base: solo totales, listos
// para los gráficos.
export interface ResultadosEncuestas {
  total: number;
  promedioPorDia: { dia: string; promedio: number }[];
  atencionMozo: Partial<Record<AtencionMozo, number>>;
  limpieza: Partial<Record<string, number>>;
  aspectosDestacados: Partial<Record<AspectoDestacado, number>>;
  recomendaria: { si: number; no: number };
}