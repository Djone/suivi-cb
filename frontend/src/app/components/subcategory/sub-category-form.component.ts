import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SubCategoryService } from '../../services/sub-category.service';
import { CategoryService } from '../../services/category.service';
import { SubCategory } from '../../models/sub-category.model';
import { Category } from '../../models/category.model';
import { SubCategoryListComponent } from './sub-category-list.component';

@Component({
    selector: 'app-sub-category-form',
    standalone: true,
    imports: [CommonModule, FormsModule, SubCategoryListComponent],
    templateUrl: './sub-category-form.component.html',
    styleUrls: ['./sub-category-form.component.css'],
})
export class SubCategoryFormComponent implements OnInit {
  label: string = ''; // Nom de la sous-catégorie
  categoryId: number | null = null; // ID de la catégorie sélectionnée
  categories: Category[] = []; // Liste des catégories disponibles
  formSubmitted: boolean = false; // Indique si le formulaire a été soumis

  constructor(
    private subCategoryService: SubCategoryService,
    private categoryService: CategoryService,
    private cdRef: ChangeDetectorRef // Injecter ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Récupérer les catégories existantes pour les afficher dans la liste déroulante
    this.categoryService.getCategories().subscribe({
      next: (categories) => (this.categories = categories),
      error: (err) => console.error('SUB CATEGORY FORM COMPONENT : Erreur lors du chargement des sous-catégories :', err),
    });
  }

  onSubmit(): void {
    this.formSubmitted = true;

    if (!this.label.trim() || !this.categoryId) {
      return; // Validation échouée
    }

    const newSubCategory: SubCategory = {
      label: this.label,
      categoryId: this.categoryId,
    };

    console.log('SUB CATEGORY FORM COMPONENT : Sous-catégories envoyées au backend:', newSubCategory);

    // Appel au service pour ajouter la sous-catégorie
    this.subCategoryService.addSubCategory(newSubCategory).subscribe({
      next: () => {
        console.log('SUB CATEGORY FORM COMPONENT : Sous-catégorie ajoutée avec succès');
        this.resetForm();
        this.subCategoryService.getSubCategories(); // Récupérer les catégories mises à jour
      },
      error: (err) => console.error('SUB CATEGORY FORM COMPONENT : Erreur lors de l\'ajout de la sous-catégorie :', err),
    });
  }

  resetForm(): void {
    this.label = '';
    this.categoryId = null;
    this.formSubmitted = false;
    this.cdRef.detectChanges(); // Déclencher manuellement un re-rendu
  }
}
