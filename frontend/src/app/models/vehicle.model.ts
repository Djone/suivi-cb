export type VehicleEnergyType =
  | 'gasoline'
  | 'diesel'
  | 'hybrid'
  | 'electric'
  | 'other';

export interface Vehicle {
  id?: number;
  name: string;
  brand?: string | null;
  model?: string | null;
  energyType: VehicleEnergyType;
  registration?: string | null;
  acquisitionDate?: string | null;
  purchasePrice?: number | null;
  annualDistance?: number | null;
  consumptionPer100?: number | null;
  energyPrice?: number | null;
  isActive?: number | boolean;
}

export interface VehicleOperation {
  id?: number;
  date: string;
  label: string;
  amount: number;
  subCategoryId: number | null;
  subCategoryLabel?: string;
  categoryLabel?: string;
  vehicleId: number | null;
}
