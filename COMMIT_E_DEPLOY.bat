@echo off
echo ============================================
echo   EduPlate - Commit + Deploy (Railway)
echo ============================================
echo.

cd /d "%~dp0"

echo [0/2] Corrigindo git index corrompido...
if exist ".git\index.lock" del /f ".git\index.lock"
git reset HEAD
echo.

echo [1/2] Fazendo commit das alteracoes...
git add client\src\pages\SchoolCertificates.tsx
git add client\src\pages\Training.tsx
git add client\src\hooks\useOrgSettings.ts
git add package.json
git add client\src\pages\nutrition\Recipes.tsx
git add client\src\data\defaultRecipes.ts
git add client\public\sw.js
git add client\src\lib\apiUrl.ts
git add client\.env.production
git add .env.production
git add client\src\pages\Billing.tsx
git add client\src\pages\Pricing.tsx
git add client\src\pages\Cadastro.tsx
git add client\src\pages\Inspection.tsx
git add client\src\pages\nutrition\Menus.tsx
git add client\src\pages\Profile.tsx
git add client\src\components\OnboardingModal.tsx
git add client\src\pages\LandingPage.tsx
git add client\src\pages\Notifications.tsx
git add server\index.ts
git add COMMIT_E_DEPLOY.bat
git status
git commit -m "deploy: atualizacoes EduPlate"
echo.

echo [2/2] Enviando para Railway (redeploy automatico)...
git push
if %ERRORLEVEL% NEQ 0 (
  echo ERRO no git push. Verifique sua conexao ou autenticacao.
  pause
  exit /b 1
)

echo.
echo ============================================
echo   Pronto! Railway esta rebuilding...
echo   Acesse em ~3 minutos em aba anonima:
echo   https://www.eduplate.com.br
echo ============================================
pause
