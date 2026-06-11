@echo off
echo ============================================
echo   EduPlate - Commit + Deploy (Railway)
echo ============================================
echo.

cd /d "%~dp0"

echo [0/3] Limpando locks do git...
if exist ".git\index.lock" del /f ".git\index.lock"
if exist ".git\HEAD.lock" del /f ".git\HEAD.lock"
echo.

echo [1/3] Fazendo commit das alteracoes...
git add -A
git status --short
echo.
set MSG=
set /p MSG="Mensagem do commit (Enter usa a padrao): "
if "%MSG%"=="" set MSG=chore: atualizacoes do sistema
git commit -m "%MSG%"
echo.

echo [2/3] Publicando regras do Firestore...
call npx firebase-tools deploy --only firestore:rules
echo.

echo [3/3] Enviando para Railway (redeploy automatico)...
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
