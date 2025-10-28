import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TransactionService } from '../../services/transaction.service';
import { RecurringTransactionService } from '../../services/recurring-transaction.service';
import { AccountService } from '../../services/account.service';
import { SubCategoryService } from '../../services/sub-category.service';
import { Transaction } from '../../models/transaction.model';
import { RecurringTransaction } from '../../models/recurring-transaction.model';
import { Account } from '../../models/account.model';
import { Subscription } from 'rxjs';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';


interface UpcomingSchedule {
  recurringTransaction: RecurringTransaction;
  dueDate: Date;
  amount: number;
  subCategoryLabel?: string;
}

interface CategoryTotal {
  categoryLabel: string;
  total: number;
  color: string;
  icon: string;
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
  imports: [ CommonModule, CardModule, TableModule, TagModule, ButtonModule ],
  templateUrl: './home.component.html',
  styleUrls: [ './home.component.css' ]
})
export class HomeComponent implements OnInit, OnDestroy {
  transactions: Transaction[] = [];
  recurringTransactions: RecurringTransaction[] = [];
  accounts: Account[] = [];
  accountBalances: AccountBalance[] = [];
  initialBalances: Map<number, number> = new Map();
  subCategories: Map<number, string> = new Map(); // Map subCategoryId -> label
  private subscriptions = new Subscription();
  expandedSchedules: Set<number> = new Set(); // Track which account schedules are expanded
  expandedExpenses: Set<number> = new Set(); // Track which account expenses are expanded
  expandedIncomes: Set<number> = new Set(); // Track which account incomes are expanded
  private subCategoriesLoaded = false; // Flag pour savoir si les sous-catégories sont chargées

  constructor(
    private transactionService: TransactionService,
    private recurringTransactionService: RecurringTransactionService,
    private accountService: AccountService,
    private subCategoryService: SubCategoryService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Charger les sous-catégories EN PREMIER
    this.subscriptions.add(
      this.subCategoryService.subCategories$.subscribe({
        next: (subCats) => {
          console.log('SubCategories received:', subCats);
          this.subCategories.clear(); // Vider avant de remplir
          subCats.forEach(sc => {
            this.subCategories.set(sc.id!, `${sc.categoryLabel} - ${sc.label}`);
          });
          console.log('SubCategories Map after update:', Array.from(this.subCategories.entries()));
          this.subCategoriesLoaded = true;
          this.calculateAllBalances();
        }
      })
    );

    // Déclencher le chargement des sous-catégories
    this.subCategoryService.getSubCategories().subscribe();

    // Charger les comptes
    this.subscriptions.add(
      this.accountService.accounts$.subscribe({
        next: (accounts) => {
          this.accounts = accounts;
          this.calculateAllBalances();
        }
      })
    );

    // Charger les transactions
    this.subscriptions.add(
      this.transactionService.transactions$.subscribe({
        next: (data) => {
          this.transactions = data;
          this.calculateAllBalances();
        }
      })
    );

    // Charger les échéances
    this.subscriptions.add(
      this.recurringTransactionService.recurringTransactions$.subscribe({
        next: (data) => {
          this.recurringTransactions = data;
          this.calculateAllBalances();
        }
      })
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

    this.accountBalances = this.accounts.map(account => {
      const accountId = account.id!;
      const initialBalance = account.initialBalance || 0;
      const currentBalance = this.calculateCurrentBalance(accountId, initialBalance);
      const upcomingSchedules = this.getUpcomingSchedules(accountId);
      const totalUpcoming = upcomingSchedules.reduce((sum, s) => sum + s.amount, 0);
      const forecastBalance = currentBalance + totalUpcoming;
      const nextMonthLowestBalance = this.calculateNextMonthLowestBalance(accountId, currentBalance);

      return {
        account,
        initialBalance,
        currentBalance,
        forecastBalance,
        upcomingSchedules,
        totalUpcoming,
        expensesByCategory: this.getExpensesByCategory(accountId),
        incomesByCategory: this.getIncomesByCategory(accountId),
        nextMonthLowestBalance
      };
    });
  }

  calculateCurrentBalance(accountId: number, initialBalance: number): number {
    const accountTransactions = this.transactions.filter(t => {
      const tAccountId = typeof t.accountId === 'string' ? parseInt(t.accountId) : t.accountId;
      return tAccountId === accountId;
    });

    const totalTransactions = accountTransactions.reduce((sum, transaction) => {
      return sum + this.getSignedAmount(transaction);
    }, 0);

    return initialBalance + totalTransactions;
  }

  isRecurringRealizedThisMonth(recurringId: number): boolean {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return this.transactions.some(t => {
      const transactionDate = new Date(t.date!);
      return t.recurringTransactionId === recurringId &&
             transactionDate.getMonth() === currentMonth &&
             transactionDate.getFullYear() === currentYear;
    });
  }

  calculateNextMonthLowestBalance(accountId: number, currentBalance: number): number {
    const today = new Date();
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const daysUntilEndOfMonth = endOfMonth.getDate() - today.getDate();

    // Ne calculer que si on est à 5 jours ou moins de la fin du mois
    if (daysUntilEndOfMonth > 5) {
      return 0;
    }

    // 1. Calculer le solde à la fin du mois en cours
    const remainingSchedulesThisMonth = this.getUpcomingSchedules(accountId, false); // false = ne pas anticiper
    const remainingAmountThisMonth = remainingSchedulesThisMonth.reduce((sum, s) => sum + s.amount, 0);
    const balanceAtEndOfMonth = currentBalance + remainingAmountThisMonth;

    // 2. Calculer l'impact des 5 premiers jours du mois suivant
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const accountRecurring = this.recurringTransactions.filter(rt => {
      const rtAccountId = typeof rt.accountId === 'string' ? parseInt(rt.accountId) : rt.accountId;
      return rtAccountId === accountId && rt.isActive === 1;
    });

    let lowestBalanceNextMonth = balanceAtEndOfMonth;
    let projectedBalance = balanceAtEndOfMonth;

    for (let day = 1; day <= 5; day++) {
      // Récupérer TOUTES les échéances pour le jour 'day' (dépenses ET revenus)
      const schedulesForDay = accountRecurring.filter(rt => {
        const dayOfMonth = typeof rt.dayOfMonth === 'string' ? parseInt(rt.dayOfMonth) : (rt.dayOfMonth || 0);
        return dayOfMonth === day;
      });

      // Calculer l'impact net de la journée
      const netChangeForDay = schedulesForDay.reduce((sum, rt) => {
        const amount = typeof rt.amount === 'string' ? parseFloat(rt.amount) : (rt.amount || 0);
        const signedAmount = rt.financialFlowId === 2 ? -Math.abs(amount) : Math.abs(amount);
        return sum + signedAmount;
      }, 0);

      projectedBalance += netChangeForDay;

      if (projectedBalance < lowestBalanceNextMonth) {
        lowestBalanceNextMonth = projectedBalance;
      }
    }

    // L'alerte est déclenchée si le point le plus bas est négatif
    if (lowestBalanceNextMonth < 0) {
      console.log(`ALERTE Compte ${accountId}: Solde négatif de ${lowestBalanceNextMonth.toFixed(2)}€ prévu début de mois prochain.`);
      return lowestBalanceNextMonth;
    }

    return 0;
  }

  getUpcomingSchedules(accountId: number, anticipate: boolean = true): UpcomingSchedule[] {
    const today = new Date();
    let anticipateNextMonth = false;

    // La logique d'anticipation ne s'applique que si l'argument `anticipate` est vrai
    if (anticipate) {
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      anticipateNextMonth = (endOfMonth.getDate() - today.getDate()) <= 5;
    }

    const accountRecurring = this.recurringTransactions.filter(rt => {
      const rtAccountId = typeof rt.accountId === 'string' ? parseInt(rt.accountId) : rt.accountId;
      return rtAccountId === accountId && rt.isActive === 1;
    });

    const schedules: UpcomingSchedule[] = [];

    accountRecurring.forEach(recurring => {
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      const currentDay = today.getDate();

      const dayOfMonth = typeof recurring.dayOfMonth === 'string'
        ? parseInt(recurring.dayOfMonth)
        : (recurring.dayOfMonth || 0);

      // Gérer les échéances du mois en cours
      const isRealizedThisMonth = this.isRecurringRealizedThisMonth(recurring.id!);
      if (dayOfMonth > currentDay && !isRealizedThisMonth) {
        const dueDate = new Date(currentYear, currentMonth, dayOfMonth);
        this.addSchedule(schedules, recurring, dueDate);
      }

      // Si on anticipe, ajouter aussi les échéances du mois suivant
      if (anticipateNextMonth) {
        const nextMonth = new Date(currentYear, currentMonth + 1, dayOfMonth);
        // On vérifie qu'une transaction n'a pas déjà été faite pour le mois prochain
        const isRealizedNextMonth = this.transactions.some(t => {
            const transactionDate = new Date(t.date!);
            return t.recurringTransactionId === recurring.id! &&
                   transactionDate.getMonth() === nextMonth.getMonth() &&
                   transactionDate.getFullYear() === nextMonth.getFullYear();
        });

        if (!isRealizedNextMonth) {
          this.addSchedule(schedules, recurring, nextMonth);
        }
      }
    });

    return schedules.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }

  private addSchedule(schedules: UpcomingSchedule[], recurring: RecurringTransaction, dueDate: Date): void {
    const amount = typeof recurring.amount === 'string' ? parseFloat(recurring.amount) : (recurring.amount || 0);
    const signedAmount = recurring.financialFlowId === 2 ? -Math.abs(amount) : Math.abs(amount);
    schedules.push({
      recurringTransaction: recurring,
      dueDate,
      amount: signedAmount,
      subCategoryLabel: this.subCategories.get(recurring.subCategoryId!) || 'N/A'
    });
  }

  getExpensesByCategory(accountId: number): CategoryTotal[] {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const expenses = this.transactions.filter(t => {
      const tAccountId = typeof t.accountId === 'string' ? parseInt(t.accountId) : t.accountId;
      const flowId = typeof t.financialFlowId === 'string' ? parseInt(t.financialFlowId) : t.financialFlowId;

      // Filtrer par compte, type de flux (dépense) et mois en cours
      if (tAccountId !== accountId || flowId !== 2) {
        return false;
      }

      const transactionDate = new Date(t.date!);
      return transactionDate.getMonth() === currentMonth && transactionDate.getFullYear() === currentYear;
    });

    const categoryMap = new Map<string, number>();

    expenses.forEach(t => {
      // Convertir subCategoryId en nombre si c'est une chaîne
      const subCatId = typeof t.subCategoryId === 'string' ? parseInt(t.subCategoryId) : t.subCategoryId;

      // Récupérer le label complet de la sous-catégorie
      const fullLabel = this.subCategories.get(subCatId!);

      // Extraire uniquement la catégorie (avant le ' - ')
      let categoryLabel = 'Autres';
      if (fullLabel && fullLabel.includes(' - ')) {
        categoryLabel = fullLabel.split(' - ')[0];
      }

      const amount = typeof t.amount === 'string' ? parseFloat(t.amount) : t.amount;
      categoryMap.set(categoryLabel, (categoryMap.get(categoryLabel) || 0) + Math.abs(amount || 0));
    });

    const categories: CategoryTotal[] = [];
    categoryMap.forEach((total, label) => {
      // Ne garder que les catégories avec un montant > 0
      if (total > 0) {
        categories.push({
          categoryLabel: label,
          total,
          color: this.getCategoryColor(label),
          icon: this.getCategoryIcon(label)
        });
      }
    });

    return categories.sort((a, b) => b.total - a.total);
  }

  getIncomesByCategory(accountId: number): CategoryTotal[] {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const incomes = this.transactions.filter(t => {
      const tAccountId = typeof t.accountId === 'string' ? parseInt(t.accountId) : t.accountId;
      const flowId = typeof t.financialFlowId === 'string' ? parseInt(t.financialFlowId) : t.financialFlowId;

      // Filtrer par compte, type de flux (revenu) et mois en cours
      if (tAccountId !== accountId || flowId !== 1) {
        return false;
      }

      const transactionDate = new Date(t.date!);
      return transactionDate.getMonth() === currentMonth && transactionDate.getFullYear() === currentYear;
    });

    const categoryMap = new Map<string, number>();

    incomes.forEach(t => {
      // Convertir subCategoryId en nombre si c'est une chaîne
      const subCatId = typeof t.subCategoryId === 'string' ? parseInt(t.subCategoryId) : t.subCategoryId;

      // Récupérer le label complet de la sous-catégorie
      const fullLabel = this.subCategories.get(subCatId!);

      // Extraire uniquement la catégorie (avant le ' - ')
      let categoryLabel = 'Autres';
      if (fullLabel && fullLabel.includes(' - ')) {
        categoryLabel = fullLabel.split(' - ')[0];
      }

      const amount = typeof t.amount === 'string' ? parseFloat(t.amount) : t.amount;
      categoryMap.set(categoryLabel, (categoryMap.get(categoryLabel) || 0) + Math.abs(amount || 0));
    });

    const categories: CategoryTotal[] = [];
    categoryMap.forEach((total, label) => {
      // Ne garder que les catégories avec un montant > 0
      if (total > 0) {
        categories.push({
          categoryLabel: label,
          total,
          color: this.getCategoryColor(label),
          icon: this.getCategoryIcon(label)
        });
      }
    });

    return categories.sort((a, b) => b.total - a.total);
  }

  getCategoryColor(category: string): string {
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
    return colors[category] || '#6b7280';
  }

  getCategoryIcon(category: string): string {
    const icons: { [key: string]: string } = {
      'Salaires': 'pi-money-bill',
      'Quotidien': 'pi-shopping-cart',
      'Habitation': 'pi-home',
      'Transports': 'pi-car',
      'Divertissements': 'pi-star',
      'Santé': 'pi-heart',
      'Dettes': 'pi-credit-card',
      'Epargne': 'pi-wallet',
      'Fournisseurs': 'pi-bolt'
    };
    return icons[category] || 'pi-tag';
  }

  private getSignedAmount(transaction: Transaction): number {
    const amount = typeof transaction.amount === 'string'
      ? parseFloat(transaction.amount)
      : (transaction.amount || 0);

    const financialFlowId = typeof transaction.financialFlowId === 'string'
      ? parseInt(transaction.financialFlowId)
      : (transaction.financialFlowId || 0);

    return financialFlowId === 2 ? -Math.abs(amount) : Math.abs(amount);
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

  getTotalExpenses(categories: CategoryTotal[]): number {
    return categories.reduce((sum, cat) => sum + cat.total, 0);
  }

  getTotalIncomes(categories: CategoryTotal[]): number {
    return categories.reduce((sum, cat) => sum + cat.total, 0);
  }
}
