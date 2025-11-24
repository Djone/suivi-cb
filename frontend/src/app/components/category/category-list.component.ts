// frontend/src/app/components/category/category-list.component.ts
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { CategoryService } from '../../services/category.service';
import { SubCategoryService } from '../../services/sub-category.service';
import { Category } from '../../models/category.model';
import { SubCategory } from '../../models/sub-category.model';
import { Transaction } from '../../models/transaction.model';
import { getFinancialFlowNameById } from '../../utils/utils';
import { EditCategoryDialogComponent } from '../edit-category-dialog/edit-category-dialog.component';
import { EditSubCategoryDialogComponent } from '../edit-sub-category-dialog/edit-sub-category-dialog.component';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';

// PrimeNG
import { DialogService } from 'primeng/dynamicdialog';
import { Table, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputSwitchModule } from 'primeng/inputswitch';
import { TooltipModule } from 'primeng/tooltip';
import { TabViewModule } from 'primeng/tabview';
import { BadgeModule } from 'primeng/badge';
import { TagModule } from 'primeng/tag';
import { TransactionService } from '../../services/transaction.service';
import { RouterModule, Router } from '@angular/router';

interface CategoryRow extends Category {
  financialFlowLabel: string;
  statusLabel: string;
  subCategories: SubCategory[];
  subSearchText: string;
}

@Component({
  selector: 'app-category-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputSwitchModule,
    TooltipModule,
    TabViewModule,
    BadgeModule,
    TagModule,
    RouterModule,
  ],
  templateUrl: './category-list.component.html',
  styleUrls: ['./category-list.component.css'],
})
export class CategoryListComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();

  categories: Category[] = [];
  subCategories: SubCategory[] = [];
  expenseCategories: CategoryRow[] = [];
  revenueCategories: CategoryRow[] = [];
  private transactions: Transaction[] = [];
  private subCategoryOperationCounts = new Map<number, number>();

  financialFlowNameById = getFinancialFlowNameById;

  @ViewChild('dtExpense') dtExpense: Table | undefined;
  @ViewChild('dtRevenue') dtRevenue: Table | undefined;

  constructor(
    private categoryService: CategoryService,
    private subCategoryService: SubCategoryService,
    private transactionService: TransactionService,
    private router: Router,
    private dialogService: DialogService,
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.categoryService.categories$.subscribe({
        next: (data) => {
          this.categories = data.map((category) => ({
            ...category,
            isActive: category.isActive ?? 0,
          }));
          this.rebuildViews();
        },
        error: (err) => console.error('CATEGORY LIST: erreur categories', err),
      }),
    );

    this.subscriptions.add(
      this.subCategoryService.subCategories$.subscribe({
        next: (data) => {
          this.subCategories = data.map((sub) => ({
            ...sub,
            isActive: sub.isActive ?? 1,
          }));
          this.rebuildViews();
        },
        error: (err) =>
          console.error('CATEGORY LIST: erreur sous-categories', err),
      }),
    );

    this.subscriptions.add(
      this.transactionService.transactions$.subscribe({
        next: (transactions) => {
          this.transactions = transactions;
          this.recomputeOperationCounts();
          this.rebuildViews();
        },
        error: (err) =>
          console.error('CATEGORY LIST: erreur transactions', err),
      }),
    );

    this.categoryService.getCategories().subscribe();
    this.subCategoryService.getSubCategories().subscribe();
    this.transactionService.loadTransactions();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private rebuildViews(): void {
    if (!this.categories.length) {
      this.expenseCategories = [];
      this.revenueCategories = [];
      return;
    }

    const enrich = (category: Category): CategoryRow => {
      const children = this.subCategories.filter(
        (sub) => sub.categoryId === category.id,
      ).map((sub) => ({
        ...sub,
        operationsCount: this.getOperationsCount(sub.id),
      }));
      return {
        ...category,
        financialFlowLabel: this.financialFlowNameById(
          category.financialFlowId,
        ),
        statusLabel: this.getStatusLabel(category.isActive),
        subCategories: children,
        subSearchText: children.map((sub) => sub.label).join(' '),
      };
    };

    this.expenseCategories = this.categories
      .filter((category) => category.financialFlowId === 2)
      .map(enrich);
    this.revenueCategories = this.categories
      .filter((category) => category.financialFlowId === 1)
      .map(enrich);
  }

  private recomputeOperationCounts(): void {
    const counts = new Map<number, number>();
    this.transactions.forEach((transaction) => {
      const raw = transaction.subCategoryId;
      if (raw === null || raw === undefined) {
        return;
      }
      const subId =
        typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);
      if (!Number.isFinite(subId)) {
        return;
      }
      counts.set(subId, (counts.get(subId) ?? 0) + 1);
    });
    this.subCategoryOperationCounts = counts;
  }

  private getOperationsCount(subCategoryId?: number): number {
    if (!subCategoryId) {
      return 0;
    }
    return this.subCategoryOperationCounts.get(subCategoryId) ?? 0;
  }

  applyGlobalFilter(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    this.dtExpense?.filterGlobal(query, 'contains');
    this.dtRevenue?.filterGlobal(query, 'contains');
  }

  isActive(category: Category): boolean {
    return category.isActive === 1 || category['is_active'] === 1;
  }

  getSeverity(isActive: number | undefined): string {
    return (isActive ?? 0) === 1 ? 'success' : 'danger';
  }

  getStatusLabel(isActive: number | undefined): string {
    return (isActive ?? 0) === 1 ? 'Actif' : 'Inactif';
  }

  createCategory(): void {
    const dialogRef = this.dialogService.open(EditCategoryDialogComponent, {
      header: 'Nouvelle catégorie',
      width: '500px',
      data: {
        category: { label: '', financialFlowId: 2 },
        isNew: true,
      },
    });

    dialogRef.onClose.subscribe((result) => {
      if (result) {
        this.categoryService.addCategory(result).subscribe({
          next: () => this.categoryService.getCategories().subscribe(),
          error: (err) =>
            console.error('CATEGORY LIST: erreur creation categorie', err),
        });
      }
    });
  }

  editCategory(category: Category): void {
    const dialogRef = this.dialogService.open(EditCategoryDialogComponent, {
      header: 'Editer une catégorie',
      width: '500px',
      data: {
        category: { ...category },
        isNew: false,
      },
    });

    dialogRef.onClose.subscribe((result) => {
      if (result) {
        this.categoryService.updateCategory(result.id!, result).subscribe({
          next: () => this.categoryService.getCategories().subscribe(),
          error: (err) =>
            console.error('CATEGORY LIST: erreur maj categorie', err),
        });
      }
    });
  }

  toggleActive(category: Category, event: any): void {
    const newStatus = event.checked === 1;
    const service$ = newStatus
      ? this.categoryService.reactivateCategory(category.id!)
      : this.categoryService.deleteCategory(category.id!);

    service$.subscribe({
      next: () =>
        setTimeout(() => this.categoryService.getCategories().subscribe(), 100),
      error: (err) => {
        console.error('CATEGORY LIST: erreur toggle categorie', err);
        this.categoryService.getCategories().subscribe();
      },
    });
  }

  deleteCategory(category: Category): void {
    const dialogRef = this.dialogService.open(ConfirmDialogComponent, {
      width: '500px',
      data: {
        title: 'Confirmer la désactivation',
        message: `Voulez-vous désactiver la catégorie "${category.label}" ?`,
        confirmText: 'Désactiver',
        cancelText: 'Annuler',
      },
    });

    dialogRef.onClose.subscribe((confirmed) => {
      if (confirmed) {
        this.categoryService.deleteCategory(category.id!).subscribe({
          next: () => this.categoryService.getCategories().subscribe(),
          error: (err) =>
            console.error('CATEGORY LIST: erreur désactivation categorie', err),
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
        cancelText: 'Annuler',
      },
    });

    dialogRef.onClose.subscribe((confirmed) => {
      if (confirmed) {
        this.categoryService.reactivateCategory(category.id!).subscribe({
          next: () => this.categoryService.getCategories().subscribe(),
          error: (err) =>
            console.error('CATEGORY LIST: erreur réactivation categorie', err),
        });
      }
    });
  }

  createSubCategory(category: Category): void {
    const dialogRef = this.dialogService.open(EditSubCategoryDialogComponent, {
      width: '500px',
      data: {
        subCategory: { label: '', categoryId: category.id },
        categories: this.categories.filter((cat) => this.isActive(cat)),
        isNew: true,
      },
    });

    dialogRef.onClose.subscribe((result) => {
      if (result) {
        this.subCategoryService.addSubCategory(result).subscribe({
          next: () => this.subCategoryService.getSubCategories().subscribe(),
          error: (err) =>
            console.error('CATEGORY LIST: erreur creation sous-categorie', err),
        });
      }
    });
  }

  editSubCategory(subCategory: SubCategory): void {
    const dialogRef = this.dialogService.open(EditSubCategoryDialogComponent, {
      width: '500px',
      data: {
        subCategory: { ...subCategory },
        categories: this.categories.filter((cat) => this.isActive(cat)),
        isNew: false,
      },
    });

    dialogRef.onClose.subscribe((result) => {
      if (result) {
        this.subCategoryService
          .updateSubCategory(result.id!, result)
          .subscribe({
            next: () => this.subCategoryService.getSubCategories().subscribe(),
            error: (err) =>
              console.error('CATEGORY LIST: erreur maj sous-categorie', err),
          });
      }
    });
  }

  deleteSubCategory(subCategory: SubCategory): void {
    const dialogRef = this.dialogService.open(ConfirmDialogComponent, {
      width: '480px',
      data: {
        title: 'Confirmer la suppression',
        message: `Supprimer la sous-catégorie "${subCategory.label}" ?`,
        confirmText: 'Supprimer',
        cancelText: 'Annuler',
      },
    });

    dialogRef.onClose.subscribe((confirmed) => {
      if (confirmed) {
        this.subCategoryService.deleteSubCategory(subCategory.id!).subscribe({
          next: () => this.subCategoryService.getSubCategories().subscribe(),
          error: (err) =>
            console.error(
              'CATEGORY LIST: erreur suppression sous-categorie',
              err,
            ),
        });
      }
    });
  }

  viewCategoryTransactions(category: Category): void {
    if (!category?.id) {
      return;
    }
    const id = category.id;
    this.transactionService.applyFilterTransactions('categoryId', id);
    this.router.navigate(['/transactions'], {
      queryParams: { categoryId: id },
    });
  }

  viewSubCategoryTransactions(subCategory: SubCategory): void {
    if (!subCategory?.id) {
      return;
    }
    const id = subCategory.id;
    this.transactionService.applyFilterTransactions('subCategoryId', id);
    this.router.navigate(['/transactions'], {
      queryParams: { subCategoryId: id },
    });
  }
}
