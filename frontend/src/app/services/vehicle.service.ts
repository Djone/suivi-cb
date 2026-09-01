import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import * as humps from 'humps';
import { environment } from '../../environments/environment';
import { Vehicle, VehicleOperation } from '../models/vehicle.model';

@Injectable({ providedIn: 'root' })
export class VehicleService {
  private readonly apiUrl = `${environment.apiUrl}/api/vehicles`;
  private readonly vehiclesSubject = new BehaviorSubject<Vehicle[]>([]);
  readonly vehicles$ = this.vehiclesSubject.asObservable();

  constructor(private readonly http: HttpClient) {}

  loadVehicles(): Observable<Vehicle[]> {
    return this.http.get<Record<string, unknown>[]>(this.apiUrl).pipe(
      map((rows) => rows.map((row) => humps.camelizeKeys(row) as Vehicle)),
      tap((vehicles) => this.vehiclesSubject.next(vehicles)),
    );
  }

  save(vehicle: Vehicle): Observable<{ id: number }> {
    const { id, ...vehicleData } = vehicle;
    const payload = this.toApiPayload(vehicleData);
    const request = vehicle.id
      ? this.http.put<{ id: number }>(`${this.apiUrl}/${vehicle.id}`, payload)
      : this.http.post<{ id: number }>(this.apiUrl, payload);
    return request.pipe(tap(() => this.loadVehicles().subscribe()));
  }

  archive(vehicle: Vehicle): Observable<{ id: number }> {
    const { id: _, ...vehicleData } = vehicle;
    return this.http
      .put<{ id: number }>(
        `${this.apiUrl}/${vehicle.id}`,
        this.toApiPayload({ ...vehicleData, isActive: 0 }),
      )
      .pipe(tap(() => this.loadVehicles().subscribe()));
  }

  loadOperations(): Observable<VehicleOperation[]> {
    return this.http
      .get<Record<string, unknown>[]>(`${this.apiUrl}/operations`)
      .pipe(
        map((rows) =>
          rows.map((row) => humps.camelizeKeys(row) as VehicleOperation),
        ),
      );
  }

  addOperation(operation: VehicleOperation): Observable<{ id: number }> {
    return this.http.post<{ id: number }>(
      `${this.apiUrl}/operations`,
      humps.decamelizeKeys(operation),
    );
  }

  deleteOperation(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/operations/${id}`);
  }

  private toApiPayload(vehicle: Omit<Vehicle, 'id'>): Record<string, unknown> {
    // L'API renvoie aussi des métadonnées SQL (createdAt, updatedAt). On construit
    // explicitement le payload afin qu'elles ne repartent jamais lors d'une édition.
    const editableVehicle: Omit<Vehicle, 'id'> = {
      name: vehicle.name,
      brand: vehicle.brand,
      model: vehicle.model,
      energyType: vehicle.energyType,
      registration: vehicle.registration,
      acquisitionDate: vehicle.acquisitionDate,
      purchasePrice: vehicle.purchasePrice,
      annualDistance: vehicle.annualDistance,
      consumptionPer100: vehicle.consumptionPer100,
      energyPrice: vehicle.energyPrice,
      isActive: vehicle.isActive,
    };
    const payload = humps.decamelizeKeys(editableVehicle) as Record<string, unknown>;
    // `humps` conserve les chiffres dans le même segment et produit
    // consumption_per100, tandis que la colonne SQL est consumption_per_100.
    delete payload['consumption_per100'];
    payload['consumption_per_100'] = vehicle.consumptionPer100 ?? null;
    return payload;
  }
}
