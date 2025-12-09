/*
Gestionnaire de filtres centralisé. 
Cela garantit que les filtres sont facilement accessibles dans toute l'application et évite de dupliquer la logique
*/
import { Injectable } from '@angular/core';
import { Transaction } from '../models/transaction.model';

@Injectable({
  providedIn: 'root', // Service accessible dans toute l'application
})
export class FilterManagerService {
  private filters: Partial<Transaction> = {}; // Stocke les filtres actifs

  // Récupère les filtres actifs
  getFilters(): Partial<Transaction> {
    return this.filters;
  }

  // Ajoute ou met à jour un filtre
  setFilters(filters: Partial<Transaction>): void {
    Object.keys(filters).forEach((key) => {
      const filterKey = key as keyof Transaction;
      const value = filters[filterKey];

      if (value !== undefined && value !== null) {
        this.filters[filterKey] = value;
      } else {
        delete this.filters[filterKey]; // Supprime le filtre si la valeur est nulle ou indéfinie
      }
    });
  }

  // Réinitialise tous les filtres
  clearFilters(): void {
    this.filters = {};
  }
}
