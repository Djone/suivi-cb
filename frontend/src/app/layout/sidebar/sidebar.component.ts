import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MenuService } from '../menu.service';

@Component({
  selector: 'app-sidebar',
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent {
  expandedSections: { [key: string]: boolean } = {
    operations: false
  };

  constructor(public menuService: MenuService) {}

  toggleSection(section: string): void {
    this.expandedSections[section] = !this.expandedSections[section];
  }

  onMenuItemClick(): void {
    // Sur mobile, fermer le menu après clic
    if (window.innerWidth < 960) {
      this.menuService.hideSidebar();
    }
  }
}
