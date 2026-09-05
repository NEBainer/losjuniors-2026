import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RegistroPendientePage } from './registro-pendiente.page';

describe('RegistroPendientePage', () => {
  let component: RegistroPendientePage;
  let fixture: ComponentFixture<RegistroPendientePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(RegistroPendientePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
