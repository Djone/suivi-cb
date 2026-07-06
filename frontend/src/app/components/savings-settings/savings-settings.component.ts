import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SavingAccount, SavingAccountSettings } from '../../models/saving-account.model';
import { SavingAccountService } from '../../services/saving-account.service';

@Component({
  selector: 'app-savings-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ButtonModule, CheckboxModule, DialogModule, DropdownModule, InputNumberModule, InputTextModule, MessageModule, TableModule, TagModule],
  templateUrl: './savings-settings.component.html',
  styleUrl: './savings-settings.component.css',
})
export class SavingsSettingsComponent implements OnInit {
  accounts: SavingAccount[] = [];
  dialogVisible = false;
  deleteDialogVisible = false;
  editingId: number | null = null;
  pendingDelete: SavingAccount | null = null;
  errorMessage = '';

  roleOptions = [
    { label: 'Loisirs et provisions', value: 'leisure' },
    { label: "Fonds d'urgence", value: 'emergency' },
    { label: 'Paiements en ligne', value: 'online_payment' },
    { label: 'Epargne disponible', value: 'savings' },
    { label: 'Investissement', value: 'investment' },
    { label: 'Epargne salariale', value: 'employee_savings' },
  ];
  liquidityOptions = [
    { label: 'Immédiate', value: 'instant' },
    { label: 'J+1', value: 'day_1' },
    { label: 'Long terme', value: 'long_term' },
  ];

  form: SavingAccountSettings = this.emptyForm();

  constructor(private service: SavingAccountService) {}

  ngOnInit(): void { this.loadAccounts(); }

  openCreate(): void {
    this.editingId = null;
    this.form = this.emptyForm();
    this.errorMessage = '';
    this.dialogVisible = true;
  }

  openEdit(account: SavingAccount): void {
    this.editingId = account.id;
    this.form = {
      name: account.name,
      bankName: account.bankName,
      role: account.role,
      liquidityLevel: account.liquidityLevel,
      currentBalance: account.baseBalance,
      targetBalance: account.targetBalance,
      minimumBalance: account.minimumBalance,
      includeInDailyBudget: account.includeInDailyBudget,
      includeInWealth: account.includeInWealth,
    };
    this.errorMessage = '';
    this.dialogVisible = true;
  }

  save(): void {
    if (!this.form.name.trim() || !this.form.bankName.trim()) {
      this.errorMessage = 'Le nom du compte et la banque sont obligatoires.';
      return;
    }
    const request = this.editingId === null
      ? this.service.createAccount(this.form)
      : this.service.updateAccountSettings(this.editingId, this.form);
    request.subscribe({
      next: () => { this.dialogVisible = false; this.loadAccounts(); },
      error: () => { this.errorMessage = "Impossible d'enregistrer ce compte."; },
    });
  }

  requestDelete(account: SavingAccount): void {
    this.pendingDelete = account;
    this.deleteDialogVisible = true;
  }

  confirmDelete(): void {
    if (!this.pendingDelete) return;
    this.service.deleteAccount(this.pendingDelete.id).subscribe({
      next: () => {
        this.deleteDialogVisible = false;
        this.pendingDelete = null;
        this.loadAccounts();
      },
      error: () => {
        this.deleteDialogVisible = false;
        this.errorMessage = 'Ce compte ne peut pas être supprimé.';
      },
    });
  }

  roleLabel(value: string): string {
    return this.roleOptions.find((option) => option.value === value)?.label ?? value;
  }

  liquidityLabel(value: string): string {
    return this.liquidityOptions.find((option) => option.value === value)?.label ?? value;
  }

  private loadAccounts(): void {
    this.service.getAccounts().subscribe({
      next: (accounts) => { this.accounts = accounts; },
      error: () => { this.errorMessage = "Impossible de charger les comptes d'épargne."; },
    });
  }

  private emptyForm(): SavingAccountSettings {
    return {
      name: '', bankName: '', role: 'savings', liquidityLevel: 'instant',
      currentBalance: 0, targetBalance: null, minimumBalance: null,
      includeInDailyBudget: false, includeInWealth: true,
    };
  }
}
