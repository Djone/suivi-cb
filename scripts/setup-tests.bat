@echo off
echo ========================================
echo   Installation des dependances de test
echo ========================================
echo.

echo [1/3] Installation des dependances backend...
cd backend
call npm install jest@^29.7.0 @types/jest@^29.5.11 --save-dev
if %errorlevel% neq 0 (
    echo Erreur lors de l'installation backend
    exit /b 1
)
echo Backend OK!
echo.

echo [2/3] Retour a la racine...
cd ..
echo.

echo [3/3] Verification des dependances frontend (deja installees)...
cd frontend
if not exist "node_modules" (
    echo Installation des dependances frontend...
    call npm install
)
echo Frontend OK!
echo.

cd ..
echo ========================================
echo   Installation terminee avec succes!
echo ========================================
echo.
echo Vous pouvez maintenant lancer les tests:
echo   - npm test                  (tous les tests)
echo   - npm run test:backend      (backend uniquement)
echo   - npm run test:frontend     (frontend uniquement)
echo   - npm run test:watch        (mode watch)
echo   - npm run test:coverage     (avec couverture)
echo.
pause
