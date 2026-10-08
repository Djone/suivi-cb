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
      '[x] Configurer Keycloak en preproduction et valider le parcours complet',
    ],
    status: 'done',
    targetVersion: '2.2.0',
    priority: 'high',
  },
  {
    title: 'Sécurité',
    description: [
      '[x] Isoler le backend sur le réseau Docker en production',
      '[x] Restreindre CORS aux origines locales de développement',
      '[x] Ajouter les en-têtes HTTP de protection et les erreurs JSON contrôlées',
      '[x] Supprimer les journaux de contenu bancaire et exclure les secrets des images',
      '[x] Ajouter les tests ciblés de sécurité HTTP',
      '[x] Valider les 101 tests backend, les 73 tests frontend et le build de production',
      '[x] Auditer les dépendances de production : aucune vulnérabilité détectée',
      '[x] Documenter les 11 alertes résiduelles des outils de développement',
      '[x] Décider du traitement des alertes résiduelles et valider la CSP',
      '[x] Valider les parcours, le reverse proxy et les sauvegardes en préproduction',
    ],
    status: 'done',
    targetVersion: '2.2.0',
    priority: 'high',
  },
];
