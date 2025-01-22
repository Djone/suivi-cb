import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { TransactionFormComponent } from './components/transaction/transaction-form.component';
import { CategoryFormComponent } from './components/category/category-form.component';
import { SubCategoryFormComponent } from './components/subcategory/sub-category-form.component';

export const routes: Routes = [
    { path: '', redirectTo: '/home', pathMatch: 'full' }, // Redirige vers une route par défaut
    { path: 'home', component: HomeComponent },
    { path: 'transactions', component: TransactionFormComponent },
    { path: 'transactions/:accountId/:financialFlowId', component: TransactionFormComponent },
    { path: 'category', component: CategoryFormComponent },
    { path: 'sub-categories', component: SubCategoryFormComponent }
];
