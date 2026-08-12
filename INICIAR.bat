@echo off
title Baby Shower - Celeste Mira
cd /d "%~dp0"
echo.
echo   Encendiendo la invitacion...
echo.
node --env-file=.env server.js
echo.
echo   El servidor se detuvo. Presiona una tecla para cerrar.
pause > nul
