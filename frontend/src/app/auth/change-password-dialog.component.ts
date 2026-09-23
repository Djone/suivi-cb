import { Component, inject, input, output } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-change-password-dialog',
  standalone: true,
  imports: [DialogModule],
  template: `
    <p-dialog header="Modifier le mot de passe" [visible]="visible()"
      (visibleChange)="onVisibleChange($event)" [modal]="true" appendTo="body"
      [draggable]="false" [resizable]="false" [dismissableMask]="false"
      [style]="{ width: '400px', maxWidth: 'calc(100vw - 2rem)' }">
      <div class="password-content">
        <span class="password-icon" aria-hidden="true"><i class="pi pi-lock"></i></span>
        <p>Vous allez accéder à votre espace sécurisé pour confirmer votre identité et choisir un nouveau mot de passe.</p>
        <p class="password-hint">Une fois terminé, vous reviendrez dans Suivi Bancaire.</p>
        @if (error) { <p class="password-error" role="alert">{{ error }}</p> }
        <button class="password-submit" type="button" [disabled]="busy" (click)="continue()">
          {{ busy ? 'Redirection en cours…' : 'Continuer vers mon espace sécurisé' }}
        </button>
        <button class="password-cancel" type="button" (click)="onVisibleChange(false)">Annuler</button>
      </div>
    </p-dialog>
  `,
  styles: `
    .password-content { color: #172033; font-size: 14px; line-height: 1.6; }
    .password-icon { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 12px; color: #2563eb; background: #eff6ff; }
    .password-hint { color: #667085; font-size: 12px; }
    button { width: 100%; padding: .75rem; border-radius: 7px; font: inherit; cursor: pointer; }
    .password-submit { margin-top: 1rem; background: #2563eb; color: #fff; border: 0; font-weight: 600; }
    .password-submit:hover { background: #1d4ed8; }
    .password-submit:disabled { opacity: .6; cursor: wait; }
    .password-cancel { margin-top: .5rem; background: transparent; border: 0; color: #667085; }
    button:focus-visible { outline: 3px solid #93c5fd; outline-offset: 2px; }
    .password-error { color: #b91c1c; }
  `,
})
export class ChangePasswordDialogComponent {
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
      await this.auth.changePassword();
    } catch {
      this.error = 'Impossible d’ouvrir le changement de mot de passe. Veuillez réessayer.';
    } finally {
      this.busy = false;
    }
  }
}
