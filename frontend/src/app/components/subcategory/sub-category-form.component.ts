import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { SubCategoryService } from '../../services/sub-category.service';
import { CategoryService } from '../../services/category.service';
import { SubCategory } from '../../models/sub-category.model';
import { Category } from '../../models/category.model';
import { SubCategoryListComponent } from './sub-category-list.component';

@Component({
    selector: 'app-sub-category-form',
    standalone: true,
    imports: [
      CommonModule,
      ReactiveFormsModule,
      MatInputModule,
      MatIconModule,
      MatButtonModule,
      MatFormFieldModule,
      MatSelectModule,
      SubCategoryListComponent
    ],
    templateUrl: './sub-category-form.component.html',
    styleUrls: ['./sub-category-form.component.css'],
})
export class SubCategoryFormComponent implements OnInit {
  subCategoryForm: FormGroup;
  categories: Category[] = [];

  constructor(
    private fb: FormBuilder,
    private subCategoryService: SubCategoryService,
    private categoryService: CategoryService
  ) {
    this.subCategoryForm = this.fb.group({
      label: ['', Validators.required],
      categoryId: [null, Validators.required]
    });
  }

  ngOnInit(): void {
    // Charger uniquement les catégories actives pour le formulaire
    this.categoryService.getActiveCategories().subscribe({
      next: (categories) => (this.categories = categories),
      error: (err) => console.error('SUB CATEGORY FORM COMPONENT : Erreur lors du chargement des catégories actives :', err),
    });
  }

  onSubmit(): void {
    if (!this.subCategoryForm.valid) {
      return;
    }

    const newSubCategory: SubCategory = this.subCategoryForm.value;

    console.log('SUB CATEGORY FORM COMPONENT : Sous-catégorie envoyée au backend:', newSubCategory);

    this.subCategoryService.addSubCategory(newSubCategory).subscribe({
      next: () => {
        console.log('SUB CATEGORY FORM COMPONENT : Sous-catégorie ajoutée avec succès');
        this.resetForm();
        this.subCategoryService.getSubCategories();
      },
      error: (err) => console.error('SUB CATEGORY FORM COMPONENT : Erreur lors de l\'ajout de la sous-catégorie :', err),
    });
  }

  resetForm(): void {
    this.subCategoryForm.reset({
      label: '',
      categoryId: null
    });
    this.subCategoryForm.markAsPristine();
    this.subCategoryForm.markAsUntouched();
  }
}
