import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { SubCategory } from '../../models/sub-category.model';
import { Category } from '../../models/category.model';

@Component({
  selector: 'app-edit-sub-category-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDialogModule
  ],
  templateUrl: './edit-sub-category-dialog.component.html',
  styleUrls: ['./edit-sub-category-dialog.component.css']
})
export class EditSubCategoryDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<EditSubCategoryDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { subCategory: SubCategory, categories: Category[] }
  ) {}

  save(): void {
    this.dialogRef.close(this.data.subCategory);
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
