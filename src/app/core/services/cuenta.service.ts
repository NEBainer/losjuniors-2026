import { Injectable, inject } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { QrAppService } from './qr-app.service';
import { Cuenta, ItemCuenta, MetodoPago, NIVELES_PROPINA, PorcentajePropina } from '../models/cuenta.model';

const ESTADOS_FACTURABLES = ['confirmado', 'completo', 'entregado'];

@Injectable({ providedIn: 'root' })
export class CuentaService {
  private supabase = inject(SupabaseService).client;
  private qrAppService = inject(QrAppService);

  async solicitar(): Promise<Cuenta> {
    return this.llamar('solicitar_cuenta', {}, 'No se pudo pedir la cuenta.');
  }

  async aplicarPropina(porcentaje: PorcentajePropina): Promise<Cuenta> {
    return this.llamar('aplicar_propina', { p_porcentaje: porcentaje }, 'No se pudo aplicar la propina.');
  }

  async pagar(metodo: MetodoPago): Promise<Cuenta> {
    return this.llamar('pagar_cuenta', { p_metodo: metodo }, 'No se pudo realizar el pago. Intentá de nuevo.');
  }

  async escanearPropina(): Promise<PorcentajePropina | null> {
    const datos = await this.qrAppService.escanear();
    if (!datos) return null;

    if (datos.tipo !== 'propina') {
      throw new Error('Ese código no es un código QR de propina.');
    }
    const nivel = NIVELES_PROPINA.find((n) => n.porcentaje === datos.porcentaje);
    if (!nivel) {
      throw new Error('Ese código no corresponde a un porcentaje de propina válido.');
    }
    return nivel.porcentaje;
  }

  async obtenerItems(cuenta: Cuenta): Promise<ItemCuenta[]> {
    const { data, error } = await this.supabase
      .from('pedido_items')
      .select('cantidad, precio_unitario, productos(nombre), pedidos!inner(mesa_id, estado, created_at)')
      .eq('pedidos.mesa_id', cuenta.mesaId)
      .gte('pedidos.created_at', cuenta.estadiaInicio)
      .in('pedidos.estado', ESTADOS_FACTURABLES);

    if (error) {
      throw new Error('No se pudo cargar el detalle de la cuenta.');
    }

    const lineas = new Map<string, ItemCuenta>();
    for (const fila of (data ?? []) as any[]) {
      const nombre = fila.productos?.nombre ?? 'Producto';
      const precioUnitario = Number(fila.precio_unitario);
      const clave = `${nombre}|${precioUnitario}`;
      const linea = lineas.get(clave) ?? { nombre, cantidad: 0, precioUnitario, importe: 0 };
      linea.cantidad += fila.cantidad;
      linea.importe = linea.cantidad * precioUnitario;
      lineas.set(clave, linea);
    }
    return [...lineas.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  // Punto 22: el cliente se entera en vivo cuando el mozo confirma el pago.
  escucharCuenta(cuentaId: string, callback: (cuenta: Cuenta) => void): RealtimeChannel {
    return this.supabase
      .channel(`cuenta-${cuentaId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'cuentas', filter: `id=eq.${cuentaId}` },
        (payload) => callback(this.mapCuenta(payload.new)),
      )
      .subscribe();
  }

  cerrarCanal(canal: RealtimeChannel): void {
    this.supabase.removeChannel(canal);
  }

  private async llamar(funcion: string, parametros: object, mensajeGenerico: string): Promise<Cuenta> {
    const { data, error } = await this.supabase.rpc(funcion, parametros);
    if (error) {
      throw new Error(error.code === 'P0001' ? error.message : mensajeGenerico);
    }
    return this.mapCuenta(data);
  }

  private mapCuenta(fila: any): Cuenta {
    const numeroONulo = (valor: unknown) => (valor === null || valor === undefined ? null : Number(valor));
    return {
      id: fila.id,
      mesaId: fila.mesa_id,
      estadiaInicio: fila.estadia_inicio,
      estado: fila.estado,
      propinaPorcentaje: numeroONulo(fila.propina_porcentaje) as PorcentajePropina | null,
      subtotal: numeroONulo(fila.subtotal),
      descuentoPorcentaje: numeroONulo(fila.descuento_porcentaje),
      descuentoImporte: numeroONulo(fila.descuento_importe),
      propinaImporte: numeroONulo(fila.propina_importe),
      total: numeroONulo(fila.total),
      metodoPago: fila.metodo_pago,
      pagadaEn: fila.pagada_en,
    };
  }
}