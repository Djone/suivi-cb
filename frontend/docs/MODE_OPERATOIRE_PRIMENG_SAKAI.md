# Mode opératoire : Transformation des composants au style PrimeNG Sakai

Ce document décrit la procédure complète pour transformer les composants de l'application au style PrimeNG Sakai, en utilisant les tableaux Filtering de PrimeNG avec boîte de dialogue pour l'ajout et l'édition.

## Table des matières
1. [Prérequis](#prérequis)
2. [Architecture globale](#architecture-globale)
3. [Étape 1 : Supprimer le formulaire inline](#étape-1--supprimer-le-formulaire-inline)
4. [Étape 2 : Transformer le composant liste](#étape-2--transformer-le-composant-liste)
5. [Étape 3 : Adapter la boîte de dialogue](#étape-3--adapter-la-boîte-de-dialogue)
6. [Étape 4 : Gestion du toggle switch](#étape-4--gestion-du-toggle-switch)
7. [Application aux sous-catégories](#application-aux-sous-catégories)
8. [Application aux transactions récurrentes](#application-aux-transactions-récurrentes)

---

## Prérequis

### 1. Installation de PrimeNG
PrimeNG 19+ doit être installé avec le package de thèmes séparé.

```bash
npm install primeng primeicons primeflex @primeng/themes
```

### 2. Configuration dans angular.json
Ajouter les styles de base dans `angular.json` :

```json
"styles": [
  "@angular/material/prebuilt-themes/azure-blue.css",
  "node_modules/primeicons/primeicons.css",
  "node_modules/primeflex/primeflex.css",
  "src/styles.css"
],
```

### 3. Configuration du thème dans app.config.ts
Avec PrimeNG 19, les thèmes se configurent directement dans le code :

**Ajouter les imports :**
```typescript
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
```

**Ajouter le provider dans appConfig :**
```typescript
export const appConfig: ApplicationConfig = {
  providers: [
    // ... autres providers
    providePrimeNG({
      theme: {
        preset: Aura,
        options: {
          darkModeSelector: false
        }
      }
    })
  ]
};
```

---

## Architecture globale

Le nouveau pattern utilise :
- **Pas de formulaire inline** dans la page
- **Un bouton "Nouveau"** qui ouvre une boîte de dialogue
- **La même boîte de dialogue** pour créer et éditer
- **Un tableau PrimeNG** avec filtres, tri, pagination et toggle switch

---

## Étape 1 : Supprimer le formulaire inline

### 1.1 Dans le composant formulaire (ex: category-form.component.html)

**Remplacer tout le contenu par :**
```html
<!-- Le formulaire inline n'est plus affiché - utiliser le bouton "Nouvelle catégorie" dans le tableau -->
<app-category-list></app-category-list>
```

### 1.2 Dans le composant TypeScript (ex: category-form.component.ts)

Vous pouvez conserver le fichier tel quel ou simplifier en supprimant toute la logique du formulaire. Le composant devient juste un conteneur pour le composant liste.

**Option simplifiée :**
```typescript
import { Component } from '@angular/core';
import { CategoryListComponent } from './category-list.component';

@Component({
  selector: 'app-category-form',
  standalone: true,
  imports: [CategoryListComponent],
  templateUrl: './category-form.component.html',
  styleUrls: ['./category-form.component.css']
})
export class CategoryFormComponent {}
```

---

## Étape 2 : Transformer le composant liste

### 2.1 Mettre à jour les imports TypeScript

```typescript
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

// Services et modèles
import { CategoryService } from '../../services/category.service';
import { Category } from '../../models/category.model';

// PrimeNG Imports
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { TagModule } from 'primeng/tag';
import { InputSwitchModule } from 'primeng/inputswitch';
import { CardModule } from 'primeng/card';
import { TooltipModule } from 'primeng/tooltip';

// Composant de dialogue
import { EditCategoryDialogComponent } from '../edit-category-dialog/edit-category-dialog.component';

@Component({
  selector: 'app-category-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    TagModule,
    InputSwitchModule,
    CardModule,
    TooltipModule
  ],
  templateUrl: './category-list.component.html',
  styleUrls: ['./category-list.component.css']
})
```

### 2.2 Simplifier la classe TypeScript

**Supprimer :**
- Toutes les propriétés de pagination manuelle
- Toutes les méthodes de filtrage, tri et pagination manuels
- Les méthodes `deleteCategory` et `reactivateCategory` avec confirmation

**Conserver/Ajouter :**
```typescript
export class CategoryListComponent implements OnInit, OnDestroy {
  categories: Category[] = [];
  private subscriptions = new Subscription();

  // Options pour les dropdowns de filtre
  statuses = [
    { label: 'Actif', value: 1 },
    { label: 'Inactif', value: 0 }
  ];

  financialFlows = [
    { label: 'Revenu', value: 1 },
    { label: 'Dépense', value: 2 }
  ];

  constructor(
    private categoryService: CategoryService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    // S'abonner au BehaviorSubject pour les mises à jour automatiques
    this.subscriptions.add(
      this.categoryService.categories$.subscribe({
        next: (data) => {
          this.categories = data;
          console.log('CATEGORY LIST : Tableau mis à jour automatiquement', data);
        },
        error: (err) => console.error('Erreur lors de la mise à jour des catégories:', err)
      })
    );

    // Charger les catégories initiales
    this.loadCategories();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadCategories(): void {
    this.categoryService.getCategories().subscribe();
  }

  isActive(category: Category): boolean {
    return category.isActive === 1 || category['is_active'] === 1;
  }

  // Créer une nouvelle catégorie via la boîte de dialogue
  createCategory(): void {
    const dialogRef = this.dialog.open(EditCategoryDialogComponent, {
      width: '500px',
      maxHeight: '90vh',
      data: {
        category: {
          label: '',
          financialFlowId: 2 // Valeur par défaut
        },
        isNew: true
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.categoryService.addCategory(result).subscribe({
          next: () => {
            console.log('CATEGORY LIST : Catégorie créée avec succès');
            this.categoryService.getCategories().subscribe();
          },
          error: (err) => console.error('CATEGORY LIST : Erreur lors de la création:', err)
        });
      }
    });
  }

  // Éditer une catégorie existante via la boîte de dialogue
  editCategory(category: Category): void {
    const dialogRef = this.dialog.open(EditCategoryDialogComponent, {
      width: '500px',
      maxHeight: '90vh',
      data: {
        category: { ...category },
        isNew: false
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.categoryService.updateCategory(result.id!, result).subscribe({
          next: () => {
            console.log('CATEGORY LIST : Catégorie mise à jour avec succès');
            this.categoryService.getCategories().subscribe();
          },
          error: (err) => console.error('CATEGORY LIST : Erreur lors de la mise à jour:', err)
        });
      }
    });
  }

  // Basculer le statut actif/inactif (sans confirmation)
  toggleActive(category: Category, event: any): void {
    console.log('CATEGORY LIST : toggleActive appelé', {
      category: category.label,
      categoryId: category.id,
      currentStatus: category.isActive,
      eventChecked: event.checked
    });

    const newStatus = event.checked === 1;
    const action = newStatus ? 'réactiver' : 'désactiver';

    const service$ = newStatus
      ? this.categoryService.reactivateCategory(category.id!)
      : this.categoryService.deleteCategory(category.id!);

    service$.subscribe({
      next: () => {
        console.log(`CATEGORY LIST : Catégorie ${action}e avec succès`);
        // Attendre un peu pour laisser le temps à la DB de se mettre à jour
        setTimeout(() => {
          this.categoryService.getCategories().subscribe({
            next: () => console.log('CATEGORY LIST : Catégories rechargées'),
            error: (err) => console.error('CATEGORY LIST : Erreur rechargement:', err)
          });
        }, 100);
      },
      error: (err) => {
        console.error(`CATEGORY LIST : Erreur lors de ${action}:`, err);
        alert(`Une erreur est survenue lors de la ${action}.`);
        this.loadCategories(); // Restaurer l'état
      }
    });
  }

  getSeverity(isActive: number): string {
    return isActive === 1 ? 'success' : 'danger';
  }

  getStatusLabel(isActive: number): string {
    return isActive === 1 ? 'Actif' : 'Inactif';
  }

  financialFlowNameById(id: number): string {
    return id === 1 ? 'Revenu' : 'Dépense';
  }
}
```

### 2.3 Créer le template HTML

```html
<div class="card">
  <p-card>
    <p-table
      #dt
      [value]="categories"
      [paginator]="true"
      [rows]="10"
      [rowsPerPageOptions]="[10, 20, 50, 100]"
      [showCurrentPageReport]="true"
      currentPageReportTemplate="{first} à {last} sur {totalRecords} catégories"
      [globalFilterFields]="['label', 'financialFlowId', 'isActive']"
      [tableStyle]="{ 'min-width': '50rem' }"
      styleClass="p-datatable-gridlines p-datatable-striped">

      <!-- Bouton pour ajouter une nouvelle catégorie -->
      <ng-template pTemplate="caption">
        <div class="flex align-items-center justify-content-between">
          <p-button
            label="Nouvelle catégorie"
            icon="pi pi-plus"
            (onClick)="createCategory()"
            styleClass="p-button-success">
          </p-button>
        </div>
      </ng-template>

      <!-- En-têtes de colonnes avec tri -->
      <ng-template pTemplate="header">
        <tr>
          <th pSortableColumn="label" style="width: 40%">
            Libellé
            <p-sortIcon field="label" />
          </th>
          <th pSortableColumn="financialFlowId" style="width: 25%">
            Flux financier
            <p-sortIcon field="financialFlowId" />
          </th>
          <th pSortableColumn="isActive" style="width: 15%">
            Statut
            <p-sortIcon field="isActive" />
          </th>
          <th style="width: 20%">Actions</th>
        </tr>
        <!-- Ligne de filtres -->
        <tr>
          <th>
            <input
              pInputText
              type="text"
              (input)="dt.filter($any($event.target).value, 'label', 'contains')"
              placeholder="Filtrer par libellé"
              class="w-full" />
          </th>
          <th>
            <p-dropdown
              [options]="financialFlows"
              (onChange)="dt.filter($event.value, 'financialFlowId', 'equals')"
              placeholder="Tous"
              [showClear]="true"
              styleClass="w-full">
              <ng-template let-option pTemplate="item">
                {{ option.label }}
              </ng-template>
            </p-dropdown>
          </th>
          <th>
            <p-dropdown
              [options]="statuses"
              (onChange)="dt.filter($event.value, 'isActive', 'equals')"
              placeholder="Tous"
              [showClear]="true"
              styleClass="w-full">
              <ng-template let-option pTemplate="item">
                {{ option.label }}
              </ng-template>
            </p-dropdown>
          </th>
          <th></th>
        </tr>
      </ng-template>

      <!-- Corps du tableau -->
      <ng-template pTemplate="body" let-category>
        <tr>
          <td>{{ category.label }}</td>
          <td>
            <p-tag
              [value]="financialFlowNameById(category.financialFlowId)"
              [severity]="category.financialFlowId === 1 ? 'success' : 'warning'">
            </p-tag>
          </td>
          <td>
            <p-tag
              [value]="getStatusLabel(category.isActive)"
              [severity]="getSeverity(category.isActive)">
            </p-tag>
          </td>
          <td>
            <div class="flex align-items-center gap-2">
              <p-button
                icon="pi pi-pencil"
                (onClick)="editCategory(category)"
                styleClass="p-button-rounded p-button-text p-button-info"
                pTooltip="Éditer"
                tooltipPosition="top">
              </p-button>
              <p-inputSwitch
                [ngModel]="category.isActive"
                [trueValue]="1"
                [falseValue]="0"
                (onChange)="toggleActive(category, $event)"
                pTooltip="Activer/Désactiver"
                tooltipPosition="top">
              </p-inputSwitch>
            </div>
          </td>
        </tr>
      </ng-template>

      <!-- Message si aucune donnée -->
      <ng-template pTemplate="emptymessage">
        <tr>
          <td colspan="4" class="text-center">Aucune catégorie trouvée.</td>
        </tr>
      </ng-template>
    </p-table>
  </p-card>
</div>
```

---

## Étape 3 : Adapter la boîte de dialogue

### 3.1 Mettre à jour les imports TypeScript

```typescript
import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';

// PrimeNG Imports
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';

// Modèle et constantes
import { Category } from '../../models/category.model';
import { FINANCIAL_FLOW_LIST } from '../../utils/utils';

@Component({
  selector: 'app-edit-category-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    ButtonModule,
    InputTextModule,
    DropdownModule
  ],
  templateUrl: './edit-category-dialog.component.html',
  styleUrls: ['./edit-category-dialog.component.css']
})
```

### 3.2 Adapter la classe TypeScript

```typescript
export class EditCategoryDialogComponent {
  financialFlowList = FINANCIAL_FLOW_LIST;
  isNew: boolean = false;
  dialogTitle: string = '';

  constructor(
    public dialogRef: MatDialogRef<EditCategoryDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { category: Category; isNew?: boolean }
  ) {
    this.isNew = data.isNew || false;
    this.dialogTitle = this.isNew ? 'Nouvelle catégorie' : 'Éditer la catégorie';
  }

  save(): void {
    const categoryData: any = {
      label: this.data.category.label,
      financialFlowId: this.data.category.financialFlowId,
    };

    if (!this.isNew && this.data.category.id) {
      categoryData.id = this.data.category.id;
    }

    this.dialogRef.close(categoryData);
  }

  cancel(): void {
    this.dialogRef.close();
  }

  isFormValid(): boolean {
    return !!(
      this.data.category.label &&
      this.data.category.label.trim() !== '' &&
      this.data.category.financialFlowId
    );
  }
}
```

### 3.3 Transformer le template HTML

```html
<h2 mat-dialog-title>{{ dialogTitle }}</h2>

<mat-dialog-content>
  <div class="p-fluid">
    <div class="p-field mb-3">
      <label for="label" class="block mb-2">Libellé *</label>
      <input
        pInputText
        id="label"
        type="text"
        [(ngModel)]="data.category.label"
        placeholder="Entrez le libellé"
        class="w-full"
        autofocus />
      <small class="p-error" *ngIf="data.category.label && data.category.label.trim() === ''">
        Le libellé est requis.
      </small>
    </div>

    <div class="p-field mb-3">
      <label for="financialFlowId" class="block mb-2">Flux financier *</label>
      <p-dropdown
        id="financialFlowId"
        [options]="financialFlowList"
        [(ngModel)]="data.category.financialFlowId"
        optionLabel="name"
        optionValue="id"
        placeholder="Sélectionnez un flux financier"
        [style]="{'width': '100%'}">
      </p-dropdown>
    </div>
  </div>
</mat-dialog-content>

<mat-dialog-actions align="end">
  <p-button
    label="Annuler"
    icon="pi pi-times"
    (onClick)="cancel()"
    styleClass="p-button-text p-button-secondary">
  </p-button>
  <p-button
    [label]="isNew ? 'Créer' : 'Enregistrer'"
    icon="pi pi-check"
    (onClick)="save()"
    [disabled]="!isFormValid()"
    styleClass="p-button-success">
  </p-button>
</mat-dialog-actions>
```

---

## Étape 4 : Gestion du toggle switch

### 4.1 Points importants

**⚠️ IMPORTANT : Ne pas utiliser `[(ngModel)]` (two-way binding) avec le toggle switch**

Pourquoi ? Le two-way binding change la valeur immédiatement dans l'objet, avant même que la requête HTTP soit envoyée. Résultat : après rechargement des données, la valeur redevient l'ancienne.

**✅ Solution : Utiliser `[ngModel]` (one-way binding) et passer `$event` à la méthode**

```html
<p-inputSwitch
  [ngModel]="category.isActive"
  [trueValue]="1"
  [falseValue]="0"
  (onChange)="toggleActive(category, $event)"
  pTooltip="Activer/Désactiver"
  tooltipPosition="top">
</p-inputSwitch>
```

### 4.2 Méthode toggleActive avec event

```typescript
toggleActive(category: Category, event: any): void {
  // event.checked contient la NOUVELLE valeur (0 ou 1)
  const newStatus = event.checked === 1;
  const action = newStatus ? 'réactiver' : 'désactiver';

  const service$ = newStatus
    ? this.categoryService.reactivateCategory(category.id!)
    : this.categoryService.deleteCategory(category.id!);

  service$.subscribe({
    next: () => {
      console.log(`Catégorie ${action}e avec succès`);
      // Attendre un peu pour la mise à jour de la DB
      setTimeout(() => {
        this.categoryService.getCategories().subscribe();
      }, 100);
    },
    error: (err) => {
      console.error(`Erreur lors de ${action}:`, err);
      alert(`Une erreur est survenue.`);
      this.loadCategories(); // Restaurer l'état
    }
  });
}
```

### 4.3 Pourquoi le setTimeout ?

Le `setTimeout(100)` permet de s'assurer que :
1. La requête HTTP de désactivation/réactivation a bien été traitée
2. La base de données a été mise à jour
3. Le rechargement des catégories récupère la bonne valeur

Sans ce délai, il peut y avoir une condition de course (race condition) où les catégories sont rechargées avant que la DB soit à jour.

---

## Application aux sous-catégories

### Spécificités pour les sous-catégories

Les sous-catégories ont une relation avec une catégorie parente. Voici les adaptations nécessaires :

#### 1. Ajouter une colonne pour la catégorie parente

```html
<th pSortableColumn="categoryId" style="width: 25%">
  Catégorie parente
  <p-sortIcon field="categoryId" />
</th>
```

#### 2. Ajouter un filtre par catégorie parente

```html
<th>
  <p-dropdown
    [options]="parentCategories"
    (onChange)="dt.filter($event.value, 'categoryId', 'equals')"
    placeholder="Toutes les catégories"
    [showClear]="true"
    optionLabel="label"
    optionValue="id"
    styleClass="w-full">
  </p-dropdown>
</th>
```

#### 3. Charger les catégories parentes dans le TypeScript

```typescript
parentCategories: Category[] = [];

ngOnInit(): void {
  // Charger les catégories parentes pour le filtre
  this.subscriptions.add(
    this.categoryService.categories$.subscribe({
      next: (data) => {
        this.parentCategories = data.filter(cat => cat.isActive === 1);
      }
    })
  );
  this.categoryService.getCategories().subscribe();

  // Charger les sous-catégories
  this.subscriptions.add(
    this.subCategoryService.subCategories$.subscribe({
      next: (data) => {
        this.subCategories = data;
      }
    })
  );
  this.loadSubCategories();
}
```

#### 4. Afficher le nom de la catégorie parente

```html
<td>
  <p-tag [value]="getCategoryName(subCategory.categoryId)" severity="info"></p-tag>
</td>
```

```typescript
getCategoryName(categoryId: number): string {
  const category = this.parentCategories.find(cat => cat.id === categoryId);
  return category ? category.label : 'Non définie';
}
```

#### 5. Dans la boîte de dialogue

```html
<div class="p-field mb-3">
  <label for="categoryId" class="block mb-2">Catégorie parente *</label>
  <p-dropdown
    id="categoryId"
    [options]="activeCategories"
    [(ngModel)]="data.subCategory.categoryId"
    optionLabel="label"
    optionValue="id"
    placeholder="Sélectionnez une catégorie"
    [style]="{'width': '100%'}">
  </p-dropdown>
</div>
```

**Fichiers à modifier :**
- `sub-category-form.component.html` et `.ts`
- `sub-category-list.component.html` et `.ts`
- `edit-sub-category-dialog.component.html` et `.ts`

---

## Application aux transactions récurrentes

### Spécificités pour les transactions récurrentes

Les transactions récurrentes ont des champs supplémentaires : `amount`, `dayOfMonth`, `frequency`.

#### 1. Colonnes du tableau

```html
<ng-template pTemplate="header">
  <tr>
    <th pSortableColumn="label" style="width: 25%">
      Libellé
      <p-sortIcon field="label" />
    </th>
    <th pSortableColumn="amount" style="width: 15%">
      Montant
      <p-sortIcon field="amount" />
    </th>
    <th pSortableColumn="dayOfMonth" style="width: 10%">
      Jour
      <p-sortIcon field="dayOfMonth" />
    </th>
    <th pSortableColumn="frequency" style="width: 15%">
      Fréquence
      <p-sortIcon field="frequency" />
    </th>
    <th pSortableColumn="subCategoryId" style="width: 20%">
      Sous-catégorie
      <p-sortIcon field="subCategoryId" />
    </th>
    <th pSortableColumn="isActive" style="width: 10%">
      Statut
      <p-sortIcon field="isActive" />
    </th>
    <th style="width: 15%">Actions</th>
  </tr>
</ng-template>
```

#### 2. Filtre par fréquence

```typescript
frequencies = [
  { label: 'Mensuelle', value: 'monthly' },
  { label: 'Hebdomadaire', value: 'weekly' },
  { label: 'Annuelle', value: 'yearly' }
];
```

```html
<th>
  <p-dropdown
    [options]="frequencies"
    (onChange)="dt.filter($event.value, 'frequency', 'equals')"
    placeholder="Toutes"
    [showClear]="true"
    styleClass="w-full">
  </p-dropdown>
</th>
```

#### 3. Affichage du montant avec formatage

```html
<td>{{ transaction.amount | currency:'EUR':'symbol':'1.2-2':'fr' }}</td>
```

#### 4. Dans la boîte de dialogue

```html
<div class="p-field mb-3">
  <label for="amount" class="block mb-2">Montant *</label>
  <input
    pInputText
    id="amount"
    type="number"
    [(ngModel)]="data.transaction.amount"
    placeholder="0.00"
    class="w-full"
    step="0.01" />
</div>

<div class="p-field mb-3">
  <label for="dayOfMonth" class="block mb-2">Jour du mois *</label>
  <input
    pInputText
    id="dayOfMonth"
    type="number"
    [(ngModel)]="data.transaction.dayOfMonth"
    placeholder="1-31"
    class="w-full"
    min="1"
    max="31" />
</div>

<div class="p-field mb-3">
  <label for="frequency" class="block mb-2">Fréquence *</label>
  <p-dropdown
    id="frequency"
    [options]="frequencies"
    [(ngModel)]="data.transaction.frequency"
    optionLabel="label"
    optionValue="value"
    placeholder="Sélectionnez une fréquence"
    [style]="{'width': '100%'}">
  </p-dropdown>
</div>

<div class="p-field mb-3">
  <label for="subCategoryId" class="block mb-2">Sous-catégorie *</label>
  <p-dropdown
    id="subCategoryId"
    [options]="activeSubCategories"
    [(ngModel)]="data.transaction.subCategoryId"
    optionLabel="label"
    optionValue="id"
    placeholder="Sélectionnez une sous-catégorie"
    [filter]="true"
    [style]="{'width': '100%'}">
  </p-dropdown>
</div>
```

**Fichiers à modifier :**
- `recurring-transaction-form.component.html` et `.ts`
- `recurring-transaction-list.component.html` et `.ts`
- `edit-recurring-transaction-dialog.component.html` et `.ts`

---

## Résumé des changements

### ✅ Architecture

1. **Suppression du formulaire inline** dans la page
2. **Bouton "Nouveau"** dans le tableau qui ouvre la boîte de dialogue
3. **Même boîte de dialogue** pour créer et éditer (avec flag `isNew`)
4. **Toggle switch sans confirmation** pour activer/désactiver

### ✅ Points clés

- **One-way binding** `[ngModel]` pour le toggle switch (pas `[(ngModel)]`)
- **Passage de $event** à la méthode `toggleActive(item, $event)`
- **setTimeout(100)** avant de recharger les données
- **Flag isNew** dans la boîte de dialogue pour différencier création/édition
- **Validation** avec `isFormValid()` pour désactiver le bouton Enregistrer

### 📦 Modules PrimeNG utilisés

- `TableModule` : Tableau avec tri/filtrage/pagination automatiques
- `ButtonModule` : Boutons stylisés
- `InputTextModule` : Champs de texte
- `DropdownModule` : Listes déroulantes avec recherche
- `TagModule` : Badges/étiquettes pour statuts
- `InputSwitchModule` : Toggle switch
- `CardModule` : Cartes/conteneurs
- `TooltipModule` : Info-bulles

### 🔧 Points d'attention

1. **Garder MatDialogModule** pour utiliser `MatDialog` et `mat-dialog-content`
2. **Utiliser $any()** pour éviter les erreurs TypeScript strict sur les événements
3. **PrimeFlex** pour les classes utilitaires (`flex`, `gap-2`, `w-full`, etc.)
4. **PrimeIcons** pour les icônes (`pi pi-plus`, `pi pi-pencil`, etc.)
5. **Reload après toggle** : Utiliser `setTimeout(100)` pour éviter les race conditions

---

## Ressources

- **Documentation PrimeNG Table** : https://primeng.org/table
- **Sakai Template** : https://sakai.primeng.org/
- **PrimeIcons** : https://primeng.org/icons
- **PrimeFlex Grid** : https://primeflex.org/
- **PrimeNG Themes** : https://primeng.org/theming
