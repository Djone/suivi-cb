import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatRadioModule } from '@angular/material/radio';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { ACCOUNT_LIST } from '../../../config/account.config';

@Component({
  selector: 'app-choix-compte-dialog',
  templateUrl: './choix-compte-dialog.component.html',
  styleUrls: ['./choix-compte-dialog.component.css'],
  standalone: true,
  imports: [
    FormsModule, 
    MatRadioModule,
    MatButtonModule,
    CommonModule,
  ],
})
export class ChoixCompteDialogComponent {
  accounts = ACCOUNT_LIST; // Charger les comptes depuis le fichier de configuration
  financialFlow: { id: number; name: string }; // Charger les types de transaction depuis le fichier de configuration
  selectedCompte: number | null = null;

  constructor(
    private dialogRef: MatDialogRef<ChoixCompteDialogComponent>,
    private router: Router,
    @Inject(MAT_DIALOG_DATA) public data: { financialFlow: { id: number; name: string } } // Ajout du type attendu
  ) {
    this.financialFlow = data.financialFlow; // Initialisation à partir des données injectées
  }

  confirmer(): void {
    this.dialogRef.close(this.selectedCompte); // Retourne le compte sélectionné

    // Redirige vers la page du formulaire de transaction avec l'ID du compte
    this.router.navigate(['/transactions', this.selectedCompte, this.financialFlow.id]);
  }

  annuler(): void {
    this.dialogRef.close(null); // Ferme la boîte de dialogue sans sélection
  }
}
