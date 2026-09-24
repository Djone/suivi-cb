# Archive Keycloak

Ces fichiers ne sont plus utilisés par les Composes actifs.

- `compose-h2-dev.yml` est l'ancienne pile locale fondée sur la base intégrée
  Keycloak. Son volume Docker historique n'est pas supprimé.
- `keycloak-theme-jar-unused` est l'ancienne variante du thème empaquetée en
  JAR sous le nom `suivi-bancaire`. Elle diffère du thème réellement monté par
  les conteneurs (`themes/suivi-cb`) et reste conservée uniquement pour
  comparaison ou récupération.

Les fichiers actifs se trouvent à la racine de `keycloak-server/`.
