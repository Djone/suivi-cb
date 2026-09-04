import { RecurringTransaction } from '../models/recurring-transaction.model';

/**
 * Indique si une recurrence doit produire une echeance pendant le mois donne.
 *
 * Les mois explicitement selectionnes sont prioritaires sur la cadence par
 * defaut. Cela permet notamment a une recurrence semestrielle d'utiliser les
 * deux mois choisis par l'utilisateur au lieu d'etre forcee sur janvier/juillet.
 */
export function recurringOccursInMonth(
  frequency: RecurringTransaction['frequency'] | null | undefined,
  monthIndex: number,
  activeMonths?: number[] | null,
): boolean {
  const normalizedMonth = ((monthIndex % 12) + 12) % 12;
  const selectedMonths = new Set(
    (Array.isArray(activeMonths) ? activeMonths : [])
      .map((month) => Number(month))
      .filter(
        (month) => Number.isInteger(month) && month >= 1 && month <= 12,
      ),
  );

  if (selectedMonths.size > 0) {
    return selectedMonths.has(normalizedMonth + 1);
  }

  switch (frequency) {
    case 'monthly':
    case 'weekly':
      return true;
    case 'bimonthly':
      return normalizedMonth % 2 === 0;
    case 'quarterly':
      return normalizedMonth % 3 === 0;
    case 'biannual':
      return normalizedMonth % 6 === 0;
    case 'yearly':
      return normalizedMonth === 0;
    default:
      return false;
  }
}
