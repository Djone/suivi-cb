import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditSubCategoryDialogComponent } from './edit-sub-category-dialog.component';

describe('EditSubCategoryDialogComponent', () => {
  let component: EditSubCategoryDialogComponent;
  let fixture: ComponentFixture<EditSubCategoryDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditSubCategoryDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditSubCategoryDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
