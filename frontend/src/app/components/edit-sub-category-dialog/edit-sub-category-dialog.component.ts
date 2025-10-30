import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { SubCategory } from '../../models/sub-category.model';
import { Category } from '../../models/category.model';

// PrimeNG Imports
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';

@Component({
  selector: 'app-edit-sub-category-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    ButtonModule,
    InputTextModule,
    DropdownModule
  ],
  templateUrl: './edit-sub-category-dialog.component.html',
  styleUrls: ['./edit-sub-category-dialog.component.css']
})
export class EditSubCategoryDialogComponent implements OnInit {
  isNew: boolean = false;
  dialogTitle: string = '';

  save(): void {
    // On ne retourne que les champs attendus par le backend pour éviter les erreurs de validation.
    const subCategoryToSave = {
      id: this.data.subCategory.id,
      label: this.data.subCategory.label,
      categoryId: this.data.subCategory.categoryId
    };

    this.dialogRef.close(subCategoryToSave);
  }

  cancel(): void {
    this.dialogRef.close();
  }

  constructor(
    public dialogRef: MatDialogRef<EditSubCategoryDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { subCategory: SubCategory; categories: Category[]; isNew?: boolean }
  ) {}

  ngOnInit(): void {
    this.isNew = this.data.isNew || false;
    this.dialogTitle = this.isNew ? 'Nouvelle sous-catégorie' : 'Éditer la sous-catégorie';
  }

  /**
   * Vérifie si le formulaire est valide pour activer le bouton de sauvegarde.
   * @returns true si le formulaire est valide, false sinon.
   */
  isFormValid(): boolean {
    return !!(
      this.data.subCategory.label &&
      this.data.subCategory.label.trim() !== '' &&
      this.data.subCategory.categoryId
    );
  }
}
