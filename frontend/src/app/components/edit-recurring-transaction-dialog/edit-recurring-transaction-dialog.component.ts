import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RecurringTransaction } from '../../models/recurring-transaction.model';
import { SubCategory } from '../../models/sub-category.model';
import { Account } from '../../models/account.model';
import { SubCategoryService } from '../../services/sub-category.service';
import { AccountService } from '../../services/account.service';

@Component({
  selector: 'app-edit-recurring-transaction-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule
  ],
  templateUrl: './edit-recurring-transaction-dialog.component.html',
  styleUrls: ['./edit-recurring-transaction-dialog.component.css']
})
export class EditRecurringTransactionDialogComponent implements OnInit {
  subcategories: SubCategory[] = [];
  accounts: Account[] = [];
  financialFlows = [
    { id: 1, name: 'Revenu' },
    { id: 2, name: 'Dépense' }
  ];
  frequencies = [
    { value: 'weekly', label: 'Hebdomadaire (chaque semaine)' },
    { value: 'monthly', label: 'Mensuelle (chaque mois)' },
    { value: 'bimonthly', label: 'Bimensuelle (tous les 2 mois)' },
    { value: 'quarterly', label: 'Trimestrielle (tous les 3 mois)' },
    { value: 'biannual', label: 'Semestrielle (tous les 6 mois)' },
    { value: 'yearly', label: 'Annuelle (une fois par an)' }
  ];
  daysOfMonth: number[] = Array.from({ length: 31 }, (_, i) => i + 1);
  daysOfWeek = [
    { value: 1, label: 'Lundi' },
    { value: 2, label: 'Mardi' },
    { value: 3, label: 'Mercredi' },
    { value: 4, label: 'Jeudi' },
    { value: 5, label: 'Vendredi' },
    { value: 6, label: 'Samedi' },
    { value: 7, label: 'Dimanche' }
  ];

  // Données éditables
  label: string = '';
  amount: number = 0;
  dayOfMonth: number = 1;
  frequency: string = 'monthly';
  financialFlowId: number = 1;
  subCategoryId: number = 0;
  accountId: number = 1;

  constructor(
    public dialogRef: MatDialogRef<EditRecurringTransactionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { recurringTransaction: RecurringTransaction },
    private subCategoryService: SubCategoryService,
    private accountService: AccountService
  ) {}

  ngOnInit(): void {
    console.log('Échéance récurrente reçue dans le dialogue:', this.data.recurringTransaction);

    // Charger tous les comptes
    this.accountService.accounts$.subscribe({
      next: (data) => {
        this.accounts = data;
      },
      error: (err) => console.error('Erreur lors du chargement des comptes:', err)
    });

    this.accountService.getAccounts().subscribe();

    // Charger toutes les sous-catégories
    this.subCategoryService.subCategories$.subscribe({
      next: (data) => {
        this.subcategories = data;
      },
      error: (err) => console.error('Erreur lors du chargement des sous-catégories:', err)
    });

    this.subCategoryService.getSubCategories().subscribe();

    // Initialiser les valeurs du formulaire avec les données de l'échéance
    const rt = this.data.recurringTransaction;
    this.label = rt.label || '';
    this.amount = typeof rt.amount === 'string' ? parseFloat(rt.amount) : (rt.amount || 0);
    this.dayOfMonth = typeof rt.dayOfMonth === 'string' ? parseInt(rt.dayOfMonth) : (rt.dayOfMonth || 1);
    this.frequency = rt.frequency || 'monthly';
    this.financialFlowId = typeof rt.financialFlowId === 'string' ? parseInt(rt.financialFlowId) : (rt.financialFlowId || 1);
    this.subCategoryId = typeof rt.subCategoryId === 'string' ? parseInt(rt.subCategoryId) : (rt.subCategoryId || 0);
    this.accountId = typeof rt.accountId === 'string' ? parseInt(rt.accountId) : (rt.accountId || 1);

    // Charger les sous-catégories filtrées par flux financier
    this.filterSubcategoriesByFinancialFlow(this.financialFlowId);
  }

  onFinancialFlowChange(): void {
    this.filterSubcategoriesByFinancialFlow(this.financialFlowId);
  }

  filterSubcategoriesByFinancialFlow(financialFlowId: number): void {
    if (!financialFlowId) {
      return;
    }

    this.subCategoryService.getAllSubCategoriesByFinancialFlowId(financialFlowId).subscribe({
      next: (data) => {
        this.subcategories = data;
      },
      error: (err) => console.error('Erreur lors du chargement des sous-catégories filtrées:', err)
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  isWeeklyFrequency(): boolean {
    return this.frequency === 'weekly';
  }

  getDayLabel(): string {
    if (this.frequency === 'weekly') {
      const dayObj = this.daysOfWeek.find(d => d.value === this.dayOfMonth);
      return dayObj ? dayObj.label : '';
    }
    return this.dayOfMonth.toString();
  }

  onSave(): void {
    const updatedRecurringTransaction: Partial<RecurringTransaction> = {
      id: this.data.recurringTransaction.id,
      label: this.label,
      amount: this.amount,
      dayOfMonth: this.dayOfMonth,
      frequency: this.frequency as 'weekly' | 'monthly' | 'bimonthly' | 'quarterly' | 'biannual' | 'yearly',
      financialFlowId: this.financialFlowId,
      subCategoryId: this.subCategoryId,
      accountId: this.accountId
    };

    console.log('Échéance mise à jour:', updatedRecurringTransaction);
    this.dialogRef.close(updatedRecurringTransaction);
  }
}
