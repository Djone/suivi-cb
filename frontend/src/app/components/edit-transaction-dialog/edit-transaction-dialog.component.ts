import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

// PrimeNG Imports
import { DynamicDialogRef, DynamicDialogConfig, DialogService } from 'primeng/dynamicdialog';
import { InputTextModule } from 'primeng/inputtext';
import { CalendarModule } from 'primeng/calendar';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { DropdownModule, DropdownFilterEvent } from 'primeng/dropdown';
import { AutoCompleteModule } from 'primeng/autocomplete';

import { Transaction } from '../../models/transaction.model';
import { SubCategory } from '../../models/sub-category.model';
import { Category } from '../../models/category.model';
import { Account } from '../../models/account.model';
import { RecurringTransaction } from '../../models/recurring-transaction.model';
import { SubCategoryService } from '../../services/sub-category.service';
import { AccountService } from '../../services/account.service';
import { RecurringTransactionService } from '../../services/recurring-transaction.service';
import { CategoryService } from '../../services/category.service';
import { FINANCIAL_FLOW_LIST } from '../../config/financial-flow.config';
import { EditSubCategoryDialogComponent } from '../edit-sub-category-dialog/edit-sub-category-dialog.component';

@Component({
  selector: 'app-edit-transaction-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    InputTextModule,
    CalendarModule,
    InputNumberModule,
    ButtonModule,
    DropdownModule,
    AutoCompleteModule,
  ],
  templateUrl: './edit-transaction-dialog.component.html',
  styleUrls: ['./edit-transaction-dialog.component.css'],
})
export class EditTransactionDialogComponent implements OnInit {
  subcategories: SubCategory[] = [];
  activeSubCategories: SubCategory[] = [];
  transactionDate!: Date;
  selectedSubCategoryId = 0;
  categories: Category[] = [];
  availableCategories: Category[] = [];
  currentSubCategoryQuery = '';
  dialogTitle = 'Editer la transaction';
  isNew = false;

  // Listes pour les dropdowns
  accounts: Account[] = [];
  financialFlowList = FINANCIAL_FLOW_LIST;
  allRecurringTransactions: RecurringTransaction[] = [];
  filteredRecurringTransactions: RecurringTransaction[] = [];
  private initialAmount: number | null = null;

  get data() {
    return this.config.data;
  }

  constructor(
    public ref: DynamicDialogRef,
    public config: DynamicDialogConfig,
    private subCategoryService: SubCategoryService,
    private accountService: AccountService,
    private recurringTransactionService: RecurringTransactionService,
    private categoryService: CategoryService,
    private dialogService: DialogService,
  ) {
    this.isNew = this.data.isNew || false;
    this.dialogTitle = this.isNew ? 'Nouvelle transaction' : 'Editer la transaction';
    this.initialAmount = this.normalizeAmount(this.data.transaction.amount);
  }

  ngOnInit(): void {
    // Charger les comptes
    this.accountService.accounts$.subscribe({
      next: (accounts) => {
        this.accounts = accounts;
      },
      error: (err) => console.error('Erreur lors du chargement des comptes:', err),
    });

    // Charger les transactions récurrentes si c'est une nouvelle transaction
    if (this.isNew) {
      this.recurringTransactionService.recurringTransactions$.subscribe({
        next: (recurring) => {
          this.allRecurringTransactions = recurring.filter((rt) => rt.isActive === 1);
        },
      });
    }

    // Convertir la date string en objet Date (correction du décalage)
    if (this.data.transaction.date) {
      if (this.data.transaction.date instanceof Date) {
        this.transactionDate = this.data.transaction.date;
      } else {
        const dateValue = this.data.transaction.date;
        const dateStr = typeof dateValue === 'string' ? dateValue : String(dateValue);
        const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
        this.transactionDate = new Date(year, month - 1, day);
      }
    } else {
      this.transactionDate = new Date();
    }

    // Récupérer le subCategoryId (en snake_case ou camelCase)
    const rawSubCategoryId = this.data.transaction.subCategoryId || this.data.transaction['sub_category_id'];
    this.selectedSubCategoryId = typeof rawSubCategoryId === 'string' ? parseInt(rawSubCategoryId, 10) : (rawSubCategoryId || 0);

    // Normaliser le montant pour l'input currency
    const normalizedAmount = this.normalizeAmount(this.data.transaction.amount);
    this.data.transaction.amount = normalizedAmount ?? 0;

    // Récupérer le financialFlowId (en snake_case ou camelCase)
    const financialFlowId = this.data.transaction.financialFlowId || this.data.transaction['financial_flow_id'];

    // Charger les sous-catégories en fonction du flux financier de la transaction
    this.loadSubcategories(financialFlowId!);

    // Charger les catégories pour alimenter la création rapide de sous-catégories
    this.categoryService.categories$.subscribe({
      next: (categories) => {
        this.categories = categories;
        if (financialFlowId) {
          this.updateAvailableCategories(financialFlowId);
          this.hydrateActiveSubCategories();
        }
      },
      error: (err) => console.error('Erreur lors du chargement des catégories:', err),
    });
    this.categoryService.getCategories().subscribe();
  }

  // --- Nouvelle logique pour les échéances ---

  filterRecurring(event: any): void {
    const query = (event.query || '').toLowerCase();
    this.filteredRecurringTransactions = this.allRecurringTransactions.filter(
      (rt) => rt.label.toLowerCase().includes(query) && rt.accountId === this.data.transaction.accountId,
    );
  }

  onRecurringTransactionSelected(event: any): void {
    const selectedRecurring: RecurringTransaction = event.value;

    // Pré-remplir le formulaire
    this.data.transaction.description = selectedRecurring.label;
    this.data.transaction.amount = this.normalizeAmount(selectedRecurring.amount) ?? 0;
    this.data.transaction.financialFlowId = selectedRecurring.financialFlowId;
    this.data.transaction.subCategoryId = selectedRecurring.subCategoryId;
    this.data.transaction.recurringTransactionId = selectedRecurring.id;

    // Mettre à jour le champ de sous-catégorie
    this.selectedSubCategoryId = selectedRecurring.subCategoryId || 0;

    // Recharger les sous-catégories si le flux financier a changé
    this.loadSubcategories(selectedRecurring.financialFlowId);

    this.onFieldChange();
  }

  // --- Fin de la nouvelle logique ---

  // Charger les sous-catégories en fonction du flux financier
  loadSubcategories(financialFlowId: number): void {
    if (!financialFlowId) {
      return;
    }

    this.updateAvailableCategories(financialFlowId);

    this.subCategoryService.getAllSubCategoriesByFinancialFlowId(financialFlowId).subscribe({
      next: (data) => {
        this.subcategories = data;
        this.hydrateActiveSubCategories();

        const exists = this.subcategories.find((sc) => sc.id === this.selectedSubCategoryId);
        if (!exists) {
          this.selectedSubCategoryId = 0;
        }
      },
      error: (err) => console.error('Erreur lors du chargement des sous-catégories:', err),
    });
  }

  onFinancialFlowChange(event: any): void {
    const newFinancialFlowId = event.value;
    this.selectedSubCategoryId = 0;
    this.loadSubcategories(newFinancialFlowId);
  }

  onSubCategoryFilter(event: DropdownFilterEvent): void {
    this.currentSubCategoryQuery = (event.filter || '').toString();
  }

  onSubCategorySelected(): void {
    // [(ngModel)] already syncs the selection
  }

  get isFormValid(): boolean {
    const normalizedAmount = this.normalizeAmount(this.data.transaction.amount);
    const isValidAmount = normalizedAmount !== null && normalizedAmount > 0;

    return (
      this.data.transaction.accountId != null &&
      this.data.transaction.financialFlowId != null &&
      this.data.transaction.description != null &&
      this.data.transaction.description.trim() !== '' &&
      this.transactionDate != null &&
      isValidAmount &&
      this.selectedSubCategoryId != null &&
      this.selectedSubCategoryId > 0
    );
  }

  onFieldChange(): void {
    // placeholder to trigger change detection if needed
  }

  save(): void {
    if (!this.isFormValid) {
      console.warn('Formulaire invalide, sauvegarde annulée');
      return;
    }

    const normalizedAmount = this.normalizeAmount(this.data.transaction.amount) ?? 0;

    let formattedDate: string | Date | undefined = this.data.transaction.date;
    if (this.transactionDate) {
      const year = this.transactionDate.getFullYear();
      const month = String(this.transactionDate.getMonth() + 1).padStart(2, '0');
      const day = String(this.transactionDate.getDate()).padStart(2, '0');
      formattedDate = `${year}-${month}-${day}`;
    }

    const updatedTransaction = {
      id: this.data.transaction.id,
      description: this.data.transaction.description,
      amount: normalizedAmount,
      date: formattedDate,
      accountId: this.data.transaction.accountId || this.data.transaction['account_id'],
      financialFlowId: this.data.transaction.financialFlowId || this.data.transaction['financial_flow_id'],
      subCategoryId: this.selectedSubCategoryId,
      recurringTransactionId: this.data.transaction.recurringTransactionId,
    };

    this.ref.close(updatedTransaction);
  }

  cancel(): void {
    this.ref.close();
  }

  private updateAvailableCategories(financialFlowId: number): void {
    this.availableCategories = this.categories.filter((category) => {
      const flowMatches = category.financialFlowId === financialFlowId;
      const isActive = (category.isActive ?? (category as any)['is_active'] ?? 0) === 1;
      return flowMatches && isActive;
    });
  }

  private hydrateActiveSubCategories(): void {
    const categoryLabelById = new Map<number, string>(
      this.categories
        .map((cat) => {
          if (typeof cat.id !== 'number') return null;
          const label = typeof cat.label === 'string' ? cat.label : (cat as any)['name'];
          return label ? [cat.id, label] : null;
        })
        .filter((entry): entry is [number, string] => !!entry),
    );

    this.activeSubCategories = (this.subcategories || []).map((sc) => ({
      ...sc,
      categoryLabel: sc.categoryLabel || categoryLabelById.get(sc.categoryId) || '',
    }));
  }

  private normalizeAmount(value: number | string | null | undefined): number | null {
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  openCreateSubCategory(event?: Event): void {
    event?.stopPropagation();

    if (!this.data.transaction.financialFlowId) {
      console.warn('Impossible de créer une sous-catégorie sans type de transaction.');
      return;
    }

    if (this.availableCategories.length === 0) {
      console.warn('Aucune catégorie active disponible pour ce type de transaction.');
      return;
    }

    const dialogRef = this.dialogService.open(EditSubCategoryDialogComponent, {
      width: '500px',
      data: {
        subCategory: {
          label: this.currentSubCategoryQuery || '',
          categoryId: this.availableCategories[0].id,
        },
        categories: this.availableCategories,
        isNew: true,
      },
    });

    dialogRef.onClose.subscribe((result) => {
      if (!result) {
        return;
      }

      this.subCategoryService.addSubCategory(result).subscribe({
        next: () => {
          this.subCategoryService
            .getAllSubCategoriesByFinancialFlowId(this.data.transaction.financialFlowId!)
            .subscribe({
              next: (list) => {
                this.subcategories = list;
                this.hydrateActiveSubCategories();

                const created = list.find(
                  (sub) =>
                    sub.label.toLowerCase() === result.label.toLowerCase() &&
                    sub.categoryId === result.categoryId,
                );

                if (created) {
                  this.selectedSubCategoryId = created.id!;
                }
              },
              error: (err) =>
                console.error('Erreur lors du rechargement des sous-catégories après création:', err),
            });
        },
        error: (err) => console.error('Erreur lors de la création de la sous-catégorie:', err),
      });
    });
  }
}
