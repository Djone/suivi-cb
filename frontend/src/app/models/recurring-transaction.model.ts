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
  [key: string]: any; // Index signature pour snake_case
}
