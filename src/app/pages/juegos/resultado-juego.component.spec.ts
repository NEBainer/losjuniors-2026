import { TestBed } from '@angular/core/testing';
import { ResultadoJuegoComponent } from './resultado-juego.component';

describe('ResultadoJuegoComponent', () => {
  it('con error al guardar también permite volver a juegos', () => {
    const fixture = TestBed.createComponent(ResultadoJuegoComponent);
    fixture.componentRef.setInput('errorGuardado', 'No se pudo guardar el resultado. Reintentá.');
    fixture.detectChanges();

    let volvio = false;
    fixture.componentInstance.volver.subscribe(() => (volvio = true));

    const botones = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const volver = botones.find((b) => b.textContent?.includes('Volver a juegos'));
    expect(volver).toBeTruthy();
    volver!.click();
    expect(volvio).toBe(true);
  });
});
