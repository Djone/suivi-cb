import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import Keycloak, { KeycloakConfig } from 'keycloak-js';
import { environment } from '../../environments/environment';

export interface ConnectedUser {
  name: string;
  email: string;
  initials: string;
}

export function connectedUserFromClaims(claims: Record<string, unknown>): ConnectedUser {
  const value = (key: string) => typeof claims[key] === 'string' ? (claims[key] as string).trim() : '';
  const fullName = [value('given_name'), value('family_name')].filter(Boolean).join(' ');
  const name = value('name') || fullName || value('preferred_username') || 'Utilisateur';
  const words = name.split(/\s+/);
  const initials = (words.length > 1
    ? words[0].charAt(0) + words[words.length - 1].charAt(0)
    : name.slice(0, 2)).toLocaleUpperCase('fr');
  return { name, email: value('email'), initials };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);
  private keycloak?: Keycloak;
  readonly authenticated = signal(false);
  readonly error = signal('');
  readonly user = signal<ConnectedUser | null>(null);

  private syncUser(): void {
    this.user.set(this.keycloak?.authenticated
      ? connectedUserFromClaims(this.keycloak.idTokenParsed || this.keycloak.tokenParsed || {})
      : null);
  }

  async initialize(): Promise<void> {
    try {
      const response = await fetch(`${environment.apiUrl}/api/auth/config`, {
        cache: 'no-store', signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('Configuration unavailable');
      const config: KeycloakConfig = await response.json();
      this.keycloak = new Keycloak(config);
      this.keycloak.onAuthSuccess = () => this.syncUser();
      this.keycloak.onAuthRefreshSuccess = () => this.syncUser();
      this.keycloak.onAuthLogout = () => this.sessionEnded();
      this.keycloak.onAuthRefreshError = () => this.sessionEnded();
      this.keycloak.onTokenExpired = () => { void this.accessToken().catch(() => undefined); };
      this.authenticated.set(await this.keycloak.init({
        flow: 'standard', pkceMethod: 'S256', checkLoginIframe: false,
        onLoad: 'check-sso',
        silentCheckSsoRedirectUri: `${location.origin}/silent-check-sso.html`,
        silentCheckSsoFallback: false,
      }));
      this.syncUser();
    } catch {
      this.keycloak = undefined;
      this.user.set(null);
      this.authenticated.set(false);
      this.error.set('Le service de connexion est indisponible. Veuillez réessayer.');
    }
  }

  async login(): Promise<void> {
    this.error.set('');
    if (!this.keycloak) await this.initialize();
    try {
      if (!this.keycloak) throw new Error('Unavailable');
      await this.keycloak.login({ redirectUri: `${location.origin}/home`, locale: 'fr' });
    } catch {
      this.error.set('Impossible de démarrer la connexion. Veuillez réessayer.');
    }
  }

  async accessToken(): Promise<string> {
    try {
      if (!this.keycloak?.authenticated) throw new Error('Unauthenticated');
      await this.keycloak.updateToken(30);
      if (!this.keycloak.token) throw new Error('Missing token');
      return this.keycloak.token;
    } catch (error) {
      this.sessionEnded();
      throw error;
    }
  }

  async changePassword(): Promise<void> {
    await this.accessToken();
    await this.keycloak!.login({
      action: 'UPDATE_PASSWORD',
      maxAge: 0,
      redirectUri: `${location.origin}/home`,
      locale: 'fr',
    });
  }

  async logout(): Promise<void> {
    // Build the end-session URL before clearing tokens; retain the ID token hint.
    const url = this.keycloak?.createLogoutUrl({ redirectUri: `${location.origin}/login` });
    this.keycloak?.clearToken();
    this.authenticated.set(false);
    this.user.set(null);
    await this.router.navigateByUrl('/login');
    if (url) location.assign(url);
  }

  sessionEnded(): void {
    this.user.set(null);
    this.authenticated.set(false);
    this.keycloak?.clearToken();
    void this.router.navigateByUrl('/login');
  }
}
