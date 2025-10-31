import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { ButtonModule } from 'primeng/button';

export interface ConfirmDialogData {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.css'],
})
export class ConfirmDialogComponent {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;

  constructor(
    public ref: DynamicDialogRef,
    public config: DynamicDialogConfig<ConfirmDialogData>
  ) {
    const data = this.config.data;
    this.title = data?.title || 'Confirmation';
    this.message = data?.message || 'Êtes-vous sûr ?';
    this.confirmText = data?.confirmText || 'Confirmer';
    this.cancelText = data?.cancelText || 'Annuler';
  }

  onConfirm(): void {
    this.ref.close(true); // Retourne "true" si confirmé
  }

  onCancel(): void {
    this.ref.close(false); // Retourne "false" si annulé
  }
}
