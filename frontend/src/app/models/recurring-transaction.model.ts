// frontend/src/app/models/recurring-transaction.model.ts
export interface RecurringTransaction {
  id?: number;
  label: string;
  amount: number | null;
  dayOfMonth: number | null; // Jour du mois (1-31) ou jour de la semaine (1-7) pour hebdomadaire
  subCategoryId: number;
  accountId: number;
  financialFlowId: number; // 1=Revenu, 2=Dépense
  frequency: 'weekly' | 'monthly' | 'bimonthly' | 'quarterly' | 'biannual' | 'yearly'; // Périodicité
  isActive?: number;
  createdAt?: Date;
  debit503020: number | null; // 1=Charges fixes, 2=Loisir, 3=Epargne
  // Champs optionnels pour récurrences avancées
  startMonth?: number | null;
  occurrences?: number | null;
  activeMonths?: number[] | null; // 1-12
  recurrenceKind?: 'permanent' | 'installment' | 'seasonal';
  installmentStartMonth?: number | null;
  [key: string]: any; // Index signature pour snake_case
}
