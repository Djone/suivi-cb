# Guide d'harmonisation des tableaux

## Objectif
Uniformiser tous les tableaux de l'application avec:
1. Icônes pour les actions (éditer, supprimer, désactiver)
2. Filtres sur chaque colonne
3. Tri sur chaque colonne
4. Pagination avec choix du nombre de lignes

## Fichiers concernés
1. **Transactions**: `frontend/src/app/components/transaction/transaction-list.component.*`
2. **Catégories**: `frontend/src/app/components/category/category-list.component.*`
3. **Sous-catégories**: `frontend/src/app/components/subcategory/sub-category-list.component.*`
4. **Échéances mensuelles**: `frontend/src/app/components/recurring-transaction/recurring-transaction-list/recurring-transaction-list.component.*`

## CSS Commun
Un fichier CSS commun a été créé: `frontend/src/app/styles/table-common.css`

Ce fichier contient tous les styles pour:
- Contrôles de pagination
- Champs de filtre
- Indicateurs de tri
- Boutons d'action avec icônes
- Style de tableau unifié

## Modifications à apporter

### 1. Dans le fichier TypeScript (.ts)

```typescript
// Ajouter dans les imports
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

// Ajouter dans @Component styleUrls
styleUrls: ['./component.css', '../../styles/table-common.css']

// Ajouter dans imports du component
imports: [
  CommonModule,
  FormsModule,
  MatIconModule,
  // autres imports...
]

// Ajouter les propriétés
transactions: Transaction[] = [];  // ou le type approprié
filteredTransactions: Transaction[] = [];
paginatedTransactions: Transaction[] = [];
Math = Math;

// Filtres (adapter selon les colonnes)
filters = {
  col1: '',
  col2: '',
  col3: ''
};

// Tri
sortColumn: string = 'col1';  // colonne par défaut
sortDirection: 'asc' | 'desc' = 'desc';

// Pagination
currentPage: number = 1;
pageSize: number = 10;
pageSizeOptions: number[] = [10, 20, 50, 100];
totalPages: number = 1;

// Méthodes à ajouter
applyFiltersAndSort(): void {
  // Filtrer
  this.filteredTransactions = this.transactions.filter(item => {
    // Ajouter les conditions de filtrage pour chaque colonne
    return true; // adapter selon les filtres
  });

  // Trier
  this.filteredTransactions.sort((a, b) => {
    // Logique de tri selon sortColumn
    return 0;
  });

  this.updatePagination();
}

sortBy(column: string): void {
  if (this.sortColumn === column) {
    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    this.sortColumn = column;
    this.sortDirection = 'asc';
  }
  this.applyFiltersAndSort();
}

applyFilter(): void {
  this.currentPage = 1;
  this.applyFiltersAndSort();
}

updatePagination(): void {
  this.totalPages = Math.ceil(this.filteredTransactions.length / this.pageSize);
  const startIndex = (this.currentPage - 1) * this.pageSize;
  const endIndex = startIndex + this.pageSize;
  this.paginatedTransactions = this.filteredTransactions.slice(startIndex, endIndex);
}

goToPage(page: number): void {
  if (page >= 1 && page <= this.totalPages) {
    this.currentPage = page;
    this.updatePagination();
  }
}

changePageSize(size: number): void {
  this.pageSize = size;
  this.currentPage = 1;
  this.updatePagination();
}

getPageNumbers(): number[] {
  const pages: number[] = [];
  const maxPagesToShow = 5;
  if (this.totalPages <= maxPagesToShow) {
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
  } else {
    const startPage = Math.max(1, this.currentPage - 2);
    const endPage = Math.min(this.totalPages, startPage + maxPagesToShow - 1);
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
  }
  return pages;
}
```

### 2. Dans le fichier HTML

Structure de base:

```html
<div class="table-container">
  <!-- Contrôles -->
  <div class="table-controls">
    <div class="page-size-selector">
      <label>Lignes par page :</label>
      <select [(ngModel)]="pageSize" (change)="changePageSize(pageSize)">
        <option *ngFor="let size of pageSizeOptions" [value]="size">{{ size }}</option>
      </select>
    </div>
    <div class="results-info">
      {{ (currentPage - 1) * pageSize + 1 }} - {{ Math.min(currentPage * pageSize, filteredTransactions.length) }} sur {{ filteredTransactions.length }} résultat(s)
    </div>
  </div>

  <!-- Table -->
  <table class="data-table">
    <thead>
      <tr>
        <th>
          <div class="th-content">
            <span (click)="sortBy('colonne1')" class="sortable">
              Colonne 1
              <span class="sort-icon" *ngIf="sortColumn === 'colonne1'">
                {{ sortDirection === 'asc' ? '▲' : '▼' }}
              </span>
            </span>
          </div>
          <input type="text" [(ngModel)]="filters.colonne1" (input)="applyFilter()" placeholder="Filtrer..." class="filter-input" />
        </th>
        <!-- Répéter pour chaque colonne -->

        <th>
          <div class="th-content">
            <span>Actions</span>
          </div>
        </th>
      </tr>
    </thead>
    <tbody>
      <tr *ngFor="let item of paginatedTransactions">
        <td>{{ item.col1 }}</td>
        <!-- ... autres colonnes -->
        <td class="actions-cell">
          <button class="action-btn edit-btn" (click)="edit(item)" title="Éditer">
            <mat-icon>edit</mat-icon>
          </button>
          <button class="action-btn delete-btn" (click)="delete(item)" title="Supprimer">
            <mat-icon>delete</mat-icon>
          </button>
          <!-- Autres actions si nécessaire -->
        </td>
      </tr>
    </tbody>
  </table>

  <!-- Message vide -->
  <div *ngIf="paginatedTransactions.length === 0" class="no-data">
    Aucun élément trouvé.
  </div>

  <!-- Pagination -->
  <div class="pagination" *ngIf="totalPages > 1">
    <button class="page-btn" (click)="goToPage(1)" [disabled]="currentPage === 1">««</button>
    <button class="page-btn" (click)="goToPage(currentPage - 1)" [disabled]="currentPage === 1">«</button>
    <button *ngFor="let page of getPageNumbers()" class="page-btn" [class.active]="page === currentPage" (click)="goToPage(page)">
      {{ page }}
    </button>
    <button class="page-btn" (click)="goToPage(currentPage + 1)" [disabled]="currentPage === totalPages">»</button>
    <button class="page-btn" (click)="goToPage(totalPages)" [disabled]="currentPage === totalPages">»»</button>
  </div>
</div>
```

### 3. Icônes Material disponibles

- `edit` : Éditer
- `delete` : Supprimer
- `toggle_off` : Désactiver
- `toggle_on` : Réactiver / Activer
- `visibility` : Voir
- `check` : Valider

## Ordre de migration

1. **Transactions** - Template de base
2. **Catégories** - Avec désactivation
3. **Sous-catégories** - Simple
4. **Échéances mensuelles** - Simple

## Notes importantes

- Tous les tableaux doivent charger leurs données dans `this.transactions` (ou nom approprié)
- Toujours appeler `applyFiltersAndSort()` après le chargement des données
- Les filtres sont case-insensitive
- Le tri par défaut est descendant sur la première colonne
- La pagination affiche max 5 numéros de page à la fois
