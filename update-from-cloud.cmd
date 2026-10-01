@echo off
setlocal
rem Gets the latest changes from a Claude cloud session and rebuilds the extension into src\dist.
rem Double-click it, or run:  update-from-cloud.cmd [branch]
rem Afterwards, reload FocuzNow in vivaldi://extensions.

rem Run from a copy: the update can change this file, and Windows reads a .cmd while it runs.
if /i not "%~1"=="--from-copy" (
    copy /y "%~f0" "%TEMP%\focuznow-update-from-cloud.cmd" >nul
    "%TEMP%\focuznow-update-from-cloud.cmd" --from-copy "%~dp0." %1
)

set "BRANCH=%~3"
if "%BRANCH%"=="" set "BRANCH=codex/focuzpass-distinctive-vibe-1utsv7"

cd /d "%~2"

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

rem Note the package list before updating, to reinstall packages only when it changes.
set "LOCK_BEFORE="
for /f "delims=" %%L in ('git rev-parse HEAD:src/package-lock.json 2^>nul') do set "LOCK_BEFORE=%%L"

git merge --ff-only FETCH_HEAD
if errorlevel 1 (
    echo.
    echo Git couldn't bring the update in on top of your copy; the reason is above.
    echo Nothing was changed. Copy the messages above into Claude.
    goto :failed
)

set "LOCK_AFTER="
for /f "delims=" %%L in ('git rev-parse HEAD:src/package-lock.json 2^>nul') do set "LOCK_AFTER=%%L"

cd src
set "NEED_INSTALL="
if not exist node_modules set "NEED_INSTALL=1"
if not "%LOCK_BEFORE%"=="%LOCK_AFTER%" set "NEED_INSTALL=1"
rem Also when a package the project lists isn't installed (an earlier update may have skipped it).
if not defined NEED_INSTALL (
    call npm ls --depth=0 >nul 2>&1
    if errorlevel 1 set "NEED_INSTALL=1"
)
if defined NEED_INSTALL (
    echo.
    echo Installing packages...
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
