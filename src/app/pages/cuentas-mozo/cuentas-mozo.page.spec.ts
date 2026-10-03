import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CuentasMozoPage } from './cuentas-mozo.page';

describe('CuentasMozoPage', () => {
  let component: CuentasMozoPage;
  let fixture: ComponentFixture<CuentasMozoPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(CuentasMozoPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
