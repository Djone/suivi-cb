import { Routes } from '@angular/router';
import { AppLayoutComponent } from './layout/app-layout/app-layout.component';
import { HomeComponent } from './components/home/home.component';
import { TransactionListComponent } from './components/transaction/transaction-list.component';
import { CategoryListComponent } from './components/category/category-list.component';
import { SubCategoryListComponent } from './components/subcategory/sub-category-list.component';
import { RecurringTransactionListComponent } from './components/recurring-transaction/recurring-transaction-list.component';
import { StatisticsComponent } from './components/statistics/statistics.component';

export const routes: Routes = [
    {
        path: '',
        component: AppLayoutComponent,
        children: [
            { path: '', redirectTo: '/home', pathMatch: 'full' },
            { path: 'home', component: HomeComponent },
            { path: 'transactions', component: TransactionListComponent },
            { path: 'transactions-list', component: TransactionListComponent },
            { path: 'transactions-list/:accountId', component: TransactionListComponent, data: { prerender: false } },
            { path: 'transactions/:accountId/:financialFlowId', component: TransactionListComponent, data: { prerender: false } },
            { path: 'category', component: CategoryListComponent },
            { path: 'sub-categories', component: SubCategoryListComponent },
            { path: 'recurring-transactions', component: RecurringTransactionListComponent },
            { path: 'statistics', component: StatisticsComponent }
        ]
    }
];
