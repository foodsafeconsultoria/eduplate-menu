@echo off
cd /d "%~dp0"
echo Buildando...
call npm run build
if %ERRORLEVEL% NEQ 0 ( echo ERRO NO BUILD & pause & exit /b 1 )
echo Deployando...
call npx firebase-tools deploy --only hosting
pause
