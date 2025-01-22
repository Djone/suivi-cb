import { FINANCIAL_FLOW_LIST } from '../config/financial-flow.config';
import { ACCOUNT_LIST } from '../config/account.config';

/**
 * Fonction utilitaire pour convertir un paramètre string en number ou null si le paramètre est indéfini.
 * @param param - Le paramètre à convertir.
 * @returns Le paramètre converti en number ou null si indéfini.
 */
export function getParamId(param: string | undefined): number | null {
    return param ? +param : null;
  }

/**
 * Fonction utilitaire pour récupérer le libellé du flux financier stocké dans le fichier de config flux-financier.config.ts
 * @param id - ID du flux financier.
 * @returns le libellé du flux financier.
 */
  export function getFinancialFlowNameById(id: number): string {
    const financialFlow = FINANCIAL_FLOW_LIST.find(ff => ff.id === id);
    return financialFlow ? financialFlow.name : 'Catégorie inconnue';
  }

/**
 * Fonction utilitaire pour récupérer le libellé du compte stocké dans le fichier de config account.config.ts
 * @param id - ID du compte.
 * @returns le libellé du compte.
 */
  export function getAccountNameById(id: number): string {
    const account = ACCOUNT_LIST.find(acc => acc.id === id);
    return account ? account.name : 'Compte inconnu';
  }