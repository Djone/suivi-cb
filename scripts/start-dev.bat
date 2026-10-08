@echo off
setlocal

call "%~dp0start-keycloak-dev.bat"
if errorlevel 1 exit /b %errorlevel%

echo [INFO] Attente de Keycloak sur http://localhost:8080...
set /a keycloak_attempts=0

:wait_for_keycloak
set /a keycloak_attempts+=1
curl.exe --silent --show-error --fail --max-time 2 --output NUL "http://localhost:8080/realms/suivi-cb/.well-known/openid-configuration" >nul 2>nul
if not errorlevel 1 goto keycloak_ready
if %keycloak_attempts% GEQ 30 goto keycloak_unavailable
timeout /t 2 /nobreak >nul
goto wait_for_keycloak

:keycloak_unavailable
echo [ERREUR] Keycloak n'est pas pret apres 60 secondes.
echo [ACTION] Consultez les logs avec : cd keycloak-server ^&^& docker compose --env-file .env -f compose.yml logs keycloak
exit /b 1

:keycloak_ready
echo [INFO] Keycloak est pret.
set "NODE_ENV=development"
set "KEYCLOAK_URL=http://localhost:8080"
set "KEYCLOAK_ACCOUNT_URL=http://localhost:8080"
set "KEYCLOAK_JWKS_URL="
set "KEYCLOAK_REALM=suivi-cb"

call npm run start:app
