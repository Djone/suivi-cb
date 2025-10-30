import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

// PrimeNG Imports
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';

// Modèles et Services
import { RecurringTransaction } from '../../models/recurring-transaction.model';
import { SubCategory } from '../../models/sub-category.model';
import { Account } from '../../models/account.model';
import { AccountService } from '../../services/account.service';
import { SubCategoryService } from '../../services/sub-category.service';
import { FREQUENCY_LIST } from '../../utils/utils';

@Component({
  selector: 'app-edit-recurring-transaction-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    InputNumberModule
  ],
  templateUrl: './edit-recurring-transaction-dialog.component.html',
  styleUrls: ['./edit-recurring-transaction-dialog.component.css']
})
export class EditRecurringTransactionDialogComponent implements OnInit, OnDestroy {
  // ✅ Ajout de la propriété manquante :
  data!: { transaction: RecurringTransaction; isNew?: boolean };

  activeSubCategories: SubCategory[] = [];
  accounts: Account[] = [];
  financialFlows = [
    { id: 1, name: 'Revenu' },
    { id: 2, name: 'Dépense' }
  ];
  frequencies = FREQUENCY_LIST;
  isNew: boolean = false;
  dialogTitle: string = '';
  private sub = new Subscription();

  constructor(
    public ref: DynamicDialogRef,
    public config: DynamicDialogConfig,
    private subCategoryService: SubCategoryService,
    private accountService: AccountService
  ) {
    // Récupération des données passées depuis la liste
    this.data = this.config.data;
    this.isNew = this.data.isNew || false;
    this.dialogTitle = this.isNew
      ? 'Nouvelle transaction récurrente'
      : 'Éditer la transaction récurrente';
  }

  ngOnInit(): void {
    // Charger les sous-catégories selon le flux financier
    if (this.data.transaction.financialFlowId) {
      this.loadSubCategoriesByFlow(this.data.transaction.financialFlowId);
    }
    this.loadAccounts();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  loadSubCategoriesByFlow(financialFlowId: number): void {
    this.sub.add(
      this.subCategoryService.getAllSubCategoriesByFinancialFlowId(financialFlowId).subscribe(subCategories => {
        this.activeSubCategories = subCategories;
      })
    );
  }

  loadAccounts(): void {
    this.sub.add(
      this.accountService.accounts$.subscribe(accounts => {
        this.accounts = accounts;
      })
    );
    this.accountService.getAccounts().subscribe();
  }

  onFinancialFlowChange(): void {
    this.data.transaction.subCategoryId = 0;
    this.activeSubCategories = [];
    this.loadSubCategoriesByFlow(this.data.transaction.financialFlowId);
  }

  save(): void {
    this.data.transaction.amount = Number(this.data.transaction.amount);

    const transactionData: any = {
      label: this.data.transaction.label,
      amount: this.data.transaction.amount,
      dayOfMonth: this.data.transaction.dayOfMonth,
      frequency: this.data.transaction.frequency,
      subCategoryId: this.data.transaction.subCategoryId,
      accountId: this.data.transaction.accountId,
      financialFlowId: this.data.transaction.financialFlowId
    };

    if (!this.isNew && this.data.transaction.id) {
      transactionData.id = this.data.transaction.id;
    }

    this.ref.close(transactionData);
  }

  cancel(): void {
    this.ref.close();
  }

  isFormValid(): boolean {
    return !!(
      this.data.transaction.label &&
      this.data.transaction.label.trim() !== '' &&
      this.data.transaction.amount &&
      this.data.transaction.amount > 0 &&
      this.data.transaction.dayOfMonth &&
      this.data.transaction.dayOfMonth >= 1 &&
      this.data.transaction.dayOfMonth <= 31 &&
      this.data.transaction.frequency &&
      this.data.transaction.subCategoryId &&
      this.data.transaction.accountId
    );
  }
}
