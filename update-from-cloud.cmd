@echo off
setlocal
rem Gets the latest changes from a Claude cloud session and rebuilds the extension into src\dist.
rem Double-click it, or run:  update-from-cloud.cmd [branch]
rem Afterwards, reload FocuzNow in vivaldi://extensions.

set "BRANCH=%~1"
if "%BRANCH%"=="" set "BRANCH=codex/focuzpass-distinctive-vibe-1utsv7"

cd /d "%~dp0"

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo This file has to be inside your FocuzNow project folder, next to AGENTS.md.
    echo It's running from: %CD%
    echo Move it into the project folder and double-click it there.
    goto :failed
)
if not exist "AGENTS.md" (
    echo This folder is a git project, but not FocuzNow: it has no AGENTS.md.
    echo It's running from: %CD%
    echo Move this file next to AGENTS.md in your FocuzNow folder.
    goto :failed
)

rem Sign in to GitHub once in the browser and Git remembers it (Git Credential Manager ships with Git for Windows).
for /f "delims=" %%H in ('git config --global credential.helper') do set "HELPER=%%H"
if "%HELPER%"=="" (
    echo Setting Git to remember your GitHub sign-in...
    git config --global credential.helper manager
)

echo.
echo Getting %BRANCH% from GitHub...
git fetch origin "%BRANCH%"
if errorlevel 1 goto :failed

git merge --ff-only FETCH_HEAD
if errorlevel 1 (
    echo.
    echo Your copy has changes the cloud branch doesn't have, so it can't just fast-forward.
    echo Nothing was changed. Ask Claude to merge them, or run:  git merge FETCH_HEAD
    goto :failed
)

cd src
if not exist node_modules (
    echo.
    echo Installing packages for the first time...
    call npm install
    if errorlevel 1 goto :failed
)

echo.
echo Building the extension...
node node_modules/vite/bin/vite.js build
if errorlevel 1 goto :failed

echo.
echo Done. Reload FocuzNow in vivaldi://extensions to use the new build.
pause
exit /b 0

:failed
echo.
echo Something went wrong. Copy the messages above into Claude.
pause
exit /b 1
