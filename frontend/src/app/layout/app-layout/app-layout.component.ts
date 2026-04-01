import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { TopbarComponent } from '../topbar/topbar.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { MenuService } from '../menu.service';
import { ViewportService } from '../../services/viewport.service';

@Component({
  selector: 'app-app-layout',
  imports: [CommonModule, RouterModule, TopbarComponent, SidebarComponent],
  templateUrl: './app-layout.component.html',
  styleUrl: './app-layout.component.css',
})
export class AppLayoutComponent implements OnInit, OnDestroy {
  isMobile = false;
  private readonly subscriptions = new Subscription();

  constructor(
    private readonly router: Router,
    private readonly menuService: MenuService,
    private readonly viewportService: ViewportService,
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.viewportService.mobile$.subscribe((isMobile) => {
        this.isMobile = isMobile;
        if (!isMobile) {
          this.menuService.hideSidebar();
        }
        this.enforceMobileRoutes(this.router.url, isMobile);
      }),
    );

    this.subscriptions.add(
      this.router.events
        .pipe(
          filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        )
        .subscribe((event) => {
          if (this.isMobile) {
            this.menuService.hideSidebar();
          }
          this.enforceMobileRoutes(event.urlAfterRedirects, this.isMobile);
        }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private enforceMobileRoutes(url: string, isMobile: boolean): void {
    if (!isMobile) {
      return;
    }

    const currentPath = url.split('?')[0].split('#')[0];
    const isAllowed =
      currentPath === '' ||
      currentPath === '/' ||
      currentPath === '/home' ||
      currentPath === '/transactions-list' ||
      /^\/transactions-list\/\d+$/.test(currentPath);

    if (!isAllowed) {
      this.router.navigate(['/home']);
    }
  }
}
