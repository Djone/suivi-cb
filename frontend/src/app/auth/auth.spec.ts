import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { authGuard } from './auth.guard';
import { authInterceptor } from './auth.interceptor';
import { environment } from '../../environments/environment';

describe('Protection Keycloak', () => {
  let auth: jasmine.SpyObj<AuthService>;
  let http: HttpClient;
  let controller: HttpTestingController;
  beforeEach(() => {
    auth = jasmine.createSpyObj('AuthService', ['authenticated', 'accessToken', 'sessionEnded', 'canAccessApplication', 'accessDenied', 'denyAccess']);
    auth.canAccessApplication.and.returnValue(true);
    auth.accessDenied.and.returnValue(false);
    auth.accessToken.and.resolveTo('access-token');
    TestBed.configureTestingModule({ providers: [
      provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(), { provide: AuthService, useValue: auth },
    ] });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });
  afterEach(() => controller.verify());

  it('blocks the layout for an authenticated user without the application role', () => {
    auth.authenticated.and.returnValue(true);
    auth.canAccessApplication.and.returnValue(false);
    const result = TestBed.runInInjectionContext(() => authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
    expect(result).toEqual(TestBed.inject(Router).createUrlTree(['/access-denied']));
  });

  it('redirects an API 403 without terminating the authenticated session', async () => {
    http.get(`${environment.apiUrl}/api/accounts`).subscribe({ error: () => undefined });
    await Promise.resolve();
    controller.expectOne(`${environment.apiUrl}/api/accounts`).flush({}, { status: 403, statusText: 'Forbidden' });
    expect(auth.denyAccess).toHaveBeenCalled();
    expect(auth.sessionEnded).not.toHaveBeenCalled();
  });

  it('does not send further API requests after access is denied', () => {
    auth.accessDenied.and.returnValue(true);
    const failure = jasmine.createSpy('failure');
    http.get(`${environment.apiUrl}/api/accounts`).subscribe({ error: failure });
    controller.expectNone(`${environment.apiUrl}/api/accounts`);
    expect(auth.accessToken).not.toHaveBeenCalled();
    expect(failure).toHaveBeenCalled();
  });

  it('redirige un visiteur vers la connexion', () => {
    auth.authenticated.and.returnValue(false);
    const result = TestBed.runInInjectionContext(() => authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
    expect(result).toEqual(TestBed.inject(Router).createUrlTree(['/login']));
  });
  it('autorise un utilisateur connecté', () => {
    auth.authenticated.and.returnValue(true);
    expect(TestBed.runInInjectionContext(() => authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot))).toBeTrue();
  });
  it('envoie le jeton seulement à notre API', async () => {
    http.get(`${environment.apiUrl}/api/accounts`).subscribe();
    await Promise.resolve();
    const request = controller.expectOne(`${environment.apiUrl}/api/accounts`);
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-token');
    request.flush([]);
    for (const url of ['https://external.invalid/api/accounts', `${environment.apiUrl}/api-evil/accounts`]) {
      http.get(url).subscribe();
      const external = controller.expectOne(url);
      expect(external.request.headers.has('Authorization')).toBeFalse();
      external.flush({});
    }
  });
  it('ferme la session après un refus 401 de l’API', async () => {
    http.get(`${environment.apiUrl}/api/accounts`).subscribe({ error: () => undefined });
    await Promise.resolve();
    controller.expectOne(`${environment.apiUrl}/api/accounts`).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.sessionEnded).toHaveBeenCalled();
  });
  it('ne transmet aucune requête si le renouvellement échoue', async () => {
    auth.accessToken.and.rejectWith(new Error('Expired'));
    const failure = jasmine.createSpy('failure');
    http.get(`${environment.apiUrl}/api/accounts`).subscribe({ error: failure });
    await Promise.resolve();
    controller.expectNone(`${environment.apiUrl}/api/accounts`);
    expect(failure).toHaveBeenCalled();
  });
});
