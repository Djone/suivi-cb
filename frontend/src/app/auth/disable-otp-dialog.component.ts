import { Component, inject, input, output } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-disable-otp-dialog',
  standalone: true,
  imports: [DialogModule],
  template: `
    <p-dialog header="Désactiver la double authentification" [visible]="visible()"
      (visibleChange)="onVisibleChange($event)" [modal]="true" appendTo="body"
      [draggable]="false" [resizable]="false" [dismissableMask]="false"
      [style]="{ width: '400px', maxWidth: 'calc(100vw - 2rem)' }">
      <div class="otp-content">
        <span class="otp-icon otp-icon--warning" aria-hidden="true"><i class="pi pi-shield"></i></span>
        <p>Êtes-vous certain de désactiver la double authentification ?</p>
        <p class="otp-hint">Les appareils OTP associés à votre compte seront supprimés. Vous resterez connecté et pourrez configurer à nouveau l’OTP à tout moment.</p>
        @if (error) { <p class="otp-error" role="alert">{{ error }}</p> }
        <button class="otp-danger" type="button" [disabled]="busy" (click)="continue()">
          {{ busy ? 'Désactivation en cours…' : 'Oui, désactiver l’OTP' }}
        </button>
        <button class="otp-cancel" type="button" [disabled]="busy" (click)="onVisibleChange(false)">Non</button>
      </div>
    </p-dialog>
  `,
  styles: `
    .otp-content { color: #172033; font-size: 14px; line-height: 1.6; }
    .otp-icon { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 12px; color: #2563eb; background: #eff6ff; }
    .otp-icon--warning { color: #b45309; background: #fffbeb; }
    .otp-hint { color: #667085; font-size: 12px; }
    button { width: 100%; padding: .75rem; border-radius: 7px; font: inherit; cursor: pointer; }
    .otp-danger { margin-top: 1rem; background: #dc2626; color: #fff; border: 0; font-weight: 600; }
    .otp-danger:hover { background: #b91c1c; }
    .otp-danger:disabled, .otp-cancel:disabled { opacity: .6; cursor: wait; }
    .otp-cancel { margin-top: .5rem; background: transparent; border: 0; color: #667085; }
    button:focus-visible { outline: 3px solid #93c5fd; outline-offset: 2px; }
    .otp-error { color: #b91c1c; }
  `,
})
export class DisableOtpDialogComponent {
  readonly visible = input(false);
  readonly visibleChange = output<boolean>();
  private readonly auth = inject(AuthService);
  busy = false;
  error = '';

  onVisibleChange(visible: boolean): void {
    if (!visible) this.error = '';
    this.visibleChange.emit(visible);
  }

  async continue(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      await this.auth.disableOtp();
      this.onVisibleChange(false);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Impossible de désactiver l’OTP. Veuillez réessayer.';
    } finally {
      this.busy = false;
    }
  }
}
