import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

// Services
import { AccountService } from '../../services/account.service';
import { TransactionService } from '../../services/transaction.service';
import { RecurringTransactionService } from '../../services/recurring-transaction.service';
import { SubCategoryService } from '../../services/sub-category.service';
import { ViewportService } from '../../services/viewport.service';
import { SavingAccountService } from '../../services/saving-account.service';

// Models
import { Transaction } from '../../models/transaction.model';
import { RecurringTransaction } from '../../models/recurring-transaction.model';
import { recurringOccursInMonth } from '../../utils/recurring-frequency.utils';
import { Account } from '../../models/account.model';
import { SavingAccount } from '../../models/saving-account.model';
import { DEBIT_503020_LIST } from '../../config/debit_503020';

// PrimeNG Modules
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DynamicDialogModule, DialogService } from 'primeng/dynamicdialog';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';

interface UpcomingSchedule {
  recurringTransaction: RecurringTransaction;
  dueDate: Date;
  amount: number;
  subCategoryLabel?: string;
  isOverdue?: boolean;
}

interface CategoryTotal {
  categoryLabel: string;
  total: number;
  color: string;
  icon: string;
}

interface Debit503020Item {
  id: number;
  name: string;
  amount: number;
  percent: number;
  details: Debit503020Detail[];
}

interface Debit503020Detail {
  subCategoryId: number | null;
  label: string;
  amount: number;
  occurrences: number;
}

interface Debit503020Breakdown {
  total: number;
  incomeDetails: Debit503020Detail[];
  totalExpenses: number;
  items: Debit503020Item[];
  unclassifiedAmount: number;
  unclassifiedDetails: Debit503020Detail[];
  remaining: number;
  remainingPercent: number;
}

interface DashboardNotification {
  severity: 'info' | 'warn' | 'danger';
  text: string;
  tooltip?: string;
  type?: string;
  accountId?: number;
  accountName?: string;
}

interface BudgetTrendStat {
  icon: string;
  title: string;
  value: string;
  detail: string;
  tone: 'positive' | 'negative' | 'neutral';
}

interface CoverageSummary {
  soldeFinMois: number;
  depensesDebutMoisSuivant: number;
  marge: number;
}

interface AccountBalance {
  account: Account;
  initialBalance: number;
  currentBalance: number;
  forecastBalance: number;
  upcomingSchedules: UpcomingSchedule[];
  totalUpcoming: number;
  expensesByCategory: CategoryTotal[];
  incomesByCategory: CategoryTotal[];
  nextMonthLowestBalance: number; // Remplacer le booléen par un nombre
}

interface DashboardSchedule extends UpcomingSchedule {
  accountId: number;
  accountName: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    TableModule,
    TagModule,
    ButtonModule,
    TooltipModule,
    DynamicDialogModule,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnInit, OnDestroy {
  readonly dashboardDate = new Date();
  isMobile = false;
  transactions: Transaction[] = [];
  recurringTransactions: RecurringTransaction[] = [];
  accounts: Account[] = [];
  savingAccounts: SavingAccount[] = [];
  accountBalances: AccountBalance[] = [];
  activeAccountId: number | null = null;
  initialBalances: Map<number, number> = new Map();
  subCategories: Map<number, string> = new Map(); // Map subCategoryId -> label
  subCategoryNames: Map<number, string> = new Map();
  budgetTrendStatsByAccount = new Map<number, BudgetTrendStat[]>();
  private breakdown503020ByAccount = new Map<number, Debit503020Breakdown>();
  private subscriptions = new Subscription();
  expandedSchedules: Set<number> = new Set(); // Track which account schedules are expanded
  expandedExpenses: Set<number> = new Set(); // Track which account expenses are expanded
  expandedIncomes: Set<number> = new Set(); // Track which account incomes are expanded
  showDashboardNotifications = false;
  private subCategoriesLoaded = false; // Flag pour savoir si les sous-catégories sont chargées

  constructor(
    private transactionService: TransactionService,
    private recurringTransactionService: RecurringTransactionService,
    private accountService: AccountService,
    private savingAccountService: SavingAccountService,
    private subCategoryService: SubCategoryService,
    private viewportService: ViewportService,
    private router: Router,
    private dialogService: DialogService,
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.viewportService.mobile$.subscribe((isMobile) => {
        this.isMobile = isMobile;
      }),
    );

    // Charger les sous-catégories EN PREMIER
    this.subscriptions.add(
      this.subCategoryService.subCategories$.subscribe({
        next: (subCats) => {
          this.subCategories.clear(); // Vider avant de remplir
          this.subCategoryNames.clear();
          subCats.forEach((sc) => {
            this.subCategories.set(sc.id!, `${sc.categoryLabel}`);
            this.subCategoryNames.set(sc.id!, sc.label);
          });
          this.subCategoriesLoaded = true;
          this.calculateAllBalances();
        },
      }),
    );

    // Déclencher le chargement des sous-catégories
    this.subCategoryService.getSubCategories().subscribe();

    // Charger les comptes
    this.subscriptions.add(
      this.accountService.accounts$.subscribe({
        next: (accounts) => {
          this.accounts = accounts;
          this.calculateAllBalances();
        },
      }),
    );

    // Charger les transactions
    this.subscriptions.add(
      this.transactionService.transactions$.subscribe({
        next: (data) => {
          this.transactions = data;
          this.calculateAllBalances();
        },
      }),
    );

    // Charger les échéances
    this.subscriptions.add(
      this.recurringTransactionService.recurringTransactions$.subscribe({
        next: (data) => {
          this.recurringTransactions = data;
          this.calculateAllBalances();
        },
      }),
    );

    // Charger les données initiales
    this.transactionService.clearFiltersTransactions();
    this.recurringTransactionService.getRecurringTransactions().subscribe();
    this.accountService.getAccounts().subscribe();
    this.savingAccountService.getAccounts().subscribe({
      next: (accounts) => {
        this.savingAccounts = accounts;
      },
      error: () => {
        this.savingAccounts = [];
      },
    });
    // getSubCategories() est déjà appelé plus haut
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  calculateAllBalances(): void {
    // Ne pas calculer si les sous-catégories ne sont pas encore chargées
    if (!this.subCategoriesLoaded) {
      console.log('Waiting for subcategories to load...');
      return;
    }
    if (!this.accounts.length) {
      return;
    }

    this.breakdown503020ByAccount.clear();

    this.accountBalances = this.accounts.map((account) => {
      const accountId = account.id!;
      const initialBalance = account.initialBalance || 0;
      const currentBalance = this.calculateCurrentBalance(
        accountId,
        initialBalance,
      );
      const allUpcomingSchedules = this.getUpcomingSchedules(accountId);

      // Le total à venir et le prévisionnel doivent inclure toutes les échéances prévues pour le reste du mois et le mois suivant (si applicable).
      const totalUpcoming = allUpcomingSchedules.reduce(
        (sum, s) => sum + s.amount,
        0,
      );
      const forecastBalance = currentBalance + totalUpcoming;

      const nextMonthLowestBalance = this.calculateNextMonthLowestBalance(
        accountId,
        currentBalance,
      );

      return {
        account,
        initialBalance,
        currentBalance,
        forecastBalance,
        upcomingSchedules: allUpcomingSchedules,
        totalUpcoming,
        expensesByCategory: this.getExpensesByCategory(accountId),
        incomesByCategory: this.getIncomesByCategory(accountId),
        nextMonthLowestBalance,
      };
    });

    this.budgetTrendStatsByAccount.clear();
    this.accountBalances.forEach((balance) => {
      const accountId = balance.account.id;
      if (typeof accountId === 'number') {
        this.budgetTrendStatsByAccount.set(
          accountId,
          this.buildBudgetTrendStats(accountId),
        );
      }
    });

    if (this.accountBalances.length === 0) {
      this.activeAccountId = null;
    } else if (
      this.activeAccountId == null ||
      !this.accountBalances.some((ab) => ab.account.id === this.activeAccountId)
    ) {
      const firstId = this.accountBalances[0]?.account?.id ?? null;
      this.activeAccountId = typeof firstId === 'number' ? firstId : null;
    }

    // Correction : Déplacer la logique de mise à jour de l'onglet actif ici
    if (
      this.accountBalances.length > 0 &&
      (this.activeAccountId === null ||
        !this.accountBalances.some(
          (ab) => ab.account.id === this.activeAccountId,
        ))
    ) {
      const id = this.accountBalances[0]?.account?.id;
      this.activeAccountId = typeof id === 'number' ? id : null;
      //this.activeAccountId = this.accountBalances[0].account.id;
    } else if (this.accountBalances.length === 0) {
      this.activeAccountId = null;
    }
  }

  calculateCurrentBalance(accountId: number, initialBalance: number): number {
    const accountTransactions = this.transactions.filter((t) => {
      const tAccountId =
        typeof t.accountId === 'string' ? parseInt(t.accountId) : t.accountId;
      return tAccountId === accountId;
    });

    const totalTransactions = accountTransactions.reduce((sum, transaction) => {
      return sum + this.getSignedAmount(transaction);
    }, 0);

    return initialBalance + totalTransactions;
  }

  private getRecurringTransactionId(value: unknown): number | null {
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = parseInt(value, 10);
      return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
  }

  private getLocalDateOnly(value: Date): Date {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  private toDateKey(value: Date | string): string {
    if (value instanceof Date) {
      const normalized = this.getLocalDateOnly(value);
      return `${normalized.getFullYear()}-${String(normalized.getMonth() + 1).padStart(2, '0')}-${String(normalized.getDate()).padStart(2, '0')}`;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) {
        return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
      }

      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) {
        return this.toDateKey(parsed);
      }
    }

    return '';
  }

  private isSamePeriod(
    recurring: RecurringTransaction,
    referenceDate: Date,
    candidateDate: Date,
  ): boolean {
    const normalizedReference = this.getLocalDateOnly(referenceDate);
    const normalizedCandidate = this.getLocalDateOnly(candidateDate);

    if (recurring.frequency === 'weekly') {
      const startOfWeek = (value: Date): Date => {
        const clone = this.getLocalDateOnly(value);
        const day = clone.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        clone.setDate(clone.getDate() + diff);
        return clone;
      };

      return (
        this.toDateKey(startOfWeek(normalizedReference)) ===
        this.toDateKey(startOfWeek(normalizedCandidate))
      );
    }

    return (
      normalizedReference.getMonth() === normalizedCandidate.getMonth() &&
      normalizedReference.getFullYear() === normalizedCandidate.getFullYear()
    );
  }

  private isRecurringRealized(
    recurring: RecurringTransaction,
    nextDueDate: Date,
  ): boolean {
    return this.transactions.some((t) => {
      const txRecurringId = this.getRecurringTransactionId(
        t.recurringTransactionId,
      );
      if (txRecurringId !== recurring.id || !t.date) {
        return false;
      }
      if (t.recurringOccurrenceDate) {
        return (
          this.toDateKey(new Date(t.recurringOccurrenceDate)) ===
          this.toDateKey(nextDueDate)
        );
      }
      const transactionDate = this.getLocalDateOnly(new Date(t.date));
      return this.isSamePeriod(recurring, nextDueDate, transactionDate);
    });
  }

  calculateNextMonthLowestBalance(
    accountId: number,
    currentBalance: number,
  ): number {
    const today = new Date();
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const daysUntilEndOfMonth = endOfMonth.getDate() - today.getDate();

    // Ne calculer que si on est à 5 jours ou moins de la fin du mois
    if (daysUntilEndOfMonth > 5) {
      return 0;
    }

    // 1. Calculer le solde à la fin du mois en cours
    const remainingSchedulesThisMonth = this.getUpcomingSchedules(
      accountId,
      false,
    ); // false = ne pas anticiper
    const remainingAmountThisMonth = remainingSchedulesThisMonth.reduce(
      (sum, s) => sum + s.amount,
      0,
    );
    const balanceAtEndOfMonth = currentBalance + remainingAmountThisMonth;

    // 2. Calculer l'impact des 5 premiers jours du mois suivant
    const accountRecurring = this.recurringTransactions.filter((rt) => {
      const rtAccountId =
        typeof rt.accountId === 'string'
          ? parseInt(rt.accountId)
          : rt.accountId;
      return rtAccountId === accountId && rt.isActive === 1;
    });

    let lowestBalanceNextMonth = balanceAtEndOfMonth;
    let projectedBalance = balanceAtEndOfMonth;
    const nextMonthDate = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      1,
    );
    const nextMonthSchedules = this.buildSchedulesForMonth(
      accountRecurring,
      nextMonthDate.getFullYear(),
      nextMonthDate.getMonth(),
    );

    for (let day = 1; day <= 5; day++) {
      const schedulesForDay = nextMonthSchedules.filter(
        ({ dueDate }) => dueDate.getDate() === day,
      );

      // Calculer l'impact net de la journée
      const netChangeForDay = schedulesForDay.reduce((sum, { recurring }) => {
        const amount =
          typeof recurring.amount === 'string'
            ? parseFloat(recurring.amount)
            : recurring.amount || 0;
        const signedAmount =
          recurring.financialFlowId === 2
            ? -Math.abs(amount)
            : Math.abs(amount);
        return sum + signedAmount;
      }, 0);

      projectedBalance += netChangeForDay;

      if (projectedBalance < lowestBalanceNextMonth) {
        lowestBalanceNextMonth = projectedBalance;
      }
    }

    // L'alerte est déclenchée si le point le plus bas est négatif
    if (lowestBalanceNextMonth < 0) {
      console.log(
        `ALERTE Compte ${accountId}: Solde négatif de ${lowestBalanceNextMonth.toFixed(2)}€ prévu début de mois prochain.`,
      );
      return lowestBalanceNextMonth;
    }

    return 0;
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

  private buildSchedulesForMonth(
    recurringTransactions: RecurringTransaction[],
    year: number,
    month: number,
  ): { recurring: RecurringTransaction; dueDate: Date }[] {
    const schedules: { recurring: RecurringTransaction; dueDate: Date }[] = [];
    const normalizedMonth = ((month % 12) + 12) % 12;
    const yearOffset = Math.floor(month / 12);
    const effectiveYear = year + yearOffset;

    recurringTransactions.forEach((recurring) => {
      const dayOfMonth =
        typeof recurring.dayOfMonth === 'string'
          ? parseInt(recurring.dayOfMonth, 10)
          : recurring.dayOfMonth || 0;
      const frequency = recurring.frequency || 'monthly';
      const isInstallment = recurring.recurrenceKind === 'installment';

      if (
        !recurringOccursInMonth(
          frequency,
          normalizedMonth,
          recurring.activeMonths,
        )
      ) {
        return;
      }

      if (frequency === 'weekly') {
        const first = new Date(effectiveYear, normalizedMonth, 1);
        const last = new Date(effectiveYear, normalizedMonth + 1, 0);
        const targetDow = dayOfMonth % 7;

        for (let day = first.getDate(); day <= last.getDate(); day++) {
          const dueDate = new Date(effectiveYear, normalizedMonth, day);
          if (dueDate.getDay() !== targetDow) {
            continue;
          }
          if (
            isInstallment &&
            !this.isInstallmentDateValid(recurring, dueDate)
          ) {
            continue;
          }
          schedules.push({ recurring, dueDate });
        }
        return;
      }

      const targetDay = dayOfMonth > 0 ? dayOfMonth : 1;
      const dueDate = new Date(effectiveYear, normalizedMonth, targetDay);
      if (isInstallment && !this.isInstallmentDateValid(recurring, dueDate)) {
        return;
      }
      schedules.push({ recurring, dueDate });
    });

    return schedules;
  }

  getUpcomingSchedules(
    accountId: number,
    anticipate: boolean = true,
  ): UpcomingSchedule[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const accountRecurring = this.recurringTransactions.filter((rt) => {
      const rtAccountId =
        typeof rt.accountId === 'string'
          ? parseInt(rt.accountId)
          : rt.accountId;
      return rtAccountId === accountId && rt.isActive === 1;
    });

    const currentMonthSchedules = this.buildSchedulesForMonth(
      accountRecurring,
      currentYear,
      currentMonth,
    )
      .filter(
        ({ recurring, dueDate }) =>
          !this.isRecurringRealized(recurring, dueDate),
      )
      .map(({ recurring, dueDate }) =>
        this.createSchedule(recurring, dueDate, today),
      );

    const nextMonthSchedules: UpcomingSchedule[] = [];
    if (anticipate && today.getDate() >= 25) {
      const nextMonth = (currentMonth + 1) % 12;
      const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
      nextMonthSchedules.push(
        ...this.buildSchedulesForMonth(accountRecurring, nextYear, nextMonth)
          .filter(
            ({ recurring, dueDate }) =>
              dueDate.getDate() <= 5 &&
              !this.isRecurringRealized(recurring, dueDate),
          )
          .map(({ recurring, dueDate }) =>
            this.createSchedule(recurring, dueDate, today),
          ),
      );
    }

    return [...currentMonthSchedules, ...nextMonthSchedules].sort(
      (a, b) => a.dueDate.getTime() - b.dueDate.getTime(),
    );
  }

  private createSchedule(
    recurring: RecurringTransaction,
    dueDate: Date,
    today: Date,
  ): UpcomingSchedule {
    const amount =
      typeof recurring.amount === 'string'
        ? parseFloat(recurring.amount)
        : recurring.amount || 0;
    const signedAmount =
      recurring.financialFlowId === 2 ? -Math.abs(amount) : Math.abs(amount);
    return {
      recurringTransaction: recurring,
      dueDate,
      amount: signedAmount,
      isOverdue: dueDate < today,
      subCategoryLabel:
        this.subCategories.get(recurring.subCategoryId!) || 'N/A',
    };
  }

  getExpensesByCategory(accountId: number): CategoryTotal[] {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const expenses = this.transactions.filter((t) => {
      const tAccountId =
        typeof t.accountId === 'string' ? parseInt(t.accountId) : t.accountId;
      const flowId =
        typeof t.financialFlowId === 'string'
          ? parseInt(t.financialFlowId)
          : t.financialFlowId;

      // Filtrer par compte, type de flux (dépense) et mois en cours
      if (tAccountId !== accountId || flowId !== 2) {
        return false;
      }

      const transactionDate = new Date(t.date!);
      return (
        transactionDate.getMonth() === currentMonth &&
        transactionDate.getFullYear() === currentYear
      );
    });

    const categoryMap = new Map<string, number>();

    expenses.forEach((t) => {
      // Convertir subCategoryId en nombre si c'est une chaîne
      const subCatId =
        typeof t.subCategoryId === 'string'
          ? parseInt(t.subCategoryId)
          : t.subCategoryId;

      // Récupérer le label complet de la sous-catégorie
      const fullLabel = this.subCategories.get(subCatId!);

      // Extraire uniquement la catégorie (avant le ' - ')
      let categoryLabel = 'Autres';
      if (fullLabel && fullLabel.includes(' - ')) {
        categoryLabel = fullLabel.split(' - ')[0];
      } else if (fullLabel && fullLabel.trim().length > 0) {
        categoryLabel = fullLabel;
      }

      const amount =
        typeof t.amount === 'string' ? parseFloat(t.amount) : t.amount;
      categoryMap.set(
        categoryLabel,
        (categoryMap.get(categoryLabel) || 0) + Math.abs(amount || 0),
      );
    });

    const categories: CategoryTotal[] = [];
    categoryMap.forEach((total, label) => {
      // Ne garder que les catégories avec un montant > 0
      if (total > 0) {
        categories.push({
          categoryLabel: label,
          total,
          color: this.getCategoryColor(label),
          icon: this.getCategoryIcon(label),
        });
      }
    });

    return categories.sort((a, b) => b.total - a.total);
  }

  getIncomesByCategory(accountId: number): CategoryTotal[] {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const incomes = this.transactions.filter((t) => {
      const tAccountId =
        typeof t.accountId === 'string' ? parseInt(t.accountId) : t.accountId;
      const flowId =
        typeof t.financialFlowId === 'string'
          ? parseInt(t.financialFlowId)
          : t.financialFlowId;

      // Filtrer par compte, type de flux (revenu) et mois en cours
      if (tAccountId !== accountId || flowId !== 1) {
        return false;
      }

      const transactionDate = new Date(t.date!);
      return (
        transactionDate.getMonth() === currentMonth &&
        transactionDate.getFullYear() === currentYear
      );
    });

    const categoryMap = new Map<string, number>();

    incomes.forEach((t) => {
      // Convertir subCategoryId en nombre si c'est une chaîne
      const subCatId =
        typeof t.subCategoryId === 'string'
          ? parseInt(t.subCategoryId)
          : t.subCategoryId;

      // Récupérer le label complet de la sous-catégorie
      const fullLabel = this.subCategories.get(subCatId!);

      // Extraire uniquement la catégorie (avant le ' - ')
      let categoryLabel = 'Autres';
      if (fullLabel && fullLabel.includes(' - ')) {
        categoryLabel = fullLabel.split(' - ')[0];
      } else if (fullLabel && fullLabel.trim().length > 0) {
        categoryLabel = fullLabel;
      }

      const amount =
        typeof t.amount === 'string' ? parseFloat(t.amount) : t.amount;
      categoryMap.set(
        categoryLabel,
        (categoryMap.get(categoryLabel) || 0) + Math.abs(amount || 0),
      );
    });

    const categories: CategoryTotal[] = [];
    categoryMap.forEach((total, label) => {
      // Ne garder que les catégories avec un montant > 0
      if (total > 0) {
        categories.push({
          categoryLabel: label,
          total,
          color: this.getCategoryColor(label),
          icon: this.getCategoryIcon(label),
        });
      }
    });

    return categories.sort((a, b) => b.total - a.total);
  }

  getCategoryColor(category: string): string {
    const colors: { [key: string]: string } = {
      Salaires: '#10b981',
      Quotidien: '#f59e0b',
      Habitation: '#3b82f6',
      Transports: '#8b5cf6',
      Divertissements: '#ec4899',
      'Sant+�': '#ef4444',
      Dettes: '#dc2626',
      Epargne: '#059669',
      Fournisseurs: '#0ea5e9',
    };
    return colors[category] || '#6b7280';
  }

  getCategoryIcon(category: string): string {
    const icons: { [key: string]: string } = {
      Salaires: 'pi-money-bill',
      Quotidien: 'pi-shopping-cart',
      Habitation: 'pi-home',
      Transports: 'pi-car',
      Divertissements: 'pi-star',
      'Sant+�': 'pi-heart',
      Dettes: 'pi-credit-card',
      Epargne: 'pi-wallet',
      Fournisseurs: 'pi-bolt',
    };
    return icons[category] || 'pi-tag';
  }

  private getSignedAmount(transaction: Transaction): number {
    const amount =
      typeof transaction.amount === 'string'
        ? parseFloat(transaction.amount)
        : transaction.amount || 0;

    const financialFlowId =
      typeof transaction.financialFlowId === 'string'
        ? parseInt(transaction.financialFlowId)
        : transaction.financialFlowId || 0;

    return financialFlowId === 2 ? -Math.abs(amount) : Math.abs(amount);
  }

  // Nouvelle méthode pour marquer une échéance comme payée
  markAsPaid(schedule: UpcomingSchedule, accountId: number): void {
    const ref = this.dialogService.open(ConfirmDialogComponent, {
      width: '450px',
      data: {
        title: "Valider l'échéance",
        message: `Confirmer la réalisation de "${schedule.recurringTransaction.label}" pour ${Math.abs(schedule.amount).toFixed(2)} € ?`,
        confirmText: 'Valider',
        cancelText: 'Annuler',
      },
    });

    ref.onClose.subscribe((confirmed: boolean) => {
      if (!confirmed) return;

      const tx: Transaction = {
        description: schedule.recurringTransaction.label,
        date: this.toDateKey(new Date()),
        amount: Math.abs(schedule.amount),
        accountId: accountId,
        financialFlowId: schedule.recurringTransaction.financialFlowId,
        subCategoryId: schedule.recurringTransaction.subCategoryId || null,
        recurringTransactionId: schedule.recurringTransaction.id,
        recurringOccurrenceDate: this.toDateKey(schedule.dueDate),
        vehicleId: schedule.recurringTransaction.vehicleId || null,
      } as any;

      this.transactionService.addTransaction(tx).subscribe();
    });
  }

  navigateToTransactions(accountId: number): void {
    this.router.navigate(['/transactions-list', accountId]);
  }

  getMainAccountBalances(): AccountBalance[] {
    const mainAccounts = this.accountBalances.filter((balance) => {
      const name = this.normalizeLabel(balance.account.name);
      return name.includes('courant') || name.includes('joint');
    });
    return (mainAccounts.length ? mainAccounts : this.accountBalances).slice(
      0,
      2,
    );
  }

  getMainAccountsLiquidity(): number {
    return this.getMainAccountBalances().reduce(
      (sum, balance) => sum + balance.currentBalance,
      0,
    );
  }

  getMainAccountsForecast(): number {
    return this.getMainAccountBalances().reduce(
      (sum, balance) => sum + balance.forecastBalance,
      0,
    );
  }

  getAvailableSavings(): number {
    return this.savingAccounts
      .filter(
        (account) =>
          account.isActive !== false && account.liquidityLevel !== 'long_term',
      )
      .reduce((sum, account) => sum + account.currentBalance, 0);
  }

  getLongTermSavings(): number {
    return this.savingAccounts
      .filter(
        (account) =>
          account.isActive !== false && account.liquidityLevel === 'long_term',
      )
      .reduce((sum, account) => sum + account.currentBalance, 0);
  }

  getDashboardNotifications(): DashboardNotification[] {
    return this.getMainAccountBalances().flatMap((accountBalance) =>
      this.getNotifications(accountBalance).map((notification) => ({
        ...notification,
        accountId: accountBalance.account.id,
        accountName: accountBalance.account.name,
      })),
    );
  }

  getDashboardAlertCount(): number {
    return this.getDashboardNotifications().length;
  }

  toggleDashboardNotifications(): void {
    this.showDashboardNotifications = !this.showDashboardNotifications;
  }

  openDashboardNotification(notification: DashboardNotification): void {
    if (typeof notification.accountId === 'number') {
      this.navigateToTransactions(notification.accountId);
    }
  }

  getDashboardTransactions(limit = 6): Transaction[] {
    const accountIds = new Set<number>(
      this.getMainAccountBalances()
        .map((balance) => balance.account.id)
        .filter((id): id is number => typeof id === 'number'),
    );
    return this.transactions
      .filter((transaction) => accountIds.has(Number(transaction.accountId)))
      .sort((a, b) => {
        const timeA = a.date ? new Date(a.date).getTime() : 0;
        const timeB = b.date ? new Date(b.date).getTime() : 0;
        return timeB - timeA;
      })
      .slice(0, limit);
  }

  getTransactionAccountName(transaction: Transaction): string {
    return (
      this.accounts.find(
        (account) => Number(account.id) === Number(transaction.accountId),
      )?.name || 'Compte'
    );
  }

  getDashboardUpcomingSchedules(limit = 6): DashboardSchedule[] {
    return this.getMainAccountBalances()
      .flatMap((balance) =>
        balance.upcomingSchedules.map((schedule) => ({
          ...schedule,
          accountId: balance.account.id!,
          accountName: balance.account.name,
        })),
      )
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      .slice(0, limit);
  }

  getAccountInitials(account: Account): string {
    const parts = (account.name || '').split(/\s+/).filter(Boolean).slice(0, 2);

    if (!parts.length) {
      return 'CB';
    }

    return parts.map((part) => part[0].toUpperCase()).join('');
  }

  getAccountCardStyle(account: Account): Record<string, string> {
    const accent = account.color || '#667eea';
    return {
      '--account-accent': accent,
      '--account-accent-soft': `${accent}22`,
    };
  }

  toggleSchedules(accountId: number | undefined): void {
    if (accountId !== undefined) {
      if (this.expandedSchedules.has(accountId)) {
        this.expandedSchedules.delete(accountId);
      } else {
        this.expandedSchedules.add(accountId);
      }
    }
  }

  isSchedulesExpanded(accountId: number | undefined): boolean {
    return accountId !== undefined && this.expandedSchedules.has(accountId);
  }

  toggleExpenses(accountId: number | undefined): void {
    if (accountId !== undefined) {
      if (this.expandedExpenses.has(accountId)) {
        this.expandedExpenses.delete(accountId);
      } else {
        this.expandedExpenses.add(accountId);
      }
    }
  }

  isExpensesExpanded(accountId: number | undefined): boolean {
    return accountId !== undefined && this.expandedExpenses.has(accountId);
  }

  toggleIncomes(accountId: number | undefined): void {
    if (accountId !== undefined) {
      if (this.expandedIncomes.has(accountId)) {
        this.expandedIncomes.delete(accountId);
      } else {
        this.expandedIncomes.add(accountId);
      }
    }
  }

  isIncomesExpanded(accountId: number | undefined): boolean {
    return accountId !== undefined && this.expandedIncomes.has(accountId);
  }

  getActiveAccountBalance(): AccountBalance | null {
    if (!this.accountBalances.length) {
      return null;
    }
    const fallbackId = this.accountBalances[0]?.account?.id;
    const activeId =
      this.activeAccountId ??
      (typeof fallbackId === 'number' ? fallbackId : null);
    if (activeId == null) {
      return this.accountBalances[0] ?? null;
    }
    return (
      this.accountBalances.find((ab) => ab.account.id === activeId) ??
      this.accountBalances[0] ??
      null
    );
  }

  selectAccount(accountId: number | null | undefined): void {
    if (typeof accountId === 'number') {
      this.activeAccountId = accountId;
    }
  }

  isAccountActive(accountId: number | null | undefined): boolean {
    if (typeof accountId !== 'number') {
      return false;
    }
    const activeBalance = this.getActiveAccountBalance();
    return activeBalance?.account?.id === accountId;
  }

  getNotifications(accountBalance: AccountBalance): DashboardNotification[] {
    const notes: DashboardNotification[] = [];

    if (accountBalance.forecastBalance < 0) {
      notes.push({
        severity: 'danger',
        text: 'Solde pr\u00E9visionnel n\u00E9gatif',
      });
    } else if (accountBalance.forecastBalance < 100) {
      notes.push({
        severity: 'warn',
        text: 'Solde pr\u00E9visionnel sous 100` \u20AC`',
      });
    }

    const forecastDelta =
      accountBalance.forecastBalance - accountBalance.currentBalance;
    if (forecastDelta < -100) {
      notes.push({
        severity: 'warn',
        text: `Pr\u00E9vision en baisse de ${this.formatEuroValue(Math.abs(forecastDelta))}`,
      });
    } else if (forecastDelta > 150) {
      notes.push({
        severity: 'info',
        text: `Pr\u00E9vision +${this.formatEuroValue(forecastDelta)} vs solde actuel`,
      });
    }

    if (accountBalance.nextMonthLowestBalance < 0) {
      notes.push({
        severity: 'danger',
        text: `Point bas du mois prochain n\u00E9gatif: ${this.formatEuroValue(accountBalance.nextMonthLowestBalance)}`,
      });
    }

    if (this.getTotalIncomes(accountBalance.incomesByCategory) === 0) {
      notes.push({ severity: 'info', text: 'Aucun revenu re\u00E7u ce mois' });
    }

    const today = new Date();

    const savingsCategory = accountBalance.expensesByCategory.find((cat) =>
      this.normalizeLabel(cat.categoryLabel).includes('eparg'),
    );
    if (savingsCategory && savingsCategory.total > 0) {
      const savingsTooltip = this.buildSavingsTooltip(accountBalance, today);
      notes.push({
        severity: 'info',
        text: `\u00C9pargne ce mois: ${this.formatEuroValue(savingsCategory.total)}`,
        tooltip: savingsTooltip,
      });
    }

    const fiveDays = 5 * 24 * 60 * 60 * 1000;
    const upcoming5Days = accountBalance.upcomingSchedules.filter(
      (schedule) => {
        const due = new Date(schedule.dueDate);
        return due.getTime() - today.getTime() <= fiveDays && due >= today;
      },
    );
    if (upcoming5Days.length > 0) {
      const net = upcoming5Days.reduce(
        (sum, schedule) => sum + schedule.amount,
        0,
      );
      notes.push({
        severity: net < 0 ? 'warn' : 'info',
        text: `Flux 5 jours: ${this.formatEuroValue(net)}`,
      });
    }

    const overdueIncome = accountBalance.upcomingSchedules.find(
      (schedule) =>
        schedule.isOverdue &&
        schedule.recurringTransaction.financialFlowId === 1,
    );
    if (overdueIncome) {
      notes.push({
        severity: 'warn',
        text: `Revenu en retard: ${overdueIncome.recurringTransaction.label}`,
      });
    }

    const highDebit = accountBalance.upcomingSchedules
      .filter((schedule) => schedule.amount < 0)
      .sort((a, b) => a.amount - b.amount)[0];
    if (highDebit && Math.abs(highDebit.amount) >= 200) {
      notes.push({
        severity: 'warn',
        text: `Grosse sortie \u00E0 venir: ${highDebit.recurringTransaction.label} ${this.formatEuroValue(highDebit.amount)}`,
      });
    }

    const accountId = accountBalance.account?.id;
    if (typeof accountId === 'number') {
      const breakdown = this.get503020Breakdown(accountId);
      const bucketThresholds: { id: number; limit: number }[] = [
        { id: 1, limit: 50 },
        { id: 2, limit: 30 },
        { id: 3, limit: 20 },
      ];
      bucketThresholds.forEach(({ id, limit }) => {
        const bucket = breakdown.items.find((item) => item.id === id);
        if (bucket && bucket.percent > limit) {
          notes.push({
            severity: 'warn',
            text: `D\u00E9passement ${bucket.name}: ${bucket.percent}% (> ${limit}%)`,
          });
        }
      });

      if (breakdown.total > 0) {
        const usagePercent = (breakdown.totalExpenses / breakdown.total) * 100;
        const formattedPercent = usagePercent.toFixed(0);
        if (usagePercent > 90) {
          notes.push({
            severity: 'danger',
            text: `Budget 50/30/20 d\u00E9pass\u00E9 (${formattedPercent}%)`,
          });
        } else if (usagePercent > 80) {
          notes.push({
            severity: 'warn',
            text: `Budget 50/30/20 critique (${formattedPercent}%)`,
          });
        }
      }
    }

    if (today.getDate() >= 25) {
      const coverage = this.getNextMonthCoverage(accountBalance);
      const tooltip = `Solde fin mois : ${this.formatEuroValue(coverage.soldeFinMois)} \n Dépenses : ${this.formatEuroValue(coverage.depensesDebutMoisSuivant)} \n Marge: ${this.formatEuroValue(coverage.marge)}`;
      notes.push({
        severity: coverage.marge >= 0 ? 'info' : 'danger',
        text: 'Couverture d\u00E9but mois prochain',
        tooltip,
        type: 'coverage',
      });
    }

    return notes;
  }

  getLastFiveTransactions(accountId: number): Transaction[] {
    return this.transactions
      .filter((tx) => {
        const txAccountId =
          typeof tx.accountId === 'string'
            ? parseInt(tx.accountId)
            : tx.accountId;
        return txAccountId === accountId;
      })
      .sort((a, b) => {
        const timeA = a.date ? new Date(a.date).getTime() : 0;
        const timeB = b.date ? new Date(b.date).getTime() : 0;
        return timeB - timeA;
      })
      .slice(0, 5);
  }

  getNextUnpaidSchedulesForBalance(
    accountBalance: AccountBalance,
    limit = 5,
  ): UpcomingSchedule[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return accountBalance.upcomingSchedules
      .filter((schedule) => {
        const due = new Date(schedule.dueDate);
        due.setHours(0, 0, 0, 0);
        return schedule.isOverdue || due >= today;
      })
      .sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      )
      .slice(0, limit);
  }

  getAmountNumber(tx: Transaction): number {
    const amount =
      typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
    return Math.abs(amount || 0);
  }

  getAmountSigned(tx: Transaction): number {
    const n =
      typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount || 0;
    return tx.financialFlowId === 2 ? -Math.abs(n) : Math.abs(n);
  }

  getSubCategoryLabel(
    subCategoryId: number | string | null | undefined,
  ): string {
    if (subCategoryId === null || subCategoryId === undefined) {
      return '-';
    }
    const id =
      typeof subCategoryId === 'string'
        ? parseInt(subCategoryId, 10)
        : subCategoryId;
    return this.subCategories.get(id) ?? '-';
  }

  getSubCategoryOnlyLabel(
    subCategoryId: number | string | null | undefined,
  ): string {
    if (subCategoryId === null || subCategoryId === undefined) return '-';
    const id =
      typeof subCategoryId === 'string'
        ? parseInt(subCategoryId, 10)
        : subCategoryId;
    return this.subCategoryNames.get(id) ?? '-';
  }

  private buildSavingsTooltip(
    accountBalance: AccountBalance,
    referenceDate: Date,
  ): string | undefined {
    const accountId = accountBalance.account?.id;
    if (typeof accountId !== 'number') {
      return undefined;
    }

    const month = referenceDate.getMonth();
    const year = referenceDate.getFullYear();

    const savingsTransactions = this.transactions.filter((tx) => {
      if (!tx.date) {
        return false;
      }
      const txAccountId =
        typeof tx.accountId === 'string'
          ? parseInt(tx.accountId, 10)
          : tx.accountId;
      if (txAccountId !== accountId) {
        return false;
      }
      const txDate = new Date(tx.date);
      if (txDate.getMonth() !== month || txDate.getFullYear() !== year) {
        return false;
      }
      const flowId =
        typeof tx.financialFlowId === 'string'
          ? parseInt(tx.financialFlowId, 10)
          : tx.financialFlowId;
      if (flowId !== 2) {
        return false;
      }
      const label = this.getSubCategoryLabel(tx.subCategoryId);
      return this.normalizeLabel(label).includes('eparg');
    });

    if (!savingsTransactions.length) {
      return undefined;
    }

    const sortedTransactions = [...savingsTransactions].sort((a, b) => {
      const aTime = a.date ? new Date(a.date).getTime() : 0;
      const bTime = b.date ? new Date(b.date).getTime() : 0;
      return bTime - aTime;
    });

    const lines = sortedTransactions.map((tx) => {
      const txDate = tx.date ? new Date(tx.date) : null;
      const dateLabel = txDate
        ? txDate.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
          })
        : 'N/A';
      const label =
        tx.description || this.getSubCategoryOnlyLabel(tx.subCategoryId) || '-';
      const amount = this.formatEuroValue(this.getAmountNumber(tx));
      return `• ${dateLabel} · ${label} - ${amount}`;
    });

    return lines.join('\n');
  }

  get503020Breakdown(accountId: number): Debit503020Breakdown {
    const cached = this.breakdown503020ByAccount.get(accountId);
    if (cached) return cached;

    const recurring = this.recurringTransactions.filter((rt) => {
      const rtAccountId =
        typeof rt.accountId === 'string'
          ? parseInt(rt.accountId)
          : rt.accountId;
      return rtAccountId === accountId && rt.isActive === 1;
    });

    const now = new Date();
    const schedules = this.buildSchedulesForMonth(
      recurring,
      now.getFullYear(),
      now.getMonth(),
    );

    const items: Debit503020Item[] = DEBIT_503020_LIST.map((cfg) => ({
      id: cfg.id,
      name: cfg.name,
      amount: 0,
      percent: 0,
      details: [],
    }));
    const detailsByBucket = new Map<number, Map<string, Debit503020Detail>>();
    const unclassifiedBySubCategory = new Map<string, Debit503020Detail>();
    const incomeBySubCategory = new Map<string, Debit503020Detail>();
    let salaryBase = 0;
    let totalExpenses = 0;
    let unclassifiedAmount = 0;

    const addDetail = (
      target: Map<string, Debit503020Detail>,
      recurringTransaction: RecurringTransaction,
      amount: number,
    ) => {
      const rawSubCategoryId = recurringTransaction.subCategoryId;
      const subCategoryId =
        typeof rawSubCategoryId === 'string'
          ? parseInt(rawSubCategoryId, 10)
          : (rawSubCategoryId ?? null);
      const key = subCategoryId === null ? 'none' : String(subCategoryId);
      const current = target.get(key);
      if (current) {
        current.amount += amount;
        current.occurrences += 1;
        return;
      }
      const subCategoryLabel = this.getSubCategoryOnlyLabel(subCategoryId);
      target.set(key, {
        subCategoryId,
        label:
          subCategoryLabel && subCategoryLabel !== '-'
            ? subCategoryLabel
            : 'Sans sous-catégorie',
        amount,
        occurrences: 1,
      });
    };

    schedules.forEach(({ recurring: rt }) => {
      const flowId =
        typeof rt.financialFlowId === 'string'
          ? parseInt(rt.financialFlowId, 10)
          : rt.financialFlowId;
      const rawAmount =
        typeof rt.amount === 'string' ? parseFloat(rt.amount) : rt.amount || 0;
      const amount = Math.abs(rawAmount);
      if (flowId === 1) {
        salaryBase += amount;
        addDetail(incomeBySubCategory, rt, amount);
        return;
      }
      if (flowId !== 2) return;

      totalExpenses += amount;
      const bucketId = Number((rt as any).debit503020) || 0;
      const bucket = items.find((item) => item.id === bucketId);
      if (!bucket) {
        unclassifiedAmount += amount;
        addDetail(unclassifiedBySubCategory, rt, amount);
        return;
      }

      bucket.amount += amount;
      if (!detailsByBucket.has(bucket.id)) {
        detailsByBucket.set(bucket.id, new Map());
      }
      addDetail(detailsByBucket.get(bucket.id)!, rt, amount);
    });

    items.forEach((item) => {
      item.percent =
        salaryBase > 0 ? Math.round((item.amount / salaryBase) * 100) : 0;
      item.details = Array.from(
        detailsByBucket.get(item.id)?.values() || [],
      ).sort((a, b) => b.amount - a.amount);
    });

    const remaining = salaryBase - totalExpenses;
    const remainingPercent =
      salaryBase > 0 ? Math.round((remaining / salaryBase) * 100) : 0;

    const breakdown = {
      total: salaryBase,
      incomeDetails: Array.from(incomeBySubCategory.values()).sort(
        (a, b) => b.amount - a.amount,
      ),
      totalExpenses,
      items,
      unclassifiedAmount,
      unclassifiedDetails: Array.from(unclassifiedBySubCategory.values()).sort(
        (a, b) => b.amount - a.amount,
      ),
      remaining,
      remainingPercent,
    };
    this.breakdown503020ByAccount.set(accountId, breakdown);
    return breakdown;
  }

  getBudgetTrendStats(accountId: number): BudgetTrendStat[] {
    return this.budgetTrendStatsByAccount.get(accountId) || [];
  }

  private buildBudgetTrendStats(accountId: number): BudgetTrendStat[] {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const currentDay = today.getDate();
    const currentExpenses = new Map<string, number>();
    const historyExpenses = new Map<string, number>();
    let currentExpenseTotal = 0;
    let currentIncomeTotal = 0;

    const historyMonths = Array.from({ length: 3 }, (_, index) => {
      const date = new Date(currentYear, currentMonth - index - 1, 1);
      return { month: date.getMonth(), year: date.getFullYear() };
    });

    this.transactions.forEach((transaction) => {
      const transactionAccountId =
        typeof transaction.accountId === 'string'
          ? parseInt(transaction.accountId, 10)
          : transaction.accountId;
      if (transactionAccountId !== accountId || !transaction.date) return;

      const date = new Date(transaction.date);
      if (Number.isNaN(date.getTime()) || date.getDate() > currentDay) return;
      const flowId =
        typeof transaction.financialFlowId === 'string'
          ? parseInt(transaction.financialFlowId, 10)
          : transaction.financialFlowId;
      const amount = this.getAmountNumber(transaction);
      const rawLabel = this.getSubCategoryOnlyLabel(transaction.subCategoryId);
      const label = rawLabel && rawLabel !== '-' ? rawLabel : 'Autres';
      const isCurrentMonth =
        date.getMonth() === currentMonth && date.getFullYear() === currentYear;

      if (isCurrentMonth) {
        if (flowId === 1) currentIncomeTotal += amount;
        if (flowId === 2) {
          currentExpenseTotal += amount;
          currentExpenses.set(
            label,
            (currentExpenses.get(label) || 0) + amount,
          );
        }
        return;
      }

      if (
        flowId === 2 &&
        historyMonths.some(
          (period) =>
            period.month === date.getMonth() &&
            period.year === date.getFullYear(),
        )
      ) {
        historyExpenses.set(label, (historyExpenses.get(label) || 0) + amount);
      }
    });

    const historyAverageTotal =
      Array.from(historyExpenses.values()).reduce(
        (sum, amount) => sum + amount,
        0,
      ) / 3;
    const totalDelta = currentExpenseTotal - historyAverageTotal;
    const totalDeltaPercent =
      historyAverageTotal > 0
        ? Math.round((totalDelta / historyAverageTotal) * 100)
        : null;

    const categoryChanges = new Set([
      ...currentExpenses.keys(),
      ...historyExpenses.keys(),
    ]);
    const changes = Array.from(categoryChanges).map((label) => {
      const current = currentExpenses.get(label) || 0;
      const average = (historyExpenses.get(label) || 0) / 3;
      return { label, current, average, delta: current - average };
    });
    const increase = [...changes].sort((a, b) => b.delta - a.delta)[0];
    const decrease = [...changes].sort((a, b) => a.delta - b.delta)[0];
    const margin = currentIncomeTotal - currentExpenseTotal;

    return [
      {
        icon: 'pi-wallet',
        title: 'Dépenses à date',
        value: this.formatEuroValue(currentExpenseTotal),
        detail:
          totalDeltaPercent === null
            ? 'Historique insuffisant pour comparer'
            : `${totalDeltaPercent >= 0 ? '+' : ''}${totalDeltaPercent}% vs moyenne des 3 mois précédents`,
        tone:
          totalDelta > 0 ? 'negative' : totalDelta < 0 ? 'positive' : 'neutral',
      },
      this.buildCategoryTrendStat(increase, true),
      this.buildCategoryTrendStat(decrease, false),
      {
        icon: margin >= 0 ? 'pi-arrow-up-right' : 'pi-arrow-down-right',
        title: 'Marge réalisée du mois',
        value: this.formatEuroValue(margin),
        detail: `${this.formatEuroValue(currentIncomeTotal)} de revenus · ${this.formatEuroValue(currentExpenseTotal)} de dépenses`,
        tone: margin >= 0 ? 'positive' : 'negative',
      },
    ];
  }

  private buildCategoryTrendStat(
    change:
      | { label: string; current: number; average: number; delta: number }
      | undefined,
    isIncrease: boolean,
  ): BudgetTrendStat {
    const isMeaningful =
      change && (isIncrease ? change.delta > 10 : change.delta < -10);
    if (!isMeaningful || !change) {
      return {
        icon: isIncrease ? 'pi-arrow-up' : 'pi-arrow-down',
        title: isIncrease ? 'Plus forte hausse' : 'Plus forte baisse',
        value: 'Aucune variation',
        detail: 'Pas de changement significatif à même date',
        tone: 'neutral',
      };
    }

    return {
      icon: isIncrease ? 'pi-arrow-up' : 'pi-arrow-down',
      title: isIncrease ? 'Plus forte hausse' : 'Plus forte baisse',
      value: change.label,
      detail: `${isIncrease ? '+' : '-'}${this.formatEuroValue(Math.abs(change.delta))} · ${this.formatEuroValue(change.current)} vs ${this.formatEuroValue(change.average)} habituellement`,
      tone: isIncrease ? 'negative' : 'positive',
    };
  }

  private getNextMonthCoverage(
    accountBalance: AccountBalance,
  ): CoverageSummary {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const soldeFinMois = accountBalance.upcomingSchedules
      .filter((schedule) =>
        this.isSameMonth(schedule.dueDate, currentMonth, currentYear),
      )
      .reduce(
        (sum, schedule) => sum + schedule.amount,
        accountBalance.currentBalance,
      );

    const depensesDebutMoisSuivant = accountBalance.upcomingSchedules
      .filter(
        (schedule) =>
          this.isInFirstTwoDaysOfNextMonth(
            schedule.dueDate,
            currentMonth,
            currentYear,
          ) && schedule.amount < 0,
      )
      .reduce((sum, schedule) => sum + Math.abs(schedule.amount), 0);

    const marge = soldeFinMois - depensesDebutMoisSuivant;

    return { soldeFinMois, depensesDebutMoisSuivant, marge };
  }

  private isSameMonth(date: Date, month: number, year: number): boolean {
    const target = new Date(date);
    return target.getMonth() === month && target.getFullYear() === year;
  }

  private isInFirstTwoDaysOfNextMonth(
    date: Date,
    month: number,
    year: number,
  ): boolean {
    const target = new Date(date);
    const nextMonth = (month + 1) % 12;
    const yearOffset = month === 11 ? 1 : 0;
    return (
      target.getFullYear() === year + yearOffset &&
      target.getMonth() === nextMonth &&
      target.getDate() <= 2
    );
  }

  private formatEuroValue(value: number): string {
    const formatted = value.toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${formatted} \u20AC`;
  }

  private normalizeLabel(label: string): string {
    return (label || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  getRecurringLabelWithCountdown(recurring: RecurringTransaction): string {
    const progress = this.getInstallmentProgressInfo(recurring);
    if (!progress) {
      return recurring.label;
    }
    if (progress.remaining <= 0) {
      return `${recurring.label} (termine)`;
    }
    return `${recurring.label} (reste ${progress.remaining}/${progress.total})`;
  }

  private getInstallmentProgressInfo(recurring: RecurringTransaction) {
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
    const completed = this.transactions.filter((tx) => {
      const txRecurringId = this.getRecurringTransactionId(
        tx.recurringTransactionId,
      );
      return txRecurringId === recurring.id;
    }).length;
    const boundedCompleted = Math.min(completed, total);
    return {
      total,
      completed: boundedCompleted,
      remaining: Math.max(total - boundedCompleted, 0),
    };
  }

  getTotalExpenses(categories: CategoryTotal[]): number {
    return categories.reduce((sum, cat) => sum + cat.total, 0);
  }

  getTotalIncomes(categories: CategoryTotal[]): number {
    return categories.reduce((sum, cat) => sum + cat.total, 0);
  }
}
