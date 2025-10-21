import { Routes } from '@angular/router';
import { AppLayoutComponent } from './layout/app-layout/app-layout.component';
import { HomeComponent } from './components/home/home.component';
import { TransactionFormComponent } from './components/transaction/transaction-form.component';
import { TransactionListComponent } from './components/transaction/transaction-list.component';
import { CategoryFormComponent } from './components/category/category-form.component';
import { SubCategoryFormComponent } from './components/subcategory/sub-category-form.component';
import { RecurringTransactionFormComponent } from './components/recurring-transaction/recurring-transaction-form/recurring-transaction-form.component';
import { StatisticsComponent } from './components/statistics/statistics.component';

export const routes: Routes = [
    {
        path: '',
        component: AppLayoutComponent,
        children: [
            { path: '', redirectTo: '/home', pathMatch: 'full' },
            { path: 'home', component: HomeComponent },
            { path: 'transactions', component: TransactionFormComponent },
            { path: 'transactions-list', component: TransactionListComponent },
            { path: 'transactions-list/:accountId', component: TransactionListComponent, data: { prerender: false } },
            { path: 'transactions/:accountId/:financialFlowId', component: TransactionFormComponent, data: { prerender: false } },
            { path: 'category', component: CategoryFormComponent },
            { path: 'sub-categories', component: SubCategoryFormComponent },
            { path: 'recurring-transactions', component: RecurringTransactionFormComponent },
            { path: 'statistics', component: StatisticsComponent }
        ]
    }
];
