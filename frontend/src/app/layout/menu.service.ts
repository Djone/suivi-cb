import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MenuService {
  private sidebarVisibleSubject = new BehaviorSubject<boolean>(false);
  public sidebarVisible$: Observable<boolean> = this.sidebarVisibleSubject.asObservable();

  constructor() {}

  toggleSidebar(): void {
    this.sidebarVisibleSubject.next(!this.sidebarVisibleSubject.value);
  }

  hideSidebar(): void {
    this.sidebarVisibleSubject.next(false);
  }

  showSidebar(): void {
    this.sidebarVisibleSubject.next(true);
  }

  getSidebarState(): boolean {
    return this.sidebarVisibleSubject.value;
  }
}
