import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BadgeModule } from 'primeng/badge';
import { environment } from '../../../environments/environment';
import { DevTodoItem, DevTodoPriority, DevTodoStatus } from './dev-todo.model';
import { DEV_TODO_ITEMS } from './dev-todo.data';

@Component({
  selector: 'app-dev-todo',
  standalone: true,
  imports: [CommonModule, RouterModule, BadgeModule],
  templateUrl: './dev-todo.component.html',
  styleUrls: ['./dev-todo.component.css'],
})
export class DevTodoComponent {
  public readonly appVersion = environment.version;

  public readonly statuses: {
    key: DevTodoStatus;
    label: string;
    accent: string;
    helper: string;
  }[] = [
    {
      key: 'todo',
      label: 'À faire',
      accent: 'accent-todo',
      helper: 'File d’attente',
    },
    {
      key: 'in-progress',
      label: 'En cours',
      accent: 'accent-in-progress',
      helper: 'Focus',
    },
    {
      key: 'done',
      label: 'Validé',
      accent: 'accent-done',
      helper: 'Réalisé ou prêt pour prod',
    },
  ];

  public readonly todoItems: DevTodoItem[] = DEV_TODO_ITEMS;

  getItemsByStatus(status: DevTodoStatus): DevTodoItem[] {
    return this.todoItems.filter((item) => item.status === status);
  }

  getDescriptionList(item: DevTodoItem): string[] | null {
    return Array.isArray(item.description) ? item.description : null;
  }

  getPlainDescription(item: DevTodoItem): string {
    return typeof item.description === 'string' ? item.description : '';
  }

  getPriorityBadge(priority: DevTodoPriority): {
    value: string;
    severity: 'danger' | 'info' | 'success';
    label: string;
  } {
    const map = {
      high: { value: 'P0', severity: 'danger' as const, label: 'high' },
      medium: { value: 'P1', severity: 'info' as const, label: 'medium' },
      low: { value: 'P2', severity: 'success' as const, label: 'low' },
    };
    return map[priority];
  }
}
