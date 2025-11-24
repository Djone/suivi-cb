import { Routes } from '@angular/router';
import { AppLayoutComponent } from './layout/app-layout/app-layout.component';
import { HomeComponent } from './components/home/home.component';
import { TransactionListComponent } from './components/transaction/transaction-list.component';
import { CategoryListComponent } from './components/category/category-list.component';
import { RecurringTransactionListComponent } from './components/recurring-transaction/recurring-transaction-list.component';
import { StatisticsComponent } from './components/statistics/statistics.component';
import { ReleaseNotesComponent } from './components/release-notes/release-notes.component';
import { ReleaseProcessComponent } from './components/release-process/release-process.component';
import { environment } from '../environments/environment';

const childRoutes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', component: HomeComponent },
  { path: 'transactions', component: TransactionListComponent },
  { path: 'transactions-list', component: TransactionListComponent },
  {
    path: 'transactions-list/:accountId',
    component: TransactionListComponent,
    data: { prerender: false },
  },
  {
    path: 'transactions/:accountId/:financialFlowId',
    component: TransactionListComponent,
    data: { prerender: false },
  },
  { path: 'category', component: CategoryListComponent },
  {
    path: 'recurring-transactions',
    component: RecurringTransactionListComponent,
  },
  { path: 'statistics', component: StatisticsComponent },
  { path: 'release-notes', component: ReleaseNotesComponent },
  { path: 'release-process', component: ReleaseProcessComponent },
];

if (!environment.production) {
  childRoutes.push({
    path: 'todo-dev',
    loadComponent: () =>
      import('./components/dev-todo/dev-todo.component').then(
        (m) => m.DevTodoComponent,
      ),
    data: { devOnly: true },
  });
}

export const routes: Routes = [
  {
    path: '',
    component: AppLayoutComponent,
    children: childRoutes,
  },
];
