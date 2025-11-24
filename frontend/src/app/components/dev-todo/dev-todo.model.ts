export type DevTodoStatus = 'todo' | 'in-progress' | 'done';
export type DevTodoPriority = 'high' | 'medium' | 'low';

export interface DevTodoItem {
  title: string;
  description: string | string[];
  status: DevTodoStatus;
  priority: DevTodoPriority;
  targetVersion?: string;
  notes?: string;
  owner?: string;
}
