import { Component, inject } from '@angular/core';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  template: `
    <main class="login-page">
      <section class="login-card" aria-labelledby="login-title">
        <p class="brand"><i class="pi pi-wallet" aria-hidden="true"></i> Suivi Bancaire</p>
        <h1 id="login-title">Accéder à mon espace client</h1>
        <p>Retrouvez vos comptes et votre suivi bancaire dans votre espace sécurisé.</p>
        @if (auth.error()) { <p class="error" role="alert">{{ auth.error() }}</p> }
        <button type="button" [disabled]="busy" (click)="connect()">
          {{ busy ? 'Connexion en cours…' : 'Se connecter' }}
        </button>
      </section>
    </main>
  `,
  styles: `
    .login-page { min-height: 100dvh; display: grid; place-items: center; padding: 1.5rem; background: #f8f9fa; }
    .login-card { width: min(100%, 560px); padding: clamp(1.5rem, 5vw, 3rem); background: white; border: 1px solid #e1e6ed; border-radius: 18px; box-shadow: 0 12px 36px #17203308; }
    .brand { display: flex; align-items: center; gap: .75rem; color: #172033; font-weight: 600; }
    .brand i { padding: .75rem; border-radius: 10px; color: white; background: #2563eb; }
    h1 { margin: 2rem 0 1rem; color: #172033; font-size: clamp(1.7rem, 4vw, 2.2rem); line-height: 1.2; }
    p { color: #667085; line-height: 1.6; }
    button { display: block; margin: 2rem 0 0 auto; border: 0; border-radius: 999px; padding: .85rem 1.4rem; background: #2563eb; color: white; font-weight: 600; cursor: pointer; }
    button:hover { background: #1d4ed8; } button:disabled { opacity: .6; cursor: wait; }
    button:focus-visible { outline: 3px solid #93c5fd; outline-offset: 3px; }
    .error { color: #b91c1c; }
  `,
})
export class LoginComponent {
  readonly auth = inject(AuthService);
  busy = false;
  async connect(): Promise<void> {
    this.busy = true;
    try { await this.auth.login(); } finally { this.busy = false; }
  }
}
