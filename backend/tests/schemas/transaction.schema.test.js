const { transactionSchema } = require('../../schemas/transaction.schema');

describe('Transaction Schema', () => {
  const validTransaction = {
    description: 'Echeance validee',
    amount: 42.5,
    account_id: 1,
    date: '2026-09-01',
    sub_category_id: 2,
    financial_flow_id: 2,
    recurring_transaction_id: 7,
  };

  it('accepte une date d occurrence recurrente distincte', () => {
    const result = transactionSchema.validate({
      ...validTransaction,
      recurring_occurrence_date: '2026-09-15',
    });

    expect(result.error).toBeUndefined();
  });

  it('accepte le rattachement facultatif a un vehicule', () => {
    const { error } = transactionSchema.validate({
      description: 'Plein carburant',
      amount: 75,
      account_id: 1,
      date: '2026-09-01',
      sub_category_id: 2,
      financial_flow_id: 2,
      vehicle_id: 3,
    });
    expect(error).toBeUndefined();
  });

  it('rejette une date d occurrence recurrente invalide', () => {
    const result = transactionSchema.validate({
      ...validTransaction,
      recurring_occurrence_date: 'date-invalide',
    });

    expect(result.error).toBeDefined();
  });
});
