export interface PlannedTransaction {
  id?: number;
  label: string;
  amount: number; // valeur absolue, signe appliqué à l'affichage
  date: Date | string;
  accountId: number;
  subCategoryId?: number | null;
  financialFlowId: number; // 1=Revenu, 2=Dépense
  isRealized?: boolean; // marquée comme réalisée -> crée une Transaction
  createdAt?: Date | string;
  updatedAt?: Date | string;
  [key: string]: any;
}

