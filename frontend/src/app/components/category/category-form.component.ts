import { Component, ChangeDetectorRef  } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FINANCIAL_FLOW, FINANCIAL_FLOW_LIST } from '../../config/financial-flow.config';
import { CategoryService } from '../../services/category.service';
import { CategoryListComponent } from './category-list.component';
import { Category } from '../../models/category.model';  // Importer le modèle

@Component({
  selector: 'app-category-form',
  standalone: true,
  imports: [CommonModule, FormsModule, CategoryListComponent],
  templateUrl: './category-form.component.html',
  styleUrl: './category-form.component.css'
})
export class CategoryFormComponent {
  label: string = '';
  financialFlowId: number = FINANCIAL_FLOW.DEBIT.id; // Type par défaut : Dépense
  financialFlowList = FINANCIAL_FLOW_LIST; // Liste des flux financier (Revenu, dépense)
  formSubmitted: boolean = false; // Indique si le formulaire a été soumis

  constructor(
    private categoryService: CategoryService,
    private cdRef: ChangeDetectorRef // Injecter ChangeDetectorRef
  ) {}

  onSubmit(): void {
    this.formSubmitted = true; // Marquer le formulaire comme soumis
    
    // Vérification des champs requis
    if (!this.label.trim()) {
      return; // Arrête si la description est vide
    }

    // Création d'une nouvelle catégorie avec les données saisies
    const newCategory: Category = {
      label: this.label,
      financialFlowId: this.financialFlowId,
    };

    console.log('CATEGORY FORM COMPONENT : Catégories envoyées au backend:', newCategory);

    // Appel au service pour ajouter une nouvelle catégorie
    this.categoryService.addCategory(newCategory).subscribe({
      next: () => {
        console.log('CATEGORY FORM COMPONENT : Catégorie ajoutée avec succès');
        this.resetForm(); // Réinitialiser le formulaire
        this.categoryService.getCategories(); // Récupérer les catégories mises à jour
      },
      error: (err) => {
        console.error('CATEGORY FORM COMPONENT : Erreur lors de l\'ajout de la catégorie :', err);
      },
    });
  }

  /**
   * Méthode pour réinitialiser les champs du formulaire.
   */
  resetForm(): void {
    this.label = '';
    this.financialFlowId = FINANCIAL_FLOW.DEBIT.id; // Réinitialiser le type à "Dépense"
    this.formSubmitted = false; // Réinitialiser l'état du formulaire
    this.cdRef.detectChanges(); // Déclencher manuellement un re-rendu
  }
}
