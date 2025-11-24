import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Transaction } from '../models/transaction.model';
import { FilterManagerService } from './filter-manager.service';
import { environment } from '../../environments/environment';
import * as humps from 'humps'; // Importer humps

@Injectable({
  providedIn: 'root',
})
export class TransactionService {
  private apiUrl = `${environment.apiUrl}/api/transactions`;
  // Gestion du BehaviorSubject
  private transactionsSubject = new BehaviorSubject<Transaction[]>([]);
  transactions$ = this.transactionsSubject.asObservable();

  constructor(
    private http: HttpClient,
    private filterManager: FilterManagerService, // Injecter le gestionnaire de filtres
  ) {}

  getTransactions(): Observable<Transaction[]> {
    const filters = this.filterManager.getFilters(); // RÃ©cupÃ¨re les filtres actifs
    const snakeCaseFilters = humps.decamelizeKeys(filters); // Convertit les clÃ©s en snake_case

    // Convertit en HttpParams pour Angular
    const params = new HttpParams({
      fromObject: snakeCaseFilters as Record<string, string>,
    });

    console.log(
      `TRANSACTION SERVICE : Requête getTransactions(GET) envoyée avec les paramètres :`,
      params,
    );
    console.log(``, params.toString());

    return this.http.get<Transaction[]>(this.apiUrl, { params }).pipe(
      tap((transactions) => {
        console.log(
          'TRANSACTION SERVICE : Avant conversion - exemple:',
          transactions[0],
        );
        // Convertir les clés en camelCase
        const camelCaseTransactions = transactions.map(
          (t) => humps.camelizeKeys(t) as Transaction,
        );
        console.log(
          'TRANSACTION SERVICE : Après conversion - exemple:',
          camelCaseTransactions[0],
        );
        console.log(
          'TRANSACTION SERVICE : humps disponible?',
          typeof humps.camelizeKeys,
        );
        this.transactionsSubject.next(camelCaseTransactions); // Met à jour les transactions
      }),
      catchError((err) => {
        console.error(
          'TRANSACTION SERVICE : Erreur lors du chargement des transactions :',
          err,
        );
        throw err; // Relance l'erreur pour permettre la gestion ailleurs
      }),
    );
  }

  // Méthode pour déclencher le chargement des données dans le BehaviorSubject
  loadTransactions(): void {
    const filters = this.filterManager.getFilters(); // Récupère les filtres actifs

    console.log('TRANSACTION SERVICE : filtres actifs : ', filters);

    // getTransactions() met déjà à jour le BehaviorSubject avec les données converties
    // Il suffit de s'y abonner pour déclencher le chargement
    this.getTransactions().subscribe({
      next: () => {
        console.log(
          'TRANSACTION SERVICE : Transactions rechargées avec succès',
        );
      },
      error: (err) =>
        console.error(
          'TRANSACTION SERVICE : Erreur chargement transactions:',
          err,
        ),
    });
  }

  // Méthode pour mettre à jour les filtres
  applyFilterTransactions<K extends keyof Transaction>(
    key: K,
    value: Transaction[K],
  ): void {
    const filter = { [key]: value } as Partial<Transaction>; // Crée un objet filtre avec une seule clé-valeur
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

    console.log(
      `TRANSACTION SERVICE : Requête POST (ajouter une transaction) envoyée à : ${this.apiUrl}`,
    );

    return this.http.post<void>(this.apiUrl, snakeCaseTransaction).pipe(
      tap(() => {
        console.log('TRANSACTION SERVICE : transaction ajoutée avec succès');
        this.filterManager.clearFilters(); // Effacer les filtres pour un rechargement complet
        this.loadTransactions(); // Met à jour les données après ajout
      }),
      catchError((err) => {
        console.error(
          "TRANSACTION SERVICE : Erreur lors de l'ajout de la transaction:",
          err,
        );
        throw err;
      }),
    );
  }

  updateTransaction(id: number, data: Partial<Transaction>): Observable<void> {
    const url = `${this.apiUrl}/${id}`;

    // Exclure l'ID du corps de la requête (il est déjà dans l'URL)
    const { id: _, ...fieldsToUpdate } = data;
    const snakeCaseTransaction = humps.decamelizeKeys(fieldsToUpdate); // Convertit en snake_case

    console.log(
      `TRANSACTION SERVICE : Requête PUT envoyée à : ${url} avec les données :`,
      snakeCaseTransaction,
    );
    return this.http.put<void>(url, snakeCaseTransaction).pipe(
      tap(() => {
        console.log(
          'TRANSACTION SERVICE : Transaction mise à jour avec succès',
        );
        this.loadTransactions();
      }),
      catchError((err) => {
        console.error(
          'TRANSACTION SERVICE : Erreur lors de la mise à jour de la transaction:',
          err,
        );
        throw err;
      }),
    );
  }

  deleteTransaction(id: number): Observable<void> {
    const url = `${this.apiUrl}/${id}`;

    console.log(`TRANSACTION SERVICE : Requête DELETE envoyée à : ${url}`);

    return this.http.delete<void>(url).pipe(
      tap(() => {
        console.log('TRANSACTION SERVICE : Transaction supprimée avec succès');
        this.loadTransactions();
      }),
      catchError((err) => {
        console.error(
          'TRANSACTION SERVICE : Erreur lors de la suppression de la transaction:',
          err,
        );
        throw err;
      }),
    );
  }
}
