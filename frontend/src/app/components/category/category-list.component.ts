// frontend/src/app/components/category/category-list.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CategoryService } from '../../services/category.service';
import { Category } from '../../models/category.model';  // Importer le modèle
import { FINANCIAL_FLOW_LIST } from '../../config/financial-flow.config'; // Importer la liste des types
import { getFinancialFlowNameById } from '../../utils/utils';

@Component({
  selector: 'app-category-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './category-list.component.html',
  styleUrls: ['./category-list.component.css']
})
export class CategoryListComponent implements OnInit  {
  categories: Category[] = [];  // Définir le type comme Category[]
  editedCategory: Category | null = null; // Catégorie en cours d'édition
  financialFlowList  = FINANCIAL_FLOW_LIST; // Charger la liste des types de transcation depuis la config
  financialFlowNameById = getFinancialFlowNameById;

  constructor(
    private categoryService: CategoryService
  ) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  // Charger les catégories depuis le service
  loadCategories(): void {
    this.categoryService.getCategories().subscribe();
    this.categoryService.categories$.subscribe(categories => {
      this.categories = categories;
    });
  }
  
  get editableCategory(): Category {
    return this.editedCategory || { id: 0, label: '', financialFlowId: 1 }; // Objet par défaut
  }

  // Mode édition
  editCategory(category: Category): void {
    this.editedCategory = { ...category }; // Cloner la catégorie en cours d'édition
  }

   // Enregistrer les modifications
  saveCategory(): void {
    if (this.editedCategory) { // Vérifie si editedCategory n'est pas null
      const { id, label, financialFlowId } = this.editedCategory;
      
      // Convertir flux_financier_id en entier
    const financialFlowIdAsNumber = Number(financialFlowId);

    // Vérifier si la conversion a échoué
    if (isNaN(financialFlowIdAsNumber)) {
      console.error('CATEGORY LIST COMPONENT : Le financialFlowId est invalide');
      return; // Ne pas envoyer si la conversion échoue
    }

    console.log('CATEGORY LIST COMPONENT : Données de la catégorie à enregistrer:', { label, financialFlowIdAsNumber });

    this.categoryService.updateCategory(id!, { label, financialFlowId: financialFlowIdAsNumber }).subscribe({
        next: () => {
          const index = this.categories.findIndex(c => c.id === id);
          if (index !== -1) {
            this.categories[index] = {
              ...this.categories[index],
              label,
              financialFlowId: financialFlowIdAsNumber,
            };
            console.log('CATEGORY LIST COMPONENT : Catégorie mise à jour localement:', this.categories[index]);
          }
          this.editedCategory = null; // Quitter le mode édition
        },
        error: (err) => {
          console.error('CATEGORY LIST COMPONENT : Erreur lors de la mise à jour de la catégorie :', err);
        }
      });
    } else {
      console.error('CATEGORY LIST COMPONENT : Impossible de sauvegarder : editedCategory est null.');
    }
  }

  // Annuler l'édition
  cancelEdit(): void {
    this.editedCategory = null; // Quitter le mode édition sans enregistrer
  }

  // Supprimer une catégorie
  deleteCategory(id: number): void {
    if (confirm('Voulez-vous vraiment supprimer cette catégorie ?')) {
      this.categoryService.deleteCategory(id).subscribe({
        next: () => {
          alert('Catégorie supprimée avec succès.');
          this.loadCategories(); // Recharger les catégories
        },
        error: (err) => {
          console.error('CATEGORY LIST COMPONENT : Erreur lors de la suppression de la catégorie :', err);
          alert('Une erreur est survenue lors de la suppression.');
        }
      });
    }
  }
}