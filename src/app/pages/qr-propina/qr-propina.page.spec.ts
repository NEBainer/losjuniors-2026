import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QrPropinaPage } from './qr-propina.page';

describe('QrPropinaPage', () => {
  let component: QrPropinaPage;
  let fixture: ComponentFixture<QrPropinaPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(QrPropinaPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
