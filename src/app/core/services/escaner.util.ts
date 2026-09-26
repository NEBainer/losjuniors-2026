import { Capacitor } from '@capacitor/core';
import {
  BarcodeScanner,
  GoogleBarcodeScannerModuleInstallState,
} from '@capacitor-mlkit/barcode-scanning';

// En Android, BarcodeScanner.scan() usa un módulo de Google Play Services
// que no viene con la app: si el teléfono todavía no lo tiene, scan() falla
// con "The Google Barcode Scanner Module is not available". Esto lo
// descarga (si hace falta) y espera a que termine antes de escanear.
// Compartido entre QrAppService (QR de mesa/ingreso) y DniScannerService.
const ESPERA_MAXIMA_MS = 60000;

export async function asegurarModuloEscaner(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;

  const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
  if (available) return;

  let avisarFin: (ok: boolean) => void = () => {};
  const terminado = new Promise<boolean>((resolve) => (avisarFin = resolve));
  const timeout = setTimeout(() => avisarFin(false), ESPERA_MAXIMA_MS);

  const listener = await BarcodeScanner.addListener('googleBarcodeScannerModuleInstallProgress', (evento) => {
    if (evento.state === GoogleBarcodeScannerModuleInstallState.COMPLETED) {
      avisarFin(true);
    } else if (
      evento.state === GoogleBarcodeScannerModuleInstallState.FAILED ||
      evento.state === GoogleBarcodeScannerModuleInstallState.CANCELED
    ) {
      avisarFin(false);
    }
  });

  try {
    await BarcodeScanner.installGoogleBarcodeScannerModule();
  } catch {
    // Si ya se estaba descargando (por el meta-data del AndroidManifest),
    // install tira error pero el listener igual recibe el COMPLETED.
  }

  const ok = await terminado;
  clearTimeout(timeout);
  await listener.remove();
  if (!ok) {
    throw new Error('No se pudo descargar el lector de códigos. Revisá tu conexión y probá de nuevo.');
  }
}
