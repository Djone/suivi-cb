import { TestBed } from '@angular/core/testing';
import { AccessDeniedComponent } from './access-denied.component';
import { AuthService } from './auth.service';

describe('AccessDeniedComponent', () => {
  it('offers logout without loading business data', async () => {
    const logout = jasmine.createSpy('logout').and.resolveTo();
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: { logout } }] });
    const fixture = TestBed.createComponent(AccessDeniedComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h1').textContent).toContain('Accès non autorisé');
    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();
    expect(logout).toHaveBeenCalled();
  });
});
