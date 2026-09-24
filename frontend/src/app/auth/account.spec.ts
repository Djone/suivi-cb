import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import Keycloak from 'keycloak-js';
import { AuthService, connectedUserFromClaims } from './auth.service';
import { ChangePasswordDialogComponent } from './change-password-dialog.component';
import { ConfigureOtpDialogComponent } from './configure-otp-dialog.component';

describe('Compte utilisateur Keycloak', () => {
  it('supprime les OTP sans redirection et garde la session ouverte', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: Router, useValue: { navigateByUrl: jasmine.createSpy() } }] });
    const auth = TestBed.inject(AuthService);
    spyOn(auth, 'accessToken').and.resolveTo('test-token');
    const request = spyOn(window, 'fetch').and.resolveTo(new Response(null, { status: 204 }));
    const endSession = spyOn(auth, 'sessionEnded');
    auth.authenticated.set(true);
    auth.otpConfigured.set(true);
    await auth.disableOtp();
    expect(request.calls.mostRecent().args[1]?.method).toBe('DELETE');
    expect(auth.otpConfigured()).toBeFalse();
    expect(auth.authenticated()).toBeTrue();
    expect(endSession).not.toHaveBeenCalled();
  });

  it('conserve le statut OTP lorsque la suppression échoue', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: Router, useValue: { navigateByUrl: jasmine.createSpy() } }] });
    const auth = TestBed.inject(AuthService);
    spyOn(auth, 'accessToken').and.resolveTo('test-token');
    spyOn(window, 'fetch').and.resolveTo(new Response(null, { status: 403 }));
    auth.otpConfigured.set(true);
    await expectAsync(auth.disableOtp()).toBeRejected();
    expect(auth.otpConfigured()).toBeTrue();
  });
  it('affiche les informations du profil et supporte les champs absents', () => {
    expect(connectedUserFromClaims({ given_name: 'Lucas', family_name: 'Martin', email: 'lucas@example.test' }))
      .toEqual({ name: 'Lucas Martin', email: 'lucas@example.test', initials: 'LM' });
    expect(connectedUserFromClaims({ preferred_username: 'lucas' }))
      .toEqual({ name: 'lucas', email: '', initials: 'LU' });
    expect(connectedUserFromClaims({ name: 42, email: null }).name).toBe('Utilisateur');
  });

  it('demande à Keycloak de changer le mot de passe après réauthentification', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: Router, useValue: { navigateByUrl: jasmine.createSpy() } }] });
    const auth = TestBed.inject(AuthService);
    const keycloak = jasmine.createSpyObj<Keycloak>('Keycloak', ['updateToken', 'login', 'clearToken']);
    keycloak.authenticated = true;
    keycloak.token = 'test-token';
    keycloak.updateToken.and.resolveTo(false);
    keycloak.login.and.resolveTo();
    Object.assign(auth, { keycloak });
    await auth.changePassword();
    expect(keycloak.login).toHaveBeenCalledOnceWith({
      action: 'UPDATE_PASSWORD', maxAge: 0, locale: 'fr', redirectUri: `${location.origin}/home`,
    });
  });

  it('demande à Keycloak de configurer l’OTP après réauthentification', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: Router, useValue: { navigateByUrl: jasmine.createSpy() } }] });
    const auth = TestBed.inject(AuthService);
    const keycloak = jasmine.createSpyObj<Keycloak>('Keycloak', ['updateToken', 'login', 'clearToken']);
    keycloak.authenticated = true;
    keycloak.token = 'test-token';
    keycloak.updateToken.and.resolveTo(false);
    keycloak.login.and.resolveTo();
    Object.assign(auth, { keycloak });
    await auth.configureOtp();
    expect(keycloak.login).toHaveBeenCalledOnceWith({
      action: 'CONFIGURE_TOTP', maxAge: 0, locale: 'fr', redirectUri: `${location.origin}/home`,
    });
  });

  it('efface le profil quand la session se termine', () => {
    TestBed.configureTestingModule({ providers: [{ provide: Router, useValue: { navigateByUrl: jasmine.createSpy() } }] });
    const auth = TestBed.inject(AuthService);
    auth.user.set(connectedUserFromClaims({ name: 'Lucas Martin' }));
    auth.authenticated.set(true);
    auth.sessionEnded();
    expect(auth.user()).toBeNull();
    expect(auth.authenticated()).toBeFalse();
  });

  it('permet de réessayer si le parcours de changement de mot de passe échoue', async () => {
    const auth = jasmine.createSpyObj('AuthService', ['changePassword']);
    auth.changePassword.and.rejectWith(new Error('Unavailable'));
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: auth }] });
    const dialog = TestBed.runInInjectionContext(() => new ChangePasswordDialogComponent());
    await dialog.continue();
    expect(dialog.error).toContain('Veuillez réessayer');
    expect(dialog.busy).toBeFalse();
    auth.changePassword.and.resolveTo();
    await dialog.continue();
    expect(dialog.error).toBe('');
    expect(auth.changePassword).toHaveBeenCalledTimes(2);
  });
  it('permet de réessayer si le parcours de configuration OTP échoue', async () => {
    const auth = jasmine.createSpyObj('AuthService', ['configureOtp']);
    auth.configureOtp.and.rejectWith(new Error('Unavailable'));
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: auth }] });
    const dialog = TestBed.runInInjectionContext(() => new ConfigureOtpDialogComponent());
    await dialog.continue();
    expect(dialog.error).toContain('Veuillez réessayer');
    expect(dialog.busy).toBeFalse();
    auth.configureOtp.and.resolveTo();
    await dialog.continue();
    expect(dialog.error).toBe('');
    expect(auth.configureOtp).toHaveBeenCalledTimes(2);
  });
});
