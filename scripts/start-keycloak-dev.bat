@echo off
setlocal
cd /d "%~dp0..\keycloak-server"

if not exist ".env" (
  copy ".env.dev.example" ".env" >nul
  echo [INFO] Le fichier keycloak-server\.env a ete cree.
  echo [ACTION] Remplacez les deux secrets d'exemple, puis relancez ce script.
  exit /b 1
)

docker compose --env-file .env -f compose.yml -f compose.dev.yml up -d
