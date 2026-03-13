export interface SavingsWallet {
  id: number;
  name: string;
  targetAmount: number;
  isActive: boolean;
}

export interface SavingsWalletAllocation {
  transactionId?: number | null;
  walletId: number;
  amount: number;
}

export interface SavingsWalletAllocationRow {
  transactionId: number;
  walletId: number;
  amount: number;
}

export interface SavingsWalletProgress {
  id: number;
  name: string;
  targetAmount: number;
  allocatedAmount: number;
  remainingAmount: number;
  progressRate: number;
  isActive: boolean;
}
