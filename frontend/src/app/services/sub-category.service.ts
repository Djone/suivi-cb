import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { SubCategory } from '../models/sub-category.model';
import * as humps from 'humps'; // Importer humps
import { environment } from '../../environments/environment';

//Ajoutez un BehaviorSubject dans votre service pour suivre l'état des sous-catégories.

@Injectable({
  providedIn: 'root',
})
export class SubCategoryService {
  private apiUrl = `${environment.apiUrl}/api/sub-categories`; // URL dynamique
  // Gestion du BehaviorSubject
  private subCategoriesSubject = new BehaviorSubject<SubCategory[]>([]);
  subCategories$ = this.subCategoriesSubject.asObservable();

  constructor(private http: HttpClient) {}

  // Récupérer la liste des catégories et mettre à jour le BehaviorSubject
  getSubCategories(): Observable<SubCategory[]> {
    return this.http.get<SubCategory[]>(this.apiUrl).pipe(
      tap((subCategories) => {
        // Convertir les données en camelCase pour correspondre au modèle Angular
        const camelCaseSubCategories = subCategories.map((SubCategory) =>
          humps.camelizeKeys(SubCategory),
        ) as SubCategory[];

        this.subCategoriesSubject.next(camelCaseSubCategories); // Met à jour les catégories
      }),
      catchError((err) => {
        console.error(
          'SUB CATEGORY SERVICE : Erreur lors du chargement des sous-catégories :',
          err,
        );

        throw err; // Relance l'erreur pour permettre la gestion ailleurs
      }),
    );
  }

  // Récupérer la liste des catégories par type de transaction et mettre à jour le BehaviorSubject
  getAllSubCategoriesByFinancialFlowId(
    financial_flow_id: number,
  ): Observable<SubCategory[]> {
    return this.http
      .get<SubCategory[]>(`${this.apiUrl}/${financial_flow_id}`)
      .pipe(
        tap((subCategories) => {
          // Convertir les données en camelCase pour correspondre au modèle Angular
          const camelCaseSubCategories = subCategories.map((SubCategory) =>
            humps.camelizeKeys(SubCategory),
          ) as SubCategory[];

          this.subCategoriesSubject.next(camelCaseSubCategories); // Met à jour les catégories
        }),
        catchError((err) => {
          console.error(
            'SUB CATEGORY SERVICE : Erreur lors du chargement des sous-catégories :',
            err,
          );

          throw err; // Relance l'erreur pour permettre la gestion ailleurs
        }),
      );
  }

  // Ajouter une sous-catégorie
  addSubCategory(subCategory: SubCategory): Observable<void> {
    const camelCaseSubCategory = humps.decamelizeKeys(subCategory); // Convertit les clés en snake_case

    return this.http.post<void>(this.apiUrl, camelCaseSubCategory).pipe(
      tap(() => {
        this.getSubCategories().subscribe(); // Met à jour les données après ajout
      }),
      catchError((err) => {
        console.error(
          "SUB CATEGORY SERVICE : Erreur lors de l'ajout de la sous-catégorie:",
          err,
        );

        throw err;
      }),
    );
  }

  updateSubCategory(id: number, data: Partial<SubCategory>): Observable<void> {
    const url = `${this.apiUrl}/${id}`;

    // Exclure l'ID du corps de la requête (il est déjà dans l'URL)
    const { id: _, ...fieldsToUpdate } = data;
    const snakeCaseSubCategory = humps.decamelizeKeys(fieldsToUpdate); // Convertit en snake_case

    return this.http.put<void>(url, snakeCaseSubCategory).pipe(
      tap(() => {
        this.getSubCategories().subscribe(); // Met à jour les données après l'édition
      }),
      catchError((err) => {
        console.error(
          'SUB CATEGORY SERVICE : Erreur lors de la mise à jour de la sous-catégorie:',
          err,
        );
        throw err;
      }),
    );
  }

  // Supprimer une sous-catégorie
  deleteSubCategory(id: number): Observable<void> {
    const url = `${this.apiUrl}/${id}`;

    console.log(`SUB CATEGORY SERVICE : Requête DELETE envoyée à : ${url}`);

    return this.http.delete<void>(url).pipe(
      tap(() => {
        this.getSubCategories().subscribe(); // Met à jour les données après suppression
      }),
      catchError((err) => {
        console.error(
          'SUB CATEGORY SERVICE : Erreur lors de la suppression de la sous-catégorie:',
          err,
        );
        throw err;
      }),
    );
  }
}
