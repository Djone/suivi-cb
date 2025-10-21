import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs'; // Une meilleure approche consiste à gérer l'état des catégories avec un service partagé, de sorte que chaque composant puisse mettre à jour et lire les catégories sans avoir à se référer directement à d'autres composants
import { tap, catchError } from 'rxjs/operators';
import { Category } from '../models/category.model';
import * as humps from 'humps'; // Importer humps

//Ajoutez un BehaviorSubject dans votre service pour suivre l'état des catégories.

@Injectable({
  providedIn: 'root'
})
export class CategoryService {
  private apiUrl = 'http://localhost:3000/api/categories';
  // Gestion du BehaviorSubject
  private categoriesSubject = new BehaviorSubject<Category[]>([]);
  categories$ = this.categoriesSubject.asObservable();

  constructor(private http: HttpClient) {}

  // Récupérer la liste de TOUTES les catégories (actives et inactives) et mettre à jour le BehaviorSubject
  getCategories(): Observable<Category[]> {

    return this.http.get<Category[]>(this.apiUrl).pipe(
      tap((categories) => {

        // Convertir les données en camelCase pour correspondre au modèle Angular
        const camelCaseCategories = categories.map((category) =>
          humps.camelizeKeys(category)
        ) as Category[];

        console.log('CATEGORY SERVICE : Catégories récupérées (toutes) :', camelCaseCategories);

        this.categoriesSubject.next(camelCaseCategories); // Met à jour les catégories
      }),
      catchError((err) => {
        console.error('CATEGORY SERVICE : Erreur lors du chargement des catégories :', err);
        throw err; // Relance l'erreur pour permettre la gestion ailleurs
      })
    );
  }

  // Récupérer uniquement les catégories ACTIVES (pour les formulaires)
  getActiveCategories(): Observable<Category[]> {
    const url = `${this.apiUrl}/active`;

    return this.http.get<Category[]>(url).pipe(
      tap((categories) => {
        const camelCaseCategories = categories.map((category) =>
          humps.camelizeKeys(category)
        ) as Category[];

        console.log('CATEGORY SERVICE : Catégories actives récupérées :', camelCaseCategories);
      }),
      catchError((err) => {
        console.error('CATEGORY SERVICE : Erreur lors du chargement des catégories actives :', err);
        throw err;
      })
    );
  }

  // Ajouter une catégorie
  addCategory(category: Category): Observable<void> {
    
    const snakeCaseCategory = humps.decamelizeKeys(category); // Convertit les clés en snake_case

    console.log(`CATEGORY SERVICE : Requête POST (ajouter une catégorie) envoyée à : ${this.apiUrl} avec les données : `, snakeCaseCategory);
    
    return this.http.post<void>(this.apiUrl, snakeCaseCategory).pipe(
      tap(() => {
        console.log('CATEGORY SERVICE : Catégorie ajoutée avec succès');
        this.getCategories().subscribe(); // Met à jour les données après ajout
      }),
      catchError((err) => {
        console.error('CATEGORY SERVICE : Erreur lors de l\'ajout de la catégorie:', err);
        throw err;
      })
    );
  }

  updateCategory(id: number, data: Partial<Category>): Observable<void> {
    const url = `${this.apiUrl}/${id}`;

    // Exclure l'ID du corps de la requête (il est déjà dans l'URL)
    const { id: _, ...fieldsToUpdate } = data;
    const snakeCaseCategory = humps.decamelizeKeys(fieldsToUpdate); // Convertit en snake_case

    console.log(`CATEGORY SERVICE : Requête PUT envoyée à : ${url} avec les données :`, snakeCaseCategory);

    return this.http.put<void>(url, snakeCaseCategory).pipe(
      tap(() => {
        console.log('CATEGORY SERVICE : Catégorie mise à jour avec succès');
      }),
      catchError((err) => {
        console.error('CATEGORY SERVICE : Erreur lors de la mise à jour de la catégorie:', err);
        throw err;
      })
    );
  }

  deleteCategory(id: number): Observable<void> {
    const url = `${this.apiUrl}/${id}`;

    console.log(`CATEGORY SERVICE : Requête DELETE envoyée à : ${url}`);

    return this.http.delete<void>(url).pipe(
      tap(() => {
        console.log('CATEGORY SERVICE : Catégorie désactivée avec succès');
        this.getCategories().subscribe(); // Met à jour les données après désactivation
      }),
      catchError((err) => {
        console.error('CATEGORY SERVICE : Erreur lors de la désactivation de la catégorie:', err);
        throw err;
      })
    );
  }

  reactivateCategory(id: number): Observable<void> {
    const url = `${this.apiUrl}/${id}/reactivate`;

    console.log(`CATEGORY SERVICE : Requête PUT envoyée à : ${url} pour réactiver`);

    return this.http.put<void>(url, {}).pipe(
      tap(() => {
        console.log('CATEGORY SERVICE : Catégorie réactivée avec succès');
        this.getCategories().subscribe(); // Met à jour les données après réactivation
      }),
      catchError((err) => {
        console.error('CATEGORY SERVICE : Erreur lors de la réactivation de la catégorie:', err);
        throw err;
      })
    );
  }
}
