@echo off
echo ============================================
echo   PNAE - Deploy para Firebase Hosting
echo ============================================
echo.

echo [1/3] Instalando dependencias...
call npm install
if %ERRORLEVEL% NEQ 0 (
  echo ERRO na instalacao de dependencias.
  pause
  exit /b 1
)

echo.
echo [2/3] Gerando build de producao...
call npm run build
if %ERRORLEVEL% NEQ 0 (
  echo ERRO no build.
  pause
  exit /b 1
)

echo.
echo [3/3] Publicando no Firebase Hosting...
call npx firebase-tools deploy --only hosting
if %ERRORLEVEL% NEQ 0 (
  echo ERRO no deploy. Verifique se esta logado: npx firebase-tools login
  pause
  exit /b 1
)

echo.
echo ============================================
echo   Deploy concluido!
echo   URL: https://gestaoescola-e5f3d.web.app
echo ============================================
pause
