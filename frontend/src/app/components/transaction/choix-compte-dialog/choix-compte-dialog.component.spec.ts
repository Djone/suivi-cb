import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChoixCompteDialogComponent } from './choix-compte-dialog.component';

describe('ChoixCompteDialogComponent', () => {
  let component: ChoixCompteDialogComponent;
  let fixture: ComponentFixture<ChoixCompteDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChoixCompteDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChoixCompteDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
