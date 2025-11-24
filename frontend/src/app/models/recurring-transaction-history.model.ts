export interface RecurringTransactionHistory {
  id?: number;
  recurringId: number;
  effectiveFrom: Date | string; // date d'effet du nouveau montant
  amount: number; // valeur absolue, signe appliqué via financialFlowId du parent
  createdAt?: Date | string;
  [key: string]: any;
}

