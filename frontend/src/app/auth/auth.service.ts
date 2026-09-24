import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import Keycloak, { KeycloakConfig } from 'keycloak-js';
import { environment } from '../../environments/environment';

export interface ConnectedUser {
  name: string;
  email: string;
  initials: string;
}

interface KeycloakRealmConfig {
  url: string;
  realm: string;
  clientId: string;
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
  private keycloakConfig?: KeycloakRealmConfig;
  readonly authenticated = signal(false);
  readonly error = signal('');
  readonly user = signal<ConnectedUser | null>(null);
  readonly otpConfigured = signal(false);
  readonly otpStatusError = signal('');

  private syncUser(): void {
    this.user.set(this.keycloak?.authenticated
      ? connectedUserFromClaims(this.keycloak.idTokenParsed || this.keycloak.tokenParsed || {})
      : null);
    if (!this.keycloak?.authenticated) this.otpConfigured.set(false);
  }

  private otpCredentialIds(credentials: unknown): string[] {
    const ids = new Set<string>();
    const visit = (value: unknown, containedInOtp = false): void => {
      if (Array.isArray(value)) {
        value.forEach((item) => visit(item, containedInOtp));
      } else if (value && typeof value === 'object') {
        const item = value as Record<string, unknown>;
        const isOtp = containedInOtp || item['type'] === 'otp' || item['credentialType'] === 'otp';
        if (isOtp && typeof item['id'] === 'string') ids.add(item['id']);
        Object.values(item).forEach((child) => visit(child, isOtp));
      }
    };
    visit(credentials);
    return [...ids];
  }

  private actionResult(): { action: string; status: string } | null {
    const read = (value: string) => new URLSearchParams(value.replace(/^#|^\?/, ''));
    const search = read(location.search);
    const hash = read(location.hash);
    const action = search.get('kc_action') || hash.get('kc_action');
    const status = search.get('kc_action_status') || hash.get('kc_action_status');
    return action && status ? { action, status } : null;
  }

  private applyActionResult(result: { action: string; status: string } | null): void {
    if (result?.status !== 'success') return;
    if (result.action === 'CONFIGURE_TOTP') this.otpConfigured.set(true);
    if (result.action.startsWith('delete_credential:')) this.otpConfigured.set(false);
  }

  async initialize(): Promise<void> {
    try {
      // The adapter removes the OAuth response from the URL during init().
      // Capture the outcome of an OTP action before it does so.
      const actionResult = this.actionResult();
      const response = await fetch(`${environment.apiUrl}/api/auth/config`, {
        cache: 'no-store', signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('Configuration unavailable');
      const config: KeycloakConfig & KeycloakRealmConfig = await response.json();
      this.keycloakConfig = config;
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
      this.applyActionResult(actionResult);
      if (this.authenticated()) void this.refreshOtpStatus();
    } catch {
      this.keycloak = undefined;
      this.keycloakConfig = undefined;
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

  async configureOtp(): Promise<void> {
    await this.accessToken();
    await this.keycloak!.login({
      action: 'CONFIGURE_TOTP',
      maxAge: 0,
      redirectUri: `${location.origin}/home`,
      locale: 'fr',
    });
  }

  async refreshOtpStatus(): Promise<boolean> {
    try {
      const token = await this.accessToken();
      const response = await fetch(`${environment.apiUrl}/api/auth/otp-credentials`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail.includes('KEYCLOAK_ACCOUNT_') ? detail : `API_HTTP_${response.status}`);
      }
      const configured = this.otpCredentialIds(await response.json()).length > 0;
      this.otpConfigured.set(configured);
      this.otpStatusError.set('');
      return configured;
    } catch (error) {
      const detail = error instanceof Error ? error.message : '';
      this.otpStatusError.set(detail.includes('KEYCLOAK_ACCOUNT_') || detail.startsWith('API_HTTP_')
        ? detail.replace(/^\{"error":"|"\}$/g, '')
        : 'Vérification OTP indisponible');
      return this.otpConfigured();
    }
  }

  async disableOtp(): Promise<void> {
    const token = await this.accessToken();
    const response = await fetch(`${environment.apiUrl}/api/auth/otp-credentials`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      if (detail.error === 'OTP_ACR_MISSING') {
        throw new Error('Le niveau d’authentification est absent du jeton. Le scope Keycloak « acr » doit être activé, puis vous devez vous reconnecter.');
      }
      throw new Error('Impossible de désactiver l’OTP. Veuillez réessayer.');
    }
    this.otpConfigured.set(false);
    this.otpStatusError.set('');
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
