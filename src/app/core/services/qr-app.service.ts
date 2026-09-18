import { Injectable } from '@angular/core';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';

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

    const { barcodes } = await BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode] });
    if (barcodes.length === 0) return null;

    const raw = barcodes[0].rawValue;
    if (!raw) {
      throw new Error('No se pudo leer el contenido del código.');
    }

    try {
      return JSON.parse(raw) as QrAppPayload;
    } catch {
      throw new Error('Este código QR no pertenece a La Mesa.');
    }
  }
}