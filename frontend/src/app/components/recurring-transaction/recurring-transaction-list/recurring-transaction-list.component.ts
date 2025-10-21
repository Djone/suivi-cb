import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { RecurringTransactionService } from '../../../services/recurring-transaction.service';
import { SubCategoryService } from '../../../services/sub-category.service';
import { AccountService } from '../../../services/account.service';
import { RecurringTransaction } from '../../../models/recurring-transaction.model';
import { SubCategory } from '../../../models/sub-category.model';
import { Account } from '../../../models/account.model';
import { ConfirmDialogComponent } from '../../confirm-dialog/confirm-dialog.component';
import { EditRecurringTransactionDialogComponent } from '../../edit-recurring-transaction-dialog/edit-recurring-transaction-dialog.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-recurring-transaction-list',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './recurring-transaction-list.component.html',
  styleUrls: ['./recurring-transaction-list.component.css']
})
export class RecurringTransactionListComponent implements OnInit, OnDestroy {
  recurringTransactions: RecurringTransaction[] = [];
  subCategories: SubCategory[] = [];
  accounts: Account[] = [];
  private subscriptions = new Subscription();

  constructor(
    private recurringTransactionService: RecurringTransactionService,
    private subCategoryService: SubCategoryService,
    private accountService: AccountService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    // S'abonner aux transactions récurrentes
    this.subscriptions.add(
      this.recurringTransactionService.recurringTransactions$.subscribe({
        next: (data) => {
          this.recurringTransactions = data;
          console.log('Transactions récurrentes chargées:', data);
        },
        error: (err) => console.error('Erreur lors du chargement des transactions récurrentes:', err)
      })
    );

    // Charger les sous-catégories pour l'affichage
    this.subscriptions.add(
      this.subCategoryService.subCategories$.subscribe({
        next: (data) => {
          this.subCategories = data;
        },
        error: (err) => console.error('Erreur lors du chargement des sous-catégories:', err)
      })
    );

    // Charger les comptes pour l'affichage
    this.subscriptions.add(
      this.accountService.accounts$.subscribe({
        next: (data) => {
          this.accounts = data;
        },
        error: (err) => console.error('Erreur lors du chargement des comptes:', err)
      })
    );

    // Charger les données
    this.recurringTransactionService.getRecurringTransactions().subscribe();
    this.subCategoryService.getSubCategories().subscribe();
    this.accountService.getAccounts().subscribe();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  getSubCategoryName(subCategoryId: number): string {
    const id = typeof subCategoryId === 'string' ? parseInt(subCategoryId, 10) : subCategoryId;
    const subCategory = this.subCategories.find(sc => sc.id == id);
    return subCategory ? subCategory.label : 'N/A';
  }

  getAccountName(accountId: number | undefined): string {
    if (!accountId) return 'N/A';
    const id = typeof accountId === 'string' ? parseInt(accountId, 10) : accountId;
    const account = this.accounts.find(a => a.id === id);
    return account ? account.name : 'N/A';
  }

  getAccountColor(accountId: number | undefined): string {
    if (!accountId) return '#666';
    const id = typeof accountId === 'string' ? parseInt(accountId, 10) : accountId;
    const account = this.accounts.find(a => a.id === id);
    return account?.color || '#666';
  }

  getFinancialFlowName(financialFlowId: number): string {
    return financialFlowId === 1 ? 'Revenu' : 'Dépense';
  }

  getFrequencyLabel(frequency: string): string {
    const labels: { [key: string]: string } = {
      'weekly': 'Hebdomadaire',
      'monthly': 'Mensuelle',
      'bimonthly': 'Bimensuelle',
      'quarterly': 'Trimestrielle',
      'biannual': 'Semestrielle',
      'yearly': 'Annuelle'
    };
    return labels[frequency] || frequency;
  }

  getDayLabel(recurring: RecurringTransaction): string {
    if (recurring.frequency === 'weekly') {
      const daysOfWeek = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
      const dayIndex = typeof recurring.dayOfMonth === 'string' ? parseInt(recurring.dayOfMonth) : recurring.dayOfMonth;
      return daysOfWeek[dayIndex] || recurring.dayOfMonth.toString();
    }
    return recurring.dayOfMonth.toString();
  }

  isRevenue(financialFlowId: number): boolean {
    return financialFlowId === 1;
  }

  isExpense(financialFlowId: number): boolean {
    return financialFlowId === 2;
  }

  isActive(recurringTransaction: RecurringTransaction): boolean {
    return recurringTransaction.isActive === 1;
  }

  deactivateRecurringTransaction(recurringTransaction: RecurringTransaction): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '450px',
      data: {
        title: 'Confirmer la désactivation',
        message: `Voulez-vous vraiment désactiver l'échéance "${recurringTransaction.label}" ?`,
        confirmText: 'Désactiver',
        cancelText: 'Annuler'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed && recurringTransaction.id) {
        this.recurringTransactionService.deleteRecurringTransaction(recurringTransaction.id).subscribe({
          next: () => {
            console.log('Échéance désactivée avec succès');
          },
          error: (err) => {
            console.error('Erreur lors de la désactivation:', err);
            alert('Une erreur est survenue lors de la désactivation.');
          }
        });
      }
    });
  }

  reactivateRecurringTransaction(recurringTransaction: RecurringTransaction): void {
    if (recurringTransaction.id) {
      this.recurringTransactionService.reactivateRecurringTransaction(recurringTransaction.id).subscribe({
        next: () => {
          console.log('Échéance réactivée avec succès');
        },
        error: (err) => {
          console.error('Erreur lors de la réactivation:', err);
          alert('Une erreur est survenue lors de la réactivation.');
        }
      });
    }
  }

  editRecurringTransaction(recurringTransaction: RecurringTransaction): void {
    const dialogRef = this.dialog.open(EditRecurringTransactionDialogComponent, {
      width: '600px',
      data: { recurringTransaction }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && recurringTransaction.id) {
        console.log('Données mises à jour:', result);
        this.recurringTransactionService.updateRecurringTransaction(recurringTransaction.id, result).subscribe({
          next: () => {
            console.log('Échéance mise à jour avec succès');
          },
          error: (err) => {
            console.error('Erreur lors de la mise à jour:', err);
            alert('Une erreur est survenue lors de la mise à jour.');
          }
        });
      }
    });
  }
}
