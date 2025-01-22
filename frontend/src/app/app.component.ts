import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router'; // Import du RouterModule
import { TransactionService } from './services/transaction.service';
import { Transaction } from './models/transaction.model';
import { MatDialog } from '@angular/material/dialog';
import { ChoixCompteDialogComponent } from './components/transaction/choix-compte-dialog/choix-compte-dialog.component';
import { FINANCIAL_FLOW_LIST  } from './config/financial-flow.config';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    FormsModule, 
    CommonModule,
    RouterModule,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  transactions: Transaction[] = [];
  financialFlowList = FINANCIAL_FLOW_LIST;
  title = 'Suivi bancaires';

  constructor(
    private transactionService: TransactionService,
    private dialog: MatDialog,
    private router: Router,
  ) {}

  ngOnInit() {
    this.getTransactions();
  }

  getTransactions() {
    this.transactionService.getTransactions().subscribe({
      next: (data) => (this.transactions = data),
      error: (err) => console.error('APP COMPONENT : Erreur lors de la récupération des transactions :', err),
    });
  }

    openChoixCompteDialog(financialFlow: { id: number; name: string }, event: MouseEvent): void {
    event.preventDefault();
  
    const dialogRef = this.dialog.open(ChoixCompteDialogComponent, {
      width: '400px',
      data: { financialFlow }, // Passez l'objet categoryType à la boîte de dialogue
    });
  
    dialogRef.afterClosed().subscribe((selectedCompte) => {
      if (selectedCompte) {
        console.log(`APP COMPONENT : ${financialFlow.name} à ajouter pour le compte : ${selectedCompte}`);
  
        // Redirection avec les paramètres
        this.router.navigate(['/transactions'], {
          queryParams: { accountId: selectedCompte, financialFlowId: financialFlow.id },
        });
      } else {
        console.log('APP COMPONENT : Aucun compte sélectionné');
      }
    });
  }
}
