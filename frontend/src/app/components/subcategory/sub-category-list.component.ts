import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SubCategoryService } from '../../services/sub-category.service';
import { CategoryService } from '../../services/category.service';
import { SubCategory } from '../../models/sub-category.model';
import { Category } from '../../models/category.model';
import { EditSubCategoryDialogComponent } from '../edit-sub-category-dialog/edit-sub-category-dialog.component';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';

// PrimeNG Imports
import { DialogService } from 'primeng/dynamicdialog';
import { Table, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { TagModule } from 'primeng/tag';
import { CardModule } from 'primeng/card';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-subcategory-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    TagModule,
    CardModule,
    TooltipModule
  ],
  templateUrl: './sub-category-list.component.html',
  styleUrls: ['./sub-category-list.component.css'],
})
export class SubCategoryListComponent implements OnInit, OnDestroy {
  subCategories: SubCategory[] = [];
  parentCategories: Category[] = []; // Pour le filtre et l'affichage
  activeCategories: Category[] = []; // Pour les dialogues
  @ViewChild('dt') dt: Table | undefined;
  private subscriptions = new Subscription();

  constructor(
    private subCategoryService: SubCategoryService,
    private categoryService: CategoryService,
    private dialogService: DialogService
  ) {}

  ngOnInit(): void {
    // Charger les catégories parentes pour le filtre et les dialogues
    this.subscriptions.add(
      this.categoryService.categories$.subscribe({
        next: (data) => {
          this.parentCategories = data;
          this.activeCategories = data.filter(cat => cat.isActive === 1);
        }
      })
    );
    this.categoryService.getCategories().subscribe();

    // Charger les sous-catégories
    this.subscriptions.add(
      this.subCategoryService.subCategories$.subscribe({
        next: (data) => {
          this.subCategories = data;
          console.log('SUB CATEGORY LIST : Tableau mis à jour', data);
        },
        error: (err) => console.error('Erreur lors de la mise à jour des sous-catégories:', err)
      })
    );
    this.loadSubCategories();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
  
  loadSubCategories(): void {
    this.subCategoryService.getSubCategories().subscribe();
  }

  getCategoryName(categoryId: number): string {
    const category = this.parentCategories.find(cat => cat.id === categoryId);
    return category ? category.label : 'N/A';
  }

  getCategoryColor(categoryName: string): string {
    const colors: { [key: string]: string } = {
      'Salaires': '#10b981',
      'Quotidien': '#f59e0b',
      'Habitation': '#3b82f6',
      'Transports': '#8b5cf6',
      'Divertissements': '#ec4899',
      'Santé': '#ef4444',
      'Dettes': '#dc2626',
      'Epargne': '#059669',
      'Fournisseurs': '#0ea5e9'
    };
    // Retourne la couleur correspondante ou un gris par défaut
    return colors[categoryName] || '#6b7280';
  }

  createSubCategory(): void {
    const dialogRef = this.dialogService.open(EditSubCategoryDialogComponent, {
      width: '500px',
      data: {
        subCategory: { label: '', categoryId: null },
        categories: this.activeCategories,
        isNew: true
      }
    });

    dialogRef.onClose.subscribe(result => {
      if (result) {
        this.subCategoryService.addSubCategory(result).subscribe({
          next: () => {
            console.log('SUB CATEGORY LIST : Sous-catégorie créée avec succès');
            this.loadSubCategories();
          },
          error: (err) => console.error('SUB CATEGORY LIST : Erreur lors de la création:', err)
        });
      }
    });
  }

  editSubCategory(subCategory: SubCategory): void {
    const dialogRef = this.dialogService.open(EditSubCategoryDialogComponent, {
      width: '500px',
      data: {
        subCategory: { ...subCategory },
        categories: this.activeCategories,
        isNew: false
      }
    });

    dialogRef.onClose.subscribe(result => {
      if (result) {
        this.subCategoryService.updateSubCategory(result.id!, result).subscribe({
          next: () => {
            console.log('SUB CATEGORY LIST : Sous-catégorie mise à jour avec succès');
            // Recharger les données pour mettre à jour le BehaviorSubject
            this.loadSubCategories();
          },
          error: (err) => console.error('SUB CATEGORY LIST : Erreur lors de la mise à jour de la sous-catégorie:', err)
        });
      }
    });
  }

  deleteSubCategory(subCategory: SubCategory): void {
    const dialogRef = this.dialogService.open(ConfirmDialogComponent, {
      width: '500px',
      data: {
        title: 'Confirmer la suppression',
        message: `Voulez-vous vraiment supprimer la sous-catégorie "${subCategory.label}" ?`,
        confirmText: 'Supprimer',
        cancelText: 'Annuler'
      }
    });

    dialogRef.onClose.subscribe(confirmed => {
      if (confirmed) {
        this.subCategoryService.deleteSubCategory(subCategory.id!).subscribe({
          next: () => {
            console.log('SUB CATEGORY LIST : Sous-catégorie supprimée avec succès');
            this.loadSubCategories();
          },
          error: (err) => {
            console.error('SUB CATEGORY LIST : Erreur lors de la suppression de la sous-catégorie:', err);
            alert('Une erreur est survenue lors de la suppression.');
          }
        });
      }
    });
  }

  applyFilterGlobal(event: Event, stringVal: string) {
    this.dt!.filterGlobal((event.target as HTMLInputElement).value, stringVal);
  }
}