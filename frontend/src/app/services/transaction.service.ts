import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, forkJoin, of, throwError } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { Transaction } from '../models/transaction.model';
import { FilterManagerService } from './filter-manager.service';
import { environment } from '../../environments/environment';
import * as humps from 'humps'; // Importer humps

export interface CreatedTransactionResponse {
  id: number;
  message?: string;
}

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

    return this.http.get<Transaction[]>(this.apiUrl, { params }).pipe(
      map((transactions) =>
        transactions.map((t) => humps.camelizeKeys(t) as Transaction),
      ),
      tap((camelCaseTransactions) => {
        this.transactionsSubject.next(camelCaseTransactions);
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

  getTransactionsUnfiltered(): Observable<Transaction[]> {
    return this.http.get<Transaction[]>(this.apiUrl).pipe(
      map((transactions) =>
        transactions.map((transaction) =>
          humps.camelizeKeys(transaction) as Transaction,
        ),
      ),
    );
  }

  // Méthode pour déclencher le chargement des données dans le BehaviorSubject
  loadTransactions(): void {
    const filters = this.filterManager.getFilters(); // Récupère les filtres actifs

    // getTransactions() met déjà à jour le BehaviorSubject avec les données converties
    // Il suffit de s'y abonner pour déclencher le chargement
    this.getTransactions().subscribe({
      error: (err) =>
        console.error(
          'TRANSACTION SERVICE : Erreur chargement transactions:',
          err,
        ),
    });
  }

  getTransactionsBySavingAccount(
    savingAccountId: number,
  ): Observable<Transaction[]> {
    const params = new HttpParams().set(
      'saving_account_id',
      String(savingAccountId),
    );
    return this.http.get<Transaction[]>(this.apiUrl, { params }).pipe(
      map((transactions) =>
        transactions.map((transaction) =>
          humps.camelizeKeys(transaction) as Transaction,
        ),
      ),
    );
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
  addTransaction(
    transaction: Transaction,
  ): Observable<CreatedTransactionResponse> {
    const payload = { ...transaction } as Partial<Transaction>;
    if (payload.id === null || typeof payload.id === 'undefined') {
      delete payload.id;
    }
    const snakeCaseTransaction = humps.decamelizeKeys(payload); // Convertit les clés en snake_case

    return this.http
      .post<CreatedTransactionResponse>(this.apiUrl, snakeCaseTransaction)
      .pipe(
        tap(() => {
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

  addTransactions(
    transactions: Transaction[],
  ): Observable<CreatedTransactionResponse[]> {
    if (transactions.length === 0) {
      return of([]);
    }

    const requests = transactions.map((transaction) => {
      const payload = { ...transaction } as Partial<Transaction>;
      if (payload.id === null || typeof payload.id === 'undefined') {
        delete payload.id;
      }

      return this.http.post<CreatedTransactionResponse>(
        this.apiUrl,
        humps.decamelizeKeys(payload),
      );
    });

    return forkJoin(requests).pipe(
      tap(() => {
        this.filterManager.clearFilters();
        this.loadTransactions();
      }),
      catchError((err) => {
        // En cas d'échec partiel, refléter immédiatement les écritures déjà créées.
        this.loadTransactions();
        console.error(
          "TRANSACTION SERVICE : Erreur lors de l'ajout groupé des transactions:",
          err,
        );
        throw err;
      }),
    );
  }

  deleteTransactions(ids: number[]): Observable<void[]> {
    const uniqueIds = [...new Set(ids)].filter(
      (id) => Number.isInteger(id) && id > 0,
    );
    if (uniqueIds.length === 0) {
      return of([]);
    }

    return forkJoin(
      uniqueIds.map((id) =>
        this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
          // L'annulation reste rejouable après une suppression partielle.
          catchError((err) =>
            err?.status === 404 ? of(void 0) : throwError(() => err),
          ),
        ),
      ),
    ).pipe(
      tap(() => this.loadTransactions()),
      catchError((err) => {
        this.loadTransactions();
        console.error(
          'TRANSACTION SERVICE : Erreur lors de la suppression groupée:',
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

    return this.http.put<void>(url, snakeCaseTransaction).pipe(
      tap(() => {
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

    return this.http.delete<void>(url).pipe(
      tap(() => {
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
