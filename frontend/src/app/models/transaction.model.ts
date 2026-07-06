// frontend/src/app/models/transaction.model.ts
export interface Transaction {
  id: number | null;
  description: string | undefined;
  amount: string | number | null;
  date: Date | string | undefined;
  subCategoryId: number | null;
  accountId: number | null;
  financialFlowId: number | null;
  recurringTransactionId?: number | null;
  advanceToJointAccount?: boolean | number | string | null;
  isInternalTransfer?: boolean | number | string | null;
  savingAccountId?: number | null;
  [key: string]: any;
}
