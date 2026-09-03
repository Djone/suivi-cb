import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type HeaderNotificationSeverity = 'info' | 'warn' | 'danger';

export interface HeaderNotification {
  id: string;
  severity: HeaderNotificationSeverity;
  text: string;
  accountId: number;
  accountName: string;
  tooltip?: string;
  type?: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationCenterService {
  private readonly storageKey = 'suivi-cb-read-notifications';
  private readonly notificationsSubject = new BehaviorSubject<HeaderNotification[]>([]);
  private readonly unreadSubject = new BehaviorSubject<boolean>(false);
  private currentPeriod = this.getCurrentPeriod();
  private readNotificationIds = this.loadReadNotificationIds();

  readonly notifications$ = this.notificationsSubject.asObservable();
  readonly unread$ = this.unreadSubject.asObservable();

  setNotifications(notifications: HeaderNotification[]): void {
    this.resetReadStateForNewMonth();
    this.notificationsSubject.next(notifications);
    this.unreadSubject.next(
      notifications.some(
        (notification) => !this.readNotificationIds.has(notification.id),
      ),
    );
  }

  markAllAsRead(): void {
    this.notificationsSubject.value.forEach((notification) => {
      this.readNotificationIds.add(notification.id);
    });
    this.persistReadNotificationIds();
    this.unreadSubject.next(false);
  }

  private loadReadNotificationIds(): Set<string> {
    if (typeof localStorage === 'undefined') return new Set<string>();
    try {
      const stored = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
      if (Array.isArray(stored)) {
        return new Set(stored);
      }
      if (stored?.period === this.currentPeriod && Array.isArray(stored.ids)) {
        return new Set(stored.ids);
      }
      return new Set<string>();
    } catch {
      return new Set<string>();
    }
  }

  private resetReadStateForNewMonth(): void {
    const period = this.getCurrentPeriod();
    if (period === this.currentPeriod) return;

    this.currentPeriod = period;
    this.readNotificationIds.clear();
    this.persistReadNotificationIds();
  }

  private getCurrentPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private persistReadNotificationIds(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(
        this.storageKey,
        JSON.stringify({
          period: this.currentPeriod,
          ids: Array.from(this.readNotificationIds).slice(-200),
        }),
      );
    } catch {
      // L'état lu reste fonctionnel pour la session si le stockage est indisponible.
    }
  }
}
