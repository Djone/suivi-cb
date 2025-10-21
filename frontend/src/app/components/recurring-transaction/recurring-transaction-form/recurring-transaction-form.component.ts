import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { RecurringTransactionService } from '../../../services/recurring-transaction.service';
import { SubCategoryService } from '../../../services/sub-category.service';
import { AccountService } from '../../../services/account.service';
import { RecurringTransaction } from '../../../models/recurring-transaction.model';
import { SubCategory } from '../../../models/sub-category.model';
import { Account } from '../../../models/account.model';
import { RecurringTransactionListComponent } from '../recurring-transaction-list/recurring-transaction-list.component';

@Component({
  selector: 'app-recurring-transaction-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    RecurringTransactionListComponent
  ],
  templateUrl: './recurring-transaction-form.component.html',
  styleUrls: ['./recurring-transaction-form.component.css'],
})
export class RecurringTransactionFormComponent implements OnInit {
  recurringTransactionForm: FormGroup;
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

  constructor(
    private fb: FormBuilder,
    private recurringTransactionService: RecurringTransactionService,
    private subCategoryService: SubCategoryService,
    private accountService: AccountService
  ) {
    this.recurringTransactionForm = this.fb.group({
      label: ['', Validators.required],
      amount: [null, [Validators.required, Validators.min(0.01)]],
      dayOfMonth: [1, [Validators.required, Validators.min(1), Validators.max(31)]],
      frequency: ['monthly', Validators.required],
      financialFlowId: [null, Validators.required],
      subCategoryId: [null, Validators.required],
      accountId: [1, Validators.required] // Pour l'instant, on fixe à 1
    });
  }

  ngOnInit(): void {
    // Charger tous les comptes
    this.accountService.accounts$.subscribe({
      next: (data) => {
        this.accounts = data;
        console.log('Comptes chargés:', this.accounts);
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

    // Filtrer les sous-catégories selon le flux financier sélectionné
    this.recurringTransactionForm.get('financialFlowId')?.valueChanges.subscribe((financialFlowId) => {
      this.filterSubcategoriesByFinancialFlow(financialFlowId);
    });
  }

  filterSubcategoriesByFinancialFlow(financialFlowId: number): void {
    if (!financialFlowId) {
      return;
    }

    this.subCategoryService.getAllSubCategoriesByFinancialFlowId(financialFlowId).subscribe({
      next: (data) => {
        this.subcategories = data;
        // Réinitialiser la sous-catégorie sélectionnée
        this.recurringTransactionForm.patchValue({ subCategoryId: null });
      },
      error: (err) => console.error('Erreur lors du chargement des sous-catégories filtrées:', err)
    });
  }

  isWeeklyFrequency(): boolean {
    return this.recurringTransactionForm.get('frequency')?.value === 'weekly';
  }

  onSubmit(): void {
    if (!this.recurringTransactionForm.valid) {
      return;
    }

    const newRecurringTransaction: RecurringTransaction = this.recurringTransactionForm.value;

    console.log('Nouvelle transaction récurrente:', newRecurringTransaction);

    this.recurringTransactionService.addRecurringTransaction(newRecurringTransaction).subscribe({
      next: () => {
        console.log('Transaction récurrente ajoutée avec succès');
        this.resetForm();
      },
      error: (err) => console.error('Erreur lors de l\'ajout de la transaction récurrente:', err),
    });
  }

  resetForm(): void {
    this.recurringTransactionForm.reset({
      label: '',
      amount: null,
      dayOfMonth: 1,
      frequency: 'monthly',
      financialFlowId: null,
      subCategoryId: null,
      accountId: 1
    });

    this.recurringTransactionForm.markAsPristine();
    this.recurringTransactionForm.markAsUntouched();
  }
}
