# Checklist rc2 : préparation locale, installation NAS et validation

> Mode opératoire détaillé : [HTTPS, parcours, CSP et scans](./VERIFICATIONS_RC2_GUIDE.md).
> Restaurations : [lectures SQLite et connexion Keycloak isolées](./RESTAURATIONS_APPLICATIVES_ISOLEES.md).


Oui : **installer la rc2 en préproduction avant de refaire les contrôles
applicatifs du NAS**. Le relevé de l’architecture, la sauvegarde et les contrôles
PostgreSQL peuvent être faits avant. La rc1 reste refusée pour la production.

La construction sur le PC prépare une candidate destinée à la préproduction.
La production recevra ensuite les images réellement exécutées et validées sur
le NAS, sans reconstruction depuis le développement.

## Repères

| Élément | Emplacement / valeur |
| --- | --- |
| Poste local | PC Windows, PowerShell, Docker Desktop démarré en conteneurs Linux |
| Dossier local de travail | `C:\Users\jonat\OneDrive\suivi-cb` |
| Images rc2 | `suivi-cb-preprod-backend:2.2.0-rc2` et `suivi-cb-preprod-frontend:2.2.0-rc2` |
| Archive locale | `.cache/releases/2.2.0-rc2/suivi-cb-preprod-2.2.0-rc2.tar` |
| Dossier de réception NAS | `/volume1/docker/suivi-cb-preprod/releases/2.2.0-rc2/` |
| Compose local fourni | `docker-compose.preprod.rc2.yml` : images rc2, sans build, pull_policy never |
| Compose actif NAS | `/volume1/docker/suivi-cb-preprod/docker-compose.yml` |
| Configuration NAS conservée | `/volume1/docker/suivi-cb-preprod/.env.preprod` |
| Données NAS conservées | `/volume1/docker/suivi-cb-preprod/data/` |
| URL testée | `https://finances-preprod.jolurie.com` |

Le `.tar` est une **archive d’images Docker**, pas une archive de sources :
l’importer avec `docker load`. Ne pas le décompresser dans `data/` ni dans
le dossier de production. Les Dockerfiles, les sources et `nginx.conf` sont
incorporés aux images ; ils n’ont pas besoin d’être copiés séparément sur le NAS
pour ce parcours. Ne pas copier les fichiers .env locaux.

Exécuter les étapes dans l’ordre et **s’arrêter dès qu’une commande échoue**.
Conserver la même session PowerShell pour les variables locales ci-dessous.
Aucune commande de cette checklist ne déploie en production.

## 1. NAS — vérifier l’architecture et créer les dossiers de réception

- [ ] Depuis PowerShell sur le PC, ouvrir une session SSH :

```powershell
ssh GodOfNasAugerie@192.168.1.113 -p 1122
```

- [ ] Dans cette session SSH, **sur le NAS** :

```sh
uname -m
cd /volume1/docker/suivi-cb-preprod
pwd
mkdir -p releases/2.2.0-rc2 audit-tools backups
test -f .env.preprod
test -f docker-compose.yml
test -f data/database.db
sudo docker inspect --format '{{.Name}} {{.Image}}' suivi-cb-preprod-backend suivi-cb-preprod-frontend
```

Noter la sortie de `uname -m` : `x86_64` correspond à `linux/amd64` ;
`aarch64` à `linux/arm64`. Pour une autre valeur, adapter la plateforme
avant toute construction. Si la création des dossiers est refusée, faire régler
les droits du dossier de préproduction pour votre compte avant le transfert.
Conserver cette session SSH pour la suite, et ouvrir PowerShell séparément sur le PC.

## 2. LOCAL — tests et audits avant construction

- [ ] **PowerShell sur le PC**, depuis le dépôt :

```powershell
Set-Location 'C:\Users\jonat\OneDrive\suivi-cb'
npm --prefix backend test
if ($LASTEXITCODE -ne 0) { throw "Tests backend en échec" }
npm --prefix frontend run test:ci
if ($LASTEXITCODE -ne 0) { throw "Tests frontend en échec" }
npm --prefix frontend run build
if ($LASTEXITCODE -ne 0) { throw "Build frontend en échec" }
npm --prefix backend audit --omit=dev
if ($LASTEXITCODE -ne 0) { throw "Audit backend production en échec" }
npm --prefix frontend audit --omit=dev
if ($LASTEXITCODE -ne 0) { throw "Audit frontend production en échec" }
```

Les contrôles ont déjà réussi pendant l’audit ; les relancer si les sources ou
lockfiles ont changé. Ne pas poursuivre en cas d’échec. Les audits complets
avec dépendances de développement gardent des alertes documentées : leur
traitement ou acceptation reste nécessaire avant la décision finale.

## 3. LOCAL — construire les deux images rc2 et exporter le tar

Le script est du **PowerShell**, extension **.ps1**. Les blocs PowerShell de ce
 guide se collent dans PowerShell ; ils ne doivent pas être enregistrés dans
un fichier .bat ou .sh. Le lanceur .bat fourni appelle le .ps1 avec PowerShell.

- [ ] Docker Desktop doit être démarré en mode conteneurs Linux.
- [ ] **PowerShell sur le PC**, depuis la racine du dépôt :

```powershell
Set-Location 'C:\Users\jonat\OneDrive\suivi-cb'
.\scripts\build-images-docker.ps1 -TargetPlatform linux/amd64
```

Pour un NAS dont uname -m indique aarch64, utiliser -TargetPlatform linux/arm64.
Si vous êtes déjà dans le dossier scripts, la commande exacte est :

```powershell
.\build-images-docker.ps1 -TargetPlatform linux/amd64
```

Le préfixe .\ indique un fichier du dossier courant. Le script retrouve
la racine du dépôt automatiquement, construit les deux images rc2 et exporte
le tar dans .cache/releases/2.2.0-rc2/. Il s’arrête en cas d’erreur et refuse
d’écraser une archive existante. Le lanceur alternatif depuis scripts est
.\build-images-docker.bat -TargetPlatform linux/amd64.

- [ ] Revenir à la racine et définir les variables utilisées par les étapes suivantes :

```powershell
Set-Location 'C:\Users\jonat\OneDrive\suivi-cb'
$ReleaseDir = Join-Path (Get-Location).Path '.cache/releases/2.2.0-rc2'
$Rc2Archive = Join-Path $ReleaseDir 'suivi-cb-preprod-2.2.0-rc2.tar'
if (-not (Test-Path -LiteralPath $Rc2Archive)) { throw "Archive rc2 absente : terminer la construction avant de continuer" }
```

Aucun secret ou volume bancaire n’est monté pendant ces constructions.
Ne pas réutiliser suivi-cb-audit-backend:2026-10-08 à la place de la candidate.
Ne pas modifier les sources entre cet export et la validation. Une modification
ultérieure exige une nouvelle candidate (rc3, etc.), pas un remplacement silencieux de rc2.

## 4. LOCAL — inspecter l’archive et produire son empreinte

- [ ] **PowerShell sur le PC**, même session :

```powershell
node scripts/audit-image-archive.mjs $Rc2Archive (Join-Path $ReleaseDir 'package-inspection.json')
if ($LASTEXITCODE -ne 0) { throw "Inspection de l’archive rc2 en échec" }
Get-Content -LiteralPath (Join-Path $ReleaseDir 'package-inspection.json')
$ArchiveHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $Rc2Archive).Hash.ToLowerInvariant()
[System.IO.File]::WriteAllText((Join-Path $ReleaseDir 'SHA256SUMS'), "$ArchiveHash  suivi-cb-preprod-2.2.0-rc2.tar`n", [System.Text.Encoding]::ASCII)
Get-Content -LiteralPath (Join-Path $ReleaseDir 'SHA256SUMS')
```

- [ ] Les deux images ont `sensitivePaths: []` et `sourceDifferences: []`.
- [ ] L’image frontend indique `matchesWorkspace: true`,
  `silentSsoException: true`, `globalCspReportOnly: true`.
- [ ] Les tags sont bien rc2 et les versions backend correspondent aux lockfiles.

Le lecteur imprime un rapport : son code de sortie réussi ne suffit pas à
valider ces résultats. S’arrêter si un de ces contrôles n’est pas conforme.
Cette inspection ne remplace pas le scan des vulnérabilités des composants système.

## 5. LOCAL → NAS — transférer l’archive, la configuration, les preuves et le script

Les commandes utilisent `scp -O` pour le protocole SCP classique, compatible
avec un NAS qui refuse le sous-système SFTP. En cas de message
`subsystem request failed on channel 0`, conserver cette option : le port SSH
reste `1122`. Le `O` est une lettre O majuscule, pas le chiffre zéro.

- [ ] **PowerShell sur le PC**, même session. Les dossiers ont été créés à l’étape 1 :

```powershell
scp -O -P 1122 $Rc2Archive GodOfNasAugerie@192.168.1.113:/volume1/docker/suivi-cb-preprod/releases/2.2.0-rc2/
if ($LASTEXITCODE -ne 0) { throw "Transfert tar en échec" }
scp -O -P 1122 (Join-Path $ReleaseDir 'SHA256SUMS') (Join-Path $ReleaseDir 'package-inspection.json') GodOfNasAugerie@192.168.1.113:/volume1/docker/suivi-cb-preprod/releases/2.2.0-rc2/
if ($LASTEXITCODE -ne 0) { throw "Transfert des preuves en échec" }
scp -O -P 1122 docker-compose.preprod.rc2.yml GodOfNasAugerie@192.168.1.113:/volume1/docker/suivi-cb-preprod/releases/2.2.0-rc2/docker-compose.rc2.yml
if ($LASTEXITCODE -ne 0) { throw "Transfert Compose en échec" }
scp -O -P 1122 scripts/audit-sqlite-restore.cjs GodOfNasAugerie@192.168.1.113:/volume1/docker/suivi-cb-preprod/audit-tools/
if ($LASTEXITCODE -ne 0) { throw "Transfert du contrôle SQLite en échec" }
```

Alternative File Station : déposer les mêmes fichiers dans `docker/suivi-cb-preprod/releases/2.2.0-rc2/`,
et le script dans `docker/suivi-cb-preprod/audit-tools/` ; renommer le Compose
transféré `docker-compose.rc2.yml`. Ne pas importer le tar rc1.

## 6. NAS — vérifier le transfert et charger les images

- [ ] Dans la **session SSH sur le NAS** :

```sh
cd /volume1/docker/suivi-cb-preprod/releases/2.2.0-rc2
sha256sum -c SHA256SUMS
```

Attendu : `suivi-cb-preprod-2.2.0-rc2.tar: OK`. Si sha256sum n’est pas
disponible, calculer avec `openssl dgst -sha256 suivi-cb-preprod-2.2.0-rc2.tar`
et comparer à l’empreinte locale avant de poursuivre.

- [ ] Après vérification de l’empreinte :

```sh
sudo docker load -i suivi-cb-preprod-2.2.0-rc2.tar
sudo docker image inspect suivi-cb-preprod-backend:2.2.0-rc2 suivi-cb-preprod-frontend:2.2.0-rc2 --format '{{.Id}} {{.Os}}/{{.Architecture}} {{json .RepoTags}}'
```

Attendu : les deux tags rc2 sont chargés, l’architecture correspond au NAS.
Charger les images ne change pas encore les conteneurs en fonctionnement.

## 7. NAS — sauvegarder la préproduction, puis installer son Compose rc2

- [ ] Dans la **session SSH sur le NAS**, exécuter ce bloc complet.
  Il arrête brièvement le backend de préproduction pour une copie cohérente
  de son dossier data, puis le redémarre avant toute modification du Compose :

```sh
sudo sh <<'SH'
set -eu
umask 077
cd /volume1/docker/suivi-cb-preprod
[ "$(pwd -P)" = /volume1/docker/suivi-cb-preprod ]
[ -f .env.preprod ]
[ -f data/database.db ]
[ -f releases/2.2.0-rc2/docker-compose.rc2.yml ]
mkdir -p backups
SAVE_DIR=$(mktemp -d /volume1/docker/suivi-cb-preprod/backups/before-rc2-XXXXXX)
cp docker-compose.yml "$SAVE_DIR/docker-compose.yml"
docker inspect --format '{{.Name}} {{.Image}}' suivi-cb-preprod-backend suivi-cb-preprod-frontend > "$SAVE_DIR/images.txt"
trap 'docker start suivi-cb-preprod-backend >/dev/null' EXIT
docker stop suivi-cb-preprod-backend
cp -a data "$SAVE_DIR/data"
docker start suivi-cb-preprod-backend
trap - EXIT
cp releases/2.2.0-rc2/docker-compose.rc2.yml docker-compose.yml
printf 'Sauvegarde pré-rc2 : %s\n' "$SAVE_DIR"
docker compose -p suivi-cb-preprod -f docker-compose.yml config --quiet
SH
```

Noter le dossier de sauvegarde imprimé. Les volumes data/logs restent ceux de
la préproduction ; le fichier .env.preprod existant n’est pas remplacé.
Le Compose est installé à la racine de préproduction pour que `./data` et
`./logs` pointent vers les bons dossiers, pas vers le dossier releases.

- [ ] Puis démarrer les images importées, **sans build ni pull** :

```sh
cd /volume1/docker/suivi-cb-preprod
sudo docker compose -p suivi-cb-preprod -f docker-compose.yml up -d --no-build --pull never
sudo docker compose -p suivi-cb-preprod -f docker-compose.yml ps
sudo docker compose -p suivi-cb-preprod -f docker-compose.yml exec frontend nginx -t
sudo docker inspect --format '{{.Name}} {{.Config.Image}} {{.Image}}' suivi-cb-preprod-backend suivi-cb-preprod-frontend
sudo docker image inspect suivi-cb-preprod-backend:2.2.0-rc2 suivi-cb-preprod-frontend:2.2.0-rc2 --format '{{.Id}} {{json .RepoTags}}'
```

- [ ] Attendre que **les deux services soient healthy** ; relancer `ps` après
  les délais des healthchecks si nécessaire. En cas d’échec, consulter
  `sudo docker compose -p suivi-cb-preprod -f docker-compose.yml logs --tail=100`.
- [ ] Les conteneurs affichent rc2 et leurs identifiants correspondent aux images rc2.
- [ ] Aucune copie temporaire de nginx.conf avec docker cp : les corrections
  doivent provenir directement de l’image chargée.

Utiliser les commandes SSH de cette checklist pour la mise à jour. Si l’éditeur
de projet Container Manager conserve une ancienne configuration, l’aligner sur
le nouveau fichier racine avant toute action ultérieure dans DSM. Ne pas lancer Build.

## 8. NAS et navigateur — exécuter les contrôles d’audit

- [ ] **NAS, session SSH** : exécuter les sections 1, 2 et 3 de
  [AUDIT_SECURITE_NAS.md](./AUDIT_SECURITE_NAS.md), dans cet ordre.
  Chaque bloc indique son dossier ; PostgreSQL utilise le dossier Keycloak,
  pas celui de suivi-cb. Remplacer le nom de conteneur demandé avant ce bloc.
- [ ] **DSM, navigateur sur le PC** : régler HSTS et la redirection HTTP → HTTPS
  du domaine de préproduction, puis refaire les contrôles HTTPS.
- [ ] **Application de préproduction, navigateur sur le PC** : tester connexion,
  session, déconnexion, comptes, transactions, récurrences, salaires, OTP, SMTP
  et refus 403 d’un compte sans app-user, avec données/comptes de test.
- [ ] **Console navigateur** : vérifier les violations CSP Report-Only pendant
  ces parcours. Noter les violations et faire corriger la politique avant activation.
- [ ] **NAS, piles isolées** : compléter les restaurations par les lectures
  applicatives et la connexion d’un compte de test Keycloak, selon le guide d’audit.
- [ ] **Scanner d’images connecté** : analyser les deux images exactes ; consigner
  les résultats et la décision concernant les alertes npm de développement.

La rc2 initiale contient une CSP **Report-Only**. Elle sert à vérifier sa
compatibilité, elle ne clôture pas ce point. Si la politique change ou est
activée dans Nginx, préparer **une nouvelle candidate rc3**, avec nouveaux tags,
nouvel export et nouveau Compose, puis refaire les contrôles sur ses images.
Ne pas retoucher le contenu d’une image déjà déclarée validée.

## 9. NAS — conserver l’archive des images finalement validées

Cette étape ne s’exécute **qu’après la clôture des contrôles**. Si une rc3 a été
nécessaire, remplacer les tags et dossiers rc2 par ceux de cette candidate.
Avant export, comparer les identifiants des conteneurs et des tags comme à l’étape 7.

- [ ] **NAS, session SSH**, pour une rc2 effectivement validée sans autre modification :

```sh
cd /volume1/docker/suivi-cb-preprod/releases/2.2.0-rc2
sudo docker inspect --format '{{.Name}} {{.Image}}' suivi-cb-preprod-backend suivi-cb-preprod-frontend > images-validees.txt
test ! -e suivi-cb-preprod-2.2.0-rc2-validee.tar
sudo docker save -o suivi-cb-preprod-2.2.0-rc2-validee.tar suivi-cb-preprod-backend:2.2.0-rc2 suivi-cb-preprod-frontend:2.2.0-rc2
sudo sha256sum suivi-cb-preprod-2.2.0-rc2-validee.tar > SHA256SUMS-validee
sudo chown GodOfNasAugerie suivi-cb-preprod-2.2.0-rc2-validee.tar
sudo chmod 0640 suivi-cb-preprod-2.2.0-rc2-validee.tar
```

Cette archive reste dans le dossier releases de **préproduction**, avec les
preuves. Les commandes chown/chmod ci-dessus rendent ce tar lisible par votre compte
pour sa récupération sur le PC. Puis :

- [ ] **PowerShell sur le PC**, même session avec ReleaseDir :

```powershell
scp -O -P 1122 GodOfNasAugerie@192.168.1.113:/volume1/docker/suivi-cb-preprod/releases/2.2.0-rc2/suivi-cb-preprod-2.2.0-rc2-validee.tar $ReleaseDir
if ($LASTEXITCODE -ne 0) { throw "Récupération de l’archive validée en échec" }
scp -O -P 1122 GodOfNasAugerie@192.168.1.113:/volume1/docker/suivi-cb-preprod/releases/2.2.0-rc2/SHA256SUMS-validee $ReleaseDir
if ($LASTEXITCODE -ne 0) { throw "Récupération de l’empreinte en échec" }
$ExpectedHash = ((Get-Content -LiteralPath (Join-Path $ReleaseDir 'SHA256SUMS-validee')) -split '\s+')[0]
$ReceivedHash = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $ReleaseDir 'suivi-cb-preprod-2.2.0-rc2-validee.tar')).Hash.ToLowerInvariant()
if ($ReceivedHash -ne $ExpectedHash) { throw "Empreinte de l’archive validée différente" }
node scripts/audit-image-archive.mjs (Join-Path $ReleaseDir 'suivi-cb-preprod-2.2.0-rc2-validee.tar') (Join-Path $ReleaseDir 'package-inspection-validee.json')
if ($LASTEXITCODE -ne 0) { throw "Inspection du package validé en échec" }
```

- [ ] Vérifier à nouveau le rapport et consigner date des essais, résultats,
  identifiants des images et décision finale. Lorsqu’une CSP appliquée remplace
  Report-Only, adapter le contrôle du rapport à la politique finale plutôt que
  d’exiger `globalCspReportOnly: true`.
- [ ] Suivre ensuite [PROMOTION_PREPROD_PRODUCTION.md](./PROMOTION_PREPROD_PRODUCTION.md)
  pour la MEP : mêmes images validées, configuration et données de production,
  sauvegardes et retour arrière. Ne pas importer les bases ou comptes de test.

Le chargement d’un tar et le statut healthy ne valent pas validation de sécurité.
La création de cette checklist ne signifie pas que rc2 a déjà été construite,
transférée ou déployée.
