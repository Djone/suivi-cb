import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TransactionService } from '../../services/transaction.service';
import { RecurringTransactionService } from '../../services/recurring-transaction.service';
import { AccountService } from '../../services/account.service';
import { Transaction } from '../../models/transaction.model';
import { RecurringTransaction } from '../../models/recurring-transaction.model';
import { Account } from '../../models/account.model';
import { Subscription } from 'rxjs';

interface AccountBalance {
  account: Account;
  initialBalance: number;
  currentBalance: number;
  forecastBalance: number;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [ CommonModule ],
  templateUrl: './home.component.html',
  styleUrls: [ './home.component.css' ]
})
export class HomeComponent implements OnInit, OnDestroy {
  transactions: Transaction[] = [];
  recurringTransactions: RecurringTransaction[] = [];
  accounts: Account[] = [];
  accountBalances: AccountBalance[] = [];
  private subscriptions = new Subscription();

  constructor(
    private transactionService: TransactionService,
    private recurringTransactionService: RecurringTransactionService,
    private accountService: AccountService,
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    // Charger les comptes
    this.subscriptions.add(
      this.accountService.accounts$.subscribe({
        next: (accounts) => {
          this.accounts = accounts;
          console.log('HOME : Comptes chargés', accounts);
          this.calculateAllBalances();
        },
        error: (err) => console.error('HOME : Erreur lors du chargement des comptes:', err)
      })
    );

    // Charger toutes les transactions
    this.subscriptions.add(
      this.transactionService.transactions$.subscribe({
        next: (data) => {
          this.transactions = data;
          console.log('HOME : Transactions chargées', data);
          this.calculateAllBalances();
        },
        error: (err) => console.error('HOME : Erreur lors du chargement des transactions:', err)
      })
    );

    // Charger les échéances récurrentes
    this.subscriptions.add(
      this.recurringTransactionService.recurringTransactions$.subscribe({
        next: (data) => {
          this.recurringTransactions = data;
          console.log('HOME : Échéances chargées', data);
          this.calculateAllBalances();
        },
        error: (err) => console.error('HOME : Erreur lors du chargement des échéances:', err)
      })
    );

    // Charger les données initiales
    this.transactionService.clearFiltersTransactions();
    this.recurringTransactionService.getRecurringTransactions().subscribe();
    this.accountService.getAccounts().subscribe();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // Calculer tous les soldes pour tous les comptes
  calculateAllBalances(): void {
    if (!this.accounts.length) return;

    this.accountBalances = this.accounts.map(account => {
      const accountId = account.id!;

      // Récupérer le solde initial depuis la configuration
      let initialBalance = 0;

      // TODO: Charger le solde initial depuis la config API
      // Pour l'instant, utiliser l'ancienne config pour le compte 1
      if (accountId === 1) {
        this.http.get<any>('http://localhost:3000/api/config/account').subscribe({
          next: (config) => {
            initialBalance = config.initialBalance || 0;
            this.updateAccountBalance(accountId, initialBalance);
          }
        });
      }

      const currentBalance = this.calculateCurrentBalance(accountId, initialBalance);
      const forecastBalance = this.calculateForecastBalance(accountId, currentBalance);

      return {
        account,
        initialBalance,
        currentBalance,
        forecastBalance
      };
    });
  }

  // Mettre à jour le solde d'un compte spécifique
  private updateAccountBalance(accountId: number, initialBalance: number): void {
    const index = this.accountBalances.findIndex(ab => ab.account.id === accountId);
    if (index !== -1) {
      this.accountBalances[index].initialBalance = initialBalance;
      this.accountBalances[index].currentBalance = this.calculateCurrentBalance(accountId, initialBalance);
      this.accountBalances[index].forecastBalance = this.calculateForecastBalance(
        accountId,
        this.accountBalances[index].currentBalance
      );
    }
  }

  // Calculer le solde actuel d'un compte
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

  // Calculer le solde prévisionnel d'un compte
  calculateForecastBalance(accountId: number, currentBalance: number): number {
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Filtrer les transactions réalisées ce mois pour ce compte
    const realizedRecurringThisMonth = this.transactions.filter(t => {
      if (!t.recurringTransactionId) return false;

      const tAccountId = typeof t.accountId === 'string' ? parseInt(t.accountId) : t.accountId;
      if (tAccountId !== accountId) return false;

      const transDate = new Date(t.date || '');
      return transDate.getMonth() === currentMonth &&
             transDate.getFullYear() === currentYear;
    });

    // Compteur d'occurrences réalisées par échéance
    const realizedOccurrences = new Map<number, number>();
    realizedRecurringThisMonth.forEach(t => {
      const recurringId = typeof t.recurringTransactionId === 'string'
        ? parseInt(t.recurringTransactionId)
        : t.recurringTransactionId;
      if (recurringId) {
        realizedOccurrences.set(recurringId, (realizedOccurrences.get(recurringId) || 0) + 1);
      }
    });

    // Filtrer les échéances pour ce compte
    const accountRecurring = this.recurringTransactions.filter(rt => {
      const rtAccountId = typeof rt.accountId === 'string' ? parseInt(rt.accountId) : rt.accountId;
      return rtAccountId === accountId && rt.isActive === 1;
    });

    const monthlyRecurringTotal = accountRecurring.reduce((sum, recurring) => {
      const frequency = recurring.frequency || 'monthly';

      // Pour les échéances hebdomadaires
      if (frequency === 'weekly') {
        const targetDayOfWeek = typeof recurring.dayOfMonth === 'string'
          ? parseInt(recurring.dayOfMonth)
          : recurring.dayOfMonth;

        const targetDayJS = targetDayOfWeek === 7 ? 0 : targetDayOfWeek;
        const lastDayOfMonth = new Date(today.getFullYear(), currentMonth + 1, 0).getDate();
        let occurrences = 0;

        for (let day = currentDay + 1; day <= lastDayOfMonth; day++) {
          const testDate = new Date(today.getFullYear(), currentMonth, day);
          if (testDate.getDay() === targetDayJS) {
            occurrences++;
          }
        }

        const realized = realizedOccurrences.get(recurring.id!) || 0;
        const remainingOccurrences = Math.max(0, occurrences - realized);

        if (remainingOccurrences === 0) {
          return sum;
        }

        const amount = typeof recurring.amount === 'string'
          ? parseFloat(recurring.amount)
          : (recurring.amount || 0);

        const totalAmount = amount * remainingOccurrences;

        if (recurring.financialFlowId === 2) {
          return sum - Math.abs(totalAmount);
        }
        return sum + Math.abs(totalAmount);
      }

      // Pour les autres périodicités
      const dayOfMonth = typeof recurring.dayOfMonth === 'string'
        ? parseInt(recurring.dayOfMonth)
        : (recurring.dayOfMonth || 0);

      if (dayOfMonth <= currentDay) {
        return sum;
      }

      if (frequency !== 'monthly') {
        const shouldApply = this.shouldApplyRecurring(frequency, currentMonth);
        if (!shouldApply) {
          return sum;
        }
      }

      // Vérifier si déjà réalisée
      const realized = realizedOccurrences.get(recurring.id!) || 0;
      if (realized > 0) {
        return sum;
      }

      const amount = typeof recurring.amount === 'string'
        ? parseFloat(recurring.amount)
        : (recurring.amount || 0);

      if (recurring.financialFlowId === 2) {
        return sum - Math.abs(amount);
      }

      return sum + Math.abs(amount);
    }, 0);

    return currentBalance + monthlyRecurringTotal;
  }

  // Vérifier si une échéance doit être appliquée selon sa périodicité
  private shouldApplyRecurring(frequency: string, currentMonth: number): boolean {
    const monthsSinceJanuary = currentMonth;

    switch (frequency) {
      case 'monthly': return true;
      case 'bimonthly': return monthsSinceJanuary % 2 === 0;
      case 'quarterly': return monthsSinceJanuary % 3 === 0;
      case 'biannual': return monthsSinceJanuary % 6 === 0;
      case 'yearly': return currentMonth === 0;
      default: return true;
    }
  }

  // Obtenir le montant signé
  private getSignedAmount(transaction: Transaction): number {
    const amount = typeof transaction.amount === 'string'
      ? parseFloat(transaction.amount)
      : (transaction.amount || 0);

    const financialFlowId = typeof transaction.financialFlowId === 'string'
      ? parseInt(transaction.financialFlowId)
      : (transaction.financialFlowId || 0);

    return financialFlowId === 2 ? -Math.abs(amount) : Math.abs(amount);
  }

  // Naviguer vers la liste des transactions pour un compte
  navigateToTransactions(accountId: number): void {
    this.router.navigate(['/transactions-list', accountId]);
  }
}
