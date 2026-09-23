import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import Keycloak from 'keycloak-js';
import { AuthService, connectedUserFromClaims } from './auth.service';
import { ChangePasswordDialogComponent } from './change-password-dialog.component';

describe('Compte utilisateur Keycloak', () => {
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
});
