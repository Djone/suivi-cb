import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { EditSubCategoryDialogComponent } from './edit-sub-category-dialog.component';

describe('EditSubCategoryDialogComponent', () => {
  let component: EditSubCategoryDialogComponent;
  let fixture: ComponentFixture<EditSubCategoryDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditSubCategoryDialogComponent],
      providers: [
        { provide: DynamicDialogRef, useValue: { close: jasmine.createSpy('close') } },
        {
          provide: DynamicDialogConfig,
          useValue: {
            data: {
              isNew: false,
              subCategory: {
                id: 1,
                label: 'Test',
                categoryId: 1,
              },
              categories: [{ id: 1, label: 'Categorie test' }],
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EditSubCategoryDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
