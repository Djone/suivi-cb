import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription, switchMap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageModule } from 'primeng/message';
import { SavingsComponent } from '../savings/savings.component';
import { SavingAccount } from '../../models/saving-account.model';
import { SavingAccountService } from '../../services/saving-account.service';

@Component({
  selector: 'app-account-saving',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ButtonModule, InputNumberModule, MessageModule, SavingsComponent],
  templateUrl: './account-saving.component.html',
  styleUrl: './account-saving.component.css',
})
export class AccountSavingComponent implements OnInit, OnDestroy {
  account: SavingAccount | null = null;
  loading = true;
  loadError = false;
  saveError = false;
  saved = false;
  private readonly subscription = new Subscription();

  constructor(private route: ActivatedRoute, private service: SavingAccountService) {}

  ngOnInit(): void {
    this.subscription.add(
      this.route.paramMap.pipe(
        switchMap((params) => this.service.getAccount(Number(params.get('id')))),
      ).subscribe({
        next: (account) => { this.account = account; this.loading = false; },
        error: () => { this.loadError = true; this.loading = false; },
      }),
    );
  }

  ngOnDestroy(): void { this.subscription.unsubscribe(); }

  get progress(): number {
    const target = this.account?.targetBalance;
    if (!target || target <= 0) return 0;
    return Math.min(100, Math.max(0, (this.account?.currentBalance ?? 0) / target * 100));
  }

  get belowMinimum(): boolean {
    return this.account?.minimumBalance != null && this.account.currentBalance < this.account.minimumBalance;
  }

  get accountDescription(): string {
    if (!this.account) return '';
    return ({
      emergency: 'Epargne de securite disponible immediatement.',
      online_payment: 'Reserve dediee aux paiements en ligne et aux charges.',
      savings: 'Epargne disponible avec un delai de retrait.',
      investment: 'Placement destine aux objectifs de long terme.',
      employee_savings: 'Epargne salariale destinee au moyen et long terme.',
      leisure: 'Epargne consacree aux loisirs et aux provisions.',
    })[this.account.role];
  }

  save(): void {
    if (!this.account || this.account.providerKey === 'plum') return;
    this.saved = false;
    this.saveError = false;
    this.service.updateAccount(this.account.id, {
      currentBalance: this.account.baseBalance,
      targetBalance: this.account.targetBalance,
      minimumBalance: this.account.minimumBalance,
      includeInDailyBudget: this.account.includeInDailyBudget,
      includeInWealth: this.account.includeInWealth,
    }).subscribe({
      next: (account) => { this.account = account; this.saved = true; },
      error: () => { this.saveError = true; },
    });
  }
}
