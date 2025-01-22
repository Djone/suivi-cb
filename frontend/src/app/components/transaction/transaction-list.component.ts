// frontend/src/app/components/transaction-list/transaction-list.component.ts
import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MatTableModule  } from '@angular/material/table';
import { MatTableDataSource  } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import { TransactionService } from '../../services/transaction.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { Transaction } from '../../models/transaction.model';  // Importer le modèle
import { ActivatedRoute } from '@angular/router';
import { getParamId } from '../../utils/utils';
import { FilterManagerService } from '../../services/filter-manager.service';

@Component({
  selector: 'app-transaction-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatPaginator,
    MatTableModule,
  ],
  templateUrl: './transaction-list.component.html',
  styleUrls: ['./transaction-list.component.css']
})
export class TransactionListComponent implements OnInit {
  accountId: number | null = null;
  accountName: string | null = null;
  financialFlowId: number | null = null;
  financialFlowName: string | null = null;
  transactions: Transaction[] = [];  // Définir le type comme Transaction[]
  editedTransaction: Transaction | null = null; // Transaction en cours d'édition
  displayedColumns: string[] = ['date', 'amount', 'description', 'actions'];
  dataSource = new MatTableDataSource<Transaction>([]);
  

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(
    private transactionService: TransactionService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private route: ActivatedRoute,
    private filterManager: FilterManagerService, // Injecter le gestionnaire de filtres
  ) {}

  ngOnInit(): void {
    
    this.filterManager.clearFilters(); // efface les filtres actif

    // Charger les transactions initiales et configurer la pagination
    this.transactionService.transactions$.subscribe((transactions) => {
      const cleanedData = transactions.map((transaction) => ({
        ...transaction,
        amount: typeof transaction.amount === 'string'
        ? parseFloat(transaction.amount.replace(/[^0-9.-]+/g, ''))
        : transaction.amount
      }));

      this.dataSource.data = cleanedData;
      this.dataSource.paginator = this.paginator;
    });

    // Récupérer l'ID du compte et le type de catégorie depuis les paramètres de requête
    this.route.queryParams.subscribe((params) => {
      this.accountId = getParamId(params['accountId']);
      this.financialFlowId = getParamId(params['financialFlowId']);
    });

    const params = {
      accountId: this.accountId,
      financialFlowId: this.financialFlowId,
    };
  
    this.filterManager.setFilters(params); // Stocker les filtres actif

    if (params) {
      console.log('TRANSACTION LIST COMPONENT : Changement de paramètres détecté :', params);
      this.loadTransactions(); // Recharge les transactions
    }
  }

  loadTransactions(): void {
    this.transactionService.loadTransactions();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
  }

  get editableCategory(): Transaction {
    return this.editedTransaction || { id: 0, description: '', amount: 0, date: new Date('2000-01-01'), accountId: 0, financialFlowId: 1, subCategoryId: 1 }; // Objet par défaut
  }

  // Méthode pour éditer une transaction
  editTransaction(transaction: Transaction): void {
    try {
      console.log('TRANSACTION LIST COMPONENT : edition en cours');
      this.editedTransaction = transaction; // Stocker directement la transaction
      console.log('TRANSACTION LIST COMPONENT : Transaction clonée:', this.editedTransaction); // Vérification du clonage
    } catch (error) {
      console.error('TRANSACTION LIST COMPONENT : Erreur lors de l\'édition de la transaction:', error);
    }
  }

  // Annuler l'édition
  cancelEdit(): void {
    this.editedTransaction = null; // Quitter le mode édition sans enregistrer
  }

  // Enregistrer les modifications
  saveTransaction(): void {
    if (this.editedTransaction) { // Vérifie si editedTranscation n'est pas null
      const { id, description, amount, date, accountId, financialFlowId, subCategoryId } = this.editedTransaction;
      
      /* // Convertir type_id en entier
      const subCategoryIdAsNumber = Number(subCategoryId);

      // Vérifier si la conversion a échoué
      if (isNaN(subCategoryIdAsNumber)) {
        console.error('TRANSACTION LIST COMPONENT : Le subCategoryId est invalide');
        return; // Ne pas envoyer si la conversion échoue
      } */

      // Convertir la date en format ISO
      const formattedDate = new Date(date!).toISOString().slice(0, 10); // YYYY-MM-DD

      console.log('TRANSACTION LIST COMPONENT : Données de la catégorie à enregistrer:', { description, amount, formattedDate, accountId, financialFlowId, subCategoryId });

      this.transactionService.updateTransaction(id!, { description, amount, date: new Date(formattedDate), accountId, financialFlowId, subCategoryId}).subscribe({
          next: () => {
            const index = this.transactions.findIndex(c => c.id === id);
            if (index !== -1) {
              this.transactions[index] = {
                ...this.transactions[index],
                description,
                amount,
                date: new Date(formattedDate),
                accountId,
                financialFlowId,
                subCategoryId,
              };
              console.log('TRANSACTION LIST COMPONENT : Catégorie mise à jour localement:', this.transactions[index]);
            }
            this.editedTransaction = null; // Quitter le mode édition
          },
          error: (err) => {
            console.error('TRANSACTION LIST COMPONENT : Erreur lors de la mise à jour de la catégorie :', err);
          }
        });
      } else {
        console.error('TRANSACTION LIST COMPONENT : Impossible de sauvegarder : editedTranscation est null.');
      }
  }

  // Méthode pour supprimer une transaction
  deleteTransaction(transaction: Transaction): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: { message:  transaction.description },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.transactionService.deleteTransaction(transaction.id!).subscribe({
          next: () => {
            console.log('Transaction supprimée:', transaction.id);
            this.loadTransactions(); // Recharger les transactions
            this.snackBar.open('Transaction supprimée avec succès.', 'Fermer', {
              duration: 3000,
              verticalPosition: 'top',
              horizontalPosition: 'center',
              panelClass: ['success-snackbar'],
            });
          },
          error: (err) => console.error('Erreur suppression transaction:', err),
        });
      }
    });
  }
}
