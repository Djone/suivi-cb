import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { TransactionListComponent } from './transaction-list.component';
import { TransactionService } from '../../services/transaction.service';
import { SubCategoryService } from '../../services/sub-category.service';
import { CategoryService } from '../../services/category.service';
import { RecurringTransactionService } from '../../services/recurring-transaction.service';
import { AccountService } from '../../services/account.service';
import { SubCategory } from '../../models/sub-category.model';
import { RecurringTransaction } from '../../models/recurring-transaction.model';
import { Account } from '../../models/account.model';
import { forkJoin, Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { Transaction } from '../../models/transaction.model';
import { ActivatedRoute } from '@angular/router';
import { getParamId, getFinancialFlowNameById, getAccountNameById } from '../../utils/utils';

@Component({
  selector: 'app-transaction-form',
  standalone: true,
  imports: [
      ReactiveFormsModule, 
      MatInputModule,
      MatButtonModule,
      MatFormFieldModule,
      MatSelectModule,
      MatDatepickerModule,
      MatNativeDateModule,
      MatAutocompleteModule,
      TransactionListComponent,
      CommonModule,
      MatIconModule
    ],
  templateUrl: './transaction-form.component.html',
  styleUrls: ['./transaction-form.component.css'],
})
export class TransactionFormComponent {
  accountId: number | null = null;
  accountName: string | null = null;
  financialFlowId: number | null = null;
  financialFlowName: string | null = null;
  transactionForm: FormGroup;
  description: string = ''; // Nom de la sous-catégorie
  date: Date = new Date();
  amount: number | null = null;
  subCategoryId: number | null = null; // ID de la catégorie sélectionnée
  subcategories: SubCategory[] = []; // Liste des catégories disponibles
  filteredSubcategories!: Observable<SubCategory[]>;
  subCategoryControl = new FormControl();
  recurringTransactions: RecurringTransaction[] = []; // Liste des échéances récurrentes
  recurringTransactionId: number | null = null; // Échéance liée (optionnel)
  formSubmitted: boolean = false; // Indique si le formulaire a été soumis
  listComponent: TransactionListComponent[] = [];
  accounts: Account[] = []; // Liste des comptes disponibles
  financialFlows = [
    { id: 1, name: 'Revenu' },
    { id: 2, name: 'Dépense' }
  ];
  showAccountSelector: boolean = false; // Afficher le sélecteur de compte
  showFlowSelector: boolean = false; // Afficher le sélecteur de flux

  constructor(
    private fb: FormBuilder,
    private transactionService: TransactionService,
    private subCategoryService: SubCategoryService,
    private categoryService: CategoryService,
    private recurringTransactionService: RecurringTransactionService,
    private accountService: AccountService,
    private route: ActivatedRoute,
    ) {
    this.transactionForm = this.fb.group({
      date: [null, Validators.required],
      amount: [null, [Validators.required, Validators.min(0.01)]],
      description: ['', Validators.required],
      subCategoryId: ['', Validators.required],
      accountId: [null, Validators.required],
      financialFlowId: ['', Validators.required],
      recurringTransactionId: [null], // Optionnel
    });
  }

  ngOnInit(): void {
    // Charger la liste des comptes
    this.accountService.accounts$.subscribe({
      next: (accounts) => {
        this.accounts = accounts;
      }
    });

    // Récupérer l'ID du compte et le type de catégorie depuis les paramètres de requête
    this.route.queryParams.subscribe((params) => {
      this.accountId = getParamId(params['accountId']);
      this.financialFlowId = getParamId(params['financialFlowId']);

      // Déterminer si on doit afficher les sélecteurs
      this.showAccountSelector = !this.accountId;
      this.showFlowSelector = !this.financialFlowId;

      // Mettre à jour les champs du formulaire
      this.transactionForm.patchValue({
        accountId: this.accountId,
        financialFlowId: this.financialFlowId,
      });

      // Récupérer le nom du compte et du type de catégorie
      this.accountName = this.accountId ? getAccountNameById(this.accountId) : null;
      this.financialFlowName = this.financialFlowId ? getFinancialFlowNameById(this.financialFlowId) : null;

      // Charger les sous-catégories en fonction du financialFlowId
      if (this.financialFlowId) {
        this.loadSubCategories(this.financialFlowId);
      }
    });

    // Charger les échéances récurrentes
    this.recurringTransactionService.recurringTransactions$.subscribe({
      next: (data) => {
        if (this.financialFlowId) {
          this.recurringTransactions = data.filter(rt =>
            rt.financialFlowId === this.financialFlowId && rt.isActive === 1
          );
        }
      },
      error: (err) => console.error('Erreur lors du chargement des échéances récurrentes:', err)
    });
    this.recurringTransactionService.getRecurringTransactions().subscribe();

    // Écouter les changements du financialFlowId dans le formulaire
    this.transactionForm.get('financialFlowId')?.valueChanges.subscribe((flowId) => {
      if (flowId) {
        this.financialFlowId = flowId;
        this.loadSubCategories(flowId);

        // Recharger les échéances récurrentes
        this.recurringTransactionService.recurringTransactions$.subscribe({
          next: (data) => {
            this.recurringTransactions = data.filter(rt =>
              rt.financialFlowId === flowId && rt.isActive === 1
            );
          }
        });
      }
    });

    // Configurer l'autocomplétion
    this.filteredSubcategories = this.subCategoryControl.valueChanges.pipe(
      startWith(''),
      map(value => this._filterSubcategories(value || ''))
    );
  }

  // Charger les sous-catégories pour un flux financier donné
  private loadSubCategories(financialFlowId: number): void {
    this.subCategoryService.getAllSubCategoriesByFinancialFlowId(financialFlowId).subscribe({
      next: (subCategories) => {
        this.subcategories = subCategories;
        console.log('Sous-catégories chargées:', subCategories.length);
      },
      error: (err) => console.error('Erreur lors du chargement des sous-catégories:', err)
    });
  }

  // Fonction pour filtrer les sous-catégories
  private _filterSubcategories(value: string | SubCategory): SubCategory[] {
    const filterValue = typeof value === 'string' ? value.toLowerCase() : value.label.toLowerCase();
    return this.subcategories.filter((subCategory) =>
      subCategory.label.toLowerCase().includes(filterValue)
    );
  }

  // Fonction pour afficher le label dans le champ d'autocomplétion
  displayFn = (subCategory: SubCategory | null): string => {
    return subCategory ? subCategory.label : '';
  }

  // Événement lorsqu'une sous-catégorie est sélectionnée
  onSubCategorySelected(subCategory: SubCategory): void {
    this.transactionForm.patchValue({
      subCategoryId: subCategory.id
    });
    console.log('Sous-catégorie sélectionnée:', subCategory);
  }

  // Obtenir le libellé d'une échéance récurrente pour l'affichage
  getRecurringTransactionLabel(rt: RecurringTransaction): string {
    const frequencyLabels: { [key: string]: string } = {
      'weekly': 'Hebdo',
      'monthly': 'Mensuel',
      'bimonthly': 'Bimensuel',
      'quarterly': 'Trimestriel',
      'biannual': 'Semestriel',
      'yearly': 'Annuel'
    };
    const freqLabel = frequencyLabels[rt.frequency] || rt.frequency;
    return `${rt.label} (${freqLabel} - ${rt.amount}€)`;
  }

  // Pré-remplir le formulaire quand une échéance est sélectionnée
  onRecurringTransactionSelected(recurringId: number): void {
    const recurring = this.recurringTransactions.find(rt => rt.id === recurringId);
    if (recurring) {
      // Trouver la sous-catégorie correspondante
      const subCategory = this.subcategories.find(sc => sc.id === recurring.subCategoryId);

      this.transactionForm.patchValue({
        description: recurring.label,
        amount: recurring.amount,
        subCategoryId: recurring.subCategoryId
      });

      // Mettre à jour le contrôle d'autocomplétion
      if (subCategory) {
        this.subCategoryControl.setValue(subCategory);
      }

      console.log('Échéance sélectionnée:', recurring);
    }
  }

  onSubmit(): void {
    this.formSubmitted = true;

    if (!this.transactionForm.valid) {
        return; // Validation échouée
    }

    const formData = this.transactionForm.value;

    // Convertir la date en format ISO
    const formattedDate = new Date(formData.date).toISOString().slice(0, 10); // YYYY-MM-DD

    const newTransaction: Transaction = {
      ...formData,
      date: formattedDate, // Date formatée
    };

    // Appel au service pour ajouter la transaction
    this.transactionService.addTransaction(newTransaction).subscribe({
      next: () => {
        this.resetForm();
        this.subCategoryService.getSubCategories(); // Récupérer les catégories mises à jour
        this.transactionService.loadTransactions(); // Recharger les transactions
      },
      error: (err) => console.error('Erreur lors de l\'ajout de la transaction :', err),
    });
  }

  resetForm(): void {
    this.transactionForm.reset({
      date: null,
      amount: null,
      description: '',
      subCategoryId: '',
      accountId: this.accountId, // Remet l'accountId dans le formulaire après reset
      financialFlowId: this.financialFlowId, // Remet le financialFlowId dans le formulaire après reset
    });

    // Réinitialiser le contrôle d'autocomplétion
    this.subCategoryControl.reset('');

    // Réinitialiser les erreurs de validation
    this.transactionForm.markAsPristine(); // Marquer le formulaire comme "propre"
    this.transactionForm.markAsUntouched(); // Marquer le formulaire comme "non touché"

    // Si vous voulez également réinitialiser les erreurs de chaque champ individuellement :
    Object.keys(this.transactionForm.controls).forEach((field) => {
      const control = this.transactionForm.get(field);
      if (control) {
        control.setErrors(null); // Supprimer toutes les erreurs de validation sur chaque champ
      }
    });

    this.formSubmitted = false;
  }

}
