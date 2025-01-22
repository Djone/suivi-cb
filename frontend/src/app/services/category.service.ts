import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs'; // Une meilleure approche consiste à gérer l'état des catégories avec un service partagé, de sorte que chaque composant puisse mettre à jour et lire les catégories sans avoir à se référer directement à d'autres composants
import { tap, catchError } from 'rxjs/operators';
import { Category } from '../models/category.model';
import humps from 'humps'; // Importer humps

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

  // Récupérer la liste des catégories et mettre à jour le BehaviorSubject
  getCategories(): Observable<Category[]> {

    return this.http.get<Category[]>(this.apiUrl).pipe(
      tap((categories) => {
        
        // Convertir les données en camelCase pour correspondre au modèle Angular
        const camelCaseCategories = categories.map((category) =>
          humps.camelizeKeys(category)
        ) as Category[];

        console.log('CATEGORY SERVICE : Catégories récupérées :', camelCaseCategories);
        
        this.categoriesSubject.next(camelCaseCategories); // Met à jour les catégories
      }),
      catchError((err) => {
        console.error('CATEGORY SERVICE : Erreur lors du chargement des catégories :', err);
        throw err; // Relance l'erreur pour permettre la gestion ailleurs
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
    //const { id: _, ...fieldsToUpdate } = data; // Exclure l'ID du corps
    const url = `${this.apiUrl}/${id}`;
    const snakeCaseCategory = humps.decamelizeKeys(data); // Convertit en snake_case

    console.log(`CATEGORY SERVICE : Requête PUT envoyée à : ${url} avec les données :`, snakeCaseCategory);
    return this.http.put<void>(url, snakeCaseCategory);
  }

  deleteCategory(id: number) {
    const url = `${this.apiUrl}/${id}`;
    console.log(`CATEGORY SERVICE : Requête DELETE envoyée à : ${url} avec les données :`, id);
    return this.http.delete<void>(url);
  }
}
