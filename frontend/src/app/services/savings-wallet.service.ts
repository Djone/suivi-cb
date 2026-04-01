import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import * as humps from 'humps';
import {
  SavingsWallet,
  SavingsWalletAllocation,
  SavingsWalletAllocationRow,
  SavingsWalletProgress,
} from '../models/savings-wallet.model';

interface CreateWalletPayload {
  name: string;
  targetAmount: number;
}

interface UpdateWalletPayload {
  name?: string;
  targetAmount?: number;
  isActive?: boolean;
}

interface WalletSummaryFilters {
  accountId?: number | null;
  year?: number | null;
  month?: number | null;
  flow?: 'all' | 'incoming' | 'outgoing';
  includeClosed?: boolean;
}

interface WalletQueryOptions {
  includeClosed?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class SavingsWalletService {
  private apiUrl = `${environment.apiUrl}/api/savings-wallets`;

  constructor(private http: HttpClient) {}

  getWallets(options: WalletQueryOptions = {}): Observable<SavingsWallet[]> {
    const rawOptions: Record<string, string> = {};
    if (options.includeClosed) {
      rawOptions['include_closed'] = 'true';
    }
    const params = new HttpParams({
      fromObject: rawOptions,
    });
    return this.http.get<SavingsWallet[]>(this.apiUrl, { params }).pipe(
      map((wallets) =>
        wallets.map((wallet) => humps.camelizeKeys(wallet) as SavingsWallet),
      ),
      catchError((err) => {
        console.error('SAVINGS WALLET SERVICE : Erreur lors du chargement:', err);
        throw err;
      }),
    );
  }

  createWallet(payload: CreateWalletPayload): Observable<{ id: number }> {
    const camel = humps.decamelizeKeys({
      name: payload.name,
      target_amount: payload.targetAmount,
    });
    return this.http.post<{ id: number }>(this.apiUrl, camel).pipe(
      catchError((err) => {
        console.error('SAVINGS WALLET SERVICE : Erreur lors de la création:', err);
        throw err;
      }),
    );
  }

  updateWallet(id: number, payload: UpdateWalletPayload): Observable<void> {
    const rawPayload: Record<string, unknown> = {};

    if (payload.name !== undefined) {
      rawPayload['name'] = payload.name;
    }

    if (payload.targetAmount !== undefined) {
      rawPayload['target_amount'] = payload.targetAmount;
    }

    if (payload.isActive !== undefined) {
      rawPayload['is_active'] = payload.isActive;
    }

    return this.http
      .patch<void>(`${this.apiUrl}/${id}`, humps.decamelizeKeys(rawPayload))
      .pipe(
        catchError((err) => {
          console.error(
            'SAVINGS WALLET SERVICE : Erreur lors de la mise a jour:',
            err,
          );
          throw err;
        }),
      );
  }

  deleteWallet(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      catchError((err) => {
        console.error(
          'SAVINGS WALLET SERVICE : Erreur lors de la suppression:',
          err,
        );
        throw err;
      }),
    );
  }

  getAllocationSummary(
    filters: WalletSummaryFilters = {},
  ): Observable<SavingsWalletProgress[]> {
    const rawFilters: Record<string, string> = {};

    const { accountId, year, month, flow } = filters;
    if (accountId !== undefined && accountId !== null) {
      rawFilters['accountId'] = String(accountId);
    }

    if (year !== undefined && year !== null) {
      rawFilters['year'] = String(year);
    }

    if (month !== undefined && month !== null) {
      rawFilters['month'] = String(month);
    }

    if (flow && flow !== 'all') {
      rawFilters['flow'] = flow;
    }

    if (filters.includeClosed) {
      rawFilters['include_closed'] = 'true';
    }

    const cleanedFilters = humps.decamelizeKeys(rawFilters) as Record<string, string>;
    const params = new HttpParams({ fromObject: cleanedFilters });
    return this.http
      .get<SavingsWalletProgress[]>(`${this.apiUrl}/summary`, { params })
      .pipe(
        map((summary) =>
          summary.map((item) => humps.camelizeKeys(item) as SavingsWalletProgress),
        ),
        catchError((err) => {
          console.error(
            'SAVINGS WALLET SERVICE : Erreur lors du chargement du récapitulatif:',
            err,
          );
          throw err;
        }),
      );
  }

  closeWallet(id: number): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${id}/close`, {}).pipe(
      catchError((err) => {
        console.error(
          'SAVINGS WALLET SERVICE : Erreur lors de la clôture du portefeuille:',
          err,
        );
        throw err;
      }),
    );
  }

  getTransactionAllocations(transactionId: number): Observable<SavingsWalletAllocationRow[]> {
    return this.http
      .get<SavingsWalletAllocationRow[]>(
        `${this.apiUrl}/allocations/${transactionId}`,
      )
      .pipe(
        map((allocations) =>
          allocations.map((allocation) =>
            humps.camelizeKeys(allocation) as SavingsWalletAllocationRow,
          ),
        ),
        catchError((err) => {
          console.error(
            'SAVINGS WALLET SERVICE : Erreur lors du chargement allocations:',
            err,
          );
          throw err;
        }),
      );
  }

  getAllocationsForTransactions(
    transactionIds: number[],
  ): Observable<SavingsWalletAllocationRow[]> {
    if (!transactionIds.length) {
      return of([]);
    }

    return this.http
      .post<SavingsWalletAllocationRow[]>(
        `${this.apiUrl}/allocations/batch`,
        humps.decamelizeKeys({ transaction_ids: transactionIds }),
      )
      .pipe(
        map((allocations) =>
          allocations.map((allocation) =>
            humps.camelizeKeys(allocation) as SavingsWalletAllocationRow,
          ),
        ),
        catchError((err) => {
          console.error(
            'SAVINGS WALLET SERVICE : Erreur lors du chargement allocations batch:',
            err,
          );
          throw err;
        }),
      );
  }

  setTransactionAllocations(
    transactionId: number,
    allocations: Array<{ walletId: number; amount: number }>,
  ): Observable<void> {
    const payload = humps.decamelizeKeys({
      transaction_id: transactionId,
      allocations: allocations.map((allocation) => ({
        wallet_id: allocation.walletId,
        amount: allocation.amount,
      })),
    });
    return this.http
      .post<void>(`${this.apiUrl}/allocations`, payload)
      .pipe(
        tap(),
        catchError((err) => {
          console.error(
            'SAVINGS WALLET SERVICE : Erreur lors de la sauvegarde allocations:',
            err,
          );
          throw err;
        }),
      );
  }

  getGlobalAllocations(includeClosed = true): Observable<SavingsWalletAllocation[]> {
    let params = new HttpParams();
    if (includeClosed) {
      params = params.set('include_closed', 'true');
    }

    return this.http
      .get<SavingsWalletAllocation[]>(`${this.apiUrl}/allocations/global`, { params })
      .pipe(
        map((allocations) =>
          allocations.map((allocation) =>
            humps.camelizeKeys(allocation) as SavingsWalletAllocation,
          ),
        ),
        catchError((err) => {
          console.error(
            'SAVINGS WALLET SERVICE : Erreur lors du chargement allocations globales:',
            err,
          );
          throw err;
        }),
      );
  }

  setGlobalAllocations(
    allocations: Array<{ walletId: number; amount: number }>,
  ): Observable<void> {
    const payload = humps.decamelizeKeys({
      allocations: allocations.map((allocation) => ({
        wallet_id: allocation.walletId,
        amount: allocation.amount,
      })),
    });

    return this.http.post<void>(`${this.apiUrl}/allocations/global`, payload).pipe(
      catchError((err) => {
        console.error(
          'SAVINGS WALLET SERVICE : Erreur lors de la sauvegarde globale allocations:',
          err,
        );
        throw err;
      }),
    );
  }
}
