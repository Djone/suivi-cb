export interface SubCategory {
    id?: number; // Optionnel, généré par la base de données
    label: string;
    categoryId: number; // Lien avec la catégorie par son ID
    categoryLabel?: string;
    isActive?: number;
  }
  