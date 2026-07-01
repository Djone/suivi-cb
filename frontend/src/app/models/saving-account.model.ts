export type SavingAccountRole =
  | 'leisure'
  | 'emergency'
  | 'online_payment'
  | 'savings'
  | 'investment'
  | 'employee_savings';
export type LiquidityLevel = 'instant' | 'day_1' | 'long_term';

export interface SavingAccount {
  id: number;
  name: string;
  bankName: string;
  providerKey: string;
  role: SavingAccountRole;
  liquidityLevel: LiquidityLevel;
  currentBalance: number;
  baseBalance: number;
  targetBalance: number | null;
  minimumBalance: number | null;
  includeInDailyBudget: boolean;
  includeInWealth: boolean;
  isActive: boolean;
}

export interface SavingAccountUpdate {
  currentBalance: number;
  targetBalance: number | null;
  minimumBalance: number | null;
  includeInDailyBudget: boolean;
  includeInWealth: boolean;
}
