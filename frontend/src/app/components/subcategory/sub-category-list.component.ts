// frontend/src/app/components/category/sub-category-list.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { SubCategoryService } from '../../services/sub-category.service';
import { CategoryService } from '../../services/category.service';
import { SubCategory } from '../../models/sub-category.model';
import { Category } from '../../models/category.model';
import { EditSubCategoryDialogComponent } from '../edit-sub-category-dialog/edit-sub-category-dialog.component';

@Component({
  selector: 'app-subcategory-list',
  standalone: true,
  imports: [ CommonModule ],
  templateUrl: './sub-category-list.component.html',
  styleUrls: ['./sub-category-list.component.css']
})
export class SubCategoryListComponent implements OnInit {
  subCategories: SubCategory[] = [];
  categories: Category[] = [];

  constructor(
    private subCategoryService: SubCategoryService,
    private categoryService: CategoryService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadSubCategories();
  }

  loadSubCategories(): void {
    this.subCategoryService.getSubCategories().subscribe({
      next: (data) => this.subCategories = data,
      error: (err) => console.error('Erreur lors du chargement des sous-catégories:', err)
    });

    this.categoryService.getCategories().subscribe({
      next: (data) => this.categories = data,
      error: (err) => console.error('Erreur lors du chargement des catégories:', err)
    });
  }

  editSubCategory(subCategory: SubCategory): void {
    const dialogRef = this.dialog.open(EditSubCategoryDialogComponent, {
      width: '400px',
      data: { subCategory, categories: this.categories }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.subCategoryService.updateSubCategory(result.id!, result).subscribe({
          next: () => {
            const index = this.subCategories.findIndex(c => c.id === result.id);
            if (index !== -1) {
              this.subCategories[index] = result;
            }
          },
          error: (err) => console.error('Erreur lors de la mise à jour de la sous-catégorie:', err)
        });
      }
    });
  }

  deleteSubCategory(id: number): void {
    if (confirm('Voulez-vous vraiment supprimer cette sous-catégorie ?')) {
      this.subCategoryService.deleteSubCategory(id).subscribe({
        next: () => {
          alert('Sous-catégorie supprimée avec succès.');
          this.loadSubCategories();
        },
        error: (err) => {
          console.error('Erreur lors de la suppression de la sous-catégorie:', err);
          alert('Une erreur est survenue lors de la suppression.');
        }
      });
    }
  }
}