import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { PlannedTransaction } from '../models/planned-transaction.model';

@Injectable({ providedIn: 'root' })
export class PlannedTransactionService {
  private readonly _planned$ = new BehaviorSubject<PlannedTransaction[]>([]);
  readonly plannedTransactions$ = this._planned$.asObservable();

  getPlannedTransactions(): Observable<PlannedTransaction[]> {
    return this.plannedTransactions$;
  }

  addPlannedTransaction(item: PlannedTransaction): Observable<void> {
    const list = this._planned$.getValue();
    const id = item.id ?? this.generateId(list);
    this._planned$.next([...list, { ...item, id }]);
    return of(void 0);
  }

  updatePlannedTransaction(item: PlannedTransaction): Observable<void> {
    const list = this._planned$.getValue();
    const next = list.map((p) => (p.id === item.id ? { ...p, ...item } : p));
    this._planned$.next(next);
    return of(void 0);
  }

  deletePlannedTransaction(id: number): Observable<void> {
    const list = this._planned$.getValue();
    this._planned$.next(list.filter((p) => p.id !== id));
    return of(void 0);
  }

  markAsRealized(id: number): Observable<void> {
    const list = this._planned$.getValue();
    const next = list.map((p) => (p.id === id ? { ...p, isRealized: true } : p));
    this._planned$.next(next);
    return of(void 0);
  }

  private generateId(list: PlannedTransaction[]): number {
    return (list.reduce((m, p) => Math.max(m, p.id || 0), 0) || 0) + 1;
  }
}

