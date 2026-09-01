import { Component } from '@angular/core';
import { MenuService } from '../menu.service';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  HeaderNotification,
  NotificationCenterService,
} from '../../services/notification-center.service';

@Component({
  selector: 'app-topbar',
  imports: [CommonModule],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.css',
})
export class TopbarComponent {
  isNotificationsOpen = false;
  readonly notifications$;
  readonly unread$;

  constructor(
    public menuService: MenuService,
    private readonly notificationCenter: NotificationCenterService,
    private readonly router: Router,
  ) {
    this.notifications$ = this.notificationCenter.notifications$;
    this.unread$ = this.notificationCenter.unread$;
  }

  toggleMenu(): void {
    this.menuService.toggleSidebar();
  }

  openNotifications(): void {
    this.isNotificationsOpen = true;
    this.notificationCenter.markAllAsRead();
  }

  closeNotifications(): void {
    this.isNotificationsOpen = false;
  }

  toggleNotifications(): void {
    this.isNotificationsOpen
      ? this.closeNotifications()
      : this.openNotifications();
  }

  selectNotification(notification: HeaderNotification): void {
    if (notification.type === 'coverage') {
      this.router.navigate(['/transactions-list', notification.accountId]);
      this.closeNotifications();
    }
  }
}
