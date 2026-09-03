import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  DynamicDialogConfig,
  DynamicDialogRef,
} from 'primeng/dynamicdialog';
import { OccurrenceAmountDialogComponent } from './occurrence-amount-dialog.component';

describe('OccurrenceAmountDialogComponent', () => {
  let component: OccurrenceAmountDialogComponent;
  let fixture: ComponentFixture<OccurrenceAmountDialogComponent>;
  let dialogRef: jasmine.SpyObj<DynamicDialogRef>;

  beforeEach(async () => {
    dialogRef = jasmine.createSpyObj<DynamicDialogRef>('DynamicDialogRef', [
      'close',
    ]);

    await TestBed.configureTestingModule({
      imports: [OccurrenceAmountDialogComponent],
      providers: [
        { provide: DynamicDialogRef, useValue: dialogRef },
        {
          provide: DynamicDialogConfig,
          useValue: {
            data: {
              label: 'Assurance',
              dueDate: new Date(2026, 8, 15),
              amount: -72.5,
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OccurrenceAmountDialogComponent);
    component = fixture.componentInstance;
  });

  it('initialise le montant en valeur absolue et enregistre la saisie', () => {
    expect(component.amount).toBe(72.5);

    component.amount = 75;
    component.save();

    expect(dialogRef.close).toHaveBeenCalledWith(75);
  });

  it('ferme sans montant lors de l annulation', () => {
    component.cancel();

    expect(dialogRef.close).toHaveBeenCalledWith(null);
  });

  it('refuse un montant invalide', () => {
    component.amount = -1;
    component.save();

    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});
