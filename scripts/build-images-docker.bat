@echo off
powershell.exe -NoProfile -File "%~dp0build-images-docker.ps1" %*
exit /b %errorlevel%
