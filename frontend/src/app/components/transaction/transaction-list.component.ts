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

import { TransactionService } from '../../services/transaction.service';
import { SubCategoryService } from '../../services/sub-category.service';
import { AccountService } from '../../services/account.service';
import { RecurringTransactionService } from '../../services/recurring-transaction.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { EditTransactionDialogComponent } from '../edit-transaction-dialog/edit-transaction-dialog.component';
import { Transaction } from '../../models/transaction.model';
import { Account } from '../../models/account.model';
import { RecurringTransaction } from '../../models/recurring-transaction.model';
import { SubCategory } from '../../models/sub-category.model';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';

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
    DropdownModule 
  ],
  templateUrl: './transaction-list.component.html',
  styleUrls: ['./transaction-list.component.css', '../../styles/table-common.css']
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
  recurringTransactions: RecurringTransaction[] = [];
  sortedRecurringTransactions: RecurringTransaction[] = [];
  currentBalance: number = 0;
  forecastedBalance: number = 0;
  private subscriptions = new Subscription();
  Math = Math;

  // Filtres
  filters = {
    dateRange: null as Date[] | null,
    description: '',
    amount: ''
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
    { label: '100', value: 100 }
  ];
  totalPages = 1;


  constructor(
    private transactionService: TransactionService,
    private subCategoryService: SubCategoryService,
    private accountService: AccountService,
    private recurringTransactionService: RecurringTransactionService,
    private dialogService: DialogService,
    private messageService: MessageService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Récupérer l'accountId depuis les paramètres de route
    this.route.params.subscribe(params => {
      if (params['accountId']) {
        this.accountId = parseInt(params['accountId'], 10);
        console.log('TRANSACTION LIST : accountId depuis la route:', this.accountId);
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
        }
      })
    );

    this.accountService.getAccounts().subscribe();

    // Charger toutes les transactions
    this.subscriptions.add(
      this.transactionService.transactions$.subscribe({
        next: (data) => {
          console.log('TRANSACTION LIST : Données reçues - Total:', data.length);
          if (data.length > 0) {
            console.log('TRANSACTION LIST : Exemple de transaction:', data[0]);
          }

          // Filtrer par compte si accountId est fourni
          if (this.accountId !== null) {
            console.log('TRANSACTION LIST : Filtrage pour le compte', this.accountId);
            this.transactions = data.filter(t => {
              const tAccountId = typeof t.accountId === 'string' ? parseInt(t.accountId) : t.accountId;
              return tAccountId === this.accountId;
            });
            console.log('TRANSACTION LIST : Après filtrage:', this.transactions.length, 'transactions');
          } else {
            this.transactions = data;
          }
          this.applyFiltersAndSort();
        },
        error: (err) => console.error('TRANSACTION LIST : Erreur lors du chargement des transactions:', err)
      })
    );

    // Charger toutes les sous-catégories pour l'affichage
    this.subscriptions.add(
      this.subCategoryService.subCategories$.subscribe({
        next: (data) => {
          this.subCategories = data;
          console.log('TRANSACTION LIST : Sous-catégories chargées - Total:', data.length);
          if (this.transactions.length > 0) {
            this.applyFiltersAndSort();
          }
        },
        error: (err) => console.error('TRANSACTION LIST : Erreur lors du chargement des sous-catégories:', err)
      })
    );

    this.subCategoryService.getSubCategories().subscribe();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadTransactions(): void {
    this.transactionService.loadTransactions();
  }

  // Appliquer les filtres et le tri
  applyFiltersAndSort(): void {
    this.filteredTransactions = this.transactions.filter(transaction => {
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

      const matchDescription = !this.filters.description ||
        (transaction.description &&
          transaction.description.toLowerCase().includes(this.filters.description.toLowerCase()));

      const matchAmount = !this.filters.amount ||
        (transaction.amount !== null &&
          transaction.amount !== undefined &&
          transaction.amount.toString().includes(this.filters.amount));

      return matchDate && matchDescription && matchAmount;
    });

    this.calculateBalances();
    this.updatePagination();
  }

  clearDateFilter(): void {
    this.filters.dateRange = null;
    this.applyFilter();
  }

  allowOnlyNumbers(event: KeyboardEvent): void {
    const allowedKeys = ['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete'];
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
  getSubCategoryName(subCategoryId: number | null): string {
    if (!subCategoryId) return 'N/A';

    const id = typeof subCategoryId === 'string' ? parseInt(subCategoryId) : subCategoryId;
    const subCategory = this.subCategories.find(sc => sc.id === id);

    if (!subCategory && this.subCategories.length > 0) {
      console.log(`TRANSACTION LIST : Sous-catégorie ${id} non trouvée. Sous-catégories disponibles:`,
        this.subCategories.map(sc => sc.id));
    }

    return subCategory ? `${subCategory.categoryLabel} - ${subCategory.label}` : 'N/A';
  }

  // Obtenir le montant avec signe
  getSignedAmount(transaction: Transaction): number {
    const amount = typeof transaction.amount === 'string'
      ? parseFloat(transaction.amount)
      : (transaction.amount || 0);

    const financialFlowId = typeof transaction.financialFlowId === 'string'
      ? parseInt(transaction.financialFlowId)
      : (transaction.financialFlowId || 0);

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
    this.groupedTransactions = this.groupTransactionsByDate(this.filteredTransactions);

    // Calculer la pagination sur les groupes
    this.totalPages = Math.ceil(this.groupedTransactions.length / this.pageSize);
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.paginatedGroupedTransactions = this.groupedTransactions.slice(startIndex, endIndex);

    // Garder aussi la pagination simple pour compatibilité
    const startIndexTx = (this.currentPage - 1) * this.pageSize;
    const endIndexTx = startIndexTx + this.pageSize;
    this.paginatedTransactions = this.filteredTransactions.slice(startIndexTx, endIndexTx);
  }

  groupTransactionsByDate(transactions: Transaction[]): GroupedTransactions[] {
    const grouped = new Map<string, TransactionWithLabel[]>();

    // Grouper par date et enrichir avec les labels
    transactions.forEach(transaction => {
      const dateKey = new Date(transaction.date!).toISOString().split('T')[0];
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }

      // Enrichir la transaction avec le label de sous-catégorie et le montant numérique
      const subCatId = typeof transaction.subCategoryId === 'string'
        ? parseInt(transaction.subCategoryId)
        : transaction.subCategoryId;

      const subCategory = this.subCategories.find(sc => sc.id === subCatId);
      const subCategoryLabel = subCategory
        ? `${subCategory.categoryLabel} - ${subCategory.label}`
        : 'Non catégorisé';

      const enrichedTransaction: TransactionWithLabel = {
        ...transaction,
        subCategoryLabel: subCategoryLabel,
        amountNumber: this.getSignedAmount(transaction)
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
        total: total
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
      return "Hier";
    } else {
      // Format: Lundi 20 octobre 2025
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
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

    this.accountService.accounts$.subscribe(accounts => {
      this.account = accounts.find(a => a.id === this.accountId) || null;
      console.log('TRANSACTION LIST : Compte chargé:', this.account);
      this.loadRecurringTransactions();
    });
  }

  // Charger les échéances récurrentes du compte
  loadRecurringTransactions(): void {
    if (!this.accountId) return;

    this.subscriptions.add(
      this.recurringTransactionService.recurringTransactions$.subscribe({
        next: (data) => {
          this.recurringTransactions = data.filter(rt => {
            const rtAccountId = typeof rt.accountId === 'string' ? parseInt(rt.accountId) : rt.accountId;
            return rtAccountId === this.accountId && rt.isActive === 1;
          });
          console.log('TRANSACTION LIST : Échéances récurrentes pour le compte:', this.recurringTransactions);

          // Trier les échéances : non réalisées en premier, puis par jour du mois
          this.sortRecurringTransactions();

          // Recalculer les soldes
          this.calculateBalances();
        },
        error: (err) => console.error('TRANSACTION LIST : Erreur lors du chargement des échéances:', err)
      })
    );

    this.recurringTransactionService.getRecurringTransactions().subscribe();
  }

  // Trier les échéances récurrentes
  sortRecurringTransactions(): void {
    this.sortedRecurringTransactions = [...this.recurringTransactions].sort((a, b) => {
      const aRealized = this.isRecurringRealized(a.id!);
      const bRealized = this.isRecurringRealized(b.id!);

      // Les non réalisées en premier
      if (aRealized && !bRealized) return 1;
      if (!aRealized && bRealized) return -1;

      // Puis trier par jour du mois
      const aDay = typeof a.dayOfMonth === 'string' ? parseInt(a.dayOfMonth) : (a.dayOfMonth || 0);
      const bDay = typeof b.dayOfMonth === 'string' ? parseInt(b.dayOfMonth) : (b.dayOfMonth || 0);
      return aDay - bDay;
    });
  }

  // Calculer les soldes actuel et prévisionnel
  calculateBalances(): void {
    if (!this.accountId || !this.account) {
      this.currentBalance = 0;
      this.forecastedBalance = 0;
      return;
    }

    // Récupérer le solde initial du compte
    const initialBalance = typeof this.account['initialBalance'] === 'string'
      ? parseFloat(this.account['initialBalance'])
      : (this.account['initialBalance'] || 0);

    console.log('TRANSACTION LIST : Solde initial du compte:', initialBalance);

    // Calculer le solde actuel (solde initial + somme de toutes les transactions du compte)
    const transactionsSum = this.transactions.reduce((sum, t) => {
      return sum + this.getSignedAmount(t);
    }, 0);

    this.currentBalance = initialBalance + transactionsSum;

    console.log('TRANSACTION LIST : Somme des transactions:', transactionsSum);
    console.log('TRANSACTION LIST : Solde actuel calculé:', this.currentBalance);

    // Calculer le solde prévisionnel (comme dans le tableau de bord)
    // On compte seulement les échéances à venir dans le mois (après aujourd'hui)
    const today = new Date();
    const currentDay = today.getDate();

    const upcomingAmount = this.recurringTransactions.reduce((sum, rt) => {
      const dayOfMonth = typeof rt.dayOfMonth === 'string'
        ? parseInt(rt.dayOfMonth)
        : (rt.dayOfMonth || 0);

      // Vérifier si l'échéance a déjà été réalisée ce mois-ci
      const isRealized = this.isRecurringRealized(rt.id!);

      // Condition : le jour n'est pas encore passé ET l'échéance n'a pas déjà été réalisée
      if (dayOfMonth > currentDay && !isRealized) {
        const amount = typeof rt.amount === 'string' ? parseFloat(rt.amount) : (rt.amount || 0);
        const financialFlowId = typeof rt.financialFlowId === 'string' ? parseInt(rt.financialFlowId) : rt.financialFlowId;
        const signedAmount = financialFlowId === 2 ? -Math.abs(amount) : Math.abs(amount);

        console.log('TRANSACTION LIST : Échéance à venir (jour', dayOfMonth, '):', rt['label'], signedAmount);
        return sum + signedAmount;
      }
      return sum;
    }, 0);

    this.forecastedBalance = this.currentBalance + upcomingAmount;

    console.log('TRANSACTION LIST : Montant des échéances à venir:', upcomingAmount);
    console.log('TRANSACTION LIST : Solde prévisionnel:', this.forecastedBalance);
  }

  // Basculer l'affichage des échéances
  toggleRecurring(): void {
    this.showRecurring = !this.showRecurring;
  }

  // Vérifier si une échéance a été réalisée ce mois
  isRecurringRealized(recurringId: number): boolean {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // The only source of truth is the existence of a linked transaction for the current month.
    const isRealized = this.transactions.some(t => {
      const transDate = new Date(t.date || '');
      return t.recurringTransactionId === recurringId &&
             transDate.getMonth() === currentMonth &&
             transDate.getFullYear() === currentYear;
    });

    if (isRealized) {
      console.log(`TRANSACTION LIST : Échéance ${recurringId} réalisée - Transaction trouvée.`);
    }

    return isRealized;
  }

  // Obtenir le libellé du jour pour une échéance
  getDayLabel(recurring: RecurringTransaction): string {
    if (recurring.dayOfMonth === null || recurring.dayOfMonth === undefined) {
      return 'N/A';
    }
    if (recurring.frequency === 'weekly') {
      const daysOfWeek = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
      const dayIndex = typeof recurring.dayOfMonth === 'string' ? parseInt(recurring.dayOfMonth) : recurring.dayOfMonth;
      return daysOfWeek[dayIndex] || recurring.dayOfMonth.toString();
    }
    return 'le ' + recurring.dayOfMonth.toString();
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
          subCategoryId: null
        },
        isNew: true
      }
    });

    dialogRef.onClose.subscribe(result => {
      if (result) {
        this.transactionService.addTransaction(result).subscribe({
          next: () => {
            console.log('TRANSACTION LIST : Transaction créée avec succès');
            this.loadTransactions();
            this.messageService.add({
              severity: 'success',
              summary: 'Succès',
              detail: 'Transaction créée avec succès.'
            });
          },
          error: (err) => {
            console.error('TRANSACTION LIST : Erreur lors de la création de la transaction:', err);
            this.messageService.add({
              severity: 'error',
              summary: 'Erreur',
              detail: 'Erreur lors de la création de la transaction.'
            });
          }
        });
      }
    });
  }

  editTransaction(transaction: Transaction): void {
    const dialogRef = this.dialogService.open(EditTransactionDialogComponent, {
      width: '500px',
      data: { transaction: { ...transaction } }
    });

    dialogRef.onClose.subscribe(result => {
      if (result) {
        // Convertir la date en format ISO
        const formattedDate = new Date(result.date).toISOString().slice(0, 10);
        const updatedTransaction = {
          ...result,
          date: new Date(formattedDate)
        };

        this.transactionService.updateTransaction(transaction.id!, updatedTransaction).subscribe({
          next: () => {
            console.log('TRANSACTION LIST : Transaction mise à jour avec succès');
            this.loadTransactions();
            this.messageService.add({
              severity: 'success',
              summary: 'Succès',
              detail: 'Transaction mise à jour avec succès.'
            });
          },
          error: (err) => {
            console.error('TRANSACTION LIST : Erreur lors de la mise à jour de la transaction:', err);
            this.messageService.add({
              severity: 'error',
              summary: 'Erreur',
              detail: 'Erreur lors de la mise à jour de la transaction.'
            });
          }
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
        cancelText: 'Annuler'
      }
    });

    dialogRef.onClose.subscribe(confirmed => {
      if (confirmed) {
        this.transactionService.deleteTransaction(transaction.id!).subscribe({
          next: () => {
            console.log('TRANSACTION LIST : Transaction supprimée avec succès');
            this.loadTransactions();
            this.messageService.add({
              severity: 'info',
              summary: 'Succès',
              detail: 'Transaction supprimée avec succès.'
            });
          },
          error: (err) => {
            console.error('TRANSACTION LIST : Erreur lors de la suppression de la transaction:', err);
            this.messageService.add({
              severity: 'error',
              summary: 'Erreur',
              detail: 'Erreur lors de la suppression de la transaction.'
            });
          }
        });
      }
    });
  }
}
