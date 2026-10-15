# Compatibilit? Nginx avec le NAS

La recette NAS RC6 a r?v?l? un refus de bind sur le port interne 80 : utilisateur nginx non privil?gi?, capacit?s retir?es, ExitCode=1 et OOMKilled=false. RC6 ne peut pas ?tre approuv?e pour la MEP.

Le frontend ?coute d?sormais sur 8080. Les publications h?te et contr?les de sant? Compose sont align?s ; les ports h?te restent 4200 et 4201. Aucun privil?ge suppl?mentaire n'est n?cessaire.

Le test isol? impose net.ipv4.ip_unprivileged_port_start=1024, cap-drop ALL et no-new-privileges. Validation locale : HTTP 200, API anonyme 401, d?marrage UID 101, migrations et rollback conservant une ?criture r?ussis. Les 18 tests de pr?paration candidate passent. Une nouvelle candidate RC7 doit ?tre construite et qualifi?e puis import?e sur le NAS ; la recette r?elle reste ? effectuer.

RC7 construite depuis le commit 9524c2ee2b4a0fbe9a67d4a3a97a4f9585b0bcbc et qualifi?e localement : tests/builds/audits production r?ussis, scans Trivy des deux images sans vuln?rabilit? ni secret d?tect?, exercice m?moire 192/64 Mio r?ussi avec seuil des ports privil?gi?s ? 1024. Package : `.cache/releases/2.2.0-rc.7`. Le transfert puis la recette NAS restent ? effectuer.
