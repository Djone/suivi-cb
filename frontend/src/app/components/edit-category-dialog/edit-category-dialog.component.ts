import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FINANCIAL_FLOW_LIST } from '../../config/financial-flow.config';

// PrimeNG Imports
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';

@Component({
  selector: 'app-edit-category-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
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
    public ref: DynamicDialogRef,
    public config: DynamicDialogConfig
  ) {}

  get data() {
    return this.config.data;
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

    this.ref.close(categoryData);
  }

  cancel(): void {
    this.ref.close();
  }

  isFormValid(): boolean {
    return !!(this.data.category.label && this.data.category.label.trim() !== '' && this.data.category.financialFlowId);
  }
}
