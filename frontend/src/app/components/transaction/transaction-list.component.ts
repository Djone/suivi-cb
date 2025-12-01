// frontend/src/app/components/transaction-list/transaction-list.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MessageService } from 'primeng/api';
import { FormsModule } from '@angular/forms';

// PrimeNG Imports
import { DialogService } from 'primeng/dynamicdialog';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { PaginatorModule } from 'primeng/paginator';
import { CalendarModule } from 'primeng/calendar';
import { InputTextModule } from 'primeng/inputtext';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { DropdownModule } from 'primeng/dropdown';
import { MultiSelectModule } from 'primeng/multiselect';

import { TransactionService } from '../../services/transaction.service';
import { SubCategoryService } from '../../services/sub-category.service';
import { AccountService } from '../../services/account.service';
import { RecurringTransactionService } from '../../services/recurring-transaction.service';
import { FilterManagerService } from '../../services/filter-manager.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { EditTransactionDialogComponent } from '../edit-transaction-dialog/edit-transaction-dialog.component';
import { Transaction } from '../../models/transaction.model';
import { Account } from '../../models/account.model';
import { RecurringTransaction } from '../../models/recurring-transaction.model';
import { SubCategory } from '../../models/sub-category.model';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { DEBIT_503020_LIST } from '../../config/debit_503020';

interface TransactionWithLabel extends Transaction {
  subCategoryLabel?: string;
  amountNumber?: number;
}

interface GroupedTransactions {
  date: string;
  formattedDate: string;
  transactions: TransactionWithLabel[];
  total: number;
}

interface UpcomingScheduleLite {
  recurringTransaction: RecurringTransaction;
  amount: number;
  dueDate: Date;
  isOverdue?: boolean;
}

@Component({
  selector: 'app-transaction-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TooltipModule,
    PaginatorModule,
    CalendarModule,
    InputTextModule,
    InputGroupModule,
    InputGroupAddonModule,
    DropdownModule,
    MultiSelectModule,
  ],
  templateUrl: './transaction-list.component.html',
  styleUrls: [
    './transaction-list.component.css',
    '../../styles/table-common.css',
  ],
})
export class TransactionListComponent implements OnInit, OnDestroy {
  accountId: number | null = null;
  account: Account | null = null;
  showRecurring: boolean = false;
  transactions: Transaction[] = [];
  filteredTransactions: Transaction[] = [];
  paginatedTransactions: Transaction[] = [];
  groupedTransactions: GroupedTransactions[] = [];
  paginatedGroupedTransactions: GroupedTransactions[] = [];
  subCategories: SubCategory[] = [];
  private subCategoryIndex = new Map<number, SubCategory>();
  categoryOptions: { label: string; value: number }[] = [];
  recurringTransactions: RecurringTransaction[] = [];
  pendingSchedules: UpcomingScheduleLite[] = [];
  sortedRecurringTransactions: RecurringTransaction[] = [];
  currentBalance: number = 0;
  forecastedBalance: number = 0;
  // Totaux des échéances (nouvel affichage)
  expectedIncomeTotal: number = 0;
  expectedExpensesTotal: number = 0;
  realizedExpensesThisMonth: number = 0;
  remainingExpensesThisMonth: number = 0;
  // Anciennes métriques conservées pour compatibilité interne
  recurringTotalThisMonth: number = 0;
  recurringRealizedThisMonth: number = 0;
  recurringRemainingThisMonth: number = 0;
  private subscriptions = new Subscription();
  Math = Math;

  // Accent couleur du compte (appliquée au header et aux dates)
  accentStart = '#60A5FA';
  accentEnd = '#3B82F6';
  accent = '#3B82F6';
  accentSoft = '#DBEAFE';
  accentShadow = 'rgba(59, 130, 246, 0.3)';

  // Filtres
  filters = {
    dateRange: null as Date[] | null,
    description: '',
    amount: '',
    categoryIds: [] as number[],
    subCategoryIds: [] as number[],
  };

  // Tri
  sortColumn: string = 'date';
  sortDirection: 'asc' | 'desc' = 'desc';

  // Pagination
  currentPage = 1;
  pageSize: number = 10;
  pageSizeOptions = [
    { label: '10', value: 10 },
    { label: '20', value: 20 },
    { label: '50', value: 50 },
    { label: '100', value: 100 },
  ];
  totalPages = 1;
  now: Date = new Date();

  constructor(
    private transactionService: TransactionService,
    private subCategoryService: SubCategoryService,
    private accountService: AccountService,
    private recurringTransactionService: RecurringTransactionService,
    private dialogService: DialogService,
    private messageService: MessageService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    // Récupérer l'accountId depuis les paramètres de route
    this.route.params.subscribe((params) => {
      if (params['accountId']) {
        this.accountId = parseInt(params['accountId'], 10);
        console.log(
          'TRANSACTION LIST : accountId depuis la route:',
          this.accountId,
        );
        this.loadAccountInfo();
      }
    });

    // Charger les comptes
    this.subscriptions.add(
      this.accountService.accounts$.subscribe({
        next: () => {
          if (this.accountId) {
            this.loadAccountInfo();
          }
        },
      }),
    );

    this.accountService.getAccounts().subscribe();

    // Charger toutes les transactions
    this.subscriptions.add(
      this.transactionService.transactions$.subscribe({
        next: (data) => {
          console.log(
            'TRANSACTION LIST : Données reçues - Total:',
            data.length,
          );
          if (data.length > 0) {
            console.log('TRANSACTION LIST : Exemple de transaction:', data[0]);
          }

          // Filtrer par compte si accountId est fourni
          if (this.accountId !== null) {
            console.log(
              'TRANSACTION LIST : Filtrage pour le compte',
              this.accountId,
            );
            this.transactions = data.filter((t) => {
              const tAccountId =
                typeof t.accountId === 'string'
                  ? parseInt(t.accountId)
                  : t.accountId;
              return tAccountId === this.accountId;
            });
            console.log(
              'TRANSACTION LIST : Après filtrage:',
              this.transactions.length,
              'transactions',
            );
          } else {
            this.transactions = data;
          }
          this.applyFiltersAndSort();
        },
        error: (err) =>
          console.error(
            'TRANSACTION LIST : Erreur lors du chargement des transactions:',
            err,
          ),
      }),
    );

    // Charger toutes les sous-catégories pour l'affichage
    this.subscriptions.add(
      this.subCategoryService.subCategories$.subscribe({
        next: (data) => {
          this.subCategories = data;
          this.refreshSubCategoryIndex(data);
          this.categoryOptions = this.buildCategoryOptions(data);
          console.log(
            'TRANSACTION LIST : Sous-catégories chargées - Total:',
            data.length,
          );
          if (this.transactions.length > 0) {
            this.applyFiltersAndSort();
          }
        },
        error: (err) =>
          console.error(
            'TRANSACTION LIST : Erreur lors du chargement des sous-catégories:',
            err,
          ),
      }),
    );

    this.subCategoryService.getSubCategories().subscribe();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadTransactions(): void {
    this.transactionService.loadTransactions();
  }

  private refreshSubCategoryIndex(list: SubCategory[]): void {
    this.subCategoryIndex.clear();
    list.forEach((sc) => {
      if (typeof sc.id === 'number') {
        this.subCategoryIndex.set(sc.id, sc);
      }
    });
  }

  private buildCategoryOptions(
    list: SubCategory[],
  ): { label: string; value: number }[] {
    const grouped = new Map<number, { label: string; count: number }>();
    list.forEach((sc) => {
      if (typeof sc.categoryId !== 'number') return;
      const label = sc.categoryLabel || `Catégorie ${sc.categoryId}`;
      if (!grouped.has(sc.categoryId)) {
        grouped.set(sc.categoryId, { label, count: 0 });
      }
      grouped.get(sc.categoryId)!.count += 1;
    });

    return Array.from(grouped.entries())
      .map(([value, info]) => ({
        value,
        label: `${info.label} (${info.count})`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  }

  get filteredSubCategoryOptions(): { label: string; value: number }[] {
    const allowedCategories = this.filters.categoryIds;
    const subset = allowedCategories.length
      ? this.subCategories.filter((sc) =>
          allowedCategories.includes(sc.categoryId),
        )
      : this.subCategories;

    return subset
      .filter((sc) => typeof sc.id === 'number')
      .map((sc) => ({
        label: `${sc.categoryLabel || 'Catégorie'} > ${sc.label}`,
        value: sc.id as number,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  }

  private getSubCategoryById(
    subCategoryId: number | string | null | undefined,
  ): SubCategory | null {
    if (subCategoryId === null || subCategoryId === undefined) return null;
    const id =
      typeof subCategoryId === 'string'
        ? parseInt(subCategoryId, 10)
        : subCategoryId;
    if (Number.isNaN(id)) {
      return null;
    }
    return this.subCategoryIndex.get(id) || null;
  }

  // Appliquer les filtres et le tri
  applyFiltersAndSort(): void {
    this.filteredTransactions = this.transactions.filter((transaction) => {
      const range = this.filters.dateRange;
      let matchDate = true;

      if (range && range.length === 2 && range[0] && range[1]) {
        const [startDate, endDate] = range;
        const transactionDate = new Date(transaction.date!);
        transactionDate.setHours(0, 0, 0, 0);

        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);

        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        matchDate = transactionDate >= start && transactionDate <= end;
      }

      const matchDescription =
        !this.filters.description ||
        (transaction.description &&
          transaction.description
            .toLowerCase()
            .includes(this.filters.description.toLowerCase()));

      const matchAmount =
        !this.filters.amount ||
        (transaction.amount !== null &&
          transaction.amount !== undefined &&
          transaction.amount.toString().includes(this.filters.amount));

      const subCategory = this.getSubCategoryById(transaction.subCategoryId);

      const matchCategory =
        this.filters.categoryIds.length === 0
          ? true
          : subCategory
            ? this.filters.categoryIds.includes(subCategory.categoryId)
            : false;

      const matchSubCategory =
        this.filters.subCategoryIds.length === 0 ||
        (typeof subCategory?.id === 'number' &&
          this.filters.subCategoryIds.includes(subCategory.id));

      return (
        matchDate &&
        matchDescription &&
        matchAmount &&
        matchCategory &&
        matchSubCategory
      );
    });

    this.calculateBalances();
    this.calculateRecurringMonthTotals();
    this.updatePagination();
  }

  // Calcul des totaux d'échéances pour le mois courant
  calculateRecurringMonthTotals(): void {
    if (!this.accountId) {
      this.expectedIncomeTotal = 0;
      this.expectedExpensesTotal = 0;
      this.realizedExpensesThisMonth = 0;
      this.remainingExpensesThisMonth = 0;
      return;
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // IDs des échéances récurrentes actives de ce compte
    const recurringIds = new Set(
      this.recurringTransactions
        .filter((rt) => {
          const rtAccountId =
            typeof rt.accountId === 'string'
              ? parseInt(rt.accountId)
              : rt.accountId;
          return rtAccountId === this.accountId && rt.isActive === 1;
        })
        .map((rt) => rt.id!),
    );

    // Total planifié du mois (une occurrence par échéance)
    this.recurringTotalThisMonth = this.recurringTransactions.reduce(
      (sum, rt) => {
        const rtAccountId =
          typeof rt.accountId === 'string'
            ? parseInt(rt.accountId)
            : rt.accountId;
        if (rtAccountId !== this.accountId || rt.isActive !== 1) return sum;
        const amount =
          typeof rt.amount === 'string'
            ? parseFloat(rt.amount)
            : rt.amount || 0;
        const flowId =
          typeof rt.financialFlowId === 'string'
            ? parseInt(rt.financialFlowId)
            : rt.financialFlowId;
        const signedAmount =
          flowId === 2 ? -Math.abs(amount) : Math.abs(amount);
        return sum + signedAmount;
      },
      0,
    );

    // Total réalisé dans le mois (transactions liées)
    this.recurringRealizedThisMonth = this.transactions.reduce((sum, t) => {
      if (!t.recurringTransactionId) return sum;
      if (!recurringIds.has(t.recurringTransactionId)) return sum;
      const d = new Date(t.date || '');
      if (d.getMonth() !== currentMonth || d.getFullYear() !== currentYear)
        return sum;
      const amount =
        typeof t.amount === 'string' ? parseFloat(t.amount) : t.amount || 0;
      const flowId =
        typeof t.financialFlowId === 'string'
          ? parseInt(t.financialFlowId)
          : t.financialFlowId || 0;
      const signedAmount = flowId === 2 ? -Math.abs(amount) : Math.abs(amount);
      return sum + signedAmount;
    }, 0);

    this.recurringRemainingThisMonth =
      this.recurringTotalThisMonth - this.recurringRealizedThisMonth;
    this.calculateRecurringBreakdown();
  }

  // Nouveau découpage: revenus prévus, dépenses prévues, dépenses restantes, prévisionnel simple
  private calculateRecurringBreakdown(): void {
    if (!this.accountId) {
      this.expectedIncomeTotal = 0;
      this.expectedExpensesTotal = 0;
      this.realizedExpensesThisMonth = 0;
      this.remainingExpensesThisMonth = 0;
      return;
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const accountRecurring = this.recurringTransactions.filter((rt) => {
      const rtAccountId =
        typeof rt.accountId === 'string'
          ? parseInt(rt.accountId)
          : rt.accountId;
      return rtAccountId === this.accountId && rt.isActive === 1;
    });
    const recurringIdSet = new Set(accountRecurring.map((r) => r.id!));

    this.expectedIncomeTotal = accountRecurring.reduce((sum, rt) => {
      const amount =
        typeof rt.amount === 'string' ? parseFloat(rt.amount) : rt.amount || 0;
      return rt.financialFlowId === 1 ? sum + Math.abs(amount) : sum;
    }, 0);

    this.expectedExpensesTotal = accountRecurring.reduce((sum, rt) => {
      const amount =
        typeof rt.amount === 'string' ? parseFloat(rt.amount) : rt.amount || 0;
      return rt.financialFlowId === 2 ? sum + Math.abs(amount) : sum;
    }, 0);

    // Dépenses réalisées ce mois (liées à une échéance)
    this.realizedExpensesThisMonth = this.transactions.reduce((sum, t) => {
      if (
        !t.recurringTransactionId ||
        !recurringIdSet.has(t.recurringTransactionId)
      )
        return sum;
      const transDate = new Date(t.date || '');
      if (
        transDate.getMonth() !== currentMonth ||
        transDate.getFullYear() !== currentYear
      )
        return sum;
      const amount =
        typeof t.amount === 'string' ? parseFloat(t.amount) : t.amount || 0;
      const flowId =
        typeof t.financialFlowId === 'string'
          ? parseInt(t.financialFlowId)
          : t.financialFlowId || 0;
      return flowId === 2 ? sum + Math.abs(amount) : sum;
    }, 0);

    this.remainingExpensesThisMonth = Math.max(
      this.expectedExpensesTotal - this.realizedExpensesThisMonth,
      0,
    );

    // Prévisionnel simple demandé: revenus prévus - dépenses restantes
    if (this.accountId) {
      const upcomingSum = this.computeUpcomingForForecast(this.accountId);
      this.forecastedBalance = this.currentBalance + upcomingSum;
    } else {
      this.forecastedBalance = 0;
    }
  }

  // Répartition 50/30/20 basée sur le salaire (revenus prévus) du mois courant
  get503020Breakdown() {
    const salaryBase = this.expectedIncomeTotal || 0;
    const accountId = this.accountId;
    const buckets = DEBIT_503020_LIST.map((b) => ({
      id: b.id,
      name: b.name,
      amount: 0,
      percent: 0,
    }));
    if (!accountId)
      return {
        total: salaryBase,
        totalExpenses: 0,
        items: buckets,
        remaining: salaryBase,
        remainingPercent: 100,
      };

    const expenses = this.recurringTransactions.filter((rt) => {
      const rtAccountId =
        typeof rt.accountId === 'string'
          ? parseInt(rt.accountId)
          : rt.accountId;
      return (
        rtAccountId === accountId &&
        rt.isActive === 1 &&
        rt.financialFlowId === 2
      );
    });

    expenses.forEach((rt) => {
      const key = rt['debit503020'] ?? null;
      if (!key) return;
      const idx = buckets.findIndex((b) => b.id === key);
      if (idx >= 0) {
        const amount =
          typeof rt.amount === 'string'
            ? parseFloat(rt.amount)
            : rt.amount || 0;
        buckets[idx].amount += Math.abs(amount);
      }
    });

    buckets.forEach((b) => {
      b.percent =
        salaryBase > 0 ? Math.round((b.amount / salaryBase) * 100) : 0;
    });

    const totalExpenses = expenses.reduce((sum, rt) => {
      const amount =
        typeof rt.amount === 'string' ? parseFloat(rt.amount) : rt.amount || 0;
      return sum + Math.abs(amount);
    }, 0);
    const remaining = Math.max(salaryBase - totalExpenses, 0);
    const remainingPercent =
      salaryBase > 0
        ? Math.max(0, Math.round((remaining / salaryBase) * 100))
        : 0;

    return {
      total: salaryBase,
      totalExpenses,
      items: buckets,
      remaining,
      remainingPercent,
    };
  }

  clearDateFilter(): void {
    this.filters.dateRange = null;
    this.applyFilter();
  }
  onCategoryFilterChange(): void {
    if (this.filters.categoryIds.length === 0) {
      this.filters.subCategoryIds = [];
    } else {
      const allowed = new Set(this.filters.categoryIds);
      this.filters.subCategoryIds = this.filters.subCategoryIds.filter((id) => {
        const sc = this.getSubCategoryById(id);
        return sc ? allowed.has(sc.categoryId) : false;
      });
    }
    this.applyFilter();
  }

  allowOnlyNumbers(event: KeyboardEvent): void {
    const allowedKeys = [
      'Backspace',
      'Tab',
      'ArrowLeft',
      'ArrowRight',
      'Delete',
    ];
    if (!/[0-9.,]/.test(event.key) && !allowedKeys.includes(event.key)) {
      event.preventDefault();
    }
  }

  sortBy(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.applyFiltersAndSort();
  }

  applyFilter(): void {
    this.currentPage = 1;
    this.applyFiltersAndSort();
  }

  // Obtenir le nom de la sous-catégorie
  // Obtenir le nom de la sous-categorie
  getSubCategoryName(subCategoryId: number | string | null): string {
    if (!subCategoryId) return 'N/A';

    const subCategory = this.getSubCategoryById(subCategoryId);
    const normalizedId =
      typeof subCategoryId === 'string'
        ? parseInt(subCategoryId, 10)
        : subCategoryId;

    if (!subCategory && this.subCategories.length > 0) {
      console.log(
        `TRANSACTION LIST : Sous-categorie ${normalizedId} non trouvee. Sous-categories disponibles:`,
        this.subCategories.map((sc) => sc.id),
      );
    }

    return subCategory
      ? `${subCategory.categoryLabel} - ${subCategory.label}`
      : 'N/A';
  }
  // Obtenir le montant avec signe
  getSignedAmount(transaction: Transaction): number {
    const amount =
      typeof transaction.amount === 'string'
        ? parseFloat(transaction.amount)
        : transaction.amount || 0;

    const financialFlowId =
      typeof transaction.financialFlowId === 'string'
        ? parseInt(transaction.financialFlowId)
        : transaction.financialFlowId || 0;

    // financialFlowId: 1 = Revenu (positif), 2 = Dépense (négatif)
    return financialFlowId === 2 ? -Math.abs(amount) : Math.abs(amount);
  }

  // Vérifier si le montant est négatif
  isNegative(transaction: Transaction): boolean {
    return this.getSignedAmount(transaction) < 0;
  }

  // Vérifier si le montant est positif
  isPositive(transaction: Transaction): boolean {
    return this.getSignedAmount(transaction) >= 0;
  }

  updatePagination(): void {
    // Grouper les transactions par date
    this.groupedTransactions = this.groupTransactionsByDate(
      this.filteredTransactions,
    );

    // Calculer la pagination sur les groupes
    this.totalPages = Math.ceil(
      this.groupedTransactions.length / this.pageSize,
    );
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.paginatedGroupedTransactions = this.groupedTransactions.slice(
      startIndex,
      endIndex,
    );

    // Garder aussi la pagination simple pour compatibilitÃƒÂ©
    const startIndexTx = (this.currentPage - 1) * this.pageSize;
    const endIndexTx = startIndexTx + this.pageSize;
    this.paginatedTransactions = this.filteredTransactions.slice(
      startIndexTx,
      endIndexTx,
    );
  }

  groupTransactionsByDate(transactions: Transaction[]): GroupedTransactions[] {
    const grouped = new Map<string, TransactionWithLabel[]>();

    // Grouper par date et enrichir avec les labels
    transactions.forEach((transaction) => {
      const dateKey = new Date(transaction.date!).toISOString().split('T')[0];
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }

      // Enrichir la transaction avec le label de sous-catégorie et le montant numérique
      // Enrichir la transaction avec le label de sous-categorie et le montant numerique
      const subCategory = this.getSubCategoryById(transaction.subCategoryId);
      const subCategoryLabel = subCategory
        ? `${subCategory.categoryLabel} - ${subCategory.label}`
        : 'Non categorise';

      const enrichedTransaction: TransactionWithLabel = {
        ...transaction,
        subCategoryLabel: subCategoryLabel,
        amountNumber: this.getSignedAmount(transaction),
      };
      grouped.get(dateKey)!.push(enrichedTransaction);
    });

    // Convertir en tableau et calculer les totaux
    const result: GroupedTransactions[] = [];
    grouped.forEach((txs, dateKey) => {
      const total = txs.reduce((sum, tx) => sum + (tx.amountNumber || 0), 0);
      result.push({
        date: dateKey,
        formattedDate: this.formatDate(dateKey),
        transactions: txs,
        total: total,
      });
    });

    // Trier par date (plus récent en premier par défaut)
    result.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return this.sortDirection === 'desc' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Retirer l'heure pour la comparaison
    today.setHours(0, 0, 0, 0);
    yesterday.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);

    if (date.getTime() === today.getTime()) {
      return "Aujourd'hui";
    } else if (date.getTime() === yesterday.getTime()) {
      return 'Hier';
    } else {
      // Format: Lundi 20 octobre 2025
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      };
      return date.toLocaleDateString('fr-FR', options);
    }
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePagination();
    }
  }

  changePageSize(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
    this.updatePagination();
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxPagesToShow = 5;

    if (this.totalPages <= maxPagesToShow) {
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      const startPage = Math.max(1, this.currentPage - 2);
      const endPage = Math.min(this.totalPages, startPage + maxPagesToShow - 1);

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }

    return pages;
  }

  onPageChange(event: any): void {
    this.currentPage = event.page + 1;
    this.updatePagination();
  }

  // Charger les informations du compte
  loadAccountInfo(): void {
    if (!this.accountId) return;

    this.accountService.accounts$.subscribe((accounts) => {
      this.account = accounts.find((a) => a.id === this.accountId) || null;
      console.log('TRANSACTION LIST : Compte chargÃƒÂ©:', this.account);
      this.loadRecurringTransactions();
    });
  }

  // Charger les échéances récurrentes du compte
  loadRecurringTransactions(): void {
    if (!this.accountId) return;

    this.subscriptions.add(
      this.recurringTransactionService.recurringTransactions$.subscribe({
        next: (data) => {
          this.recurringTransactions = data.filter((rt) => {
            const rtAccountId =
              typeof rt.accountId === 'string'
                ? parseInt(rt.accountId)
                : rt.accountId;
            return rtAccountId === this.accountId && rt.isActive === 1;
          });
          console.log(
            'TRANSACTION LIST : Échéances récurrentes pour le compte:',
            this.recurringTransactions,
          );

          // Trier les échéances : non réalisées en premier, puis par jour du mois
          this.sortRecurringTransactions();

          // Recalculer les soldes
          this.calculateBalances();
          this.calculateRecurringMonthTotals();
        },
        error: (err) =>
          console.error(
            'TRANSACTION LIST : Erreur lors du chargement des échéances:',
            err,
          ),
      }),
    );

    this.recurringTransactionService.getRecurringTransactions().subscribe();
  }

  // Trier les échéances récurrentes
  sortRecurringTransactions(): void {
    this.sortedRecurringTransactions = [...this.recurringTransactions].sort(
      (a, b) => {
        const aRealized = this.isRecurringRealized(a.id!);
        const bRealized = this.isRecurringRealized(b.id!);

        // Les non réalisées en premier
        if (aRealized && !bRealized) return 1;
        if (!aRealized && bRealized) return -1;

        // Puis trier par jour du mois
        const aDay =
          typeof a.dayOfMonth === 'string'
            ? parseInt(a.dayOfMonth)
            : a.dayOfMonth || 0;
        const bDay =
          typeof b.dayOfMonth === 'string'
            ? parseInt(b.dayOfMonth)
            : b.dayOfMonth || 0;
        return aDay - bDay;
      },
    );
  }

  // Calculer les soldes actuel et prévisionnel
  calculateBalances(): void {
    if (!this.accountId || !this.account) {
      this.currentBalance = 0;
      this.forecastedBalance = 0;
      return;
    }

    // Récupérer le solde initial du compte
    const initialBalance =
      typeof this.account['initialBalance'] === 'string'
        ? parseFloat(this.account['initialBalance'])
        : this.account['initialBalance'] || 0;

    console.groupCollapsed('TRANSACTION LIST : DEBUG CALCUL SOLDE', {
      accountId: this.accountId,
      accountName: this.account?.name || '-',
    });
    console.log(' - Solde initial du compte =', initialBalance);
    const todayNoTime = new Date();
    todayNoTime.setHours(0, 0, 0, 0);
    const transactionsSumAll = this.transactions.reduce(
      (sum, t) => sum + this.getSignedAmount(t),
      0,
    );
    const transactionsSumUntilToday = this.transactions.reduce((sum, t) => {
      const d = new Date(t.date || '');
      d.setHours(0, 0, 0, 0);
      return d.getTime() <= todayNoTime.getTime()
        ? sum + this.getSignedAmount(t)
        : sum;
    }, 0);
    // On garde le comportement actuel (toutes les transactions)
    const transactionsSum = transactionsSumAll;

    this.currentBalance = initialBalance + transactionsSum;
    console.log(' - Somme des transactions (toutes) =', transactionsSumAll);
    console.log(
      " - Somme des transactions (<= aujourd'hui) =",
      transactionsSumUntilToday,
    );
    console.log(' - Solde actuel (initial + toutes) =', this.currentBalance);

    console.log('TRANSACTION LIST : Somme des transactions:', transactionsSum);
    console.log(
      'TRANSACTION LIST : Solde actuel calculé:',
      this.currentBalance,
    );

    // Le calcul du prévisionnel est déplacé dans calculateRecurringBreakdown pour s'assurer que currentBalance est déjà à jour.
  }

  private computeUpcomingForForecast(accountId: number): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const rec = this.recurringTransactions.filter((rt) => {
      const rtAccountId =
        typeof rt.accountId === 'string'
          ? parseInt(rt.accountId)
          : rt.accountId;
      return rtAccountId === accountId && rt.isActive === 1;
    });

    const currentMonthDue = this.buildSchedulesForMonth(
      rec,
      currentYear,
      currentMonth,
    ).filter((d) => !this.isRecurringRealized(d.rt.id!));

    const nextStartDue: { rt: RecurringTransaction; date: Date }[] = [];
    if (today.getDate() >= 25) {
      const nextMonth = (currentMonth + 1) % 12;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      const next = this.buildSchedulesForMonth(rec, nextYear, nextMonth).filter(
        (d) => d.date.getDate() <= 5 && !this.isRecurringRealized(d.rt.id!),
      );
      nextStartDue.push(...next);
    }

    const sumCurrent = currentMonthDue.reduce(
      (s, d) => s + this.getSignedAmountFromRecurring(d.rt),
      0,
    );
    const sumNext = nextStartDue.reduce(
      (s, d) => s + this.getSignedAmountFromRecurring(d.rt),
      0,
    );

    this.pendingSchedules = [
      ...currentMonthDue.map((entry) => ({
        recurringTransaction: entry.rt,
        amount: this.getSignedAmountFromRecurring(entry.rt),
        dueDate: entry.date,
        isOverdue: entry.date < today,
      })),
      ...nextStartDue.map((entry) => ({
        recurringTransaction: entry.rt,
        amount: this.getSignedAmountFromRecurring(entry.rt),
        dueDate: entry.date,
        isOverdue: false,
      })),
    ].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

    return sumCurrent + sumNext;
  }

  private shouldApplyRecurring(
    frequency: RecurringTransaction['frequency'] | null | undefined,
    monthIndex: number,
  ): boolean {
    const month = monthIndex % 12;
    switch (frequency) {
      case 'monthly':
      case 'weekly':
        return true;
      case 'bimonthly':
        return month % 2 === 0;
      case 'quarterly':
        return month % 3 === 0;
      case 'biannual':
        return month % 6 === 0;
      case 'yearly':
        return month === 0;
      default:
        return false;
    }
  }

  private getFrequencyMonthSpan(
    frequency?: RecurringTransaction['frequency'] | null,
  ): number {
    switch (frequency) {
      case 'bimonthly':
        return 2;
      case 'quarterly':
        return 3;
      case 'biannual':
        return 6;
      case 'yearly':
        return 12;
      default:
        return 1;
    }
  }

  private resolveInstallmentStartMonth(
    recurring: RecurringTransaction,
  ): number | null {
    if (
      typeof recurring.startMonth === 'number' &&
      recurring.startMonth >= 1 &&
      recurring.startMonth <= 12
    ) {
      return recurring.startMonth;
    }
    if (
      typeof recurring.installmentStartMonth === 'number' &&
      recurring.installmentStartMonth >= 1 &&
      recurring.installmentStartMonth <= 12
    ) {
      return recurring.installmentStartMonth;
    }
    return null;
  }

  private getInstallmentStartYear(
    recurring: RecurringTransaction,
    startMonth: number,
  ): number {
    const createdAt = recurring.createdAt
      ? new Date(recurring.createdAt as any)
      : null;
    if (!createdAt || Number.isNaN(createdAt.getTime())) {
      return new Date().getFullYear();
    }
    const createdMonth = createdAt.getMonth() + 1;
    let year = createdAt.getFullYear();
    if (startMonth < createdMonth) {
      year += 1;
    }
    return year;
  }

  private isInstallmentDateValid(
    recurring: RecurringTransaction,
    date: Date,
  ): boolean {
    if (recurring.recurrenceKind !== 'installment') {
      return true;
    }
    const startMonth = this.resolveInstallmentStartMonth(recurring);
    const occurrences = recurring.occurrences;
    if (!startMonth || !occurrences || occurrences <= 0) {
      return false;
    }
    const monthSpan = this.getFrequencyMonthSpan(recurring.frequency);
    const startYear = this.getInstallmentStartYear(recurring, startMonth);
    const firstIndex = startYear * 12 + (startMonth - 1);
    const targetIndex = date.getFullYear() * 12 + date.getMonth();
    const delta = targetIndex - firstIndex;
    if (delta < 0) {
      return false;
    }
    if (delta % monthSpan !== 0) {
      return false;
    }
    const occurrenceIndex = delta / monthSpan;
    return occurrenceIndex < occurrences;
  }

  private buildSchedulesForMonth(
    rec: RecurringTransaction[],
    year: number,
    month: number,
  ) {
    const list: { rt: RecurringTransaction; date: Date }[] = [];
    const normalizedMonth = ((month % 12) + 12) % 12;
    const yearOffset = Math.floor(month / 12);
    const effectiveYear = year + yearOffset;

    rec.forEach((rt) => {
      const dayOfMonth =
        typeof rt.dayOfMonth === 'string'
          ? parseInt(rt.dayOfMonth)
          : rt.dayOfMonth || 0;
      const freq: RecurringTransaction['frequency'] =
        (rt as any).frequency || 'monthly';
      const activeMonths = Array.isArray(rt.activeMonths)
        ? new Set(
            (rt.activeMonths as number[]).filter(
              (m) => typeof m === 'number' && m >= 1 && m <= 12,
            ),
          )
        : null;
      const isInstallment = rt.recurrenceKind === 'installment';

      if (!this.shouldApplyRecurring(freq, normalizedMonth)) {
        return;
      }

      if (freq === 'weekly') {
        const first = new Date(effectiveYear, normalizedMonth, 1);
        const last = new Date(effectiveYear, normalizedMonth + 1, 0);
        const targetDow = dayOfMonth % 7;
        for (let d = first.getDate(); d <= last.getDate(); d++) {
          const date = new Date(effectiveYear, normalizedMonth, d);
          if (date.getDay() !== targetDow) {
            continue;
          }
          if (activeMonths && !activeMonths.has(date.getMonth() + 1)) {
            continue;
          }
          if (isInstallment && !this.isInstallmentDateValid(rt, date)) {
            continue;
          }
          list.push({ rt, date });
        }
        return;
      }

      if (activeMonths && !activeMonths.has(normalizedMonth + 1)) {
        return;
      }

      const targetDay = dayOfMonth > 0 ? dayOfMonth : 1;
      const date = new Date(effectiveYear, normalizedMonth, targetDay);
      if (isInstallment && !this.isInstallmentDateValid(rt, date)) {
        return;
      }
      list.push({ rt, date });
    });
    return list;
  }

  private isRecurringRealizedByExactDate(
    recurring: RecurringTransaction,
    date: Date,
  ): boolean {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return this.transactions.some((t) => {
      if (t.recurringTransactionId !== recurring.id || !t.date) return false;
      const d = new Date(t.date);
      return d >= start && d <= end;
    });
  }

  private getSignedAmountFromRecurring(rt: RecurringTransaction): number {
    const amount =
      typeof rt.amount === 'string' ? parseFloat(rt.amount) : rt.amount || 0;
    const flowId =
      typeof rt.financialFlowId === 'string'
        ? parseInt(rt.financialFlowId)
        : rt.financialFlowId || 0;
    return flowId === 2 ? -Math.abs(amount) : Math.abs(amount);
  }

  // Basculer l'affichage des ÃƒÂ©chÃƒÂ©ances
  toggleRecurring(): void {
    this.showRecurring = !this.showRecurring;
  }

  markRecurringAsPaid(recurring: RecurringTransaction): void {
    if (!this.accountId) {
      return;
    }
    const rawAmount =
      typeof recurring.amount === 'string'
        ? parseFloat(recurring.amount)
        : recurring.amount || 0;

    const dialogRef = this.dialogService.open(ConfirmDialogComponent, {
      width: '450px',
      data: {
        title: "Valider l'échéance",
        message: `Confirmer la réalisation de "${recurring.label}" pour ${Math.abs(rawAmount).toFixed(2)} € ?`,
        confirmText: 'Valider',
        cancelText: 'Annuler',
      },
    });

    dialogRef.onClose.subscribe((confirmed: boolean) => {
      if (!confirmed) return;
      const tx: Transaction = {
        description: recurring.label,
        date: new Date(),
        amount: Math.abs(rawAmount),
        accountId: this.accountId!,
        financialFlowId: recurring.financialFlowId,
        subCategoryId: recurring.subCategoryId || null,
        recurringTransactionId: recurring.id,
      } as any;

      this.transactionService.addTransaction(tx).subscribe(() => {
        this.loadTransactions();
      });
    });
  }

  // Vérifier si une échéance a été réalisée ce mois
  isRecurringRealized(recurringId: number): boolean {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // The only source of truth is the existence of a linked transaction for the current month.
    const isRealized = this.transactions.some((t) => {
      const transDate = new Date(t.date || '');
      return (
        t.recurringTransactionId === recurringId &&
        transDate.getMonth() === currentMonth &&
        transDate.getFullYear() === currentYear
      );
    });

    if (isRealized) {
      console.log(
        `TRANSACTION LIST : Échéance ${recurringId} réalisée - Transaction trouvée.`,
      );
    }

    return isRealized;
  }

  // Obtenir le libellé du jour pour une échéance
  getDayLabel(recurring: RecurringTransaction): string {
    if (recurring.dayOfMonth === null || recurring.dayOfMonth === undefined) {
      return 'N/A';
    }
    if (recurring.frequency === 'weekly') {
      const daysOfWeek = [
        '',
        'Lundi',
        'Mardi',
        'Mercredi',
        'Jeudi',
        'Vendredi',
        'Samedi',
        'Dimanche',
      ];
      const dayIndex =
        typeof recurring.dayOfMonth === 'string'
          ? parseInt(recurring.dayOfMonth)
          : recurring.dayOfMonth;
      return daysOfWeek[dayIndex] || recurring.dayOfMonth.toString();
    }
    return 'le ' + recurring.dayOfMonth.toString();
  }

  getFrequencyLabel(recurring: RecurringTransaction): string {
    const labels: Record<string, string> = {
      weekly: 'Hebdomadaire',
      monthly: 'Mensuel',
      bimonthly: 'Bimestriel',
      quarterly: 'Trimestriel',
      biannual: 'Semestriel',
      yearly: 'Annuel',
    };
    if (!recurring.frequency) {
      return 'Mensuel';
    }
    return labels[recurring.frequency] || 'Mensuel';
  }

  getRecurringDisplayLabel(recurring: RecurringTransaction): string {
    const progress = this.getInstallmentProgress(recurring);
    if (!progress) {
      return recurring.label;
    }
    if (progress.remaining <= 0) {
      return `${recurring.label} (termine)`;
    }
    return `${recurring.label} (reste ${progress.remaining}/${progress.total})`;
  }

  getRecurringKindBadge(
    recurring: RecurringTransaction,
  ): { label: string; cssClass: string } | null {
    if (recurring.recurrenceKind === 'installment') {
      return { label: 'Crédit', cssClass: 'badge-credit' };
    }
    if (recurring.recurrenceKind === 'seasonal') {
      return { label: 'Saisonnier', cssClass: 'badge-seasonal' };
    }
    return null;
  }

  private getInstallmentProgress(recurring: RecurringTransaction) {
    if (
      recurring.recurrenceKind !== 'installment' ||
      typeof recurring.id !== 'number'
    ) {
      return null;
    }
    const total =
      typeof recurring.occurrences === 'number' && recurring.occurrences > 0
        ? recurring.occurrences
        : null;
    if (!total) {
      return null;
    }
    const completed = this.transactions.filter((t) => {
      const txRecurringId =
        typeof t.recurringTransactionId === 'string'
          ? parseInt(t.recurringTransactionId, 10)
          : t.recurringTransactionId || null;
      return txRecurringId === recurring.id;
    }).length;
    const boundedCompleted = Math.min(completed, total);
    return {
      total,
      completed: boundedCompleted,
      remaining: Math.max(total - boundedCompleted, 0),
    };
  }

  createTransaction(): void {
    // Déterminer le compte à utiliser par défaut
    const defaultAccountId = this.accountId || 1; // Utiliser le compte actuel ou 1 par défaut
    const defaultFinancialFlowId = 2; // Dépense par défaut

    const dialogRef = this.dialogService.open(EditTransactionDialogComponent, {
      width: '500px',
      data: {
        transaction: {
          description: '',
          date: new Date(),
          amount: 0,
          accountId: defaultAccountId,
          financialFlowId: defaultFinancialFlowId,
          subCategoryId: null,
        },
        isNew: true,
      },
    });

    dialogRef.onClose.subscribe((result) => {
      if (result) {
        this.transactionService.addTransaction(result).subscribe({
          next: () => {
            console.log('TRANSACTION LIST : Transaction créée avec succès');
            this.loadTransactions();
            this.messageService.add({
              severity: 'success',
              summary: 'Succès',
              detail: 'Transaction créée avec succès.',
            });
          },
          error: (err) => {
            console.error(
              'TRANSACTION LIST : Erreur lors de la création de la transaction:',
              err,
            );
            this.messageService.add({
              severity: 'error',
              summary: 'Erreur',
              detail: 'Erreur lors de la création de la transaction.',
            });
          },
        });
      }
    });
  }

  editTransaction(transaction: Transaction): void {
    const dialogRef = this.dialogService.open(EditTransactionDialogComponent, {
      width: '500px',
      data: { transaction: { ...transaction } },
    });

    dialogRef.onClose.subscribe((result) => {
      if (result) {
        // Convertir la date en format ISO
        const formattedDate = new Date(result.date).toISOString().slice(0, 10);
        const updatedTransaction = {
          ...result,
          date: new Date(formattedDate),
        };

        this.transactionService
          .updateTransaction(transaction.id!, updatedTransaction)
          .subscribe({
            next: () => {
              console.log(
                'TRANSACTION LIST : Transaction mise à jour avec succès',
              );
              this.loadTransactions();
              this.messageService.add({
                severity: 'success',
                summary: 'Succès',
                detail: 'Transaction mise à jour avec succès.',
              });
            },
            error: (err) => {
              console.error(
                'TRANSACTION LIST : Erreur lors de la mise à jour de la transaction:',
                err,
              );
              this.messageService.add({
                severity: 'error',
                summary: 'Erreur',
                detail: 'Erreur lors de la mise à jour de la transaction.',
              });
            },
          });
      }
    });
  }

  deleteTransaction(transaction: Transaction): void {
    const dialogRef = this.dialogService.open(ConfirmDialogComponent, {
      width: '450px',
      data: {
        title: 'Confirmer la suppression',
        message: `Voulez-vous vraiment supprimer la transaction "${transaction.description}" ?`,
        confirmText: 'Supprimer',
        cancelText: 'Annuler',
      },
    });

    dialogRef.onClose.subscribe((confirmed) => {
      if (confirmed) {
        this.transactionService.deleteTransaction(transaction.id!).subscribe({
          next: () => {
            console.log('TRANSACTION LIST : Transaction supprimée avec succès');
            this.loadTransactions();
            this.messageService.add({
              severity: 'info',
              summary: 'Succès',
              detail: 'Transaction supprimée avec succès.',
            });
          },
          error: (err) => {
            console.error(
              'TRANSACTION LIST : Erreur lors de la suppression de la transaction:',
              err,
            );
            this.messageService.add({
              severity: 'error',
              summary: 'Erreur',
              detail: 'Erreur lors de la suppression de la transaction.',
            });
          },
        });
      }
    });
  }

  isSameMonth(date: Date, month: number, year: number): boolean {
    const target = new Date(date);
    return target.getMonth() === month && target.getFullYear() === year;
  }

  private applyAccountAccent(): void {
    const base = (this.account?.color || '#3B82F6').toString();
    const normalized = this.normalizeHex(base);
    this.accent = normalized;
    this.accentStart = this.shadeColor(normalized, 20);
    this.accentEnd = this.shadeColor(normalized, -10);
    this.accentSoft = this.shadeColor(normalized, 70);
    this.accentShadow = this.hexToRgba(normalized, 0.3);
  }

  getAccentVars(): { [key: string]: string } {
    return {
      '--accent-start': this.accentStart,
      '--accent-end': this.accentEnd,
      '--accent': this.accent,
      '--accent-soft': this.accentSoft,
      '--accent-shadow': this.accentShadow,
    } as any;
  }

  private normalizeHex(hex: string): string {
    let h = hex.trim();
    if (!h.startsWith('#')) h = '#' + h;
    if (h.length === 4) {
      const r = h[1],
        g = h[2],
        b = h[3];
      h = `#${r}${r}${g}${g}${b}${b}`;
    }
    return h.substring(0, 7);
  }

  private shadeColor(hex: string, percent: number): string {
    const { r, g, b } = this.hexToRgb(hex);
    const t = percent < 0 ? 0 : 255;
    const p = Math.abs(percent) / 100;
    const R = Math.round((t - r) * p + r);
    const G = Math.round((t - g) * p + g);
    const B = Math.round((t - b) * p + b);
    return '#' + [R, G, B].map((x) => x.toString(16).padStart(2, '0')).join('');
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    const r = m ? parseInt(m[1], 16) : 59;
    const g = m ? parseInt(m[2], 16) : 130;
    const b = m ? parseInt(m[3], 16) : 246;
    return { r, g, b };
  }

  private hexToRgba(hex: string, alpha: number): string {
    const { r, g, b } = this.hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}

