import { Injectable } from '@angular/core';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';

export interface DatosDni {
  apellidos: string;
  nombres: string;
  dni: string;
}

// Parseo del PDF417 del DNI argentino + manejo de permisos de cámara del
// lector. Compartido entre registro-cliente (punto 5) y alta-empleado
// (punto 1) para no duplicar la lógica de escaneo en cada página.
@Injectable({ providedIn: 'root' })
export class DniScannerService {

  async lectorDisponible(): Promise<boolean> {
    const { supported } = await BarcodeScanner.isSupported();
    return supported;
  }

  // Pide permiso de cámara si falta y escanea el PDF417. Devuelve null si
  // el usuario cerró el lector sin escanear nada; tira Error (mensaje ya
  // listo para mostrar en un toast) en cualquier otro caso de fallo.
  async escanearDni(): Promise<DatosDni | null> {
    const { camera } = await BarcodeScanner.checkPermissions();
    if (camera === 'denied') {
      throw new Error('Activá el permiso de cámara desde Configuración del dispositivo para poder escanear el DNI.');
    }
    if (camera !== 'granted') {
      const solicitado = await BarcodeScanner.requestPermissions();
      if (solicitado.camera !== 'granted') {
        throw new Error('Se necesita permiso de cámara para escanear el DNI.');
      }
    }

    // PDF417, no QrCode: es el formato real del DNI argentino.
    const { barcodes } = await BarcodeScanner.scan({ formats: [BarcodeFormat.Pdf417] });
    if (barcodes.length === 0) return null;

    const rawValue = barcodes[0].rawValue;
    if (!rawValue) {
      throw new Error('No se pudo leer el contenido del código.');
    }

    return this.parsearDni(rawValue);
  }

  // Campos separados por '@'. El PDF417 argentino NO incluye el CUIL:
  // eso sigue siendo carga 100% manual en el form.
  parsearDni(raw: string): DatosDni {
    const campos = raw.split('@');
    if (campos.length < 8) {
      throw new Error('Formato de DNI no reconocido');
    }
    const [, apellidos, nombres, , dni] = campos;
    return { apellidos, nombres, dni: this.normalizarDni(dni) };
  }

  // Saca puntos/espacios, deja solo dígitos.
  normalizarDni(valor: string): string {
    return (valor ?? '').replace(/\D/g, '');
  }
}
