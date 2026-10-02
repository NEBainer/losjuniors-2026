import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EncuestasResultadosPage } from './encuestas-resultados.page';

describe('EncuestasResultadosPage', () => {
  let component: EncuestasResultadosPage;
  let fixture: ComponentFixture<EncuestasResultadosPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(EncuestasResultadosPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
