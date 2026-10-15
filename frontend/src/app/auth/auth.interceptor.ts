import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const api = new URL(`${environment.apiUrl}/api/`, location.origin);
  const target = new URL(request.url, location.origin);
  if (target.origin !== api.origin || !target.pathname.startsWith(api.pathname)) {
    return next(request);
  }
  const auth = inject(AuthService);
  if (auth.accessDenied()) {
    return throwError(() => new HttpErrorResponse({ status: 403, statusText: 'Forbidden' }));
  }
  return from(auth.accessToken()).pipe(
    switchMap((token) => auth.accessDenied()
      ? throwError(() => new HttpErrorResponse({ status: 403, statusText: 'Forbidden' }))
      : next(request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))),
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) auth.sessionEnded();
      if (error instanceof HttpErrorResponse && error.status === 403) auth.denyAccess();
      return throwError(() => error);
    }),
  );
};
