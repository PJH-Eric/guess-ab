@echo off
chcp 65001 >nul
title Guess AB 1A2B
cd /d "%~dp0"

rem ASCII-only on purpose: after chcp 65001 cmd mis-reads byte offsets around
rem labels when multibyte text precedes them. Chinese messages live in
rem scripts\launcher\*.txt and are shown with type.
rem Picks the first node that is 26.12.1+ (PATH, common install dirs, then nvm).

set "NODE_EXE="
set "NODE_FROM_PATH="
set "NODE_BAD="
set "MSG=%~dp0scripts\launcher\"

for /f "delims=" %%N in ('where node 2^>nul') do call :try "%%N" 1
call :try "%ProgramFiles%\nodejs\node.exe"
call :try "%ProgramFiles(x86)%\nodejs\node.exe"
call :try "%LOCALAPPDATA%\Programs\nodejs\node.exe"
if not defined NODE_EXE for /f "delims=" %%D in ('dir /b /a:d /o:-n "%APPDATA%\nvm\v26.*" 2^>nul') do call :try "%APPDATA%\nvm\%%D\node.exe"

if not defined NODE_EXE goto :nonode
if defined NODE_FROM_PATH goto :run
type "%MSG%msg-other-node.txt"
echo   %NODE_EXE%
echo.
goto :run

:try
if defined NODE_EXE exit /b 0
if not exist %1 exit /b 0
%1 -e "const [a,b,c]=process.versions.node.split('.').map(Number); process.exit(a===26&&(b>12||(b===12&&c>=1))?0:1)"
if errorlevel 1 set "NODE_BAD=%~1"
if errorlevel 1 exit /b 0
set "NODE_EXE=%~1"
if "%2"=="1" set "NODE_FROM_PATH=1"
exit /b 0

:nonode
if defined NODE_BAD goto :tooold
type "%MSG%msg-no-node.txt"
goto :stop
:tooold
type "%MSG%msg-too-old.txt"
echo   found: %NODE_BAD%
:stop
pause
exit /b 1

:run
type "%MSG%msg-starting.txt"
rem wait for the server before opening the browser
start "" /b cmd /c "ping -n 3 127.0.0.1 >nul & start "" http://localhost:3100"
"%NODE_EXE%" server.js
if not errorlevel 1 goto :done
type "%MSG%msg-exited.txt"
echo   node: %NODE_EXE%
:done
pause
