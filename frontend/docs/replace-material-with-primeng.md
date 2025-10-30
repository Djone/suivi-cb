# 🧩 Migration Guide – Remplacer Angular Material Dialog par PrimeNG Dialog

## 📘 Sommaire
1. [🎯 Objectif](#-objectif)
2. [🧱 Avant / Après – aperçu rapide](#-avant--après--aperçu-rapide)
3. [⚙️ 1. Installation des modules nécessaires](#️-1-installation-des-modules-nécessaires)
4. [🧩 2. Conversion d’une boîte de dialogue](#-2-conversion-dune-boîte-de-dialogue)
5. [🧭 3. Ouverture depuis un composant parent](#-3-ouverture-de-la-boîte-de-dialogue-depuis-un-composant-parent)
6. [🎨 4. Thèmes et apparence](#-4-thèmes-et-apparence)
7. [🧹 5. Nettoyage du code](#-5-nettoyage-du-code)
8. [🧾 6. Résumé des fichiers à adapter](#-6-résumé-des-fichiers-à-adapter)
9. [💡 Astuce bonus : Service d’aide aux dialogues](#-astuce-bonus--service-daide-aux-dialogues)
10. [📚 Exemples spécifiques](#-exemples-spécifiques)

---

## 🎯 Objectif

Remplacer les boîtes de dialogue **Angular Material** (`MatDialog`) par les composants **PrimeNG** (`DynamicDialog`) dans toute l’application Angular.

Ce changement apporte :
- 🎨 Une **UI plus cohérente** avec le reste de l’application (PrimeNG déjà utilisé)
- ⚙️ Moins de dépendances (Material peut être supprimé progressivement)
- 🧩 Des **boîtes de dialogue plus souples et plus stylables**

---

## 🧱 Avant / Après – aperçu rapide

| Fonction | Angular Material | PrimeNG |
|-----------|------------------|----------|
| Ouverture d’une boîte de dialogue | `MatDialog.open(Component, config)` | `DialogService.open(Component, config)` |
| Référence à la boîte de dialogue | `MatDialogRef` | `DynamicDialogRef` |
| Données d’entrée | `MAT_DIALOG_DATA` via injection | `data` dans `DialogService.open()` |
| Fermeture et retour de valeur | `dialogRef.close(value)` | `ref.close(value)` |
| Titre / contenu | `<h2 mat-dialog-title>`, `<mat-dialog-content>` | `<p-header>`, `<ng-template pTemplate="content">` |
| Actions (pied de page) | `<mat-dialog-actions>` | `<ng-template pTemplate="footer">` |

---

## ⚙️ 1. Installation des modules nécessaires

Assure-toi d’avoir les modules PrimeNG suivants installés :

```bash
npm install primeng primeicons

Puis, dans le module principal (souvent app.module.ts) :

import { DialogService, DynamicDialogModule } from 'primeng/dynamicdialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';

@NgModule({
  imports: [
    DynamicDialogModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    InputNumberModule
  ],
  providers: [DialogService]
})
export class AppModule {}

🧩 2. Conversion d’une boîte de dialogue
🧱 Avant (Angular Material)

edit-category-dialog.component.ts

constructor(
  private dialogRef: MatDialogRef<EditCategoryDialogComponent>,
  @Inject(MAT_DIALOG_DATA) public data: { category: Category }
) {}

save() {
  this.dialogRef.close(this.data.category);
}


edit-category-dialog.component.html

<h2 mat-dialog-title>Modifier une catégorie</h2>
<mat-dialog-content>
  <mat-form-field>
    <mat-label>Libellé</mat-label>
    <input matInput [(ngModel)]="data.category.label">
  </mat-form-field>
</mat-dialog-content>
<mat-dialog-actions align="end">
  <button mat-button (click)="dialogRef.close()">Annuler</button>
  <button mat-flat-button color="primary" (click)="save()">Enregistrer</button>
</mat-dialog-actions>

✅ Après (PrimeNG DynamicDialog)

edit-category-dialog.component.ts

import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';

constructor(
  public ref: DynamicDialogRef,
  public config: DynamicDialogConfig
) {}

get data() {
  return this.config.data;
}

save() {
  this.ref.close(this.data.category);
}

cancel() {
  this.ref.close();
}


edit-category-dialog.component.html

<p-header>{{ dialogTitle }}</p-header>

<div class="p-fluid grid">
  <div class="field col-12">
    <label for="label">Libellé *</label>
    <input pInputText id="label" [(ngModel)]="data.category.label" class="w-full" />
  </div>
</div>

<ng-template pTemplate="footer">
  <p-button label="Annuler" icon="pi pi-times" (onClick)="cancel()" styleClass="p-button-text p-button-secondary"></p-button>
  <p-button label="Enregistrer" icon="pi pi-check" (onClick)="save()" styleClass="p-button-success"></p-button>
</ng-template>

🧭 3. Ouverture de la boîte de dialogue depuis un composant parent
Avant (Material)
const dialogRef = this.dialog.open(EditCategoryDialogComponent, {
  width: '400px',
  data: { category }
});

dialogRef.afterClosed().subscribe(result => {
  if (result) this.saveCategory(result);
});

Après (PrimeNG)
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';

constructor(private dialogService: DialogService) {}

openEditDialog(category: Category) {
  const ref: DynamicDialogRef = this.dialogService.open(EditCategoryDialogComponent, {
    header: 'Modifier une catégorie',
    width: '400px',
    data: { category }
  });

  ref.onClose.subscribe((result: Category) => {
    if (result) this.saveCategory(result);
  });
}

🎨 4. Thèmes et apparence

Ajoute (ou vérifie) dans styles.scss :

@import 'primeng/resources/themes/lara-light-blue/theme.css';
@import 'primeng/resources/primeng.css';
@import 'primeicons/primeicons.css';


PrimeNG applique automatiquement une apparence cohérente aux boutons, entrées et dropdowns.

🧹 5. Nettoyage du code

Après la migration :

Supprime les imports Angular Material :

import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';


Supprime les modules Material non utilisés :

import { MatDialogModule } from '@angular/material/dialog';


Vérifie les styles personnalisés éventuels liés à Material (souvent .mat-dialog-container).

🧾 6. Résumé des fichiers à adapter
Fichier	Action
component.ts	Remplacer MatDialogRef / MAT_DIALOG_DATA par DynamicDialogRef / DynamicDialogConfig
component.html	Remplacer mat-dialog-* par p-header, ng-template pTemplate="footer", etc.
module.ts	Importer DynamicDialogModule et DialogService
Composant parent	Remplacer MatDialog.open() par DialogService.open()
💡 Astuce bonus : Service d’aide aux dialogues

Tu peux centraliser l’ouverture des boîtes de dialogue avec un service :

dialog-helper.service.ts

import { Injectable, Type } from '@angular/core';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';

@Injectable({ providedIn: 'root' })
export class DialogHelperService {
  constructor(private dialogService: DialogService) {}

  openDialog<T>(component: Type<T>, header: string, data: any, width = '500px'): DynamicDialogRef {
    return this.dialogService.open(component, { header, width, data });
  }
}


Utilisation

const ref = this.dialogHelper.openDialog(EditTransactionDialogComponent, 'Modifier une transaction', { transaction });
ref.onClose.subscribe(result => { if (result) this.saveTransaction(result); });

📚 Exemples spécifiques
Composant	Ancien titre Material	Nouveau composant PrimeNG
EditCategoryDialogComponent	<h2 mat-dialog-title>	<p-header>
EditTransactionDialogComponent	<mat-dialog-content>	<div class="p-fluid grid">
EditRecurringTransactionDialogComponent	<mat-dialog-actions>	<ng-template pTemplate="foote