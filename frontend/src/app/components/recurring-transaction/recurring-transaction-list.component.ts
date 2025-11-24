import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

// Services et modèles
import { RecurringTransactionService } from '../../services/recurring-transaction.service';
import { SubCategoryService } from '../../services/sub-category.service';
import { AccountService } from '../../services/account.service';
import { TransactionService } from '../../services/transaction.service';
import { RecurringTransaction } from '../../models/recurring-transaction.model';
import { SubCategory } from '../../models/sub-category.model'; // Correction du nom du fichier
import { Account } from '../../models/account.model';
import { Transaction } from '../../models/transaction.model';
import { RecurringTransactionHistory } from '../../models/recurring-transaction-history.model';
import { EditRecurringTransactionDialogComponent } from '../edit-recurring-transaction-dialog/edit-recurring-transaction-dialog.component';
import { FREQUENCY_LIST } from '../../utils/utils';
import { DEBIT_503020_LIST } from '../../config/debit_503020';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { RecurringTransactionHistoryService } from '../../services/recurring-transaction-history.service';

// PrimeNG Imports
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { TagModule } from 'primeng/tag';
import { InputSwitchModule } from 'primeng/inputswitch';
import { CardModule } from 'primeng/card';
import { TooltipModule } from 'primeng/tooltip';
import { InputNumberModule } from 'primeng/inputnumber';
import { TabViewModule } from 'primeng/tabview';
import { AccordionModule } from 'primeng/accordion';
import { ChartModule } from 'primeng/chart';

type FlowFilter = 'all' | 'expenses' | 'incomes';

interface AccountSection {
  account: Account | null;
  transactions: RecurringTransaction[];
  totalAmount: number;
  nextDueLabel: string;
  activeCount: number;
}

type FlowView = {
  count: number;
  totalAmount: number;
  sections: AccountSection[];
};

interface RecurringDialogResultMeta {
  amountChanged?: boolean;
  previousAmount?: number | null;
}

interface RecurringDialogResult {
  payload?: Partial<RecurringTransaction>;
  meta?: RecurringDialogResultMeta;
}

@Component({
  selector: 'app-recurring-transaction-list',
  standalone: true,
  providers: [DialogService],
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
    TooltipModule,
    InputNumberModule,
    TabViewModule,
    AccordionModule,
    ChartModule
  ],
  templateUrl: './recurring-transaction-list.component.html',
  styleUrls: ['./recurring-transaction-list.component.css']
})

export class RecurringTransactionListComponent implements OnInit, OnDestroy {
  recurringTransactions: RecurringTransaction[] = [];
  subCategories: SubCategory[] = [];
  accounts: Account[] = [];
  transactions: Transaction[] = [];
  dialogRef: DynamicDialogRef | undefined;
  private subscriptions = new Subscription(); // Renommé pour éviter conflit avec 'sub' dans le dialog

  // Options pour les filtres
  frequencies = FREQUENCY_LIST.map(f => ({ label: f.name, value: f.id }));
  statuses = [
    { label: 'Actif', value: 1 },
    { label: 'Inactif', value: 0 }
  ];
  accountFilterOptions: { label: string; value: number | null }[] = [
    { label: 'Tous les comptes', value: null }
  ];
  selectedAccountFilter: number | null = null;
  activeFlowTabIndex = 0;
  flowTabs: { label: string; value: FlowFilter; icon: string }[] = [
    { label: 'Tous les flux', value: 'all', icon: 'pi pi-align-justify' },
    { label: 'Dépenses', value: 'expenses', icon: 'pi pi-arrow-down-left' },
    { label: 'Revenus', value: 'incomes', icon: 'pi pi-arrow-up-right' }
  ];
  searchTerm = '';
  flowStats: Record<FlowFilter, FlowView> = {
    all: { count: 0, totalAmount: 0, sections: [] },
    expenses: { count: 0, totalAmount: 0, sections: [] },
    incomes: { count: 0, totalAmount: 0, sections: [] }
  };
  accordionState: Record<FlowFilter, number[]> = {
    all: [],
    expenses: [],
    incomes: []
  };
  historyRecurringOptions: { label: string; value: number }[] = [];
  selectedHistoryRecurringId: number | null = null;
  historyChartData: any = null;
  historyChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#475569' } },
      y: {
        ticks: {
          color: '#475569',
          callback: (value: string | number) =>
            `${Number(value).toLocaleString('fr-FR')} €`,
        },
      },
    },
  };
  historyLoading = false;
  private lastHistoryLoadedId: number | null = null;
  private readonly flowFilters: FlowFilter[] = ['all', 'expenses', 'incomes'];

  constructor(
    private recurringTransactionService: RecurringTransactionService,
    private subCategoryService: SubCategoryService,
    private accountService: AccountService,
    private transactionService: TransactionService,
    private dialogService: DialogService,
    private historyService: RecurringTransactionHistoryService
  ) {}

  ngOnInit(): void {
    // S'abonner aux transactions récurrentes
    this.loadRecurringTransactions();
    this.subscriptions.add(
      this.recurringTransactionService.recurringTransactions$.subscribe({
        next: (data) => {
          // Enrichir les données pour l'affichage et le filtrage global
          this.recurringTransactions = data.map(transaction => ({
            ...transaction,
            subCategoryLabel: this.getSubCategoryName(transaction.subCategoryId),
            accountLabel: this.getAccountName(transaction.accountId),
            frequencyLabel: this.getFrequencyLabel(transaction.frequency),
            statusLabel: this.getStatusLabel(transaction.isActive),
            debitLabel: this.getDebitLabel(transaction.debit503020),
            isActive: transaction.isActive ?? 0
          }));
          this.updateFlowStats();
          this.refreshHistoryCandidates();
        },
        error: (err) => console.error('Erreur lors du chargement des transactions récurrentes:', err)
      })
    );

    this.loadSubCategories();
    // Charger les sous-catégories pour l'affichage
    this.subscriptions.add(
      this.subCategoryService.subCategories$.subscribe({
        next: (data) => {
          this.subCategories = data;
        },
        error: (err) => console.error('Erreur lors du chargement des sous-catégories:', err)
      })
    );

    this.loadAccounts();
    // Charger les comptes pour l'affichage
    this.subscriptions.add(
      this.accountService.accounts$.subscribe({
        next: (data) => {
          this.accounts = data;
          this.accountFilterOptions = [
            { label: 'Tous les comptes', value: null },
            ...this.accounts.map(account => ({
              label: account.name,
              value: account.id ?? null
            }))
          ];
          this.updateFlowStats();
          this.refreshHistoryCandidates();
        },
        error: (err) => console.error('Erreur lors du chargement des comptes:', err)
      })
    );

    this.subscriptions.add(
      this.transactionService.transactions$.subscribe({
        next: (data) => {
          this.transactions = data || [];
        },
        error: (err) =>
          console.error('Erreur lors du chargement des transactions:', err),
      }),
    );
    this.transactionService.loadTransactions();

  }

  ngOnDestroy(): void {
    if (this.dialogRef) {
      this.dialogRef.close();
    }
    this.subscriptions.unsubscribe();
  }

  loadRecurringTransactions(): void {
    this.recurringTransactionService.getRecurringTransactions().subscribe();
  }

  loadSubCategories(): void {
    this.subCategoryService.getSubCategories().subscribe();
  }

  loadAccounts(): void {
    this.accountService.getAccounts().subscribe();
  }

  getSubCategoryName(subCategoryId: number): string {
    const id = typeof subCategoryId === 'string' ? parseInt(subCategoryId, 10) : subCategoryId;
    const subCategory = this.subCategories.find(sc => sc.id == id);
    return subCategory ? subCategory.label : 'N/A';
  }

  private getDebitLabel(debitId: number | null | undefined): string {
    if (!debitId) {
      return '-';
    }
    const bucket = DEBIT_503020_LIST.find((item) => item.id === debitId);
    return bucket?.name ?? '-';
  }

  getAccountName(accountId: number | undefined): string {
    if (!accountId) return 'N/A';
    const account = this.accounts.find(a => a.id === accountId);
    return account ? account.name : 'N/A';
  }

  private normalizeDialogResult(
    result: RecurringDialogResult | Partial<RecurringTransaction> | null | undefined,
  ): { payload: Partial<RecurringTransaction>; meta?: RecurringDialogResultMeta } | null {
    if (!result) {
      return null;
    }
    if (
      typeof (result as RecurringDialogResult).payload !== 'undefined' &&
      (result as RecurringDialogResult).payload
    ) {
      return {
        payload: (result as RecurringDialogResult).payload!,
        meta: (result as RecurringDialogResult).meta,
      };
    }
    return { payload: result as Partial<RecurringTransaction> };
  }

  private promptAmountHistory(
    recurringId: number,
    previousAmount: number | null,
    newAmount: number | string | null | undefined,
  ): void {
    const ref = this.dialogService.open(ConfirmDialogComponent, {
      width: '450px',
      data: {
        title: 'Historique des montants',
        message:
          "Souhaitez-vous conserver cette modification dans l'historique des montants ?",
        confirmText: 'Oui',
        cancelText: 'Non',
      },
    });

    ref.onClose.subscribe((confirmed: boolean) => {
      if (!confirmed) {
        return;
      }
      const amount = this.toNumericAmount(newAmount);
      if (amount === null) {
        return;
      }
      this.historyService
        .addEntry(recurringId, {
          amount: Math.abs(amount),
          effectiveFrom: new Date(),
        })
        .subscribe({
          next: () => {
            if (this.selectedHistoryRecurringId === recurringId) {
              this.loadHistoryForRecurring(recurringId, true);
            }
          },
          error: (err) =>
            console.error('Erreur lors de l’enregistrement de l’historique', err),
        });
    });
  }

  private toNumericAmount(value: number | string | null | undefined): number | null {
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private refreshHistoryCandidates(): void {
    const candidates = this.recurringTransactions
      .filter(
        (rt) =>
          (rt.debit503020 ?? (rt as any)['debit_503020']) === 1 &&
          (rt.isActive ?? 0) === 1 &&
          typeof rt.id === 'number',
      )
      .map((rt) => ({
        label: rt.label,
        value: rt.id as number,
      }));
    this.historyRecurringOptions = candidates;
    if (!candidates.length) {
      this.selectedHistoryRecurringId = null;
      this.historyChartData = null;
      this.lastHistoryLoadedId = null;
      return;
    }
    const current = this.selectedHistoryRecurringId;
    if (
      typeof current !== 'number' ||
      !candidates.some((option) => option.value === current)
    ) {
      this.selectedHistoryRecurringId = candidates[0].value;
    }
    if (typeof this.selectedHistoryRecurringId === 'number') {
      this.loadHistoryForRecurring(this.selectedHistoryRecurringId);
    }
  }

  onHistoryRecurringChange(recurringId: number | null): void {
    if (typeof recurringId !== 'number') {
      this.selectedHistoryRecurringId = null;
      this.historyChartData = null;
      return;
    }
    this.selectedHistoryRecurringId = recurringId;
    this.loadHistoryForRecurring(recurringId, true);
  }

  private loadHistoryForRecurring(recurringId: number, forceReload = false): void {
    if (!forceReload && this.lastHistoryLoadedId === recurringId && this.historyChartData) {
      return;
    }
    this.historyLoading = true;
    this.subscriptions.add(
      this.historyService.getHistory(recurringId).subscribe({
        next: (history) => {
          this.historyLoading = false;
          this.lastHistoryLoadedId = recurringId;
          this.buildHistoryChartData(recurringId, history);
        },
        error: (err) => {
          console.error('Erreur lors du chargement de l’historique', err);
          this.historyLoading = false;
          this.historyChartData = null;
        },
      }),
    );
  }

  private buildHistoryChartData(
    recurringId: number,
    entries: RecurringTransactionHistory[],
  ): void {
    type HistoryPoint = RecurringTransactionHistory & { effectiveFrom: Date };
    const recurring = this.recurringTransactions.find((rt) => rt.id === recurringId);
    const fallbackAmount =
      recurring != null ? Math.abs(this.getTransactionAmount(recurring)) : null;

    let workingEntries: HistoryPoint[] = entries.map((entry) => ({
      ...entry,
      amount: Math.abs(entry.amount ?? 0),
      effectiveFrom: entry.effectiveFrom
        ? new Date(entry.effectiveFrom as any)
        : new Date(),
    }));

    if (!workingEntries.length && fallbackAmount !== null) {
      workingEntries = [
        {
          recurringId,
          amount: fallbackAmount,
          effectiveFrom: new Date(),
        } as HistoryPoint,
      ];
    }

    if (!workingEntries.length) {
      this.historyChartData = null;
      return;
    }

    const formatter = new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });

    const sorted = workingEntries.sort(
      (a, b) =>
        new Date(a.effectiveFrom as any).getTime() -
        new Date(b.effectiveFrom as any).getTime(),
    );
    const labels = sorted.map((entry) =>
      formatter.format(new Date(entry.effectiveFrom as any)),
    );
    const data = sorted.map((entry) => entry.amount ?? 0);

    this.historyChartData = {
      labels,
      datasets: [
        {
          label: recurring?.label || 'Montant',
          data,
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.3)',
          fill: false,
          tension: 0.3,
          pointRadius: 4,
        },
      ],
    };
  }

  /**
   * Récupère la couleur associée à un compte.
   * @param accountId L'ID du compte.
   * @returns La couleur hexadécimale du compte ou une couleur par défaut.
   */
  getAccountColor(accountId: number | undefined): string {
    if (!accountId) return '#6c757d'; // Couleur par défaut (gris)
    const account = this.accounts.find(a => a.id === accountId);
    return account?.color || '#6c757d';
  }

  /**
   * Génère le style CSS pour le badge du compte.
   * @param accountId L'ID du compte.
   * @returns Un objet de style pour ngStyle.
   */
  getAccountStyle(accountId: number | undefined): { [key: string]: string } {
    const bgColor = this.getAccountColor(accountId);
    // Simple logique pour déterminer si le texte doit être blanc ou noir pour le contraste
    const textColor = this.isColorLight(bgColor) ? '#000000' : '#FFFFFF';
    return {
      'background-color': bgColor,
      'color': textColor
    };
  }

  getFlowCount(flowFilter: FlowFilter): number {
    return this.flowStats[flowFilter]?.count ?? 0;
  }

  getFlowTotal(flowFilter: FlowFilter): number {
    return this.flowStats[flowFilter]?.totalAmount ?? 0;
  }

  onAccountFilterChange(): void {
    this.updateFlowStats();
  }

  onSearchTermChange(value: string): void {
    this.searchTerm = value;
    this.updateFlowStats();
  }

  private getFlowFilteredTransactions(flowFilter: FlowFilter): RecurringTransaction[] {
    return this.recurringTransactions.filter(transaction => {
      return this.matchesAccount(transaction)
        && this.matchesFlow(transaction, flowFilter)
        && this.matchesSearch(transaction);
    });
  }

  private updateFlowStats(): void {
    this.flowFilters.forEach(flow => {
      const filtered = this.getFlowFilteredTransactions(flow);
      this.flowStats[flow] = {
        count: filtered.length,
        totalAmount: this.getTotalAmount(filtered),
        sections: this.buildAccountSections(filtered)
      };
      this.syncAccordionState(flow);
    });
  }

  private syncAccordionState(flow: FlowFilter): void {
    const sections = this.flowStats[flow]?.sections ?? [];
    const currentState = this.accordionState[flow] ?? [];
    const valid = currentState.filter(
      (index) => index >= 0 && index < sections.length,
    );
    if (this.areArraysEqual(valid, currentState)) {
      return;
    }
    queueMicrotask(() => {
      this.accordionState[flow] = valid;
    });
  }

  onAccordionOpen(flow: FlowFilter, event: { index: number }): void {
    if (typeof event?.index !== 'number') {
      return;
    }
    const current = this.accordionState[flow] ?? [];
    if (!current.includes(event.index)) {
      this.accordionState[flow] = [...current, event.index].sort((a, b) => a - b);
    }
  }

  onAccordionClose(flow: FlowFilter, event: { index: number }): void {
    if (typeof event?.index !== 'number') {
      return;
    }
    const current = this.accordionState[flow] ?? [];
    this.accordionState[flow] = current.filter((idx) => idx !== event.index);
  }

  private areArraysEqual(a: number[], b: number[]): boolean {
    if (a.length !== b.length) {
      return false;
    }
    return a.every((value, index) => b[index] === value);
  }

  private buildAccountSections(transactions: RecurringTransaction[]): AccountSection[] {
    const grouped = new Map<number | 'none', RecurringTransaction[]>();

    transactions.forEach(transaction => {
      const accountId = this.getNumericAccountId(transaction.accountId);
      const key = accountId ?? 'none';
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(transaction);
    });

    return Array.from(grouped.entries())
      .map(([key, accountTransactions]) => {
        const account = typeof key === 'number'
          ? this.accounts.find(a => a.id === key) ?? null
          : null;
        return {
          account,
          transactions: accountTransactions.sort((a, b) => (a.dayOfMonth ?? 99) - (b.dayOfMonth ?? 99)),
          totalAmount: this.getTotalAmount(accountTransactions),
          nextDueLabel: this.getNextDueLabel(accountTransactions),
          activeCount: accountTransactions.filter(t => (t.isActive ?? 0) === 1).length
        };
      })
      .sort((a, b) => {
        const aName = a.account?.name || '';
        const bName = b.account?.name || '';
        return aName.localeCompare(bName);
      });
  }

  private matchesFlow(transaction: RecurringTransaction, flowFilter: FlowFilter): boolean {
    if (flowFilter === 'all') {
      return true;
    }
    const isIncome = transaction.financialFlowId === 1;
    if (flowFilter === 'incomes') {
      return isIncome;
    }
    return !isIncome;
  }

  private matchesAccount(transaction: RecurringTransaction): boolean {
    if (this.selectedAccountFilter === null) {
      return true;
    }
    const accountId = this.getNumericAccountId(transaction.accountId);
    return accountId === this.selectedAccountFilter;
  }

  private matchesSearch(transaction: RecurringTransaction): boolean {
    if (!this.searchTerm) {
      return true;
    }
    const search = this.searchTerm.toLowerCase();
    const accountId = this.getNumericAccountId(transaction.accountId) ?? 0;
    const accountName = this.getAccountName(accountId);
    const subCategory = this.getSubCategoryName(transaction.subCategoryId);
    const frequencyLabel = this.getFrequencyLabel(transaction.frequency);
    return [
      transaction.label,
      accountName,
      subCategory,
      frequencyLabel
    ].some(value => value?.toLowerCase().includes(search));
  }

  private getTotalAmount(transactions: RecurringTransaction[]): number {
    return transactions.reduce((sum, transaction) => sum + Math.abs(this.getTransactionAmount(transaction)), 0);
  }

  private getTransactionAmount(transaction: RecurringTransaction): number {
    return typeof transaction.amount === 'string'
      ? parseFloat(transaction.amount)
      : (transaction.amount ?? 0);
  }

  private getNextDueLabel(transactions: RecurringTransaction[]): string {
    const today = new Date();
    const currentDay = today.getDate();
    let minDiff = Number.MAX_SAFE_INTEGER;
    let selectedDay: number | null = null;

    transactions.forEach(transaction => {
      if (transaction.dayOfMonth === null || transaction.dayOfMonth === undefined) {
        return;
      }
      const day = transaction.dayOfMonth;
      let diff = day - currentDay;
      if (diff < 0) {
        diff += 31;
      }
      if (diff < minDiff) {
        minDiff = diff;
        selectedDay = day;
      }
    });

    return selectedDay ? `Jour ${selectedDay}` : '—';
  }

  private getNumericAccountId(accountId: number | string | undefined): number | null {
    if (accountId === null || accountId === undefined) {
      return null;
    }
    return typeof accountId === 'string' ? parseInt(accountId, 10) : accountId;
  }

  getFinancialFlowName(financialFlowId: number): string {
    return financialFlowId === 1 ? 'Revenu' : 'Dépense';
  }

  getFrequencyLabel(frequency: string): string {
    return FREQUENCY_LIST.find(f => f.id === frequency)?.name || frequency;
  }

  getDayLabel(recurring: RecurringTransaction): string {
    return recurring.dayOfMonth ? recurring.dayOfMonth.toString() : 'N/A';
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
      return { label: 'Cr\u00E9dit', cssClass: 'badge-credit' };
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

  getFinancialFlowSeverity(financialFlowId: number): 'success' | 'danger' {
    return financialFlowId === 1 ? 'success' : 'danger';
  }

  getStatusLabel(isActive: number | undefined): string {
    return (isActive ?? 0) === 1 ? 'Actif' : 'Inactif';
  }

  getSeverity(isActive: number | undefined): string {
    return (isActive ?? 0) === 1 ? 'success' : 'danger';
  }

  createRecurringTransaction(): void {
    setTimeout(() => {
      this.dialogRef = this.dialogService.open(EditRecurringTransactionDialogComponent, {
        header: 'Nouvelle transaction récurrente',
        data: {
          transaction: {
            label: '',
            amount: null,
            dayOfMonth: null,
            frequency: 'monthly',
            accountId: 1,
            financialFlowId: 2,
            subCategoryId: 0
          } as RecurringTransaction,
          isNew: true
        },
        width: '600px'
      });

      this.dialogRef.onClose.subscribe((result) => {
        const normalized = this.normalizeDialogResult(result);
        const payload = normalized?.payload;
        if (!payload) {
          return;
        }
        this.recurringTransactionService
          .addRecurringTransaction(payload as RecurringTransaction)
          .subscribe(() => this.loadRecurringTransactions());
      });
    }, 0);
  }

  editRecurringTransaction(transaction: RecurringTransaction): void {
    setTimeout(() => {
      this.dialogRef = this.dialogService.open(EditRecurringTransactionDialogComponent, {
        header: 'Éditer la transaction récurrente',
        data: {
          transaction: { ...transaction },
          isNew: false
        },
        width: '600px'
      });

      this.dialogRef.onClose.subscribe((result) => {
        const normalized = this.normalizeDialogResult(result);
        const payload = normalized?.payload;
        if (!payload) {
          return;
        }
        const recurringId =
          typeof payload.id === 'string'
            ? parseInt(payload.id, 10)
            : payload.id ?? null;
        if (!recurringId) {
          return;
        }
        this.recurringTransactionService
          .updateRecurringTransaction(recurringId, payload)
          .subscribe(() => {
            this.loadRecurringTransactions();
            if (normalized?.meta?.amountChanged) {
              this.promptAmountHistory(
                recurringId,
                normalized.meta.previousAmount ?? null,
                payload.amount
              );
            }
          });
      });
    }, 0);
  }

  toggleActive(transaction: RecurringTransaction, event: any): void {
    console.log('RECURRING TRANSACTION LIST : toggleActive appelé', {
      transaction: transaction.label,
      transactionId: transaction.id,
      currentStatus: transaction.isActive,
      eventChecked: event.checked
    });

    const newStatus = event.checked ? 1 : 0;
    const action = newStatus ? 'réactiver' : 'désactiver';

    const service$ = newStatus
      ? this.recurringTransactionService.reactivateRecurringTransaction(transaction.id!)
      : this.recurringTransactionService.deleteRecurringTransaction(transaction.id!);

    service$.subscribe({
      next: () => {
        console.log(`RECURRING TRANSACTION LIST : Transaction récurrente ${action}e avec succès`);
        // Attendre un peu pour laisser le temps à la DB de se mettre à jour
        setTimeout(() => {
          this.loadRecurringTransactions();
        }, 100);
      },
      error: (err) => {
        console.error(`RECURRING TRANSACTION LIST : Erreur lors de ${action}:`, err);
        alert(`Une erreur est survenue lors de la ${action}.`);
        this.loadRecurringTransactions(); // Restaurer l'état
      }
    });
  }

  // Ces méthodes ne sont plus utilisées avec le p-inputSwitch
  /*
  deactivateRecurringTransaction(recurringTransaction: RecurringTransaction): void {}
  reactivateRecurringTransaction(recurringTransaction: RecurringTransaction): void {}
  */

  /**
   * Détermine si une couleur hexadécimale est claire ou foncée.
   * @param color La couleur en format hexadécimal (ex: #RRGGBB).
   * @returns true si la couleur est claire, false sinon.
   */
  private isColorLight(color: string): boolean {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    // Formule de luminance YIQ
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return yiq >= 128;
  }

}







