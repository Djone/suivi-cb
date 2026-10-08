# Assistant de release

## Parcours obligatoire

Le processus cible est :

**Dev → tests validés en dev → candidate en préproduction → tests validés en
préproduction → publication Git → MEP**

L'assistant automatise les contrôles et opérations Git disponibles localement.
La construction, l’export et le transfert vérifié sont automatisés par la commande
du panneau « Package de préproduction », exécutée dans le terminal du PC.
L’installation, les tests NAS et la promotion restent distincts. Ne pas confondre
le tag Git avec les images déployées.

## 1. Valider le développement

- Terminer les changements sur la branche de développement et vérifier
  manuellement les fonctionnalités concernées.
- Pousser la branche et s'assurer que le dépôt est propre et synchronisé avec
  `origin`.
- Vérifier que les tickets livrés sont `done` et ciblent la version stable.
- Ne jamais commiter de secret, de fichier `.env` ou de données de production.
- Dans `/release-process`, lancer `dry-run` et vérifier le rapport : cette
  commande vérifie Git et exécute les tests automatisés.

Ne pas continuer si les tests fonctionnels ou automatisés échouent. Corriger
sur la branche de développement puis relancer les contrôles.

## 2. Préparer le commit candidat

Renseigner dans l'assistant la version stable, la prochaine version de
développement et la branche cible `master`. Garder activés le commit de
préparation et la restauration automatique en cas d'échec. Les options avancées
restent désactivées dans le parcours normal.

Lancer `prepare`, puis vérifier son rapport et l'état Git. Cette commande
relance les contrôles, archive les notes de version, actualise les numéros et
crée le commit de préparation. Elle ne pousse pas ce commit.

Pousser la branche de développement avec le commit candidat. Ne plus modifier
les sources, Dockerfiles, configuration Nginx ou autres contenus des images
après cette étape ; une modification oblige à recommencer avec une nouvelle
candidate.

## 3. Construire et installer en préproduction

Suivre [AUTOMATISATION_CANDIDATE.md](../../../../../docs/AUTOMATISATION_CANDIDATE.md).
La commande release:candidate construit les images du commit propre, les exporte,
inspecte l’archive et transfère le package avec vérification des empreintes.
Elle refuse d’écraser une candidate existante ; sans --execute, elle simule.
Après transfert, charger les images dans l'environnement de préproduction.
Suivre la checklist de candidate adaptée à la version et à
l'architecture du NAS, par exemple
[CHECKLIST_RC2_PREPRODUCTION.md](../../../../../docs/CHECKLIST_RC2_PREPRODUCTION.md).

La préproduction utilise ses propres conteneurs, variables Keycloak et données.
Ne pas monter ni copier les données de production. L'assistant de release ne
pilote pas encore cette étape.

## 4. Valider la préproduction

Exécuter les contrôles fonctionnels et techniques prévus pour la candidate.
Avant d'approuver, consigner :

- la version, le commit candidat et la date des essais ;
- les identifiants exacts (IDs) des images backend et frontend en cours
  d'exécution ;
- les résultats des tests et la décision d'approbation.

Un tag d'image n'est pas une preuve suffisante : il peut être déplacé. En cas
d'échec, ne pas publier dans Git. Corriger dans une nouvelle candidate et
recommencer la validation préproduction.

## 5. Publier la release dans Git

Uniquement après le feu vert préproduction, revenir dans l'assistant et lancer
`deploy`. Confirmer l'exécution réelle seulement après avoir vérifié que le
commit et les deux IDs d'image approuvés sont consignés.

`deploy` relance les contrôles, fusionne la branche courante dans `master`,
pousse `master`, crée et pousse le tag stable et, si l'option est activée, crée
la branche de développement suivante. Il ne construit ni ne déploie d'image.

La commande `full` n'est pas adaptée à ce parcours : elle enchaîne préparation
et publication Git sans attendre la validation préproduction.

## 6. Effectuer la MEP

Suivre [PROMOTION_PREPROD_PRODUCTION.md](../../../../../docs/PROMOTION_PREPROD_PRODUCTION.md).
Avant l'intervention :

- sauvegarder les données et vérifier le plan de retour arrière ;
- comparer les IDs backend/frontend de production à ceux consignés en
  préproduction ;
- conserver les variables, volumes et données de production ;
- promouvoir les images préproduction **sans les reconstruire**.

Ne pas utiliser `scripts/update.sh` pour une MEP : ce script récupère le code
Git et reconstruit les images. Ne pas reconstruire non plus sur le NAS de
production.

## Ce que font les actions de l'assistant

| Action | Modifie des fichiers | Modifie Git distant | Déploie sur le NAS |
| --- | --- | --- | --- |
| `dry-run` | Non | Non | Non |
| `prepare` | Oui, versions et notes | Non | Non |
| `deploy` | Fusion Git uniquement | Oui, `master` et tag | Non |
| `rollback` | Restaure le dernier backup local de préparation | Non | Non |

La case d'approbation et la confirmation de `deploy` sont des contrôles
opérateur dans l'interface. Elles ne sont pas une preuve technique : l'assistant
ne vérifie pas encore les conteneurs ou tests sur le NAS. La commande distincte
release:candidate:approve enregistre une attestation liée aux IDs du package et
à l’empreinte du compte rendu ; elle refuse des IDs différents et ne lance pas la MEP.
