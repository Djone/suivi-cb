// frontend/src/app/services/recurring-transaction.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { RecurringTransaction } from '../models/recurring-transaction.model';
import * as humps from 'humps';

@Injectable({
  providedIn: 'root'
})
export class RecurringTransactionService {
  private apiUrl = 'http://localhost:3000/api/recurring-transactions';

  private recurringTransactionsSubject = new BehaviorSubject<RecurringTransaction[]>([]);
  recurringTransactions$ = this.recurringTransactionsSubject.asObservable();

  constructor(private http: HttpClient) {}

  // Récupérer toutes les transactions récurrentes
  getRecurringTransactions(): Observable<RecurringTransaction[]> {
    return this.http.get<RecurringTransaction[]>(this.apiUrl).pipe(
      tap((recurringTransactions) => {
        const camelCaseData = recurringTransactions.map((rt) =>
          humps.camelizeKeys(rt)
        ) as RecurringTransaction[];

        console.log('RECURRING TRANSACTION SERVICE : Transactions récurrentes récupérées:', camelCaseData);
        this.recurringTransactionsSubject.next(camelCaseData);
      }),
      catchError((err) => {
        console.error('RECURRING TRANSACTION SERVICE : Erreur lors du chargement:', err);
        throw err;
      })
    );
  }

  // Ajouter une transaction récurrente
  addRecurringTransaction(recurringTransaction: RecurringTransaction): Observable<void> {
    const snakeCaseData = humps.decamelizeKeys(recurringTransaction);

    console.log('RECURRING TRANSACTION SERVICE : Ajout d\'une transaction récurrente:', snakeCaseData);

    return this.http.post<void>(this.apiUrl, snakeCaseData).pipe(
      tap(() => {
        console.log('RECURRING TRANSACTION SERVICE : Transaction récurrente ajoutée avec succès');
        this.getRecurringTransactions().subscribe();
      }),
      catchError((err) => {
        console.error('RECURRING TRANSACTION SERVICE : Erreur lors de l\'ajout:', err);
        throw err;
      })
    );
  }

  // Mettre à jour une transaction récurrente
  updateRecurringTransaction(id: number, data: Partial<RecurringTransaction>): Observable<void> {
    const url = `${this.apiUrl}/${id}`;
    const { id: _, ...fieldsToUpdate } = data;
    const snakeCaseData = humps.decamelizeKeys(fieldsToUpdate);

    console.log('RECURRING TRANSACTION SERVICE : Mise à jour:', snakeCaseData);

    return this.http.put<void>(url, snakeCaseData).pipe(
      tap(() => {
        console.log('RECURRING TRANSACTION SERVICE : Transaction récurrente mise à jour avec succès');
        this.getRecurringTransactions().subscribe();
      }),
      catchError((err) => {
        console.error('RECURRING TRANSACTION SERVICE : Erreur lors de la mise à jour:', err);
        throw err;
      })
    );
  }

  // Désactiver une transaction récurrente
  deleteRecurringTransaction(id: number): Observable<void> {
    const url = `${this.apiUrl}/${id}`;

    console.log('RECURRING TRANSACTION SERVICE : Désactivation de la transaction récurrente:', id);

    return this.http.delete<void>(url).pipe(
      tap(() => {
        console.log('RECURRING TRANSACTION SERVICE : Transaction récurrente désactivée avec succès');
        this.getRecurringTransactions().subscribe();
      }),
      catchError((err) => {
        console.error('RECURRING TRANSACTION SERVICE : Erreur lors de la désactivation:', err);
        throw err;
      })
    );
  }

  // Réactiver une transaction récurrente
  reactivateRecurringTransaction(id: number): Observable<void> {
    const url = `${this.apiUrl}/${id}/reactivate`;

    console.log('RECURRING TRANSACTION SERVICE : Réactivation de la transaction récurrente:', id);

    return this.http.patch<void>(url, {}).pipe(
      tap(() => {
        console.log('RECURRING TRANSACTION SERVICE : Transaction récurrente réactivée avec succès');
        this.getRecurringTransactions().subscribe();
      }),
      catchError((err) => {
        console.error('RECURRING TRANSACTION SERVICE : Erreur lors de la réactivation:', err);
        throw err;
      })
    );
  }
}
