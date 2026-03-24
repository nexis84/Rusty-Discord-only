#!/bin/bash

# RustyBot Setup Script
# This script helps you prepare RustyBot for deployment

echo "🤖 RustyBot Deployment Setup"
echo "=============================="
echo ""

# Check if we're in the right directory
if [[ ! -f "server.js" ]] || [[ ! -f "package.json" ]]; then
    echo "❌ Error: Please run this script from the RustyBot directory"
    exit 1
fi

echo "✅ Found RustyBot files"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [[ $? -ne 0 ]]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed"
echo ""

# Check if .env exists
if [[ ! -f ".env" ]]; then
    echo "⚙️ Creating .env file from template..."
    cp .env.template .env
    echo "✅ Created .env file"
    echo "📝 Please edit .env file with your actual tokens and configuration"
    echo ""
else
    echo "✅ .env file already exists"
    echo ""
fi

# Run syntax checks
echo "🔍 Running syntax checks..."
node -c server.js
if [[ $? -ne 0 ]]; then
    echo "❌ Syntax error in server.js"
    exit 1
fi

node -c twitch-bot.js
if [[ $? -ne 0 ]]; then
    echo "❌ Syntax error in twitch-bot.js"
    exit 1
fi

node -c twitch-utils.js
if [[ $? -ne 0 ]]; then
    echo "❌ Syntax error in twitch-utils.js"
    exit 1
fi

echo "✅ All syntax checks passed"
echo ""

# Check Git setup
if [[ ! -d ".git" ]]; then
    echo "🔧 Initializing Git repository..."
    git init
    git add .
    git commit -m "feat: Initial RustyBot setup with Discord & Twitch integration"
    echo "✅ Git repository initialized"
    echo ""
else
    echo "✅ Git repository already exists"
    echo ""
fi

# Deployment readiness check
echo "🚀 Deployment Readiness Check"
echo "=============================="

# Check required files
required_files=("server.js" "twitch-bot.js" "twitch-utils.js" "package.json" ".env.template" "README.md" "DEPLOYMENT_CHECKLIST.md")
for file in "${required_files[@]}"; do
    if [[ -f "$file" ]]; then
        echo "✅ $file exists"
    else
        echo "❌ $file missing"
    fi
done

echo ""
echo "📋 Next Steps:"
echo "1. Edit .env file with your Discord and Twitch credentials"
echo "2. Test locally with: npm start"
echo "3. Create GitHub repository and push code"
echo "4. Deploy to Render using the instructions in DEPLOYMENT_CHECKLIST.md"
echo ""
echo "🔗 Quick Links:"
echo "- Discord Bot Setup: https://discord.com/developers/applications"
echo "- Twitch OAuth Token: https://twitchapps.com/tmi/"
echo "- Render Deployment: https://render.com"
echo ""
echo "✨ Setup complete! Read README.md for detailed instructions."