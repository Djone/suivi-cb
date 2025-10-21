import { Component } from '@angular/core';
import { MenuService } from '../menu.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-topbar',
  imports: [CommonModule],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.css'
})
export class TopbarComponent {
  constructor(public menuService: MenuService) {}

  toggleMenu(): void {
    this.menuService.toggleSidebar();
  }
}
