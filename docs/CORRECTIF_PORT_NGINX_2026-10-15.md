# Compatibilit? Nginx avec le NAS

La recette NAS RC6 a r?v?l? un refus de bind sur le port interne 80 : utilisateur nginx non privil?gi?, capacit?s retir?es, ExitCode=1 et OOMKilled=false. RC6 ne peut pas ?tre approuv?e pour la MEP.

Le frontend ?coute d?sormais sur 8080. Les publications h?te et contr?les de sant? Compose sont align?s ; les ports h?te restent 4200 et 4201. Aucun privil?ge suppl?mentaire n'est n?cessaire.

Le test isol? impose net.ipv4.ip_unprivileged_port_start=1024, cap-drop ALL et no-new-privileges. Validation locale : HTTP 200, API anonyme 401, d?marrage UID 101, migrations et rollback conservant une ?criture r?ussis. Les 18 tests de pr?paration candidate passent. Une nouvelle candidate RC7 doit ?tre construite et qualifi?e puis import?e sur le NAS ; la recette r?elle reste ? effectuer.
