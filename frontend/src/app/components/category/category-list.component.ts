// frontend/src/app/components/category/category-list.component.ts
import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CategoryService } from '../../services/category.service';
import { Category } from '../../models/category.model';
import { getFinancialFlowNameById } from '../../utils/utils';
import { EditCategoryDialogComponent } from '../edit-category-dialog/edit-category-dialog.component';
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
import { InputSwitchModule } from 'primeng/inputswitch';
import { CardModule } from 'primeng/card';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-category-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    TagModule,
    InputSwitchModule,
    CardModule,
    TooltipModule
  ],
  templateUrl: './category-list.component.html',
  styleUrls: ['./category-list.component.css']
})
export class CategoryListComponent implements OnInit, OnDestroy {
  categories: Category[] = [];
  financialFlowNameById = getFinancialFlowNameById;
  @ViewChild('dt') dt: Table | undefined;
  private subscriptions = new Subscription();

  // Options pour les dropdowns
  statuses = [
    { label: 'Actif', value: 1 },
    { label: 'Inactif', value: 0 }
  ];

  financialFlows = [
    { label: 'Revenu', value: 1 },
    { label: 'Dépense', value: 2 }
  ];

  constructor(
    private categoryService: CategoryService,
    private dialogService: DialogService
  ) {}

  ngOnInit(): void {
    // S'abonner au BehaviorSubject pour les mises à jour automatiques
    this.subscriptions.add(
      this.categoryService.categories$.subscribe({
        next: (data) => {
          // Enrichir les données pour l'affichage et le filtrage
          this.categories = data.map(category => ({
            ...category,
            financialFlowLabel: this.financialFlowNameById(category.financialFlowId),
            statusLabel: this.getStatusLabel(category.isActive),
            // Assurer que isActive a une valeur pour le p-inputSwitch
            isActive: category.isActive ?? 0
          }));
          console.log('CATEGORY LIST : Tableau mis à jour automatiquement', data);
        },
        error: (err) => console.error('Erreur lors de la mise à jour des catégories:', err)
      })
    );
    // Charger les catégories initiales
    this.loadCategories();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadCategories(): void {
    this.categoryService.getCategories().subscribe();
  }

  isActive(category: Category): boolean {
    // Vérifier si la catégorie est active (gère snake_case et camelCase)
    return category.isActive === 1 || category['is_active'] === 1;
  }

  // Créer une nouvelle catégorie
  createCategory(): void {
    const dialogRef = this.dialogService.open(EditCategoryDialogComponent, {
      header: 'Nouvelle catégorie',
      width: '500px',
      data: {
        category: {
          label: '',
          financialFlowId: 2 // Dépense par défaut
        },
        isNew: true
      }
    });

    dialogRef.onClose.subscribe(result => {
      if (result) {
        this.categoryService.addCategory(result).subscribe({
          next: () => {
            console.log('CATEGORY LIST : Catégorie créée avec succès');
            this.categoryService.getCategories().subscribe();
          },
          error: (err) => console.error('CATEGORY LIST : Erreur lors de la création de la catégorie:', err)
        });
      }
    });
  }

  // Éditer une catégorie existante
  editCategory(category: Category): void {
    const dialogRef = this.dialogService.open(EditCategoryDialogComponent, {
      header: 'Editer une catégorie',
      width: '500px',
      data: {
        category: { ...category },
        isNew: false
      }
    });

    dialogRef.onClose.subscribe(result => {
      if (result) {
        this.categoryService.updateCategory(result.id!, result).subscribe({
          next: () => {
            console.log('CATEGORY LIST : Catégorie mise à jour avec succès');
            // Recharger les données pour mettre à jour le BehaviorSubject
            this.categoryService.getCategories().subscribe();
          },
          error: (err) => console.error('CATEGORY LIST : Erreur lors de la mise à jour de la catégorie:', err)
        });
      }
    });
  }

  deleteCategory(category: Category): void {
    const dialogRef = this.dialogService.open(ConfirmDialogComponent, {
      width: '500px',
      data: {
        title: 'Confirmer la désactivation',
        message: `Voulez-vous vraiment désactiver la catégorie "${category.label}" ? Elle restera visible mais ne sera plus utilisable pour de nouvelles transactions.`,
        confirmText: 'Désactiver',
        cancelText: 'Annuler'
      }
    });

    dialogRef.onClose.subscribe(confirmed => {
      if (confirmed) {
        this.categoryService.deleteCategory(category.id!).subscribe({
          next: () => {
            console.log('CATEGORY LIST : Catégorie désactivée avec succès');
            this.loadCategories(); // Recharger pour mettre à jour l'affichage
          },
          error: (err) => {
            console.error('CATEGORY LIST : Erreur lors de la désactivation de la catégorie:', err);
            alert('Une erreur est survenue lors de la désactivation.');
          }
        });
      }
    });
  }

  reactivateCategory(category: Category): void {
    const dialogRef = this.dialogService.open(ConfirmDialogComponent, {
      width: '450px',
      data: {
        title: 'Confirmer la réactivation',
        message: `Voulez-vous réactiver la catégorie "${category.label}" ?`,
        confirmText: 'Réactiver',
        cancelText: 'Annuler'
      }
    });

    dialogRef.onClose.subscribe(confirmed => {
      if (confirmed) {
        this.categoryService.reactivateCategory(category.id!).subscribe({
          next: () => {
            console.log('CATEGORY LIST : Catégorie réactivée avec succès');
            this.loadCategories(); // Recharger pour mettre à jour l'affichage
          },
          error: (err) => {
            console.error('CATEGORY LIST : Erreur lors de la réactivation de la catégorie:', err);
            alert('Une erreur est survenue lors de la réactivation.');
          }
        });
      }
    });
  }

  // Basculer le statut actif/inactif (sans confirmation)
  toggleActive(category: Category, event: any): void {
    // Log pour déboguer
    console.log('CATEGORY LIST : toggleActive appelé', {
      category: category.label,
      categoryId: category.id,
      currentStatus: category.isActive,
      event: event,
      eventChecked: event.checked
    });

    // Récupérer la nouvelle valeur depuis l'événement
    const newStatus = event.checked === 1;
    const action = newStatus ? 'réactiver' : 'désactiver';

    console.log(`CATEGORY LIST : Action à effectuer: ${action}, newStatus: ${newStatus}`);

    const service$ = newStatus
      ? this.categoryService.reactivateCategory(category.id!)
      : this.categoryService.deleteCategory(category.id!);

    service$.subscribe({
      next: () => {
        console.log(`CATEGORY LIST : Catégorie ${action}e avec succès - rechargement des catégories`);
        // Attendre un peu avant de recharger pour laisser le temps à la DB de se mettre à jour
        setTimeout(() => {
          this.categoryService.getCategories().subscribe({
            next: () => console.log('CATEGORY LIST : Catégories rechargées après toggle'),
            error: (err) => console.error('CATEGORY LIST : Erreur lors du rechargement:', err)
          });
        }, 100);
      },
      error: (err) => {
        console.error(`CATEGORY LIST : Erreur lors de la ${action}:`, err);
        alert(`Une erreur est survenue lors de la ${action}.`);
        // Remettre le switch à son état précédent en cas d'erreur
        this.loadCategories();
      }
    });
  }

  getSeverity(isActive: number | undefined): string {
    return (isActive ?? 0) === 1 ? 'success' : 'danger';
  }

  getStatusLabel(isActive: number | undefined): string {
    return (isActive ?? 0) === 1 ? 'Actif' : 'Inactif';
  }

  applyFilterGlobal(event: Event, stringVal: string) {
    this.dt!.filterGlobal((event.target as HTMLInputElement).value, stringVal);
  }
}