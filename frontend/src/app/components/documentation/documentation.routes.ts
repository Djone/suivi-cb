import { Routes } from '@angular/router';

// Replaced by documentation.routes.prod.ts in every production/preproduction build.
export const documentationRoutes: Routes = [{
  path: 'documentation',
  loadComponent: () => import('./documentation.component').then((module) => module.DocumentationComponent),
  data: { devOnly: true },
}];
