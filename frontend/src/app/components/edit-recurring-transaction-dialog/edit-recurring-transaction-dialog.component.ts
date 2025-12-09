import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

// PrimeNG
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { MultiSelectModule } from 'primeng/multiselect';
import { DialogModule } from 'primeng/dialog';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';

// Models & services
import { RecurringTransaction } from '../../models/recurring-transaction.model';
import { SubCategory } from '../../models/sub-category.model';
import { Account } from '../../models/account.model';
import { AccountService } from '../../services/account.service';
import { CategoryService } from '../../services/category.service';
import { Category } from '../../models/category.model';
import { SubCategoryService } from '../../services/sub-category.service';
import { FREQUENCY_LIST } from '../../utils/utils';
import { FINANCIAL_FLOW_LIST } from '../../config/financial-flow.config';
import { DEBIT_503020_LIST } from '../../config/debit_503020';

@Component({
  selector: 'app-edit-recurring-transaction-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    InputNumberModule,
    MultiSelectModule,
    DialogModule
  ],
  templateUrl: './edit-recurring-transaction-dialog.component.html',
  styleUrls: ['./edit-recurring-transaction-dialog.component.css']
})
export class EditRecurringTransactionDialogComponent implements OnInit, OnDestroy {
  recurrenceHelpVisible = false;
  readonly monthOptions = [
    { label: 'Janvier', value: 1 },
    { label: 'Février', value: 2 },
    { label: 'Mars', value: 3 },
    { label: 'Avril', value: 4 },
    { label: 'Mai', value: 5 },
    { label: 'Juin', value: 6 },
    { label: 'Juillet', value: 7 },
    { label: 'Août', value: 8 },
    { label: 'Septembre', value: 9 },
    { label: 'Octobre', value: 10 },
    { label: 'Novembre', value: 11 },
    { label: 'Décembre', value: 12 }
  ];
  private readonly frequencyMonthRequirements: Record<
    RecurringTransaction['frequency'],
    number | undefined
  > = {
    weekly: undefined,
    monthly: undefined,
    bimonthly: undefined,
    quarterly: 3,
    biannual: 2,
    yearly: 1
  };

  data!: { transaction: RecurringTransaction; isNew?: boolean };

  activeSubCategories: SubCategory[] = [];
  accounts: Account[] = [];
  categories: Category[] = [];
  allSubCategories: SubCategory[] = [];
  financialFlowList = FINANCIAL_FLOW_LIST;
  debit503020Options = DEBIT_503020_LIST;

  frequencies = FREQUENCY_LIST;
  isNew = false;
  dialogTitle = '';
  private initialAmount: number | null = null;
  private sub = new Subscription();

  constructor(
    public ref: DynamicDialogRef,
    public config: DynamicDialogConfig,
    private subCategoryService: SubCategoryService,
    private accountService: AccountService,
    private categoryService: CategoryService
  ) {
    this.data = this.config.data;
    this.isNew = this.data.isNew || false;
    this.initialAmount = this.normalizeAmount(this.data.transaction.amount);
    this.initializeInstallmentStartMonth();

    this.dialogTitle = this.isNew
      ? 'Nouvelle transaction récurrente'
      : 'Éditer la transaction récurrente';
  }

  ngOnInit(): void {
    this.loadCategories();
    this.loadAllSubCategories();
    if (this.data.transaction.financialFlowId) {
      this.filterActiveSubCategories(this.data.transaction.financialFlowId);
    }
    this.loadAccounts();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  private loadCategories(): void {
    this.sub.add(
      this.categoryService.categories$.subscribe((cats) => {
        this.categories = cats || [];
        if (this.data.transaction.financialFlowId) {
          this.filterActiveSubCategories(this.data.transaction.financialFlowId);
        }
      })
    );
    this.categoryService.getCategories().subscribe();
  }

  private loadAllSubCategories(): void {
    this.sub.add(
      this.subCategoryService.subCategories$.subscribe((subs) => {
        this.allSubCategories = subs || [];
        if (this.data.transaction.financialFlowId) {
          this.filterActiveSubCategories(this.data.transaction.financialFlowId);
        }
      })
    );
    this.subCategoryService.getSubCategories().subscribe();
  }

  private loadAccounts(): void {
    this.sub.add(
      this.accountService.accounts$.subscribe((accounts) => {
        this.accounts = accounts;
      })
    );
    this.accountService.getAccounts().subscribe();
  }

  private filterActiveSubCategories(financialFlowId: number): void {
    const allowedCategoryIds = new Set(
      (this.categories || [])
        .filter((cat) => cat.financialFlowId === financialFlowId)
        .map((cat) => cat.id)
    );

    const mapCategoryLabel = new Map<number, string>(
      (this.categories || [])
        .map((cat) => {
          const id = typeof cat.id === 'number' ? cat.id : undefined;
          const label =
            typeof cat.label === 'string'
              ? cat.label
              : typeof cat['name'] === 'string'
              ? (cat['name'] as string)
              : undefined;
          return id !== undefined && label ? [id, label] : null;
        })
        .filter((item): item is [number, string] => !!item)
    );

    this.activeSubCategories = (this.allSubCategories || [])
      .filter((sc) => allowedCategoryIds.has(sc.categoryId))
      .map((sc) => ({
        ...sc,
        categoryLabel: sc.categoryLabel || mapCategoryLabel.get(sc.categoryId) || ''
      }));
  }

  onFinancialFlowChange(): void {
    this.data.transaction.subCategoryId = 0;
    this.activeSubCategories = [];
    this.filterActiveSubCategories(this.data.transaction.financialFlowId);
  }

  onRecurrenceKindChange(kind: RecurringTransaction['recurrenceKind'] | undefined): void {
    this.data.transaction.recurrenceKind = kind;
    if (kind !== 'seasonal' && !this.requiresMonthSelection(this.data.transaction.frequency)) {
      this.data.transaction.activeMonths = [];
    }
    if (kind === 'installment') {
      this.initializeInstallmentStartMonth();
    } else {
      this.data.transaction.occurrences = null;
      this.onInstallmentStartMonthChange(null);
    }
  }

  onInstallmentStartMonthChange(value: number | null): void {
    const month = typeof value === 'number' && value >= 1 && value <= 12 ? value : null;
    this.data.transaction.installmentStartMonth = month;
    this.data.transaction.startMonth = month;
  }

  onFrequencyChange(value: RecurringTransaction['frequency']): void {
    this.data.transaction.frequency = value;
    const required = this.getRequiredMonthCount(value);
    const sanitized = this.sanitizeActiveMonths(this.data.transaction.activeMonths, required);
    if (sanitized.length > 0) {
      this.data.transaction.activeMonths = sanitized;
    } else if (!this.shouldDisplayActiveMonths()) {
      this.data.transaction.activeMonths = [];
    }
  }

  onActiveMonthsChange(values: number[] | null): void {
    const limit = this.getRequiredMonthCount(this.data.transaction.frequency);
    this.data.transaction.activeMonths = this.sanitizeActiveMonths(values, limit);
  }

  save(): void {
    const normalizedAmount = this.normalizeAmount(this.data.transaction.amount) || 0;
    this.data.transaction.amount = normalizedAmount;
    const debit503020 = this.normalizeDebit503020(this.data.transaction.debit503020);
    this.data.transaction.debit503020 = debit503020;
    const amountChanged =
      !this.isNew &&
      this.initialAmount !== null &&
      this.initialAmount !== normalizedAmount;

    const transactionData: any = {
      label: this.data.transaction.label,
      amount: this.data.transaction.amount,
      dayOfMonth: this.data.transaction.dayOfMonth,
      frequency: this.data.transaction.frequency,
      subCategoryId: this.data.transaction.subCategoryId,
      accountId: this.data.transaction.accountId,
      financialFlowId: this.data.transaction.financialFlowId,
      activeMonths: this.stringifyActiveMonths(),
      recurrenceKind: this.data.transaction.recurrenceKind || null,
      // La règle 50/30/20 sera envoyée en snake_case par humps
      debit_503020: debit503020
    };

    if (this.data.transaction.recurrenceKind === 'installment') {
      transactionData.startMonth = this.data.transaction.installmentStartMonth ?? null;
    } else {
      transactionData.startMonth = null;
    }

    if (this.data.transaction.recurrenceKind === 'installment') {
      transactionData.occurrences = this.data.transaction.occurrences;
    }

    if (!this.isNew && this.data.transaction.id) {
      transactionData.id = this.data.transaction.id;
    }

    this.ref.close({
      payload: transactionData,
      meta: {
        amountChanged,
        previousAmount: this.initialAmount
      }
    });
  }

  cancel(): void {
    this.ref.close();
  }

  isFormValid(): boolean {
    const t: any = this.data.transaction;
    const base = !!(
      t.label && t.label.trim() !== '' &&
      t.amount && t.amount > 0 &&
      t.dayOfMonth && t.dayOfMonth >= 1 && t.dayOfMonth <= 31 &&
      t.frequency && t.subCategoryId && t.accountId
    );
    if (!base) return false;

    const debit = this.normalizeDebit503020(t.debit503020);
    if (debit === null) return false;

    if (t.recurrenceKind === 'installment') {
      if (!t.occurrences || t.occurrences < 1) return false;
      if (!t.installmentStartMonth || t.installmentStartMonth < 1 || t.installmentStartMonth > 12) {
        return false;
      }
    }

    const requiredMonths = this.getRequiredMonthCount(t.frequency);
    if (requiredMonths) {
      if (!Array.isArray(t.activeMonths) || t.activeMonths.length !== requiredMonths) {
        return false;
      }
    } else if (t.recurrenceKind === 'seasonal') {
      if (!Array.isArray(t.activeMonths) || t.activeMonths.length === 0) return false;
    }
    return true;
  }

  shouldDisplayActiveMonths(): boolean {
    return (
      this.data.transaction.recurrenceKind === 'seasonal' ||
      this.requiresMonthSelection(this.data.transaction.frequency)
    );
  }

  hasValidActiveMonths(): boolean {
    const required = this.getRequiredMonthCount(this.data.transaction.frequency);
    const sanitized = this.sanitizeActiveMonths(
      this.data.transaction.activeMonths,
      required
    );

    if (required) {
      return sanitized.length === required;
    }
    if (this.data.transaction.recurrenceKind === 'seasonal') {
      return sanitized.length > 0;
    }
    return true;
  }

  getActiveMonthsErrorMessage(): string {
    const required = this.getRequiredMonthCount(this.data.transaction.frequency);
    if (required) {
      return `Sélectionnez ${required} mois pour cette fréquence.`;
    }
    return 'Sélectionnez au moins un mois pour le type "Saisonnier".';
  }

  getMonthSelectionLimit(
    frequency: RecurringTransaction['frequency'] | undefined
  ): number | null {
    return this.getRequiredMonthCount(frequency);
  }

  private stringifyActiveMonths(): string | null {
    const requiredMonths = this.getRequiredMonthCount(this.data.transaction.frequency);
    const months = this.sanitizeActiveMonths(this.data.transaction.activeMonths, requiredMonths);
    const isSeasonal = this.data.transaction.recurrenceKind === 'seasonal';

    if (requiredMonths) {
      if (months.length !== requiredMonths) {
        return null;
      }
      return JSON.stringify(months);
    }

    if (isSeasonal) {
      if (months.length === 0) {
        return null;
      }
      return JSON.stringify(months);
    }

    return null;
  }

  private sanitizeActiveMonths(
    value: unknown,
    limit?: number | null
  ): number[] {
    const months = Array.isArray(value) ? value : [];
    const cleaned = Array.from(
      new Set(
        months
          .map((m) => Number(m))
          .filter((num) => Number.isInteger(num) && num >= 1 && num <= 12)
      )
    );
    if (typeof limit === 'number') {
      return cleaned.slice(0, limit);
    }
    return cleaned;
  }

  private initializeInstallmentStartMonth(): void {
    if (this.data.transaction.recurrenceKind !== 'installment') {
      this.onInstallmentStartMonthChange(null);
      return;
    }
    const explicitMonth =
      typeof this.data.transaction.startMonth === 'number'
        ? this.data.transaction.startMonth
        : typeof this.data.transaction.installmentStartMonth === 'number'
        ? this.data.transaction.installmentStartMonth
        : null;
    const sanitized =
      explicitMonth && explicitMonth >= 1 && explicitMonth <= 12 ? explicitMonth : null;
    this.onInstallmentStartMonthChange(sanitized);
  }

  private requiresMonthSelection(
    frequency: RecurringTransaction['frequency'] | undefined
  ): boolean {
    return this.getRequiredMonthCount(frequency) !== null;
  }

  getRequiredMonthCount(
    frequency: RecurringTransaction['frequency'] | undefined
  ): number | null {
    if (!frequency) return null;
    const required = this.frequencyMonthRequirements[frequency];
    return typeof required === 'number' ? required : null;
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

  private normalizeDebit503020(value: number | string | null | undefined): number | null {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    }
    return null;
  }
}
