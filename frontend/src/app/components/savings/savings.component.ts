import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { CardModule } from 'primeng/card';
import { DropdownModule } from 'primeng/dropdown';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ChartModule } from 'primeng/chart';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { ListboxModule } from 'primeng/listbox';
import { CalendarModule } from 'primeng/calendar';
import { TransactionService } from '../../services/transaction.service';
import { AccountService } from '../../services/account.service';
import { SavingsWalletService } from '../../services/savings-wallet.service';
import { SubCategoryService } from '../../services/sub-category.service';
import { Transaction } from '../../models/transaction.model';
import { Account } from '../../models/account.model';
import {
  SavingsWallet,
  SavingsWalletProgress,
} from '../../models/savings-wallet.model';
import { SubCategory } from '../../models/sub-category.model';

interface SavingsMovement {
  id: number;
  accountId: number | null;
  financialFlowId: number | null;
  subCategoryId: number | null;
  date: Date | null;
  description: string;
  accountName: string;
  categoryLabel: string;
  subCategoryLabel: string;
  signedAmount: number;
}

interface SavingsTypeStat {
  typeLabel: string;
  incoming: number;
  outgoing: number;
  net: number;
}

interface SavingsAccountStat {
  accountName: string;
  incoming: number;
  outgoing: number;
  net: number;
}

interface MovementAllocationDraft {
  walletId: number;
  walletName: string;
  amount: number | null;
}

type SavingsFlowFilter = 'all' | 'incoming' | 'outgoing';
type WalletFilterValue = null;
type WalletDialogMode = 'create' | 'edit';
type ManualMovementType = 'deposit' | 'withdrawal';
type WalletConfirmationAction = 'close' | 'delete';

@Component({
  selector: 'app-savings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    DropdownModule,
    TableModule,
    TagModule,
    ChartModule,
    ButtonModule,
    MessageModule,
    DialogModule,
    InputTextModule,
    InputNumberModule,
    ListboxModule,
    CalendarModule,
  ],
  templateUrl: './savings.component.html',
  styleUrl: './savings.component.css',
})
export class SavingsComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();

  private transactions: Transaction[] = [];
  private accounts: Account[] = [];
  private baseMovements: SavingsMovement[] = [];
  private allocationInitialAmountByWallet = new Map<number, number>();
  private walletNameById = new Map<number, string>();
  private allWallets: SavingsWallet[] = [];
  lockedAllocationDraft: MovementAllocationDraft[] = [];

  selectedAccount: number | null = null;
  selectedYear: number | null = null;
  selectedMonth: number | null = null;
  selectedFlow: SavingsFlowFilter = 'all';
  selectedWallet: WalletFilterValue = null;
  newWalletName = '';
  newWalletTargetAmount: number | null = null;
  walletDialogMode: WalletDialogMode = 'create';
  editingWalletId: number | null = null;
  createWalletError: string | null = null;
  walletActionError: string | null = null;
  allocationDialogError: string | null = null;
  manualMovementError: string | null = null;
  walletCreationDialogVisible = false;
  allocationDialogVisible = false;
  manualMovementDialogVisible = false;
  walletConfirmationDialogVisible = false;
  pendingWalletAction: WalletConfirmationAction | null = null;
  pendingWallet: SavingsWallet | null = null;
  editingManualMovement: SavingsMovement | null = null;

  manualMovementType: ManualMovementType = 'deposit';
  manualMovementDate: Date = new Date();
  manualMovementLabel = '';
  manualMovementAmount: number | null = null;
  manualMovementTypeOptions = [
    { label: 'Depot', value: 'deposit' as ManualMovementType },
    { label: 'Retrait', value: 'withdrawal' as ManualMovementType },
  ];

  private internalTransferAccountId: number | null = null;
  private internalTransferSubCategoryIds: Partial<Record<ManualMovementType, number>> = {};
  private creatingInternalTransferAccount = false;

  availableYears: number[] = [];
  yearOptions: Array<{ label: string; value: number | null }> = [];
  accountOptions: Array<{ label: string; value: number | null }> = [];
  monthOptions = [
    { label: 'Tous les mois', value: null },
    { label: 'Janvier', value: 0 },
    { label: 'Fevrier', value: 1 },
    { label: 'Mars', value: 2 },
    { label: 'Avril', value: 3 },
    { label: 'Mai', value: 4 },
    { label: 'Juin', value: 5 },
    { label: 'Juillet', value: 6 },
    { label: 'Aout', value: 7 },
    { label: 'Septembre', value: 8 },
    { label: 'Octobre', value: 9 },
    { label: 'Novembre', value: 10 },
    { label: 'Decembre', value: 11 },
  ];
  flowOptions: Array<{ label: string; value: SavingsFlowFilter }> = [
    { label: 'Tous les flux', value: 'all' },
    { label: 'Entrees sur epargne', value: 'incoming' },
    { label: 'Sorties depuis epargne', value: 'outgoing' },
  ];

  movements: SavingsMovement[] = [];
  wallets: SavingsWallet[] = [];
  walletProgress: SavingsWalletProgress[] = [];
  totalIncoming = 0;
  totalOutgoing = 0;
  netAmount = 0;
  savingsByType: SavingsTypeStat[] = [];
  savingsByAccount: SavingsAccountStat[] = [];
  savingsTypeChartData: any = null;
  savingsTypeChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.dataset?.label || '';
            const value = Number(context.parsed?.y ?? context.parsed ?? 0);
            const formatted = new Intl.NumberFormat('fr-FR', {
              style: 'currency',
              currency: 'EUR',
            }).format(value);
            return `${label}: ${formatted}`;
          },
        },
      },
    },
    scales: {
      y: {
        ticks: {
          callback: (value: number | string) =>
            new Intl.NumberFormat('fr-FR', {
              style: 'currency',
              currency: 'EUR',
              maximumFractionDigits: 0,
            }).format(Number(value)),
        },
      },
    },
  };
  allocationDraft: MovementAllocationDraft[] = [];
  allocationTotalToDistribute = 0;
  walletFilterOptions: Array<{ label: string; value: WalletFilterValue }> = [];

  constructor(
    private transactionService: TransactionService,
    private accountService: AccountService,
    private savingsWalletService: SavingsWalletService,
    private subCategoryService: SubCategoryService,
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.transactionService.transactions$.subscribe((transactions) => {
        this.transactions = transactions || [];
        this.extractAvailableYears();
        this.refreshView();
      }),
    );

    this.subscriptions.add(
      this.accountService.accounts$.subscribe((accounts) => {
        this.accounts = accounts || [];
        this.accountOptions = [
          { label: 'Tous les comptes', value: null },
          ...this.accounts.map((account) => ({
            label: account.name || `Compte ${account.id}`,
            value: account.id ?? null,
          })),
        ];
        this.refreshView();
      }),
    );

    this.loadWallets();
    this.loadInternalTransferSystemData();
    this.transactionService.getTransactions().subscribe();
    this.accountService.getAccounts().subscribe();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  applyFilters(): void {
    this.refreshView();
  }

  resetFilters(): void {
    this.selectedAccount = null;
    this.selectedMonth = null;
    this.selectedYear = null;
    this.selectedFlow = 'all';
    this.selectedWallet = null;
    this.refreshView();
  }

  openCreateWalletDialog(): void {
    this.createWalletError = null;
    this.newWalletName = '';
    this.newWalletTargetAmount = null;
    this.walletDialogMode = 'create';
    this.editingWalletId = null;
    this.walletCreationDialogVisible = true;
  }

  openEditWalletDialog(wallet: SavingsWallet): void {
    this.createWalletError = null;
    this.newWalletName = wallet.name;
    this.newWalletTargetAmount = wallet.targetAmount;
    this.walletDialogMode = 'edit';
    this.editingWalletId = wallet.id;
    this.walletCreationDialogVisible = true;
  }

  closeCreateWalletDialog(): void {
    this.walletCreationDialogVisible = false;
    this.walletDialogMode = 'create';
    this.editingWalletId = null;
  }

  createSavingsWallet(): void {
    const name = this.newWalletName.trim();
    const targetAmount = this.newWalletTargetAmount;
    if (!name) {
      this.createWalletError = 'Saisissez un nom de portefeuille.';
      return;
    }
    if (targetAmount === null || targetAmount < 0) {
      this.createWalletError =
        'Le montant objectif doit etre un nombre positif ou nul.';
      return;
    }
    if (
      this.allWallets.some(
        (wallet) =>
          wallet.id !== this.editingWalletId &&
          this.normalizeLabel(wallet.name) === this.normalizeLabel(name),
      )
    ) {
      this.createWalletError = 'Un portefeuille avec ce nom existe deja.';
      return;
    }

    this.createWalletError = null;

    if (this.walletDialogMode === 'edit' && this.editingWalletId !== null) {
      this.savingsWalletService
        .updateWallet(this.editingWalletId, {
          name,
          targetAmount,
        })
        .subscribe({
          next: () => {
            this.walletCreationDialogVisible = false;
            this.loadWallets();
            this.createWalletError = null;
          },
          error: () => {
            this.createWalletError = 'Impossible de modifier le portefeuille.';
          },
        });
      return;
    }

    this.savingsWalletService
      .createWallet({
        name,
        targetAmount,
      })
      .subscribe({
        next: () => {
          this.walletCreationDialogVisible = false;
          this.loadWallets();
          this.createWalletError = null;
        },
        error: () => {
          this.createWalletError = 'Impossible de creer le portefeuille.';
        },
      });
  }

  requestCloseWallet(wallet: SavingsWallet): void {
    if (!wallet.isActive) {
      return;
    }
    this.pendingWallet = wallet;
    this.pendingWalletAction = 'close';
    this.walletConfirmationDialogVisible = true;
  }

  private closeWallet(wallet: SavingsWallet): void {
    this.walletActionError = null;
    this.savingsWalletService.closeWallet(wallet.id).subscribe({
      next: () => {
        this.closeWalletConfirmationDialog();
        this.loadWallets();
        this.refreshView();
      },
      error: () => {
        this.walletActionError =
          "Impossible de clore le portefeuille pour l'instant.";
      },
    });
  }

  closeWalletById(walletId: number): void {
    const wallet = this.allWallets.find((item) => item.id === walletId);
    if (!wallet) {
      return;
    }
    this.requestCloseWallet(wallet);
  }

  requestDeleteWallet(wallet: SavingsWallet): void {
    this.pendingWallet = wallet;
    this.pendingWalletAction = 'delete';
    this.walletConfirmationDialogVisible = true;
  }

  private deleteWallet(wallet: SavingsWallet): void {
    this.walletActionError = null;
    this.savingsWalletService.deleteWallet(wallet.id).subscribe({
      next: () => {
        this.closeWalletConfirmationDialog();
        this.loadWallets();
        this.refreshView();
      },
      error: () => {
        this.walletActionError =
          "Impossible de supprimer le portefeuille pour l'instant.";
      },
    });
  }

  closeWalletConfirmationDialog(): void {
    this.walletConfirmationDialogVisible = false;
    this.pendingWalletAction = null;
    this.pendingWallet = null;
  }

  confirmWalletAction(): void {
    if (!this.pendingWallet || !this.pendingWalletAction) {
      return;
    }

    if (this.pendingWalletAction === 'close') {
      this.closeWallet(this.pendingWallet);
      return;
    }

    this.deleteWallet(this.pendingWallet);
  }

  getWalletConfirmationTitle(): string {
    return this.pendingWalletAction === 'delete'
      ? 'Supprimer le portefeuille'
      : 'Clore le portefeuille';
  }

  getWalletConfirmationMessage(): string {
    if (!this.pendingWallet) {
      return '';
    }

    if (this.pendingWalletAction === 'delete') {
      return `Confirmez la suppression du portefeuille "${this.pendingWallet.name}".`;
    }

    return `Confirmez la cloture du portefeuille "${this.pendingWallet.name}". Les repartitions associees ne seront plus affichees.`;
  }

  openManualMovementDialog(): void {
    this.manualMovementError = null;
    this.editingManualMovement = null;
    this.manualMovementType = 'deposit';
    this.manualMovementDate = new Date();
    this.manualMovementLabel = '';
    this.manualMovementAmount = null;
    this.manualMovementDialogVisible = true;
  }

  openEditManualMovementDialog(movement: SavingsMovement): void {
    if (!this.isStandaloneInternalMovement(movement)) {
      return;
    }

    this.manualMovementError = null;
    this.editingManualMovement = movement;
    this.manualMovementType = movement.signedAmount >= 0 ? 'deposit' : 'withdrawal';
    this.manualMovementDate = movement.date ? new Date(movement.date) : new Date();
    this.manualMovementLabel = movement.description || '';
    this.manualMovementAmount = Math.abs(movement.signedAmount || 0);
    this.manualMovementDialogVisible = true;
  }

  closeManualMovementDialog(): void {
    this.manualMovementDialogVisible = false;
    this.manualMovementError = null;
    this.editingManualMovement = null;
  }

  saveManualMovement(): void {
    const label = this.manualMovementLabel.trim();
    const amount = this.roundAmount(this.manualMovementAmount || 0);

    if (!this.internalTransferAccountId) {
      this.manualMovementError =
        'Compte systeme "Transfert interne" introuvable.';
      return;
    }

    const subCategoryId = this.internalTransferSubCategoryIds[this.manualMovementType];
    if (!subCategoryId) {
      this.manualMovementError =
        'Sous-categorie "Transfert interne" introuvable.';
      return;
    }

    if (!label) {
      this.manualMovementError = 'Saisissez un libelle.';
      return;
    }

    if (amount <= 0) {
      this.manualMovementError = 'Le montant doit etre superieur a zero.';
      return;
    }

    const financialFlowId = this.manualMovementType === 'deposit' ? 2 : 1;
    if (!this.manualMovementDate || Number.isNaN(this.manualMovementDate.getTime())) {
      this.manualMovementError = 'Date invalide.';
      return;
    }

    const payload = {
      description: label,
      amount,
      date: this.manualMovementDate,
      accountId: this.internalTransferAccountId,
      financialFlowId,
      subCategoryId,
      recurringTransactionId: null,
      advanceToJointAccount: false,
      isInternalTransfer: true,
    } as Transaction;

    if (this.editingManualMovement?.id) {
      this.transactionService
        .updateTransaction(this.editingManualMovement.id, payload)
        .subscribe({
          next: () => {
            this.closeManualMovementDialog();
          },
          error: () => {
            this.manualMovementError =
              "Erreur lors de la modification du mouvement.";
          },
        });
      return;
    }

    this.transactionService
      .addTransaction({
        ...payload,
        id: null,
      } as Transaction)
      .subscribe({
        next: () => {
          this.closeManualMovementDialog();
        },
        error: () => {
          this.manualMovementError =
            "Erreur lors de l'enregistrement du mouvement.";
        },
      });
  }

  deleteManualMovement(movement: SavingsMovement): void {
    if (!movement.id || !this.isStandaloneInternalMovement(movement)) {
      return;
    }

    this.walletActionError = null;

    const confirmed = window.confirm(`Supprimer "${movement.description}" ?`);

    if (!confirmed) {
      return;
    }

    this.transactionService.deleteTransaction(movement.id).subscribe({
      error: () => {
        this.walletActionError = 'Erreur lors de la suppression du mouvement.';
      },
    });
  }

  isStandaloneInternalMovement(movement: SavingsMovement): boolean {
    return (
      this.internalTransferAccountId !== null &&
      movement.accountId === this.internalTransferAccountId
    );
  }

  getManualMovementDialogTitle(): string {
    return this.editingManualMovement
      ? 'Modifier depot / retrait interne'
      : 'Depot / retrait interne';
  }

  isManualMovementTypeLocked(): boolean {
    return false;
  }

  openAllocationDialog(): void {
    this.allocationInitialAmountByWallet = new Map(
      this.walletProgress
        .filter((wallet) => wallet.isActive)
        .map((wallet) => [wallet.id, this.roundAmount(wallet.allocatedAmount || 0)]),
    );
    this.allocationDraft = this.sortAllocationDraft(
      this.wallets.map((wallet) => ({
        walletId: wallet.id,
        walletName: wallet.name,
        amount: this.toDraftAmount(
          this.allocationInitialAmountByWallet.get(wallet.id) || 0,
        ),
      })),
    );

    this.lockedAllocationDraft = this.sortAllocationDraft(
      this.walletProgress
        .filter((wallet) => !wallet.isActive && (wallet.allocatedAmount || 0) > 0)
        .map((wallet) => ({
          walletId: wallet.id,
          walletName: wallet.name,
          amount: this.roundAmount(wallet.allocatedAmount || 0),
        })),
    );

    this.allocationTotalToDistribute = this.getAllocationRemaining();
    this.allocationDialogError = null;
    this.allocationDialogVisible = true;
  }

  closeAllocationDialog(): void {
    this.allocationDialogVisible = false;
    this.allocationDialogError = null;
    this.allocationDraft = [];
    this.lockedAllocationDraft = [];
    this.allocationInitialAmountByWallet = new Map();
    this.allocationTotalToDistribute = 0;
  }

  saveAllocation(): void {
    const activeAllocations = this.allocationDraft
      .filter((entry) => (entry.amount || 0) > 0)
      .map((entry) => ({
        walletId: entry.walletId,
        amount: this.roundAmount(entry.amount || 0),
      }));
    const exceededWallet = activeAllocations.find(
      (allocation) => allocation.amount - this.getWalletAllocationCapacity(allocation.walletId) > 0.0001,
    );
    if (exceededWallet) {
      this.allocationDialogError =
        `Le montant reparti pour ${this.getWalletName(exceededWallet.walletId)} depasse le reste disponible de cette enveloppe.`;
      return;
    }

    this.savingsWalletService
      .setGlobalAllocations(activeAllocations)
      .subscribe({
        next: () => {
          this.closeAllocationDialog();
          this.loadWallets();
        },
        error: () => {
          this.allocationDialogError =
            "Erreur lors de l'enregistrement de la repartition.";
        },
      });
  }

  clearAllocation(): void {
    this.allocationDraft = this.sortAllocationDraft(
      this.wallets.map((wallet) => ({
        walletId: wallet.id,
        walletName: wallet.name,
        amount: null,
      })),
    );
    this.allocationDialogError = null;
  }

  allocateAllToWallet(walletId: number): void {
    const distributableAmount = this.getAllocationDistributableAmount();
    if (distributableAmount <= 0) {
      this.allocationDialogError = null;
      return;
    }

    this.allocationDraft = this.allocationDraft.map((entry) => ({
      ...entry,
      amount: this.toDraftAmount(
        entry.walletId === walletId
          ? Math.min(
              this.getDraftDisplayAmount(entry.amount) + distributableAmount,
              this.getWalletAllocationCapacity(entry.walletId),
            )
          : this.getDraftDisplayAmount(entry.amount),
      ),
    }));
    this.allocationDialogError = null;
  }

  splitAllocationEqually(): void {
    const distributableAmount = this.getAllocationDistributableAmount();
    const eligibleDraft = this.allocationDraft.filter(
      (entry) => !this.isWalletFrozenForAllocation(entry.walletId),
    );

    if (eligibleDraft.length <= 0 || distributableAmount <= 0) {
      this.allocationDialogError = null;
      return;
    }

    const allocations = new Map<number, number>(
      this.allocationDraft.map((entry) => [
        entry.walletId,
        this.getDraftDisplayAmount(entry.amount),
      ]),
    );
    const capacities = new Map<number, number>(
      eligibleDraft.map((entry) => [
        entry.walletId,
        this.roundAmount(
          this.getWalletAllocationCapacity(entry.walletId) -
            this.getDraftDisplayAmount(entry.amount),
        ),
      ]),
    );
    let remaining = distributableAmount;
    let availableWalletIds = eligibleDraft
      .map((entry) => entry.walletId)
      .filter((walletId) => (capacities.get(walletId) || 0) > 0);

    while (remaining > 0 && availableWalletIds.length > 0) {
      const share = this.roundAmount(remaining / availableWalletIds.length);

      for (const walletId of availableWalletIds) {
        if (remaining <= 0) {
          break;
        }

        const currentAmount = allocations.get(walletId) || 0;
        const capacity = capacities.get(walletId) || 0;
        const remainingCapacity = this.roundAmount(capacity - currentAmount);

        if (remainingCapacity <= 0) {
          continue;
        }

        const desiredAmount = share > 0 ? share : remaining;
        const amount = this.roundAmount(
          Math.min(remainingCapacity, remaining, desiredAmount),
        );

        if (amount <= 0) {
          continue;
        }

        allocations.set(walletId, this.roundAmount(currentAmount + amount));
        remaining = this.roundAmount(remaining - amount);
      }

      availableWalletIds = availableWalletIds.filter((walletId) => {
        const capacity = capacities.get(walletId) || 0;
        const currentAmount = allocations.get(walletId) || 0;
        return this.roundAmount(capacity - currentAmount) > 0;
      });
    }

    this.allocationDraft = this.allocationDraft.map((entry) => ({
      ...entry,
      amount: this.toDraftAmount(allocations.get(entry.walletId) || 0),
    }));
    this.allocationDialogError = null;
  }

  onAllocationAmountChange(walletId: number, value: number | null | undefined): void {
    const normalizedValue = this.roundAmount(Number(value || 0));
    const clampedValue = Math.min(
      Math.max(normalizedValue, 0),
      this.getWalletInputCapacity(walletId),
    );
    const entry = this.allocationDraft.find((item) => item.walletId === walletId);
    if (!entry) {
      return;
    }

    entry.amount = this.toDraftAmount(clampedValue);
    this.allocationDialogError = null;
  }

  getAllocationTotal(): number {
    const activeTotal = this.allocationDraft.reduce(
      (sum, entry) => sum + this.roundAmount(entry.amount || 0),
      0,
    );
    const lockedTotal = this.lockedAllocationDraft.reduce(
      (sum, entry) => sum + this.roundAmount(entry.amount || 0),
      0,
    );
    return this.roundAmount(activeTotal + lockedTotal);
  }

  getAllocationRemaining(): number {
    return this.roundAmount(this.netAmount - this.getAllocationTotal());
  }

  getAllocationOverage(): number {
    const remaining = this.getAllocationRemaining();
    return remaining < 0 ? Math.abs(remaining) : 0;
  }

  getLockedAllocationTotal(): number {
    return this.roundAmount(
      this.lockedAllocationDraft.reduce(
        (sum, entry) => sum + this.roundAmount(entry.amount || 0),
        0,
      ),
    );
  }

  getAllocationSharePercent(amount: number): number {
    const total = this.getAllocationTotal();
    if (total <= 0) {
      return 0;
    }
    return this.getProgressWidth((amount / total) * 100);
  }

  getDraftDisplayAmount(amount: number | null): number {
    return this.roundAmount(amount || 0);
  }

  getWalletRemainingAmount(walletId: number): number {
    const capacity = this.getWalletAllocationCapacity(walletId);
    const currentAmount = this.getDraftDisplayAmount(
      this.allocationDraft.find((entry) => entry.walletId === walletId)?.amount ?? null,
    );
    return this.roundAmount(Math.max(capacity - currentAmount, 0));
  }

  getWalletAllocationCapacity(walletId: number): number {
    const progress = this.walletProgress.find((item) => item.id === walletId && item.isActive);
    return this.roundAmount(Math.max(progress?.targetAmount || 0, 0));
  }

  getWalletInputCapacity(walletId: number): number {
    return this.getWalletAllocationCapacity(walletId);
  }

  isWalletGoalReached(walletId: number): boolean {
    const progress = this.walletProgress.find((item) => item.id === walletId && item.isActive);
    return progress ? this.isWalletProgressFrozen(progress) : false;
  }

  isWalletFrozenForAllocation(walletId: number): boolean {
    return this.isWalletGoalReached(walletId);
  }

  getProgressWidth(progressRate: number): number {
    return Math.max(Math.min(progressRate, 100), 0);
  }

  getActiveWalletTargetTotal(): number {
    return this.roundAmount(
      this.wallets.reduce((sum, wallet) => sum + (wallet.targetAmount || 0), 0),
    );
  }

  getTargetBudgetRemaining(): number {
    return this.roundAmount(this.netAmount - this.getActiveWalletTargetTotal());
  }

  getTargetBudgetOverage(): number {
    const remaining = this.getTargetBudgetRemaining();
    return remaining < 0 ? Math.abs(remaining) : 0;
  }

  getAllocatedBudgetTotal(): number {
    return this.roundAmount(
      this.walletProgress.reduce(
        (sum, wallet) => sum + (wallet.allocatedAmount || 0),
        0,
      ),
    );
  }

  getRemainingToAllocate(): number {
    return this.roundAmount(this.netAmount - this.getAllocatedBudgetTotal());
  }

  getRemainingToAllocateOverage(): number {
    const remaining = this.getRemainingToAllocate();
    return remaining < 0 ? Math.abs(remaining) : 0;
  }

  isWalletActive(progress: SavingsWalletProgress): boolean {
    return Boolean(progress.isActive);
  }

  private loadWallets(): void {
    this.subscriptions.add(
      this.savingsWalletService
        .getWallets({ includeClosed: true })
        .subscribe({
          next: (wallets) => {
            this.allWallets = wallets;
            this.wallets = this.sortActiveWallets(wallets.filter((wallet) => wallet.isActive));
            this.walletNameById = new Map(
              wallets.map((wallet) => [wallet.id, wallet.name]),
            );

            if (
              this.selectedWallet !== null &&
              !wallets.some((wallet) => wallet.id === this.selectedWallet)
            ) {
              this.selectedWallet = null;
            }

            this.walletFilterOptions = [{ label: 'Tous les portefeuilles', value: null }];
            this.refreshView();
          },
          error: (err) => {
            console.error('Erreur lors du chargement des portefeuilles:', err);
          },
        }),
    );
  }

  private loadInternalTransferSystemData(): void {
    this.subscriptions.add(
      this.accountService.getAllAccountsIncludingInactive().subscribe({
        next: (accounts) => {
          const systemAccount = (accounts || []).find(
            (account) =>
              this.normalizeLabel(account.name || '') === 'transfert interne',
          );
          if (typeof systemAccount?.id === 'number') {
            this.creatingInternalTransferAccount = false;
            this.internalTransferAccountId = systemAccount.id;
            return;
          }

          if (this.creatingInternalTransferAccount) {
            return;
          }

          this.creatingInternalTransferAccount = true;

          this.accountService
            .addAccount({
              name: 'Transfert interne',
              description:
                'Compte systeme pour les depots et retraits internes d epargne',
              color: '#64748b',
              isActive: 0,
            })
            .subscribe({
              next: () => {
                this.creatingInternalTransferAccount = false;
                this.loadInternalTransferSystemData();
              },
              error: (err) => {
                this.creatingInternalTransferAccount = false;
                console.error(
                  'Erreur lors de la creation du compte systeme transfert interne:',
                  err,
                );
                this.internalTransferAccountId = null;
              },
            });
        },
        error: (err) => {
          console.error(
            'Erreur lors du chargement du compte systeme transfert interne:',
            err,
          );
          this.internalTransferAccountId = null;
        },
      }),
    );

    this.loadInternalTransferSubCategory('deposit', 2);
    this.loadInternalTransferSubCategory('withdrawal', 1);
  }

  private loadInternalTransferSubCategory(
    type: ManualMovementType,
    financialFlowId: number,
  ): void {
    this.subscriptions.add(
      this.subCategoryService
        .getAllSubCategoriesByFinancialFlowId(financialFlowId)
        .subscribe({
          next: (subCategories) => {
            const match = (subCategories || []).find(
              (subCategory: SubCategory) =>
                this.normalizeLabel(subCategory.label || '') ===
                'transfert interne',
            );
            this.internalTransferSubCategoryIds[type] =
              typeof match?.id === 'number' ? match.id : undefined;
          },
          error: (err) => {
            console.error(
              'Erreur lors du chargement de la sous-categorie transfert interne:',
              err,
            );
            this.internalTransferSubCategoryIds[type] = undefined;
          },
        }),
    );
  }

  private refreshView(): void {
    const filtered = this.transactions.filter((transaction) =>
      this.matchesBaseFilter(transaction),
    );

    this.baseMovements = filtered
      .map((transaction) => this.toSavingsMovement(transaction))
      .sort((a, b) => {
        const timeA = a.date ? a.date.getTime() : 0;
        const timeB = b.date ? b.date.getTime() : 0;
        return timeB - timeA;
      });

    if (!this.baseMovements.length) {
      this.movements = [];
      this.walletProgress = [];
      this.totalIncoming = 0;
      this.totalOutgoing = 0;
      this.netAmount = 0;
      this.savingsByType = [];
      this.savingsByAccount = [];
      this.savingsTypeChartData = null;
      return;
    }

    this.applyDisplayFilters();
    this.loadWalletProgressSummary();
  }

  private matchesBaseFilter(transaction: Transaction): boolean {
    if (!this.isInternalTransfer(transaction)) {
      return false;
    }

    const date = transaction.date ? new Date(transaction.date) : null;
    if (!date || Number.isNaN(date.getTime())) {
      return false;
    }

    if (this.selectedYear !== null && date.getFullYear() !== this.selectedYear) {
      return false;
    }

    if (this.selectedMonth !== null && date.getMonth() !== this.selectedMonth) {
      return false;
    }

    if (this.selectedAccount !== null) {
      const accountId = this.toNumber(transaction.accountId);
      if (accountId !== this.selectedAccount) {
        return false;
      }
    }

    return true;
  }

  private toSavingsMovement(transaction: Transaction): SavingsMovement {
    const date = transaction.date ? new Date(transaction.date) : null;
    const accountId = this.toNumber(transaction.accountId);
    const subCategoryLabel =
      this.toDisplayValue((transaction as any)['subCategoryLabel']) || 'Transfert interne';
    const categoryLabel =
      this.toDisplayValue((transaction as any)['categoryLabel']) || 'Epargne';
    const signedAmount = this.toSignedAmount(
      this.toNumber(transaction.financialFlowId),
      this.toNumber(transaction.amount) || 0,
    );

    const accountName =
      accountId === this.internalTransferAccountId
        ? 'Transfert interne'
        : this.accounts.find((account) => account.id === accountId)?.name ||
          `Compte ${accountId ?? '-'}`;

    const movementId = this.toNumber(transaction.id) || 0;

    return {
      id: movementId,
      accountId,
      financialFlowId: this.toNumber(transaction.financialFlowId),
      subCategoryId: this.toNumber(transaction.subCategoryId),
      date,
      description: transaction.description || '',
      accountName,
      categoryLabel,
      subCategoryLabel,
      signedAmount,
    };
  }

  private toSignedAmount(financialFlowId: number | null, amount: number): number {
    if (financialFlowId === null) {
      return amount;
    }
    return financialFlowId === 1 ? -amount : amount;
  }

  private loadWalletProgressSummary(): void {
    this.savingsWalletService
      .getAllocationSummary({
        accountId: this.selectedAccount,
        year: this.selectedYear,
        month: this.selectedMonth,
        flow: this.selectedFlow,
        includeClosed: true,
      })
      .subscribe({
        next: (summary) => {
          this.walletProgress = this.sortWalletProgress(summary);
        },
        error: (err) => {
          console.error('Erreur lors du chargement du recapitulatif:', err);
          this.walletProgress = [];
        },
      });
  }

  private applyDisplayFilters(): void {
    const filtered = this.baseMovements
      .filter((movement) => this.matchesFlowFilter(movement))
      .filter((movement) => this.matchesWalletFilter(movement));

    this.movements = filtered.sort((a, b) => {
      const timeA = a.date ? a.date.getTime() : 0;
      const timeB = b.date ? b.date.getTime() : 0;
      return timeB - timeA;
    });

    this.totalIncoming = this.movements
      .filter((movement) => movement.signedAmount > 0)
      .reduce((sum, movement) => sum + movement.signedAmount, 0);

    this.totalOutgoing = this.movements
      .filter((movement) => movement.signedAmount < 0)
      .reduce((sum, movement) => sum + Math.abs(movement.signedAmount), 0);

    this.netAmount = this.totalIncoming - this.totalOutgoing;
    this.buildBreakdowns();
  }

  private extractAvailableYears(): void {
    const years = new Set<number>();
    this.transactions.forEach((transaction) => {
      if (
        !this.isInternalTransfer(transaction) ||
        !transaction.date
      ) {
        return;
      }
      const date = new Date(transaction.date);
      if (!Number.isNaN(date.getTime())) {
        years.add(date.getFullYear());
      }
    });
    const sorted = Array.from(years).sort((a, b) => b - a);
    this.availableYears = sorted;
    this.yearOptions = [
      { label: 'Toutes les annees', value: null },
      ...sorted.map((year) => ({ label: `${year}`, value: year })),
    ];
    if (
      this.selectedYear !== null &&
      !sorted.includes(this.selectedYear) &&
      sorted.length > 0
    ) {
      this.selectedYear = sorted[0];
    }
  }

  private isInternalTransfer(transaction: Transaction): boolean {
    const raw = transaction.isInternalTransfer;
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'number') return raw === 1;
    if (typeof raw === 'string') {
      const normalized = raw.trim().toLowerCase();
      return normalized === '1' || normalized === 'true';
    }
    return false;
  }

  private isCurrentOrJointAccount(accountId: unknown): boolean {
    const normalizedAccountId = this.toNumber(accountId);
    if (normalizedAccountId === null) {
      return false;
    }

    const account = this.accounts.find((item) => item.id === normalizedAccountId);
    const normalizedName = this.normalizeLabel(account?.name || '');
    return normalizedName.includes('courant') || normalizedName.includes('joint');
  }

  private matchesFlowFilter(movement: SavingsMovement): boolean {
    if (this.selectedFlow === 'incoming') {
      return movement.signedAmount > 0;
    }
    if (this.selectedFlow === 'outgoing') {
      return movement.signedAmount < 0;
    }
    return true;
  }

  private matchesWalletFilter(movement: SavingsMovement): boolean {
    return this.selectedWallet === null;
  }

  private buildBreakdowns(): void {
    const byType = new Map<string, SavingsTypeStat>();
    const byAccount = new Map<string, SavingsAccountStat>();

    this.movements.forEach((movement) => {
      const typeLabel = movement.subCategoryLabel || 'Non classe';
      const incoming = movement.signedAmount > 0 ? movement.signedAmount : 0;
      const outgoing = movement.signedAmount < 0 ? Math.abs(movement.signedAmount) : 0;
      const net = movement.signedAmount;

      const typeStat = byType.get(typeLabel) ?? {
        typeLabel,
        incoming: 0,
        outgoing: 0,
        net: 0,
      };
      typeStat.incoming += incoming;
      typeStat.outgoing += outgoing;
      typeStat.net += net;
      byType.set(typeLabel, typeStat);

      const accountKey = 'transfert-interne';
      const accountLabel = 'Transfert interne';
      {
        const accountStat = byAccount.get(accountKey) ?? {
          accountName: accountLabel,
          incoming: 0,
          outgoing: 0,
          net: 0,
        };
        accountStat.incoming += incoming;
        accountStat.outgoing += outgoing;
        accountStat.net += net;
        byAccount.set(accountKey, accountStat);
      }
    });

    this.savingsByType = Array.from(byType.values()).sort((a, b) => b.net - a.net);
    this.savingsByAccount = Array.from(byAccount.values()).sort((a, b) => b.net - a.net);

    this.savingsTypeChartData = {
      labels: this.savingsByType.map((item) => item.typeLabel),
      datasets: [
        {
          label: 'Entrees sur epargne',
          data: this.savingsByType.map((item) => item.incoming),
          backgroundColor: '#16a34a',
        },
        {
          label: 'Sorties depuis epargne',
          data: this.savingsByType.map((item) => item.outgoing),
          backgroundColor: '#dc2626',
        },
      ],
    };
  }

  private getWalletName(walletId: number): string {
    return this.walletNameById.get(walletId) || `Portefeuille ${walletId}`;
  }

  private isWalletProgressFrozen(wallet: SavingsWalletProgress): boolean {
    return this.roundAmount(wallet.remainingAmount || 0) <= 0;
  }

  private sortWalletProgress(summary: SavingsWalletProgress[]): SavingsWalletProgress[] {
    return [...summary].sort((left, right) => {
      if (left.isActive !== right.isActive) {
        return left.isActive ? -1 : 1;
      }
      return left.name.localeCompare(right.name, 'fr');
    });
  }

  private sortActiveWallets(wallets: SavingsWallet[]): SavingsWallet[] {
    return [...wallets].sort((left, right) =>
      left.name.localeCompare(right.name, 'fr'),
    );
  }

  private sortAllocationDraft(draft: MovementAllocationDraft[]): MovementAllocationDraft[] {
    return [...draft].sort((left, right) => {
      const leftReached = this.isWalletGoalReached(left.walletId);
      const rightReached = this.isWalletGoalReached(right.walletId);
      if (leftReached !== rightReached) {
        return leftReached ? 1 : -1;
      }
      return left.walletName.localeCompare(right.walletName, 'fr');
    });
  }

  private toDraftAmount(value: number): number | null {
    const roundedValue = this.roundAmount(value);
    return roundedValue > 0 ? roundedValue : null;
  }

  private getAllocationDistributableAmount(): number {
    return this.roundAmount(Math.max(this.getAllocationRemaining(), 0));
  }

  private normalizeLabel(value: string): string {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  private toNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value.replace(',', '.'));
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private toDisplayValue(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  private roundAmount(value: number): number {
    return Math.round(value * 100) / 100;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
}
