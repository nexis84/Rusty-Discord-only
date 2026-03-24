# 🚀 RustyBot Quick Start Guide

Get your EVE Online Discord & Twitch bot running in 5 minutes!

## Step 1: Get Your Tokens

### Discord Bot Token
1. Go to https://discord.com/developers/applications
2. Create new application → "Bot" → Create bot
3. Copy the token

### Twitch OAuth Token (Optional)
1. Go to https://twitchapps.com/tmi/
2. Login with your bot's Twitch account
3. Copy the OAuth token

## Step 2: Configure Environment

1. **Copy template:** `cp .env.template .env`
2. **Edit .env file** with your tokens:
   ```env
   DISCORD_TOKEN=your_discord_token_here
   CLIENT_ID=your_discord_app_id_here
   TWITCH_USERNAME=your_twitch_bot_name
   TWITCH_OAUTH_TOKEN=oauth:your_twitch_token_here
   TWITCH_CHANNELS=yourchannel,friendschannel
   ```

### 3a. Run with Python GUI (Recommended for Local)
If you have Python installed, you can use the graphical manager:
```bash
python gui.py
```
This allows you to:
- Start Discord Bot Only
- Start Twitch Bot Only
- Start Both Bots
- Stop all bots with one click

### 3b. Run via Command Line
```bash
npm install
npm start
```

**To run only Discord via CLI:**
```bash
# Windows
set DISCORD_ONLY_MODE=true && npm start
# Linux/Mac
DISCORD_ONLY_MODE=true npm start
```

## Step 4: Test Commands

### Discord
- `/market PLEX`
- `/help`

### Twitch
- `!market Tritanium`
- `!help`

## Step 5: Deploy to Production

### GitHub + Render (Recommended)
1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "feat: Initial RustyBot with Discord & Twitch support"
   git remote add origin https://github.com/nexis84/rustybot-discord-twitch.git
   git push -u origin main
   ```

2. **Deploy to Render:**
   - Go to https://render.com
   - Connect GitHub repository
   - Create Web Service
   - Add environment variables
   - Deploy!

## 🎉 Done!

Your bot is now live on both Discord and Twitch!

**Need help?** Check `README.md` or `DEPLOYMENT_CHECKLIST.md` for detailed instructions.
- Git installed
- Discord account and server for testing

### 2. Clone and Setup
```bash
# Clone the repository
git clone https://github.com/nexis84/rustybot-discord-bot.git
cd rustybot-discord-bot

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
```

### 3. Discord Bot Setup
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create new application → "RustyBot"
3. Go to Bot section → Add Bot
4. Copy Token and Application ID
5. Update `.env` file with your tokens

### 4. Run Locally
```bash
# Start the bot
npm start

# For development with auto-restart
npm run dev
```

### 5. Test Commands
In your Discord server:
- `/help` - Show all commands
- `/market PLEX` - Test market data
- `/info Tritanium` - Test item lookup

## Production Deployment

### Quick Deploy to Render
1. Push to GitHub
2. Connect to Render
3. Set environment variables
4. Deploy!

See `DEPLOYMENT.md` for detailed instructions.

## Features Overview

- **Real-time Market Data**: Live prices from all EVE trade hubs
- **Manufacturing Costs**: Calculate build costs and profits
- **LP Store Analysis**: Browse loyalty point offers
- **Interactive UI**: Dropdown menus and buttons
- **D-Scan Parser**: Analyze directional scan results

## Commands Quick Reference

| Command | Description | Example |
|---------|-------------|---------|
| `/market <item>` | Get market prices | `/market PLEX` |
| `/build <item>` | Manufacturing costs | `/build Retriever` |
| `/lp <corp>` | LP store browser | `/lp Sisters of EVE` |
| `/info <item>` | Item information | `/info Condor` |
| `/dscan` | D-scan parser | `/dscan` |

## Support

- **Issues**: GitHub Issues page
- **Discord**: [Your Discord Server]
- **Documentation**: README.md and wiki

## Contributing

1. Fork repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

Happy capsuleering! 🚀