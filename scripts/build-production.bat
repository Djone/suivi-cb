@echo off
REM Script de build pour la production (Windows)
REM Ce script prépare l'application pour le déploiement sur le NAS Synology

setlocal enabledelayedexpansion

echo ======================================
echo Build de production - Suivi CB
echo ======================================
echo.

REM Se placer a la racine du projet (dossier parent de scripts\)
set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "PROJECT_ROOT=%%~fI"
cd /d "%PROJECT_ROOT%"

REM Vérifier que nous sommes dans le bon répertoire
if not exist "docker-compose.yml" (
    echo [ERREUR] docker-compose.yml non trouve. Etes-vous dans le bon repertoire?
    exit /b 1
)

REM Vérifier que Docker est installé
docker --version >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Docker n'est pas installe. Installez Docker Desktop avant de continuer.
    exit /b 1
)

REM Vérifier que docker-compose est installé
docker compose version >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Docker Compose v2 n'est pas disponible.
    exit /b 1
)

REM Docker Compose ne charge automatiquement que .env.
REM Charger explicitement la configuration de production.
if not exist ".env.production" (
    echo [ERREUR] .env.production est introuvable.
    exit /b 1
)
findstr /B /C:"KEYCLOAK_URL=https://" ".env.production" >nul
if errorlevel 1 (
    echo [ERREUR] KEYCLOAK_URL doit etre renseignee en HTTPS dans .env.production.
    exit /b 1
)

REM Étape 1: Nettoyage
echo [INFO] Etape 1/6: Nettoyage des anciens builds...
if exist "frontend\dist\" rmdir /s /q "frontend\dist\"
if exist "backend\dist\" rmdir /s /q "backend\dist\"
echo [INFO] Nettoyage termine
echo.

REM Étape 2: Vérification des dépendances backend
echo [INFO] Etape 2/6: Verification des dependances backend...
if not exist "backend\node_modules" (
    echo [WARNING] node_modules du backend non trouve. Installation...
    pushd backend
    call npm ci
    popd
)
echo [INFO] Dependances backend OK
echo.

REM Étape 3: Vérification des dépendances frontend
echo [INFO] Etape 3/6: Verification des dependances frontend...
if not exist "frontend\node_modules" (
    echo [WARNING] node_modules du frontend non trouve. Installation...
    pushd frontend
    call npm ci --legacy-peer-deps
    popd
)
echo [INFO] Dependances frontend OK
echo.

REM Étape 4: Build du frontend Angular
echo [INFO] Etape 4/6: Build du frontend Angular en mode production...
pushd frontend
call npx ng build --configuration production
if errorlevel 1 (
    echo [ERREUR] Erreur lors du build du frontend
    popd
    exit /b 1
)
popd
echo [INFO] Build frontend termine
echo.

REM Étape 5: Build des images Docker
echo [INFO] Etape 5/6: Construction des images Docker...
docker compose --env-file .env.production build --no-cache
if errorlevel 1 (
    echo [ERREUR] Erreur lors de la construction des images Docker
    exit /b 1
)
echo [INFO] Images Docker construites avec succes
echo.

REM Étape 6: Vérification des images
echo [INFO] Etape 6/6: Verification des images creees...
echo.
docker images | findstr /C:"suivi-cb" /C:"REPOSITORY"
echo.

REM Afficher un résumé
echo ======================================
echo Build termine avec succes!
echo ======================================
echo.
echo Prochaines etapes:
echo 1. Tester localement: docker compose --env-file .env.production up -d
echo 2. Verifier les logs: docker compose --env-file .env.production logs -f
echo 3. Tester l'application: http://localhost:4200
echo 4. Deployer sur le NAS (voir INSTALLATION_NAS.md)
echo.
echo Commandes utiles:
echo - Demarrer: docker compose --env-file .env.production up -d
echo - Arreter: docker compose --env-file .env.production down
echo - Logs: docker compose --env-file .env.production logs -f
echo - Status: docker compose --env-file .env.production ps
echo.

endlocal
