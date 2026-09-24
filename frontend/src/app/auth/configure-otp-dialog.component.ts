import { Component, inject, input, output } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-configure-otp-dialog',
  standalone: true,
  imports: [DialogModule],
  template: `
    <p-dialog header="Configurer la double authentification" [visible]="visible()"
      (visibleChange)="onVisibleChange($event)" [modal]="true" appendTo="body"
      [draggable]="false" [resizable]="false" [dismissableMask]="false"
      [style]="{ width: '400px', maxWidth: 'calc(100vw - 2rem)' }">
      <div class="otp-content">
        <span class="otp-icon" aria-hidden="true"><i class="pi pi-shield"></i></span>
        <p>Souhaitez-vous activer la double authentification par code à usage unique ?</p>
        <p class="otp-hint">Vous configurerez votre application d’authentification dans l’espace sécurisé Keycloak. Un code vous sera demandé lors de vos prochaines connexions.</p>
        @if (error) { <p class="otp-error" role="alert">{{ error }}</p> }
        <button class="otp-submit" type="button" [disabled]="busy" (click)="continue()">
          {{ busy ? 'Redirection en cours…' : 'Oui, configurer l’OTP' }}
        </button>
        <button class="otp-cancel" type="button" [disabled]="busy" (click)="onVisibleChange(false)">Non, pas maintenant</button>
      </div>
    </p-dialog>
  `,
  styles: `
    .otp-content { color: #172033; font-size: 14px; line-height: 1.6; }
    .otp-icon { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 12px; color: #2563eb; background: #eff6ff; }
    .otp-hint { color: #667085; font-size: 12px; }
    button { width: 100%; padding: .75rem; border-radius: 7px; font: inherit; cursor: pointer; }
    .otp-submit { margin-top: 1rem; background: #2563eb; color: #fff; border: 0; font-weight: 600; }
    .otp-submit:hover { background: #1d4ed8; }
    .otp-submit:disabled, .otp-cancel:disabled { opacity: .6; cursor: wait; }
    .otp-cancel { margin-top: .5rem; background: transparent; border: 0; color: #667085; }
    button:focus-visible { outline: 3px solid #93c5fd; outline-offset: 2px; }
    .otp-error { color: #b91c1c; }
  `,
})
export class ConfigureOtpDialogComponent {
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
      await this.auth.configureOtp();
    } catch {
      this.error = 'Impossible d’ouvrir la configuration OTP. Veuillez réessayer.';
    } finally {
      this.busy = false;
    }
  }
}
