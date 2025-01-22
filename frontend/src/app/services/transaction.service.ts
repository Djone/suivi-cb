import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Transaction } from '../models/transaction.model';
import { FilterManagerService } from './filter-manager.service';
import humps from 'humps'; // Importer humps

@Injectable({
  providedIn: 'root'
})
export class TransactionService {
  private apiUrl = 'http://localhost:3000/api/transactions';
  // Gestion du BehaviorSubject
  private transactionsSubject = new BehaviorSubject<Transaction[]>([]);
  transactions$ = this.transactionsSubject.asObservable();

  constructor(
    private http: HttpClient,
    private filterManager: FilterManagerService // Injecter le gestionnaire de filtres
  ) {}

  getTransactions(): Observable<Transaction[]> {
    const filters = this.filterManager.getFilters(); // Récupère les filtres actifs
    const snakeCaseFilters = humps.decamelizeKeys(filters); // Convertit les clés en snake_case
    
    // Convertit en HttpParams pour Angular
    const params = new HttpParams({
      fromObject: snakeCaseFilters as Record<string, string>
    });

    console.log(`TRANSACTION SERVICE : Requête getTransactions(GET) envoyée avec les paramètres :`, params);
    console.log(``, params.toString());
    
    return this.http.get<Transaction[]>(this.apiUrl, { params }).pipe(
      tap((transactions) => {
        this.transactionsSubject.next(transactions); // Met à jour les catégories
      }),
      catchError((err) => {
        console.error('TRANSACTION SERVICE : Erreur lors du chargement des transactions :', err);
        throw err; // Relance l'erreur pour permettre la gestion ailleurs
      })
    );
  }

  // Méthode pour déclencher le chargement des données dans le BehaviorSubject
  loadTransactions(): void {
    const filters = this.filterManager.getFilters(); // Récupère les filtres actifs
    
    console.log('TRANSACTION SERVICE : filres actifs : ', filters);
    
    this.getTransactions().subscribe({
      next: (data) => {
        // Conversion des montants
        const cleanedData = data.map(transaction => ({
          ...transaction,
          amount: typeof transaction.amount === 'string' 
          ? parseFloat(transaction.amount.replace(/[^0-9.-]+/g, '')) : transaction.amount
        }));
        this.transactionsSubject.next(cleanedData);
      },
      error: (err) => console.error('TRANSACTION SERVICE : Erreur chargement transactions:', err),
    }); // Recharge les données en mettant à jour transactionsSubject
  }

  // Méthode pour mettre à jour les filtres
  applyFilterTransactions(key: keyof Transaction, value: Transaction): void {
    const filter = { [key]: value }; // Crée un objet filtre avec une seule clé-valeur
    this.filterManager.setFilters(filter); // Passe l'objet filtre
    this.loadTransactions(); // Recharge les transactions avec les nouveaux filtres
  }

  // Méthode pour réinitialiser tous les filtres
  clearFiltersTransactions(): void {
    this.filterManager.clearFilters(); // Réinitialise les filtres
    this.loadTransactions(); // Recharge toutes les transactions
  }

  // Ajouter une getTransactions
  addTransaction(transaction: Transaction): Observable<void> {
    
    const snakeCaseTransaction = humps.decamelizeKeys(transaction); // Convertit les clés en snake_case

    console.log(`TRANSACTION SERVICE : Requête POST (ajouter une transaction) envoyée à : ${this.apiUrl}`);
    
    return this.http.post<void>(this.apiUrl, snakeCaseTransaction).pipe(
      tap(() => {
        console.log('TRANSACTION SERVICE : transaction ajoutée avec succès');
        this.getTransactions().subscribe(); // Met à jour les données après ajout
      }),
      catchError((err) => {
        console.error('TRANSACTION SERVICE : Erreur lors de l\'ajout de la transaction:', err);
        throw err;
      })
    );
  }

  updateTransaction(id: number, data: Partial<Transaction>): Observable<void> {
    
    //const { id: _, ...fieldsToUpdate } = data; // Exclure l'ID du corps
    const url = `${this.apiUrl}/${id}`;
    const snakeCaseTransaction = humps.decamelizeKeys(data); // Convertit en snake_case

    console.log(`TRANSACTION SERVICE : Requête PUT envoyée à : ${url} avec les données :`, snakeCaseTransaction);
    return this.http.put<void>(url, snakeCaseTransaction);
  }

  deleteTransaction(id: number) {
    const url = `${this.apiUrl}/${id}`;
    console.log(`TRANSACTION SERVICE : Requête DELETE envoyée à : ${url} avec les données :`, id);
    return this.http.delete<void>(url);
  }
}
