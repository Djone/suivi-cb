import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MenuService } from '../menu.service';
import { AccountService } from '../../services/account.service';
import { Account } from '../../models/account.model';
import { ViewportService } from '../../services/viewport.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
})
export class SidebarComponent implements OnInit, OnDestroy {
  public appVersion = environment.version;
  public currentYear = new Date().getFullYear();
  public readonly isDevBuild = !environment.production;
  public isMobile = false;
  public accounts: Account[] = [];
  private readonly subscriptions = new Subscription();

  expandedSections: { [key: string]: boolean } = {
    operations: false,
  };

  constructor(
    public menuService: MenuService,
    private readonly accountService: AccountService,
    private readonly viewportService: ViewportService,
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.viewportService.mobile$.subscribe((isMobile) => {
        this.isMobile = isMobile;
      }),
    );

    this.subscriptions.add(
      this.accountService.accounts$.subscribe((accounts) => {
        this.accounts = (accounts || []).filter((account) => account.isActive !== 0);
      }),
    );

    this.accountService.getAccounts().subscribe();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  toggleSection(section: string): void {
    this.expandedSections[section] = !this.expandedSections[section];
  }

  onMenuItemClick(): void {
    if (window.innerWidth < 960) {
      this.menuService.hideSidebar();
    }
  }
}
