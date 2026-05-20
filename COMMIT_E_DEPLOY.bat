@echo off
echo ============================================
echo   EduPlate - Commit + Deploy (Railway)
echo ============================================
echo.

cd /d "%~dp0"

echo [0/2] Corrigindo git index corrompido...
if exist ".git\index.lock" del /f ".git\index.lock"
if exist ".git\HEAD.lock" del /f ".git\HEAD.lock"
git reset HEAD
echo.

echo [1/2] Fazendo commit das alteracoes...
git add client\src\pages\SchoolCertificates.tsx
git add client\src\pages\Training.tsx
git add client\src\hooks\useOrgSettings.ts
git add package.json
git add client\src\pages\nutrition\Recipes.tsx
git add client\src\data\defaultRecipes.ts
git add client\src\data\nutritionFoods.ts
git add client\public\sw.js
git add client\src\lib\apiUrl.ts
git add client\.env.production
git add .env.production
git add client\src\pages\Billing.tsx
git add client\src\pages\Pricing.tsx
git add client\src\pages\Cadastro.tsx
git add client\src\pages\Inspection.tsx
git add client\src\pages\Documents.tsx
git add client\src\pages\Maintenance.tsx
git add client\src\pages\Dashboard.tsx
git add client\src\pages\RestoIngesta.tsx
git add client\src\pages\Acceptability.tsx
git add client\src\pages\nutrition\Menus.tsx
git add client\src\pages\Profile.tsx
git add client\src\components\OnboardingModal.tsx
git add client\src\pages\LandingPage.tsx
git add client\src\pages\Notifications.tsx
git add client\src\pages\Register.tsx
git add client\src\pages\ForgotPassword.tsx
git add client\src\pages\Login.tsx
git add client\src\App.tsx
git add client\src\contexts\AuthContext.tsx
git add client\public\manifest.json
git add client\public\icon-192.png
git add client\public\icon-512.png
git add server\stripe.ts
git add server\email.ts
git add server\index.ts
git add client\src\pages\Inspection.tsx
git add client\src\hooks\useOrgId.ts
git add client\src\hooks\useDocuments.ts
git add client\src\hooks\useFirestore.ts
git add client\src\hooks\useSpecialDiets.ts
git add client\src\hooks\useMenus.ts
git add client\src\hooks\useRestoIngestaRecords.ts
git add client\src\hooks\useMarmitaRuns.ts
git add client\src\hooks\useRecipes.ts
git add client\src\hooks\useMaintenanceTickets.ts
git add client\src\hooks\useFoods.ts
git add client\src\hooks\useProductionLogs.ts
git add client\src\hooks\useOrgSettings.ts
git add client\src\hooks\useAcceptabilityRecords.ts
git add COMMIT_E_DEPLOY.bat
git status
git commit -m "fix: mobile responsivo, fichas tecnicas custo editavel + tabela nutricional completa, PDF com data, sem onboarding"
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
