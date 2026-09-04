import { recurringOccursInMonth } from './recurring-frequency.utils';

describe('recurringOccursInMonth', () => {
  it('utilise les mois choisis pour une recurrence semestrielle', () => {
    expect(recurringOccursInMonth('biannual', 4, [5, 9])).toBeTrue();
    expect(recurringOccursInMonth('biannual', 8, [5, 9])).toBeTrue();
    expect(recurringOccursInMonth('biannual', 6, [5, 9])).toBeFalse();
  });

  it('utilise aussi les mois choisis pour les frequences trimestrielle et annuelle', () => {
    expect(recurringOccursInMonth('quarterly', 1, [2, 6, 10])).toBeTrue();
    expect(recurringOccursInMonth('quarterly', 0, [2, 6, 10])).toBeFalse();
    expect(recurringOccursInMonth('yearly', 8, [9])).toBeTrue();
    expect(recurringOccursInMonth('yearly', 0, [9])).toBeFalse();
  });

  it('laisse un type saisonnier limiter les frequences mensuelle et hebdomadaire', () => {
    expect(recurringOccursInMonth('monthly', 8, [9])).toBeTrue();
    expect(recurringOccursInMonth('monthly', 7, [9])).toBeFalse();
    expect(recurringOccursInMonth('weekly', 8, [9])).toBeTrue();
    expect(recurringOccursInMonth('weekly', 7, [9])).toBeFalse();
  });

  it('conserve les cadences historiques en absence de mois choisis', () => {
    expect(recurringOccursInMonth('monthly', 8)).toBeTrue();
    expect(recurringOccursInMonth('weekly', 8)).toBeTrue();
    expect(recurringOccursInMonth('bimonthly', 2)).toBeTrue();
    expect(recurringOccursInMonth('bimonthly', 3)).toBeFalse();
    expect(recurringOccursInMonth('quarterly', 3)).toBeTrue();
    expect(recurringOccursInMonth('biannual', 6)).toBeTrue();
    expect(recurringOccursInMonth('yearly', 0)).toBeTrue();
  });
});
