// frontend/src/app/models/category.model.ts
export interface Category {
  id?: number | undefined;
  label: string;
  financialFlowId: number; // Référence à financialFlow.id
  isActive?: number; // 1 = actif, 0 = inactif (après conversion camelCase)
  [key: string]: any; // Index signature pour permettre l'accès dynamique (is_active en snake_case)
}