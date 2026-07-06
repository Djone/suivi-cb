import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { SavingAccount, SavingAccountSettings, SavingAccountUpdate } from '../models/saving-account.model';

@Injectable({ providedIn: 'root' })
export class SavingAccountService {
  private readonly apiUrl = `${environment.apiUrl}/api/saving-accounts`;

  constructor(private http: HttpClient) {}

  getAccounts(): Observable<SavingAccount[]> {
    return this.http.get<SavingAccount[]>(this.apiUrl).pipe(
      map((accounts) => accounts.map((account) => this.normalize(account))),
    );
  }

  getAccount(id: number): Observable<SavingAccount> {
    return this.http.get<SavingAccount>(`${this.apiUrl}/${id}`).pipe(
      map((account) => this.normalize(account)),
    );
  }

  updateAccount(id: number, value: SavingAccountUpdate): Observable<SavingAccount> {
    return this.http.patch<SavingAccount>(`${this.apiUrl}/${id}`, value).pipe(
      map((account) => this.normalize(account)),
    );
  }

  createAccount(value: SavingAccountSettings): Observable<SavingAccount> {
    return this.http.post<SavingAccount>(this.apiUrl, value).pipe(
      map((account) => this.normalize(account)),
    );
  }

  updateAccountSettings(
    id: number,
    value: SavingAccountSettings,
  ): Observable<SavingAccount> {
    return this.http.put<SavingAccount>(`${this.apiUrl}/${id}`, value).pipe(
      map((account) => this.normalize(account)),
    );
  }

  deleteAccount(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  private normalize(account: SavingAccount): SavingAccount {
    return {
      ...account,
      currentBalance: Number(account.currentBalance) || 0,
      baseBalance: Number(account.baseBalance ?? account.currentBalance) || 0,
      targetBalance: account.targetBalance == null ? null : Number(account.targetBalance),
      minimumBalance: account.minimumBalance == null ? null : Number(account.minimumBalance),
      includeInDailyBudget: Boolean(account.includeInDailyBudget),
      includeInWealth: Boolean(account.includeInWealth),
      isActive: Boolean(account.isActive),
    };
  }
}
