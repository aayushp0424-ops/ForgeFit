@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install Node.js LTS from https://nodejs.org/
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Reinstall Node.js LTS from https://nodejs.org/
  pause
  exit /b 1
)
if not exist "node_modules" (
  echo Installing ForgeFit dependencies for the first time...
  call npm install
  if errorlevel 1 (
    echo Package installation failed. Check your internet connection.
    pause
    exit /b 1
  )
)
echo.
echo Starting ForgeFit. Open http://localhost:3000 in your browser.
echo Leave this window open while using the app. Press Ctrl+C to stop.
echo.
call npm run dev
pause
