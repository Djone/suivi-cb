import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { VehicleService } from './vehicle.service';
import { environment } from '../../environments/environment';
import { Vehicle } from '../models/vehicle.model';

describe('VehicleService', () => {
  let service: VehicleService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [VehicleService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(VehicleService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('envoie la consommation avec le nom attendu par API', () => {
    service
      .save({
        name: 'Polo',
        brand: 'Volkswagen',
        energyType: 'gasoline',
        consumptionPer100: 6.2,
      })
      .subscribe();

    const request = httpTesting.expectOne(
      `${environment.apiUrl}/api/vehicles`,
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body.consumption_per_100).toBe(6.2);
    expect(request.request.body.consumption_per100).toBeUndefined();
    request.flush({ id: 1 });

    const reload = httpTesting.expectOne(
      `${environment.apiUrl}/api/vehicles`,
    );
    reload.flush([]);
  });

  it('ne renvoie pas les metadonnees SQL lors de la modification', () => {
    service
      .save({
        id: 1,
        name: 'Polo',
        brand: 'Volkswagen',
        energyType: 'gasoline',
        purchasePrice: 11000,
        createdAt: '2026-08-30 10:00:00',
        updatedAt: '2026-09-01 12:00:00',
      } as Vehicle & { createdAt: string; updatedAt: string })
      .subscribe();

    const request = httpTesting.expectOne(
      `${environment.apiUrl}/api/vehicles/1`,
    );
    expect(request.request.method).toBe('PUT');
    expect(request.request.body.purchase_price).toBe(11000);
    expect(request.request.body.created_at).toBeUndefined();
    expect(request.request.body.updated_at).toBeUndefined();
    request.flush({ id: 1 });

    const reload = httpTesting.expectOne(
      `${environment.apiUrl}/api/vehicles`,
    );
    reload.flush([]);
  });

  it('ajoute une operation vehicule sans transaction bancaire', () => {
    service
      .addOperation({
        date: '2021-06-15',
        label: 'Ancien entretien',
        amount: 450,
        subCategoryId: 3,
        vehicleId: 1,
      })
      .subscribe();

    const request = httpTesting.expectOne(
      `${environment.apiUrl}/api/vehicles/operations`,
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(
      jasmine.objectContaining({
        sub_category_id: 3,
        vehicle_id: 1,
      }),
    );
    request.flush({ id: 10 });
  });
});
