# Organisation des travaux avant livraison 2.2.0

La décision la plus récente avance en 2.2.0 les tests automatisés métier/navigateur, la chaîne GitHub Actions et la clôture de release. Elle remplace leur ancien report en 2.3.0. La rétention locale et l’alerte USB restent en 2.3.0, vers mi-novembre, avec report explicite. Aucun déploiement n’est lancé par cette réorganisation.

## Acquis conservés

Les tests de sécurisation sont clôturés dans leur périmètre documenté : tests locaux, recette manuelle RC7/RC8, migrations et rollback isolé, chaîne de sauvegarde et intégrité USB, protections GitHub et ACL NAS. Le workflow de publication durci est fusionné sur master. Ces résultats ne démontrent pas que la nouvelle chaîne automatisée existe déjà et ne sont pas automatiquement transférables à une candidate ultérieure.

## Quatre lots sans doublons

| Ordre | Lot | Livrable et critère de fin |
| --- | --- | --- |
| 1 | Tests automatisés métier et sécurité | Pile Docker reproductible, données synthétiques, scénarios API et Playwright, commandes locales et rapports ; tests d’erreur et nettoyage vérifiés. |
| 2 | Pipeline GitHub Actions et distribution | Exécuter les tests du lot 1 et les contrôles existants, construire une seule fois, scanner, publier dans GHCR et déployer les mêmes images en préproduction. Valider le cycle et les vrais checks requis. |
| 3 | Preuves et clôture dans /release-process | Importer les résultats des lots 1/2, les lier à la candidate, gérer les réserves et bloquer les prérequis absents. Produire un rapport de préparation à la livraison. |
| 4 | Approbation et livraison effective | Approbation humaine du candidat exact, publication selon le processus validé, sauvegarde, promotion des images testées, contrôles après MEP et rapport final. |

Les lots 1 à 3 sont les travaux de préparation avant le feu vert de production. Le lot 4 contient l’exécution de la livraison : il ne peut donc pas être intégralement coché avant la MEP. Le rapport final de clôture suit les contrôles de production ; le rapport de préparation permet de demander l’approbation auparavant.

## Points à traiter explicitement

- Lint : configurer et faire passer un contrôle réel, sans annoncer un check inexistant.
- Exécuteur NAS : accès minimaux, séparation des environnements et exclusion des PR non fiables de l’exécuteur et des secrets.
- Identité : relier commit, version affichée, package et digests ; une correction produit une nouvelle candidate et invalide les preuves concernées.
- Scans : traiter les alertes ou accepter une exception motivée, datée et revue ; braces reste un risque suivi, pas une correction technique.
- Preuves : distinguer résultat automatique, recette humaine et déclaration ; ne jamais transformer une case UI en preuve d’exécution.
- Production : sauvegarde cohérente, mêmes images qualifiées, pas de reconstruction ni restauration automatique de base au rollback ; approbation explicite avant publication et MEP.
- Impôts frontend : entrée 2.2.0 encore ouverte, hors de ces quatre lots. Décider si elle entre dans le périmètre figé de la release ou si elle est reportée avant de déclarer la version prête.

Le détail opérationnel et les statuts sont centralisés dans frontend/src/app/components/dev-todo/dev-todo.data.ts. /release-process conserve son fonctionnement actuel jusqu’à l’implémentation du lot 3.
