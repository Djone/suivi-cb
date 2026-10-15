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
    .login-page { min-height: 100dvh; display: grid; place-items: center; padding: 2rem 1rem; color: #051638; background: #0d0d0d repeating-linear-gradient(153deg, transparent 0 62px, #ffffff0c 63px 64px); }
    .login-card { width: min(100%, 280px); padding: 23px; background: #fff; border: 0; border-radius: 16px; box-shadow: 0 22px 52px #0009; }
    .brand { display: flex; align-items: center; gap: .55rem; color: #051638; font-size: 10px; font-weight: 700; }
    .brand i { display: grid; width: 19px; height: 19px; place-items: center; padding: 0; border-radius: 5px; color: white; background: #2563eb; font-size: 10px; }
    h1 { margin: 1.55rem 0 .6rem; color: #051638; font-size: 18px; line-height: 1.2; letter-spacing: -.04em; }
    p { color: #2563eb; font-size: 10px; line-height: 1.4; }
    button { display: block; margin: 1.7rem 0 0 auto; border: 0; border-radius: 999px; padding: .75rem 1.25rem; background: #2563eb; color: white; font-size: 10px; font-weight: 700; cursor: pointer; }
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
