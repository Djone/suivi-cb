import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { Subscription } from 'rxjs';

// PrimeNG Imports
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';

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
    MatDialogModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    InputNumberModule
  ],
  templateUrl: './edit-recurring-transaction-dialog.component.html',
  styleUrls: ['./edit-recurring-transaction-dialog.component.css']
})
export class EditRecurringTransactionDialogComponent implements OnInit, OnDestroy {
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
    public dialogRef: MatDialogRef<EditRecurringTransactionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { transaction: RecurringTransaction; isNew?: boolean },
    private subCategoryService: SubCategoryService,
    private accountService: AccountService
  ) {
    this.isNew = data.isNew || false;
    this.dialogTitle = this.isNew ? 'Nouvelle transaction récurrente' : 'Éditer la transaction récurrente';
  }

  ngOnInit(): void {
    // Charger les sous-catégories initiales en fonction du flux financier de la transaction
    if (this.data.transaction.financialFlowId) {
      this.loadSubCategoriesByFlow(this.data.transaction.financialFlowId);
    }
    this.loadAccounts();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  /**
   * Charge les sous-catégories actives pour un flux financier donné.
   * @param financialFlowId L'ID du flux financier (1 pour Revenu, 2 pour Dépense).
   */
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

  /**
   * Appelé lorsque l'utilisateur change le flux financier.
   * Recharge les sous-catégories et réinitialise la sélection.
   */
  onFinancialFlowChange(): void {
    this.data.transaction.subCategoryId = 0; // Réinitialiser la sélection
    this.activeSubCategories = []; // Vider la liste
    this.loadSubCategoriesByFlow(this.data.transaction.financialFlowId);
  }

  save(): void {
    // Assurer que le montant est bien un nombre
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

    this.dialogRef.close(transactionData);
  }

  cancel(): void {
    this.dialogRef.close();
  }

  isFormValid(): boolean {
    return !!(
      this.data.transaction.label && this.data.transaction.label.trim() !== '' &&
      this.data.transaction.amount && this.data.transaction.amount > 0 &&
      this.data.transaction.dayOfMonth && this.data.transaction.dayOfMonth >= 1 && this.data.transaction.dayOfMonth <= 31 &&
      this.data.transaction.frequency &&
      this.data.transaction.subCategoryId &&
      this.data.transaction.accountId
    );
  }
}
