import { Component, inject } from '@angular/core';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-access-denied',
  standalone: true,
  template: `
    <main>
      <section aria-labelledby="denied-title">
        <p>Suivi Bancaire</p>
        <h1 id="denied-title">Accès non autorisé</h1>
        <p>Votre compte ne dispose pas des droits nécessaires pour accéder à cette application.</p>
        <p>Contactez votre administrateur pour obtenir un accès.</p>
        <button type="button" (click)="logout()" [disabled]="busy">Se déconnecter</button>
        @if (failed) { <p role="alert">La déconnexion a échoué. Veuillez réessayer.</p> }
      </section>
    </main>
  `,
  styles: `
    main { min-height: 100dvh; display: grid; place-items: center; background: #f1f5f9; padding: 1rem; }
    section { max-width: 32rem; padding: 2rem; border-radius: 1rem; background: white; color: #0f172a; }
    h1 { font-size: 1.75rem; } p { line-height: 1.6; }
    button { padding: .75rem 1.25rem; border: 0; border-radius: .5rem; background: #2563eb; color: white; cursor: pointer; }
    button:focus-visible { outline: 3px solid #93c5fd; outline-offset: 3px; }
  `,
})
export class AccessDeniedComponent {
  private readonly auth = inject(AuthService);
  busy = false;
  failed = false;
  async logout(): Promise<void> {
    this.busy = true;
    this.failed = false;
    try { await this.auth.logout(); }
    catch { this.failed = true; }
    finally { this.busy = false; }
  }
}
