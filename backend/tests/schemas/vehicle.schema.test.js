const {
  vehicleSchema,
  vehicleOperationSchema,
} = require('../../schemas/vehicle.schema');

describe('Vehicle Schema', () => {
  it('accepte un vehicule thermique avec ses donnees de consommation', () => {
    const { error } = vehicleSchema.validate({
      name: 'Polo',
      brand: 'Volkswagen',
      energy_type: 'gasoline',
      annual_distance: 12000,
      consumption_per_100: 6.2,
      energy_price: 1.85,
    });
    expect(error).toBeUndefined();
  });

  it('refuse un type energie inconnu', () => {
    const { error } = vehicleSchema.validate({
      name: 'Polo',
      energy_type: 'steam',
    });
    expect(error).toBeDefined();
  });

  it('valide une operation independante des comptes bancaires', () => {
    const { error } = vehicleOperationSchema.validate({
      date: '2021-06-15',
      label: 'Entretien avant suivi bancaire',
      amount: 450,
      sub_category_id: 3,
      vehicle_id: 1,
    });
    expect(error).toBeUndefined();
  });
});
