import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Account } from '../models/account.model';

@Injectable({
  providedIn: 'root'
})
export class AccountService {
  private apiUrl = 'http://localhost:3000/api/accounts';
  private configApiUrl = 'http://localhost:3000/api/config';
  private accountsSubject = new BehaviorSubject<Account[]>([]);
  public accounts$ = this.accountsSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadAccountsWithConfig();
  }

  // Charger les comptes avec leurs configurations
  private loadAccountsWithConfig(): void {
    this.http.get<Account[]>(this.apiUrl).subscribe(accounts => {
      this.http.get<any>(`${this.configApiUrl}/accounts`).subscribe(config => {
        console.log('ACCOUNT SERVICE : Config récupérée:', config);

        // Fusionner les données des comptes avec la config
        const accountsWithConfig = accounts.map(account => {
          const accountConfig = config.accounts?.find((c: any) => c.accountId === account.id);
          return {
            ...account,
            initialBalance: accountConfig?.initialBalance || 0
          };
        });

        console.log('ACCOUNT SERVICE : Comptes avec config:', accountsWithConfig);
        this.accountsSubject.next(accountsWithConfig);
      }, error => {
        console.error('ACCOUNT SERVICE : Erreur lors du chargement de la config', error);
        // En cas d'erreur, charger sans config
        this.accountsSubject.next(accounts);
      });
    });
  }

  // Récupérer tous les comptes actifs
  getAccounts(): Observable<Account[]> {
    this.loadAccountsWithConfig();
    return this.accounts$;
  }

  // Récupérer tous les comptes y compris inactifs
  getAllAccountsIncludingInactive(): Observable<Account[]> {
    return this.http.get<Account[]>(`${this.apiUrl}/all`).pipe(
      tap((accounts) => {
        console.log('ACCOUNT SERVICE : Tous les comptes récupérés avec succès', accounts);
      })
    );
  }

  // Récupérer un compte par son ID
  getAccountById(id: number): Observable<Account> {
    return this.http.get<Account>(`${this.apiUrl}/${id}`).pipe(
      tap((account) => {
        console.log('ACCOUNT SERVICE : Compte récupéré avec succès', account);
      })
    );
  }

  // Ajouter un nouveau compte
  addAccount(account: Account): Observable<any> {
    return this.http.post<any>(this.apiUrl, account).pipe(
      tap(() => {
        console.log('ACCOUNT SERVICE : Compte ajouté avec succès');
        this.getAccounts().subscribe();
      })
    );
  }

  // Mettre à jour un compte
  updateAccount(id: number, account: Partial<Account>): Observable<void> {
    const url = `${this.apiUrl}/${id}`;
    return this.http.put<void>(url, account).pipe(
      tap(() => {
        console.log('ACCOUNT SERVICE : Compte mis à jour avec succès');
        this.getAccounts().subscribe();
      })
    );
  }

  // Désactiver un compte
  deactivateAccount(id: number): Observable<void> {
    const url = `${this.apiUrl}/${id}/deactivate`;
    return this.http.patch<void>(url, {}).pipe(
      tap(() => {
        console.log('ACCOUNT SERVICE : Compte désactivé avec succès');
        this.getAccounts().subscribe();
      })
    );
  }

  // Réactiver un compte
  reactivateAccount(id: number): Observable<void> {
    const url = `${this.apiUrl}/${id}/reactivate`;
    return this.http.patch<void>(url, {}).pipe(
      tap(() => {
        console.log('ACCOUNT SERVICE : Compte réactivé avec succès');
        this.getAccounts().subscribe();
      })
    );
  }
}
