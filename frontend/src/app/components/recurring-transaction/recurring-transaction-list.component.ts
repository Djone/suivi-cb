import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

// Services et modèles
import { RecurringTransactionService } from '../../services/recurring-transaction.service';
import { SubCategoryService } from '../../services/sub-category.service';
import { AccountService } from '../../services/account.service';
import { RecurringTransaction } from '../../models/recurring-transaction.model';
import { SubCategory } from '../../models/sub-category.model'; // Correction du nom du fichier
import { Account } from '../../models/account.model';
import { EditRecurringTransactionDialogComponent } from '../edit-recurring-transaction-dialog/edit-recurring-transaction-dialog.component';
import { FREQUENCY_LIST } from '../../utils/utils';

// PrimeNG Imports
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { TagModule } from 'primeng/tag';
import { InputSwitchModule } from 'primeng/inputswitch';
import { CardModule } from 'primeng/card';
import { TooltipModule } from 'primeng/tooltip';
import { InputNumberModule } from 'primeng/inputnumber';

@Component({
  selector: 'app-recurring-transaction-list',
  standalone: true,
  providers: [DialogService],
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    TagModule,
    InputSwitchModule,
    CardModule,
    TooltipModule,
    InputNumberModule
  ],
  templateUrl: './recurring-transaction-list.component.html',
  styleUrls: ['./recurring-transaction-list.component.css']
})
export class RecurringTransactionListComponent implements OnInit, OnDestroy {
  recurringTransactions: RecurringTransaction[] = [];
  subCategories: SubCategory[] = [];
  accounts: Account[] = [];
  dialogRef: DynamicDialogRef | undefined;
  private subscriptions = new Subscription(); // Renommé pour éviter conflit avec 'sub' dans le dialog

  // Options pour les filtres
  frequencies = FREQUENCY_LIST.map(f => ({ label: f.name, value: f.id }));
  statuses = [
    { label: 'Actif', value: 1 },
    { label: 'Inactif', value: 0 }
  ];

  constructor(
    private recurringTransactionService: RecurringTransactionService,
    private subCategoryService: SubCategoryService,
    private accountService: AccountService,
    private dialogService: DialogService
  ) {}

  ngOnInit(): void {
    // S'abonner aux transactions récurrentes
    this.loadRecurringTransactions();
    this.subscriptions.add(
      this.recurringTransactionService.recurringTransactions$.subscribe({
        next: (data) => {
          this.recurringTransactions = data;
          console.log('Transactions récurrentes chargées:', data);
        },
        error: (err) => console.error('Erreur lors du chargement des transactions récurrentes:', err)
      })
    );

    this.loadSubCategories();
    // Charger les sous-catégories pour l'affichage
    this.subscriptions.add(
      this.subCategoryService.subCategories$.subscribe({
        next: (data) => {
          this.subCategories = data;
        },
        error: (err) => console.error('Erreur lors du chargement des sous-catégories:', err)
      })
    );

    this.loadAccounts();
    // Charger les comptes pour l'affichage
    this.subscriptions.add(
      this.accountService.accounts$.subscribe({
        next: (data) => {
          this.accounts = data;
        },
        error: (err) => console.error('Erreur lors du chargement des comptes:', err)
      })
    );

  }

  ngOnDestroy(): void {
    if (this.dialogRef) {
      this.dialogRef.close();
    }
    this.subscriptions.unsubscribe();
  }

  loadRecurringTransactions(): void {
    this.recurringTransactionService.getRecurringTransactions().subscribe();
  }

  loadSubCategories(): void {
    this.subCategoryService.getSubCategories().subscribe();
  }

  loadAccounts(): void {
    this.accountService.getAccounts().subscribe();
  }

  getSubCategoryName(subCategoryId: number): string {
    const id = typeof subCategoryId === 'string' ? parseInt(subCategoryId, 10) : subCategoryId;
    const subCategory = this.subCategories.find(sc => sc.id == id);
    return subCategory ? subCategory.label : 'N/A';
  }

  getAccountName(accountId: number | undefined): string {
    if (!accountId) return 'N/A';
    const account = this.accounts.find(a => a.id === accountId);
    return account ? account.name : 'N/A';
  }

  /**
   * Récupère la couleur associée à un compte.
   * @param accountId L'ID du compte.
   * @returns La couleur hexadécimale du compte ou une couleur par défaut.
   */
  getAccountColor(accountId: number | undefined): string {
    if (!accountId) return '#6c757d'; // Couleur par défaut (gris)
    const account = this.accounts.find(a => a.id === accountId);
    return account?.color || '#6c757d';
  }

  /**
   * Génère le style CSS pour le badge du compte.
   * @param accountId L'ID du compte.
   * @returns Un objet de style pour ngStyle.
   */
  getAccountStyle(accountId: number | undefined): { [key: string]: string } {
    const bgColor = this.getAccountColor(accountId);
    // Simple logique pour déterminer si le texte doit être blanc ou noir pour le contraste
    const textColor = this.isColorLight(bgColor) ? '#000000' : '#FFFFFF';
    return {
      'background-color': bgColor,
      'color': textColor
    };
  }

  getFinancialFlowName(financialFlowId: number): string {
    return financialFlowId === 1 ? 'Revenu' : 'Dépense';
  }

  getFrequencyLabel(frequency: string): string {
    return FREQUENCY_LIST.find(f => f.id === frequency)?.name || frequency;
  }

  getDayLabel(recurring: RecurringTransaction): string {
    return recurring.dayOfMonth ? recurring.dayOfMonth.toString() : 'N/A';
  }

  getFinancialFlowSeverity(financialFlowId: number): 'success' | 'danger' {
    return financialFlowId === 1 ? 'success' : 'danger';
  }

  getStatusLabel(isActive: number): string {
    return isActive === 1 ? 'Actif' : 'Inactif';
  }

  getSeverity(isActive: number): string {
    return isActive === 1 ? 'success' : 'danger';
  }

  createRecurringTransaction(): void {
    this.dialogRef = this.dialogService.open(EditRecurringTransactionDialogComponent, {
      header: 'Nouvelle transaction récurrente',
      data: {
        transaction: {
          label: '',
          amount: null,
          dayOfMonth: null,
          frequency: 'monthly',
          accountId: 1, // Valeur par défaut, à adapter si multi-comptes
          financialFlowId: 2, // Dépense par défaut
          subCategoryId: 0 // Ajout de la propriété manquante
        } as RecurringTransaction,
        isNew: true
      },
      width: '600px'
    });

    this.dialogRef.onClose.subscribe(result => {
      if (result) {
        this.recurringTransactionService.addRecurringTransaction(result).subscribe(() => {
          this.loadRecurringTransactions();
        });
      }
    });
  }

  editRecurringTransaction(transaction: RecurringTransaction): void {
    this.dialogRef = this.dialogService.open(EditRecurringTransactionDialogComponent, {
      header: 'Éditer la transaction récurrente',
      data: {
        transaction: { ...transaction },
        isNew: false
      },
      width: '600px'
    });

    this.dialogRef.onClose.subscribe(result => {
      if (result) {
        this.recurringTransactionService.updateRecurringTransaction(result.id!, result).subscribe(() => {
          this.loadRecurringTransactions();
        });
      }
    });
  }

  toggleActive(transaction: RecurringTransaction, event: any): void {
    console.log('RECURRING TRANSACTION LIST : toggleActive appelé', {
      transaction: transaction.label,
      transactionId: transaction.id,
      currentStatus: transaction.isActive,
      eventChecked: event.checked
    });

    const newStatus = event.checked ? 1 : 0;
    const action = newStatus ? 'réactiver' : 'désactiver';

    const service$ = newStatus
      ? this.recurringTransactionService.reactivateRecurringTransaction(transaction.id!)
      : this.recurringTransactionService.deleteRecurringTransaction(transaction.id!);

    service$.subscribe({
      next: () => {
        console.log(`RECURRING TRANSACTION LIST : Transaction récurrente ${action}e avec succès`);
        // Attendre un peu pour laisser le temps à la DB de se mettre à jour
        setTimeout(() => {
          this.loadRecurringTransactions();
        }, 100);
      },
      error: (err) => {
        console.error(`RECURRING TRANSACTION LIST : Erreur lors de ${action}:`, err);
        alert(`Une erreur est survenue lors de la ${action}.`);
        this.loadRecurringTransactions(); // Restaurer l'état
      }
    });
  }

  // Ces méthodes ne sont plus utilisées avec le p-inputSwitch
  /*
  deactivateRecurringTransaction(recurringTransaction: RecurringTransaction): void {}
  reactivateRecurringTransaction(recurringTransaction: RecurringTransaction): void {}
  */

  /**
   * Détermine si une couleur hexadécimale est claire ou foncée.
   * @param color La couleur en format hexadécimal (ex: #RRGGBB).
   * @returns true si la couleur est claire, false sinon.
   */
  private isColorLight(color: string): boolean {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    // Formule de luminance YIQ
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return yiq >= 128;
  }
}
