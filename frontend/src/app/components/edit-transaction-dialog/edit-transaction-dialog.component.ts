import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';

// PrimeNG Imports
import { InputTextModule } from 'primeng/inputtext';
import { CalendarModule } from 'primeng/calendar';
import { InputNumberModule } from 'primeng/inputnumber';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';

import { Transaction } from '../../models/transaction.model';
import { SubCategory } from '../../models/sub-category.model';
import { Account } from '../../models/account.model';
import { SubCategoryService } from '../../services/sub-category.service';
import { AccountService } from '../../services/account.service';
import { FINANCIAL_FLOW_LIST } from '../../config/financial-flow.config';

interface DialogData {
  transaction: Transaction;
  isNew?: boolean;
}

@Component({
  selector: 'app-edit-transaction-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    InputTextModule,
    CalendarModule,
    InputNumberModule,
    AutoCompleteModule,
    ButtonModule,
    DropdownModule
  ],
  templateUrl: './edit-transaction-dialog.component.html',
  styleUrls: ['./edit-transaction-dialog.component.css']
})
export class EditTransactionDialogComponent implements OnInit {
  subcategories: SubCategory[] = [];
  subCategoryControl = new FormControl();
  filteredSubcategories: SubCategory[] = [];
  transactionDate!: Date;
  selectedSubCategoryId!: number;
  dialogTitle: string = 'Éditer la transaction';
  isNew: boolean = false;

  // Listes pour les dropdowns
  accounts: Account[] = [];
  financialFlowList = FINANCIAL_FLOW_LIST;

  constructor(
    public dialogRef: MatDialogRef<EditTransactionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
    private subCategoryService: SubCategoryService,
    private accountService: AccountService
  ) {
    this.isNew = data.isNew || false;
    this.dialogTitle = this.isNew ? 'Nouvelle transaction' : 'Éditer la transaction';

    // Écouter les changements du FormControl pour synchroniser selectedSubCategoryId
    this.subCategoryControl.valueChanges.subscribe(value => {
      console.log('FormControl value changed:', value);
      if (value && typeof value === 'object' && value.id) {
        this.selectedSubCategoryId = value.id;
        console.log('selectedSubCategoryId synchronisé:', this.selectedSubCategoryId);
      } else if (value === null || value === '') {
        this.selectedSubCategoryId = 0;
      }
    });
  }

  ngOnInit(): void {
    console.log('Transaction reçue dans le dialogue:', this.data.transaction);

    // Charger les comptes
    this.accountService.accounts$.subscribe({
      next: (accounts) => {
        this.accounts = accounts;
        console.log('Comptes chargés dans le dialogue:', this.accounts);
      },
      error: (err) => console.error('Erreur lors du chargement des comptes:', err)
    });

    // Convertir la date string en objet Date (CORRECTION DU PROBLEME DE DECALAGE)
    if (this.data.transaction.date) {
      if (this.data.transaction.date instanceof Date) {
        this.transactionDate = this.data.transaction.date;
      } else {
        const dateValue = this.data.transaction.date;
        const dateStr = typeof dateValue === 'string' ? dateValue : String(dateValue);

        // Créer la date en mode local pour éviter le décalage UTC
        const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
        this.transactionDate = new Date(year, month - 1, day);
      }
      console.log('Date convertie:', this.transactionDate);
    } else {
      // Si pas de date, utiliser aujourd'hui
      this.transactionDate = new Date();
    }

    // Récupérer le subCategoryId (en snake_case ou camelCase)
    const rawSubCategoryId = this.data.transaction.subCategoryId || this.data.transaction['sub_category_id'];
    this.selectedSubCategoryId = typeof rawSubCategoryId === 'string' ? parseInt(rawSubCategoryId, 10) : (rawSubCategoryId || 0);
    console.log('selectedSubCategoryId initial:', this.selectedSubCategoryId, 'type:', typeof this.selectedSubCategoryId);

    // Récupérer le financialFlowId (en snake_case ou camelCase)
    const financialFlowId = this.data.transaction.financialFlowId || this.data.transaction['financial_flow_id'];

    // Charger les sous-catégories en fonction du flux financier de la transaction
    this.loadSubcategories(financialFlowId!);
  }

  // Charger les sous-catégories en fonction du flux financier
  loadSubcategories(financialFlowId: number): void {
    this.subCategoryService.getAllSubCategoriesByFinancialFlowId(financialFlowId).subscribe({
      next: (data) => {
        this.subcategories = data;
        this.filteredSubcategories = [...data];
        console.log('Sous-catégories chargées:', this.subcategories);
        console.log('Recherche de la sous-catégorie avec ID:', this.selectedSubCategoryId);

        // Initialiser le contrôle d'autocomplétion avec la sous-catégorie actuelle
        const currentSubCategory = this.subcategories.find(sc => sc.id == this.selectedSubCategoryId);
        console.log('Sous-catégorie trouvée:', currentSubCategory);

        if (currentSubCategory) {
          this.subCategoryControl.setValue(currentSubCategory);
          console.log('Sous-catégorie initiale définie:', currentSubCategory);
        }
      },
      error: (err) => console.error('Erreur lors du chargement des sous-catégories:', err)
    });
  }

  // Méthode appelée quand le flux financier change
  onFinancialFlowChange(event: any): void {
    const newFinancialFlowId = event.value;
    console.log('Flux financier changé:', newFinancialFlowId);

    // Réinitialiser la sous-catégorie sélectionnée
    this.selectedSubCategoryId = 0;
    this.subCategoryControl.setValue(null);

    // Recharger les sous-catégories pour le nouveau flux financier
    this.loadSubcategories(newFinancialFlowId);
  }

  // Méthode de filtrage pour PrimeNG AutoComplete
  filterSubcategories(event: any): void {
    const query = event.query.toLowerCase();
    this.filteredSubcategories = this.subcategories.filter(sc =>
      sc.label.toLowerCase().includes(query)
    );
  }

  // Méthode appelée lors de la sélection d'une sous-catégorie
  onSubCategorySelected(event: any): void {
    console.log('Événement de sélection reçu:', event);

    // PrimeNG AutoComplete passe un objet avec une propriété 'value'
    const subCategory = event.value || event;

    if (subCategory && subCategory.id) {
      this.selectedSubCategoryId = subCategory.id;
      console.log('Sous-catégorie sélectionnée - ID:', this.selectedSubCategoryId, 'Label:', subCategory.label);
    } else {
      console.warn('Sous-catégorie invalide:', subCategory);
    }
  }

  // Validation du formulaire (getter pour détection automatique des changements)
  get isFormValid(): boolean {
    const isValid =
      this.data.transaction.accountId != null &&
      this.data.transaction.financialFlowId != null &&
      this.data.transaction.description != null &&
      this.data.transaction.description.trim() !== '' &&
      this.transactionDate != null &&
      this.data.transaction.amount !== null &&
      this.data.transaction.amount !== undefined &&
      this.selectedSubCategoryId != null &&
      this.selectedSubCategoryId > 0;

    console.log('Validation du formulaire:', {
      accountId: this.data.transaction.accountId,
      financialFlowId: this.data.transaction.financialFlowId,
      description: this.data.transaction.description,
      transactionDate: this.transactionDate,
      amount: this.data.transaction.amount,
      selectedSubCategoryId: this.selectedSubCategoryId,
      isValid: isValid
    });

    return isValid;
  }

  // Méthode appelée à chaque changement de champ (pour forcer la détection)
  onFieldChange(): void {
    // Cette méthode force Angular à détecter les changements
    // Elle est appelée sur chaque changement de champ
  }

  save(): void {
    if (!this.isFormValid) {
      console.warn('Formulaire invalide, sauvegarde annulée');
      return;
    }

    console.log('Données avant sauvegarde:', this.data.transaction);

    // CORRECTION DU PROBLEME DE DECALAGE DE DATE
    // Formater la date au format YYYY-MM-DD en mode local
    let formattedDate: string | Date | undefined = this.data.transaction.date;
    if (this.transactionDate) {
      // Utiliser getFullYear, getMonth et getDate pour éviter tout décalage UTC
      const year = this.transactionDate.getFullYear();
      const month = String(this.transactionDate.getMonth() + 1).padStart(2, '0');
      const day = String(this.transactionDate.getDate()).padStart(2, '0');
      formattedDate = `${year}-${month}-${day}`;
      console.log('Date formatée (sans décalage):', formattedDate);
    }

    const updatedTransaction = {
      id: this.data.transaction.id,
      description: this.data.transaction.description,
      amount: this.data.transaction.amount,
      date: formattedDate,
      accountId: this.data.transaction.accountId || this.data.transaction['account_id'],
      financialFlowId: this.data.transaction.financialFlowId || this.data.transaction['financial_flow_id'],
      subCategoryId: this.selectedSubCategoryId,
    };

    console.log('Transaction à envoyer:', updatedTransaction);
    this.dialogRef.close(updatedTransaction);
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
