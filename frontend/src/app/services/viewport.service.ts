import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ViewportService {
  readonly mobileBreakpoint = 960;

  private readonly isBrowser: boolean;
  private readonly mobileSubject = new BehaviorSubject<boolean>(false);

  readonly mobile$ = this.mobileSubject.asObservable();

  constructor(@Inject(PLATFORM_ID) platformId: object) {
    this.isBrowser = isPlatformBrowser(platformId);

    if (!this.isBrowser) {
      return;
    }

    this.updateViewport();
    window.addEventListener('resize', this.handleResize, { passive: true });
  }

  isMobileViewport(): boolean {
    return this.mobileSubject.value;
  }

  private readonly handleResize = (): void => {
    this.updateViewport();
  };

  private updateViewport(): void {
    this.mobileSubject.next(window.innerWidth <= this.mobileBreakpoint);
  }
}
