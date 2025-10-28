export interface Account {
  id?: number;
  name: string;
  description?: string;
  color?: string;
  isActive?: number;
  initialBalance?: number; // Ajouté pour le solde initial
  createdAt?: Date;
  [key: string]: any;
}
