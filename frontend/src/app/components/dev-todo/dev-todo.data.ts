import { DevTodoItem } from './dev-todo.model';

export const DEV_TODO_ITEMS: DevTodoItem[] = [
  {
    title: 'Impots : frontend',
    description: ['[ ] Integrer la logique frontend'],
    status: 'todo',
    targetVersion: '2.2.0',
    priority: 'low',
  },
  {
    title: 'Connexion sécurisée Keycloak',
    description: [
      '[x] Intégrer une authentification via Keycloak et protéger les pages et les API',
      '[x] Ajouter un thème de connexion en deux étapes : identifiant et mot de passe',
      '[x] Afficher le profil Keycloak et la déconnexion en bas du menu sur ordinateur et mobile',
      '[x] Ajouter une modale ouvrant le changement de mot de passe sécurisé Keycloak',
      "[x] Ajouter la configuration de l'OTP",
      '[ ] Configurer Keycloak en production et valider le parcours complet',
    ],
    status: 'in-progress',
    targetVersion: '2.2.0',
    priority: 'high',
  },
  {
    title: 'Sécurité',
    description: [
      '[x] Intégrer une authentification via Keycloak et protéger les pages et les API',
      '[x] Ajouter un thème de connexion en deux étapes : identifiant et mot de passe',
      '[x] Afficher le profil Keycloak et la déconnexion en bas du menu sur ordinateur et mobile',
      '[x] Ajouter une modale ouvrant le changement de mot de passe sécurisé Keycloak',
      "[x] Ajouter la configuration de l'OTP",
      '[ ] Configurer Keycloak en production et valider le parcours complet',
    ],
    status: 'in-progress',
    targetVersion: '2.2.0',
    priority: 'high',
  },
];
