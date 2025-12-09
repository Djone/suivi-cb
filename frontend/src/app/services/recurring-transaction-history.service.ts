import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import * as humps from 'humps';
import { RecurringTransactionHistory } from '../models/recurring-transaction-history.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class RecurringTransactionHistoryService {
  private readonly apiUrl = `${environment.apiUrl}/api/recurring-transactions`;

  constructor(private http: HttpClient) {}

  getHistory(recurringId: number): Observable<RecurringTransactionHistory[]> {
    return this.http
      .get<RecurringTransactionHistory[]>(`${this.apiUrl}/${recurringId}/history`)
      .pipe(map((items) => items.map((item) => this.normalizeHistory(item))));
  }

  addEntry(
    recurringId: number,
    entry: Pick<RecurringTransactionHistory, 'amount' | 'effectiveFrom'>,
  ): Observable<{ id: number }> {
    const payload = humps.decamelizeKeys(entry);
    return this.http.post<{ id: number }>(`${this.apiUrl}/${recurringId}/history`, payload);
  }

  getChangeRate(recurringId: number): Observable<number | null> {
    return this.getHistory(recurringId).pipe(
      map((items) => {
        if (items.length < 2) {
          return null;
        }
        const sorted = [...items].sort(
          (a, b) =>
            new Date(a.effectiveFrom as any).getTime() -
            new Date(b.effectiveFrom as any).getTime(),
        );
        const prev = sorted[sorted.length - 2]?.amount;
        const curr = sorted[sorted.length - 1]?.amount;
        if (!prev || !curr) {
          return null;
        }
        return ((curr - prev) / prev) * 100;
      }),
    );
  }

  private normalizeHistory(item: any): RecurringTransactionHistory {
    const camel = humps.camelizeKeys(item) as Partial<RecurringTransactionHistory>;
    if (camel.effectiveFrom && typeof camel.effectiveFrom === 'string') {
      camel.effectiveFrom = new Date(camel.effectiveFrom);
    }
    if (camel.amount != null) {
      const rawAmount = camel.amount as unknown;
      const parsed =
        typeof rawAmount === 'string'
          ? parseFloat(rawAmount.replace(',', '.'))
          : Number(rawAmount);
      camel.amount = Number.isFinite(parsed) ? parsed : 0;
    }
    return camel as RecurringTransactionHistory;
  }
}
