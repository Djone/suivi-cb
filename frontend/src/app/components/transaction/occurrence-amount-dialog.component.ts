import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import {
  DynamicDialogConfig,
  DynamicDialogRef,
} from 'primeng/dynamicdialog';
import { InputNumberModule } from 'primeng/inputnumber';

export interface OccurrenceAmountDialogData {
  label: string;
  dueDate: Date;
  amount: number;
}

@Component({
  selector: 'app-occurrence-amount-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, InputNumberModule],
  templateUrl: './occurrence-amount-dialog.component.html',
  styleUrls: ['./occurrence-amount-dialog.component.css'],
})
export class OccurrenceAmountDialogComponent {
  readonly label: string;
  readonly dueDate: Date;
  amount: number | null;

  constructor(
    private ref: DynamicDialogRef,
    config: DynamicDialogConfig<OccurrenceAmountDialogData>,
  ) {
    const data = config.data;
    this.label = data?.label || 'Échéance';
    this.dueDate = data?.dueDate
      ? new Date(data.dueDate)
      : new Date();
    this.amount = Number.isFinite(data?.amount)
      ? Math.abs(data!.amount)
      : null;
  }

  get isAmountInvalid(): boolean {
    return (
      this.amount === null ||
      !Number.isFinite(this.amount) ||
      this.amount < 0
    );
  }

  save(): void {
    if (this.isAmountInvalid) return;
    this.ref.close(this.amount);
  }

  cancel(): void {
    this.ref.close(null);
  }
}
