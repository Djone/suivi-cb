import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { Category } from '../../models/category.model';
import { FINANCIAL_FLOW_LIST } from '../../config/financial-flow.config';

// PrimeNG Imports
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';

@Component({
  selector: 'app-edit-category-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    DropdownModule
  ],
  templateUrl: './edit-category-dialog.component.html',
  styleUrls: ['./edit-category-dialog.component.css']
})
export class EditCategoryDialogComponent {
  financialFlowList = FINANCIAL_FLOW_LIST;
  isNew: boolean = false;
  dialogTitle: string = '';

  constructor(
    public dialogRef: MatDialogRef<EditCategoryDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { category: Category; isNew?: boolean }
  ) {
    this.isNew = data.isNew || false;
    this.dialogTitle = this.isNew ? 'Nouvelle catégorie' : 'Éditer la catégorie';
  }

  save(): void {
    // Pour une nouvelle catégorie, ne pas inclure l'id
    const categoryData: any = {
      label: this.data.category.label,
      financialFlowId: this.data.category.financialFlowId,
    };

    // Pour une mise à jour, inclure l'id
    if (!this.isNew && this.data.category.id) {
      categoryData.id = this.data.category.id;
    }

    this.dialogRef.close(categoryData);
  }

  cancel(): void {
    this.dialogRef.close();
  }

  isFormValid(): boolean {
    return !!(this.data.category.label && this.data.category.label.trim() !== '' && this.data.category.financialFlowId);
  }
}
