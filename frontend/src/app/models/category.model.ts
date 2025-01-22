// frontend/src/app/models/category.model.ts
export interface Category {
  id?: number | undefined;
  label: string;
  financialFlowId: number; // Référence à financialFlow.id
}