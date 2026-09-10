@echo off
cd /d "%~dp0"
echo Demarrage du serveur local...
start "Serveur local - Suivi et Trophees (fermez cette fenetre pour arreter)" cmd /k py -3 -m http.server 8934
timeout /t 2 >nul
start "" http://localhost:8934
