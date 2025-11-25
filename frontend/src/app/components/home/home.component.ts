import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

// Services
import { AccountService } from '../../services/account.service';
import { TransactionService } from '../../services/transaction.service';
import { RecurringTransactionService } from '../../services/recurring-transaction.service';
import { SubCategoryService } from '../../services/sub-category.service';

// Models
import { Transaction } from '../../models/transaction.model';
import { RecurringTransaction } from '../../models/recurring-transaction.model';
import { Account } from '../../models/account.model';
import { DEBIT_503020_LIST } from '../../config/debit_503020';

// PrimeNG Modules
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ChartModule } from 'primeng/chart';
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
}

interface Debit503020Breakdown {
  total: number;
  totalExpenses: number;
  items: Debit503020Item[];
  remaining: number;
  remainingPercent: number;
}

interface DashboardNotification {
  severity: 'info' | 'warn' | 'danger';
  text: string;
  tooltip?: string;
  type?: string;
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
    ChartModule,
    DynamicDialogModule,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnInit, OnDestroy {
  transactions: Transaction[] = [];
  recurringTransactions: RecurringTransaction[] = [];
  accounts: Account[] = [];
  accountBalances: AccountBalance[] = [];
  activeAccountId: number | null = null;
  initialBalances: Map<number, number> = new Map();
  subCategories: Map<number, string> = new Map(); // Map subCategoryId -> label
  private subscriptions = new Subscription();
  expandedSchedules: Set<number> = new Set(); // Track which account schedules are expanded
  expandedExpenses: Set<number> = new Set(); // Track which account expenses are expanded
  expandedIncomes: Set<number> = new Set(); // Track which account incomes are expanded
  stackedBarOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: { beginAtZero: true },
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: string | number) =>
            `${Number(value).toLocaleString('fr-FR')} \u20AC`,
        },
      },
    },
  };
  private subCategoriesLoaded = false; // Flag pour savoir si les sous-catégories sont chargées

  constructor(
    private transactionService: TransactionService,
    private recurringTransactionService: RecurringTransactionService,
    private accountService: AccountService,
    private subCategoryService: SubCategoryService,
    private router: Router,
    private dialogService: DialogService,
  ) {}

  ngOnInit(): void {
    // Charger les sous-catégories EN PREMIER
    this.subscriptions.add(
      this.subCategoryService.subCategories$.subscribe({
        next: (subCats) => {
          this.subCategories.clear(); // Vider avant de remplir
          subCats.forEach((sc) => {
            this.subCategories.set(sc.id!, `${sc.categoryLabel}`);
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
    if (!this.accounts.length) return;

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

  isRecurringRealized(
    recurring: RecurringTransaction,
    nextDueDate: Date,
  ): boolean {
    // Simplification : on vérifie si une transaction correspondante existe pour le mois de l'échéance, peu importe le jour.
    const targetMonth = nextDueDate.getMonth();
    const targetYear = nextDueDate.getFullYear();

    // On cherche une transaction qui correspond à l'échéance et qui a été effectuée durant le même mois et la même année.
    return this.transactions.some((t) => {
      if (t.recurringTransactionId !== recurring.id) {
        return false;
      }
      const transactionDate = new Date(t.date!);
      return (
        transactionDate.getMonth() === targetMonth &&
        transactionDate.getFullYear() === targetYear
      );
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

    for (let day = 1; day <= 5; day++) {
      const currentDate = new Date(
        nextMonthDate.getFullYear(),
        nextMonthDate.getMonth(),
        day,
      );
      const currentDayOfWeekJS = currentDate.getDay(); // 0=Dim, 1=Lun, ...

      // Récupérer TOUTES les échéances pour le jour 'day'
      const schedulesForDay = accountRecurring.filter((rt) => {
        // @ts-ignore
        if (rt.frequency === 'weekly') {
          const dayOfWeek =
            typeof rt.dayOfMonth === 'string'
              ? parseInt(rt.dayOfMonth)
              : rt.dayOfMonth || 0;
          if (dayOfWeek < 1 || dayOfWeek > 7) return false;
          const targetDayOfWeekJS = dayOfWeek % 7;
          return targetDayOfWeekJS === currentDayOfWeekJS;
        }

        // Logique pour les échéances mensuelles (et autres basées sur le jour du mois)
        const dayOfMonth =
          typeof rt.dayOfMonth === 'string'
            ? parseInt(rt.dayOfMonth)
            : rt.dayOfMonth || 0;
        return dayOfMonth === day;
      });

      // Calculer l'impact net de la journée
      const netChangeForDay = schedulesForDay.reduce((sum, rt) => {
        const amount =
          typeof rt.amount === 'string'
            ? parseFloat(rt.amount)
            : rt.amount || 0;
        const signedAmount =
          rt.financialFlowId === 2 ? -Math.abs(amount) : Math.abs(amount);
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

  private shouldApplyRecurring(frequency: string, month: number): boolean {
    const monthIndex = month; // 0 for January, 1 for February, etc.
    switch (frequency) {
      case 'monthly':
      case 'weekly':
        return true;
      case 'bimonthly':
        return monthIndex % 2 === 0; // Jan, Mar, May...
      case 'quarterly':
        return monthIndex % 3 === 0; // Jan, Apr, Jul, Oct
      case 'biannual':
        return monthIndex % 6 === 0; // Jan, Jul
      case 'yearly':
        return monthIndex === 0; // January
      default:
        return false; // Ne pas traiter les fr+�quences inconnues
    }
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
  getUpcomingSchedules(
    accountId: number,
    anticipate: boolean = true,
  ): UpcomingSchedule[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Pour comparer les dates sans l'heure
    let anticipateNextMonth = false;

    if (anticipate) {
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      anticipateNextMonth = endOfMonth.getDate() - today.getDate() <= 5;
    }

    const accountRecurring = this.recurringTransactions.filter((rt) => {
      const rtAccountId =
        typeof rt.accountId === 'string'
          ? parseInt(rt.accountId)
          : rt.accountId;
      return rtAccountId === accountId && rt.isActive === 1;
    });

    const schedules: UpcomingSchedule[] = [];

    accountRecurring.forEach((recurring) => {
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();

      // @ts-ignore - Assuming 'frequency' property will exist on the model
      const frequency = recurring.frequency || 'monthly';
      const dayOfMonth =
        typeof recurring.dayOfMonth === 'string'
          ? parseInt(recurring.dayOfMonth)
          : recurring.dayOfMonth || 0;

      // Garde-fous communs
      const activeMonths = Array.isArray(recurring.activeMonths)
        ? new Set(
            (recurring.activeMonths as number[]).filter(
              (m) => m >= 1 && m <= 12,
            ),
          )
        : null;
      const isInstallment = recurring.recurrenceKind === 'installment';

      // Boucle pour vérifier le mois en cours et le mois suivant (si anticipation)
      for (
        let monthOffset = 0;
        monthOffset <= (anticipateNextMonth ? 1 : 0);
        monthOffset++
      ) {
        const targetMonth = currentMonth + monthOffset;
        const targetYear = currentYear + Math.floor(targetMonth / 12);
        const normalizedMonth = targetMonth % 12;

        // Vérifier si la fréquence s'applique à ce mois
        if (!this.shouldApplyRecurring(frequency, normalizedMonth)) {
          continue;
        }

        if (frequency === 'weekly') {
          // Pour les échéances hebdos, on calcule toutes les occurrences du mois
          const firstDay = new Date(targetYear, normalizedMonth, 1);
          const lastDay = new Date(targetYear, normalizedMonth + 1, 0);

          for (let day = firstDay.getDate(); day <= lastDay.getDate(); day++) {
            const testDate = new Date(targetYear, normalizedMonth, day);
            const targetDayOfWeekJS = dayOfMonth % 7; // 1-6 -> 1-6, 7 -> 0
            if (testDate.getDay() === targetDayOfWeekJS) {
              // On ajoute l'échéance si elle n'est pas réalisée
              const isRealized = this.isRecurringRealized(recurring, testDate);
              const isCurrentMonth = monthOffset === 0;
              // Vérifications avancées
              if (
                isInstallment &&
                !this.isInstallmentDateValid(recurring, testDate)
              ) {
                continue;
              }
              if (activeMonths && !activeMonths.has(testDate.getMonth() + 1)) {
                continue;
              }

              if (!isRealized && isCurrentMonth) {
                this.addSchedule(schedules, recurring, testDate, today);
              }
            }
          }
        } else {
          // Pour toutes les autres fréquences basées sur le jour du mois
          const dueDate = new Date(targetYear, normalizedMonth, dayOfMonth);
          const isRealized = this.isRecurringRealized(recurring, dueDate);
          const isPast = dueDate < today;
          const isCurrentMonth = monthOffset === 0;
          // Vérifications avancées
          if (
            isInstallment &&
            !this.isInstallmentDateValid(recurring, dueDate)
          ) {
            continue;
          }
          if (activeMonths && !activeMonths.has(normalizedMonth + 1)) {
            continue;
          }

          if (!isRealized && (!isPast || isCurrentMonth)) {
            this.addSchedule(schedules, recurring, dueDate, today);
          }
        }
      }
    });

    return schedules.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }
  private addSchedule(
    schedules: UpcomingSchedule[],
    recurring: RecurringTransaction,
    dueDate: Date,
    today: Date,
  ): void {
    const amount =
      typeof recurring.amount === 'string'
        ? parseFloat(recurring.amount)
        : recurring.amount || 0;
    const signedAmount =
      recurring.financialFlowId === 2 ? -Math.abs(amount) : Math.abs(amount);
    schedules.push({
      recurringTransaction: recurring,
      dueDate,
      amount: signedAmount,
      isOverdue: dueDate < today, // Une échéance est en retard si sa date est strictement avant aujourd'hui
      subCategoryLabel:
        this.subCategories.get(recurring.subCategoryId!) || 'N/A',
    });
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
        date: new Date(),
        amount: Math.abs(schedule.amount),
        accountId: accountId,
        financialFlowId: schedule.recurringTransaction.financialFlowId,
        subCategoryId: schedule.recurringTransaction.subCategoryId || null,
        recurringTransactionId: schedule.recurringTransaction.id,
      } as any;

      this.transactionService.addTransaction(tx).subscribe();
    });
  }

  navigateToTransactions(accountId: number): void {
    this.router.navigate(['/transactions-list', accountId]);
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

    const totalExpenses = this.getTotalExpenses(
      accountBalance.expensesByCategory,
    );
    const meaningfulExpenses = accountBalance.expensesByCategory.filter(
      (cat) => this.normalizeLabel(cat.categoryLabel) !== 'autres',
    );
    if (totalExpenses > 0 && meaningfulExpenses.length > 0) {
      const topExpense = meaningfulExpenses.sort(
        (a, b) => b.total - a.total,
      )[0];
      const share = Math.min(topExpense.total, totalExpenses) / totalExpenses;
      if (share > 0.3) {
        notes.push({
          severity: 'info',
          text: `D\u00E9penses concentr\u00E9es: ${topExpense.categoryLabel} > ${(share * 100).toFixed(0)}%`,
        });
      }
    }

    const today = new Date();

    const expenseLabelsDebug = accountBalance.expensesByCategory.map((cat) => ({
      label: cat.categoryLabel,
      normalized: this.normalizeLabel(cat.categoryLabel),
    }));
    console.debug('HOME NOTIF – catégories dépenses', {
      account: accountBalance.account.name,
      labels: expenseLabelsDebug,
    });
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

  handleNotificationClick(
    note: DashboardNotification | null | undefined,
    accountId: number,
  ): void {
    if (note?.type === 'coverage') {
      this.navigateToTransactions(accountId);
    }
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
    const full = this.getSubCategoryLabel(subCategoryId);
    if (!full || full === '-') return full;
    const idx = full.indexOf(' - ');
    return idx >= 0 ? full.substring(idx + 3) : full;
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
    const recurring = this.recurringTransactions.filter((rt) => {
      const rtAccountId =
        typeof rt.accountId === 'string'
          ? parseInt(rt.accountId)
          : rt.accountId;
      return rtAccountId === accountId && rt.isActive === 1;
    });

    const salaryBase = recurring.reduce((sum, rt) => {
      if (rt.financialFlowId !== 1) {
        return sum;
      }
      const amount =
        typeof rt.amount === 'string' ? parseFloat(rt.amount) : rt.amount || 0;
      return sum + Math.abs(amount);
    }, 0);

    const totalExpenses = recurring.reduce((sum, rt) => {
      if (rt.financialFlowId !== 2) {
        return sum;
      }
      const amount =
        typeof rt.amount === 'string' ? parseFloat(rt.amount) : rt.amount || 0;
      return sum + Math.abs(amount);
    }, 0);

    const items: Debit503020Item[] = DEBIT_503020_LIST.map((cfg) => ({
      id: cfg.id,
      name: cfg.name,
      amount: 0,
      percent: 0,
    }));

    recurring.forEach((rt) => {
      if (rt.financialFlowId !== 2) {
        return;
      }
      const bucketId = (rt as any).debit503020 ?? null;
      if (!bucketId) {
        return;
      }
      const amount =
        typeof rt.amount === 'string' ? parseFloat(rt.amount) : rt.amount || 0;
      const bucket = items.find((item) => item.id === bucketId);
      if (bucket) {
        bucket.amount += Math.abs(amount);
      }
    });

    items.forEach((item) => {
      item.percent =
        salaryBase > 0 ? Math.round((item.amount / salaryBase) * 100) : 0;
    });

    const remaining = Math.max(salaryBase - totalExpenses, 0);
    const remainingPercent =
      salaryBase > 0
        ? Math.max(0, Math.round((remaining / salaryBase) * 100))
        : 0;

    return {
      total: salaryBase,
      totalExpenses,
      items,
      remaining,
      remainingPercent,
    };
  }

  getStackedBarData(accountId: number) {
    const balance = this.accountBalances.find(
      (ab) => ab.account.id === accountId,
    );
    if (!balance) {
      return { labels: [], datasets: [] };
    }

    const totalExpenses = Math.abs(
      balance.expensesByCategory.reduce(
        (sum, category) => sum + category.total,
        0,
      ),
    );
    const totalIncomes = Math.abs(
      balance.incomesByCategory.reduce(
        (sum, category) => sum + category.total,
        0,
      ),
    );

    return {
      labels: ['D\u00E9penses', 'Revenus'],
      datasets: [
        {
          label: 'Montants',
          backgroundColor: ['#ef4444', '#10b981'],
          borderColor: ['#b91c1c', '#047857'],
          borderWidth: 1,
          data: [totalExpenses, totalIncomes],
        },
      ],
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
      const txRecurringId =
        typeof tx.recurringTransactionId === 'string'
          ? parseInt(tx.recurringTransactionId, 10)
          : tx.recurringTransactionId || null;
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
