import { Injectable } from '@angular/core';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { asegurarModuloEscaner } from './escaner.util';

export type QrAppPayload =
  | { tipo: 'ingreso_local' }
  | { tipo: 'mesa'; numero: number };

@Injectable({ providedIn: 'root' })
export class QrAppService {

  async escanear(): Promise<QrAppPayload | null> {
    const { camera } = await BarcodeScanner.checkPermissions();
    if (camera === 'denied') {
      throw new Error('Activá el permiso de cámara desde Configuración del dispositivo.');
    }
    if (camera !== 'granted') {
      const solicitado = await BarcodeScanner.requestPermissions();
      if (solicitado.camera !== 'granted') {
        throw new Error('Se necesita permiso de cámara para escanear el código.');
      }
    }

    await asegurarModuloEscaner();
    const { barcodes } = await BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode] });
    if (barcodes.length === 0) return null;

    const raw = barcodes[0].rawValue;
    if (!raw) {
      throw new Error('No se pudo leer el contenido del código.');
    }

    return this.interpretar(raw);
  }

  // Las mesas creadas desde la app antes del 16/09 guardaron el QR en
  // texto plano (`MESA-{numero}`), no en el JSON actual -- se aceptan los
  // dos formatos para que esas mesas (y sus QR ya impresos) sigan andando.
  interpretar(raw: string): QrAppPayload {
    const formatoViejo = /^MESA-(\d+)$/.exec(raw.trim());
    if (formatoViejo) {
      return { tipo: 'mesa', numero: Number(formatoViejo[1]) };
    }

    try {
      return JSON.parse(raw) as QrAppPayload;
    } catch {
      throw new Error('Este código QR no pertenece a La Mesa.');
    }
  }
}