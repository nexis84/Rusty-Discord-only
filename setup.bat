@echo off
setlocal enabledelayedexpansion

echo 🤖 RustyBot Deployment Setup
echo ==============================
echo.

REM Check if we're in the right directory
if not exist "server.js" (
    echo ❌ Error: Please run this script from the RustyBot directory
    pause
    exit /b 1
)

if not exist "package.json" (
    echo ❌ Error: Please run this script from the RustyBot directory
    pause
    exit /b 1
)

echo ✅ Found RustyBot files
echo.

REM Install dependencies
echo 📦 Installing dependencies...
call npm install

if errorlevel 1 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo ✅ Dependencies installed
echo.

REM Check if .env exists
if not exist ".env" (
    echo ⚙️ Creating .env file from template...
    copy ".env.template" ".env" >nul
    echo ✅ Created .env file
    echo 📝 Please edit .env file with your actual tokens and configuration
    echo.
) else (
    echo ✅ .env file already exists
    echo.
)

REM Run syntax checks
echo 🔍 Running syntax checks...
node -c server.js
if errorlevel 1 (
    echo ❌ Syntax error in server.js
    pause
    exit /b 1
)

node -c twitch-bot.js
if errorlevel 1 (
    echo ❌ Syntax error in twitch-bot.js
    pause
    exit /b 1
)

node -c twitch-utils.js
if errorlevel 1 (
    echo ❌ Syntax error in twitch-utils.js
    pause
    exit /b 1
)

echo ✅ All syntax checks passed
echo.

REM Check Git setup
if not exist ".git" (
    echo 🔧 Initializing Git repository...
    git init
    git add .
    git commit -m "feat: Initial RustyBot setup with Discord & Twitch integration"
    echo ✅ Git repository initialized
    echo.
) else (
    echo ✅ Git repository already exists
    echo.
)

REM Deployment readiness check
echo 🚀 Deployment Readiness Check
echo ==============================

REM Check required files
set "files=server.js twitch-bot.js twitch-utils.js package.json .env.template README.md DEPLOYMENT_CHECKLIST.md"
for %%f in (%files%) do (
    if exist "%%f" (
        echo ✅ %%f exists
    ) else (
        echo ❌ %%f missing
    )
)

echo.
echo 📋 Next Steps:
echo 1. Edit .env file with your Discord and Twitch credentials
echo 2. Test locally with: npm start
echo 3. Create GitHub repository and push code
echo 4. Deploy to Render using the instructions in DEPLOYMENT_CHECKLIST.md
echo.
echo 🔗 Quick Links:
echo - Discord Bot Setup: https://discord.com/developers/applications
echo - Twitch OAuth Token: https://twitchapps.com/tmi/
echo - Render Deployment: https://render.com
echo.
echo ✨ Setup complete! Read README.md for detailed instructions.
echo.
pause