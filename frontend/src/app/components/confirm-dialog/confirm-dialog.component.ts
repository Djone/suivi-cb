import { Component, Inject } from '@angular/core';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface ConfirmDialogData {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.css'],
})
export class ConfirmDialogComponent {
  title: string;
  confirmText: string;
  cancelText: string;

  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData
  ) {
    this.title = data.title || 'Confirmation';
    this.confirmText = data.confirmText || 'Confirmer';
    this.cancelText = data.cancelText || 'Annuler';
  }

  onConfirm(): void {
    this.dialogRef.close(true); // Retourne "true" si confirmé
  }

  onCancel(): void {
    this.dialogRef.close(false); // Retourne "false" si annulé
  }
}
