import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { FINANCIAL_FLOW, FINANCIAL_FLOW_LIST } from '../../config/financial-flow.config';
import { CategoryService } from '../../services/category.service';
import { CategoryListComponent } from './category-list.component';
import { Category } from '../../models/category.model';

// PrimeNG Imports
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-category-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    CardModule,
    CategoryListComponent
  ],
  templateUrl: './category-form.component.html',
  styleUrl: './category-form.component.css'
})
export class CategoryFormComponent {
  categoryForm: FormGroup;
  financialFlowList = FINANCIAL_FLOW_LIST;

  constructor(
    private fb: FormBuilder,
    private categoryService: CategoryService
  ) {
    this.categoryForm = this.fb.group({
      label: ['', Validators.required],
      financialFlowId: [FINANCIAL_FLOW.DEBIT.id, Validators.required]
    });
  }

  onSubmit(): void {
    if (!this.categoryForm.valid) {
      return;
    }

    const newCategory: Category = this.categoryForm.value;

    console.log('CATEGORY FORM COMPONENT : Catégorie envoyée au backend:', newCategory);

    this.categoryService.addCategory(newCategory).subscribe({
      next: () => {
        console.log('CATEGORY FORM COMPONENT : Catégorie ajoutée avec succès');
        this.resetForm();
        this.categoryService.getCategories();
      },
      error: (err) => {
        console.error('CATEGORY FORM COMPONENT : Erreur lors de l\'ajout de la catégorie :', err);
      },
    });
  }

  resetForm(): void {
    this.categoryForm.reset({
      label: '',
      financialFlowId: FINANCIAL_FLOW.DEBIT.id
    });
    this.categoryForm.markAsPristine();
    this.categoryForm.markAsUntouched();
  }
}
