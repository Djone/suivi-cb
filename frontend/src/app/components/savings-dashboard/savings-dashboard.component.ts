import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MessageModule } from 'primeng/message';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { SavingAccountService } from '../../services/saving-account.service';
import { LiquidityLevel, SavingAccount, SavingAccountRole } from '../../models/saving-account.model';

@Component({
  selector: 'app-savings-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, MessageModule, ButtonModule, ProgressBarModule],
  templateUrl: './savings-dashboard.component.html',
  styleUrl: './savings-dashboard.component.css',
})
export class SavingsDashboardComponent implements OnInit {
  accounts: SavingAccount[] = [];
  loading = true;
  loadError = false;

  constructor(private savingAccountService: SavingAccountService) {}

  ngOnInit(): void {
    this.savingAccountService.getAccounts().subscribe({
      next: (accounts) => { this.accounts = accounts; this.loading = false; },
      error: () => { this.loadError = true; this.loading = false; },
    });
  }

  get totalWealth(): number {
    return this.accounts.filter((item) => item.includeInWealth)
      .reduce((total, item) => total + item.currentBalance, 0);
  }

  get liquidAccounts(): SavingAccount[] {
    return this.accounts.filter((item) => item.liquidityLevel !== 'long_term');
  }

  get longTermAccounts(): SavingAccount[] {
    return this.accounts.filter((item) => item.liquidityLevel === 'long_term');
  }

  get availableSavings(): number {
    return this.liquidAccounts.reduce((total, item) => total + item.currentBalance, 0);
  }

  get longTermSavings(): number {
    return this.longTermAccounts.reduce((total, item) => total + item.currentBalance, 0);
  }

  get alertCount(): number {
    return this.accounts.filter((item) => this.isBelowMinimum(item)).length;
  }

  progress(account: SavingAccount): number {
    if (!account.targetBalance || account.targetBalance <= 0) return 0;
    return Math.min(100, Math.max(0, account.currentBalance / account.targetBalance * 100));
  }

  isBelowMinimum(account: SavingAccount): boolean {
    return account.minimumBalance != null && account.currentBalance < account.minimumBalance;
  }

  roleLabel(role: SavingAccountRole): string {
    return ({
      leisure: 'Loisirs et provisions',
      emergency: "Fonds d'urgence",
      online_payment: 'Paiements en ligne et charges',
      savings: 'Epargne disponible',
      investment: 'Investissement long terme',
      employee_savings: 'Epargne salariale',
    })[role];
  }

  liquidityLabel(level: LiquidityLevel): string {
    return ({ instant: 'Immediate', day_1: 'J+1', long_term: 'Long terme' })[level];
  }

  bankLogo(account: SavingAccount): string {
    const logoKey = account.providerKey.startsWith('goodvest')
      ? 'goodvest'
      : account.providerKey;
    return `/bank-logos/${logoKey}.png`;
  }

  hasBankLogo(account: SavingAccount): boolean {
    return ['plum', 'revolut', 'fortuneo', 'cfcal', 'cic'].includes(
      account.providerKey,
    ) || account.providerKey.startsWith('goodvest');
  }
}
