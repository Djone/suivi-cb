// frontend/src/app/models/transaction.model.ts
export interface Transaction {
    id: number | null;
    description: string | undefined;
    amount: string | number | null;
    date: Date | undefined;
    subCategoryId: number | null;
    accountId: number | null;
    financialFlowId: number | null;
    [key: string]: any; // Index signature permettant d'utiliser des clés dynamiques
  }