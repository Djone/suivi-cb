import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
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
import { SubCategory } from '../../models/sub-category.model';
import { forkJoin } from 'rxjs';
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
  filteredSubcategories: SubCategory[] = [];
  formSubmitted: boolean = false; // Indique si le formulaire a été soumis
  listComponent: TransactionListComponent[] = [];

  constructor(
    private fb: FormBuilder,
    private transactionService: TransactionService,
    private subCategoryService: SubCategoryService,
    private categoryService: CategoryService,
    private route: ActivatedRoute,
    ) {
    this.transactionForm = this.fb.group({
      date: [null, Validators.required],
      amount: [null, [Validators.required, Validators.min(0.01)]],
      description: ['', Validators.required],
      subCategoryId: ['', Validators.required],
      accountId: [null, Validators.required],
      financialFlowId: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    // Récupérer l'ID du compte et le type de catégorie depuis les paramètres de requête
    this.route.queryParams.subscribe((params) => {
      this.accountId = getParamId(params['accountId']);
      this.financialFlowId = getParamId(params['financialFlowId']);
      
      console.log('TRANSACTION FORM COMPONENT : ngOnInit appelé : accountId =>', this.accountId, ' - financialFlowId =>', this.financialFlowId);

      // Mettre à jour les champs du formulaire
      this.transactionForm.patchValue({
        accountId: this.accountId,
        financialFlowId: this.financialFlowId,
      });
  
      // Récupérer le nom du compte et du type de catégorie
      this.accountName = this.accountId ? getAccountNameById(this.accountId) : 'Aucun compte sélectionné';
        
      this.financialFlowName = this.financialFlowId ? getFinancialFlowNameById(this.financialFlowId) : 'Aucun flux financier sélectionnée';
    });
  
    // Récupérer les sous-catégories et les autres données en parallèle
    forkJoin([
      this.subCategoryService.getAllSubCategoriesByFinancialFlowId(this.financialFlowId!),
      getAccountNameById(this.accountId!), // ou une autre requête pour les informations nécessaires
    ]).subscribe(([subCategoriesData, accountData]) => {
      this.subcategories = subCategoriesData;
      this.filteredSubcategories = this.subcategories;
    });
  }

  // Fonction pour filtrer les sous-catégories
  private _filterSubcategories(value: string): SubCategory[] {
    const filterValue = value.toLowerCase();
    const filtered = this.subcategories.filter((subCategory) =>
      subCategory.label.toLowerCase().includes(filterValue)
    );
    console.log('TRANSACTION FORM COMPONENT : Sous-catégories filtrées:', filtered);  // Vérifier la liste filtrée
    return filtered;
  }

  onSubmit(): void {
    this.formSubmitted = true;

    if (!this.transactionForm.valid) {
        console.log('description:', this.description);
        console.log('date:', this.date);
        console.log('amount:', this.amount);
        console.log('subCategoryId:', this.subCategoryId);
        console.log('accountId:', this.accountId);
        console.log('financialFlowId:', this.financialFlowId);
        console.log('transaction annulée');
        return; // Validation échouée
    }

    const formData = this.transactionForm.value;
    
    // Convertir la date en format ISO
    const formattedDate = new Date(formData.date).toISOString().slice(0, 10); // YYYY-MM-DD

    const newTransaction: Transaction = {
      ...formData,
      date: formattedDate, // Date formatée
    };

    console.log('TRANSACTION FORM COMPONENT : transaction envoyée au backend:', newTransaction);

    // Appel au service pour ajouter la sous-catégorie
    this.transactionService.addTransaction(newTransaction).subscribe({
      next: () => {
        console.log('TRANSACTION FORM COMPONENT : Transaction ajoutée avec succès');
        this.resetForm();
        this.subCategoryService.getSubCategories(); // Récupérer les catégories mises à jour
        this.transactionService.loadTransactions(); // Recharger les transactions
      },
      error: (err) => console.error('TRANSACTION FORM COMPONENT : Erreur lors de l\'ajout de la transaction :', err),
    });
  }

  resetForm(): void {
    this.transactionForm.reset({
      date: null,
      amount: null,
      label: '',
      subCategoryId: '',
      accountId: this.accountId, // Remet l'accountId dans le formulaire après reset
      financialFlowId: this.financialFlowId, // Remet le financialFlowId dans le formulaire après reset
    });

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
