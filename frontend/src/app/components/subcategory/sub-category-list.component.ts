// frontend/src/app/components/category/sub-category-list.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { SubCategoryService } from '../../services/sub-category.service';
import { CategoryService } from '../../services/category.service';
import { SubCategory } from '../../models/sub-category.model';
import { Category } from '../../models/category.model';
import { EditSubCategoryDialogComponent } from '../edit-sub-category-dialog/edit-sub-category-dialog.component';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-subcategory-list',
  standalone: true,
  imports: [ CommonModule ],
  templateUrl: './sub-category-list.component.html',
  styleUrls: ['./sub-category-list.component.css']
})
export class SubCategoryListComponent implements OnInit, OnDestroy {
  subCategories: SubCategory[] = [];
  categories: Category[] = [];
  private subscriptions = new Subscription();

  constructor(
    private subCategoryService: SubCategoryService,
    private categoryService: CategoryService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    // S'abonner au BehaviorSubject pour les mises à jour automatiques
    this.subscriptions.add(
      this.subCategoryService.subCategories$.subscribe({
        next: (data) => {
          this.subCategories = data;
          console.log('SUB CATEGORY LIST : Tableau mis à jour automatiquement', data);
        },
        error: (err) => console.error('Erreur lors de la mise à jour des sous-catégories:', err)
      })
    );

    // Charger les catégories et les sous-catégories initiales
    this.loadSubCategories();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadSubCategories(): void {
    this.subCategoryService.getSubCategories().subscribe();

    // Charger uniquement les catégories actives pour le dialogue d'édition
    this.categoryService.getActiveCategories().subscribe({
      next: (data) => this.categories = data,
      error: (err) => console.error('Erreur lors du chargement des catégories actives:', err)
    });
  }

  editSubCategory(subCategory: SubCategory): void {
    const dialogRef = this.dialog.open(EditSubCategoryDialogComponent, {
      width: '500px',
      maxHeight: '90vh',
      data: { subCategory, categories: this.categories }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.subCategoryService.updateSubCategory(result.id!, result).subscribe({
          next: () => {
            console.log('SUB CATEGORY LIST : Sous-catégorie mise à jour avec succès');
            // Recharger les données pour mettre à jour le BehaviorSubject
            this.subCategoryService.getSubCategories().subscribe();
          },
          error: (err) => console.error('SUB CATEGORY LIST : Erreur lors de la mise à jour de la sous-catégorie:', err)
        });
      }
    });
  }

  deleteSubCategory(subCategory: SubCategory): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '450px',
      data: {
        title: 'Confirmer la suppression',
        message: `Voulez-vous vraiment supprimer la sous-catégorie "${subCategory.label}" ?`,
        confirmText: 'Supprimer',
        cancelText: 'Annuler'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.subCategoryService.deleteSubCategory(subCategory.id!).subscribe({
          next: () => {
            console.log('SUB CATEGORY LIST : Sous-catégorie supprimée avec succès');
          },
          error: (err) => {
            console.error('SUB CATEGORY LIST : Erreur lors de la suppression de la sous-catégorie:', err);
            alert('Une erreur est survenue lors de la suppression.');
          }
        });
      }
    });
  }
}