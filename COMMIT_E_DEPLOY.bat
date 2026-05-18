@echo off
echo ============================================
echo   PNAE - Commit + Build + Deploy
echo ============================================
echo.

cd /d "%~dp0"

echo [0/4] Corrigindo git index corrompido...
if exist ".git\index.lock" del /f ".git\index.lock"
if exist ".git\index" del /f ".git\index"
git reset HEAD
echo.

echo [1/4] Fazendo commit das alteracoes...
git add client\src\pages\SchoolCertificates.tsx
git add client\src\pages\Training.tsx
git add client\src\hooks\useOrgSettings.ts
git add package.json
git add client\src\pages\nutrition\Recipes.tsx
git add client\src\data\defaultRecipes.ts
git add client\public\sw.js
git add firebase.json
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
git status
git commit -m "fix: VITE_API_URL no build + SW v13 + fichas tecnicas + duplicatas + onboarding firestore + LP melhorias"
echo.

echo [2/5] Enviando codigo do servidor para Railway (git push)...
git push
if %ERRORLEVEL% NEQ 0 (
  echo AVISO: git push falhou. Verifique sua conexao ou autenticacao git.
  pause
)
echo.

echo [3/5] Instalando dependencias (se necessario)...
call npm install
echo.

echo [4/5] Gerando build de producao...
call npm run build
if %ERRORLEVEL% NEQ 0 (
  echo ERRO no build.
  pause
  exit /b 1
)

echo.
echo [5/5] Publicando no Firebase Hosting...
call npx firebase-tools deploy --only hosting
if %ERRORLEVEL% NEQ 0 (
  echo ERRO no deploy. Verifique se esta logado: npx firebase-tools login
  pause
  exit /b 1
)

echo.
echo ============================================
echo   Pronto! Acesse em aba anonima:
echo   https://www.eduplate.com.br
echo ============================================
pause
