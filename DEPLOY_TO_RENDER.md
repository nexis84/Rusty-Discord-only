# 🚀 Deploy RustyBot to Render

Your code is now live on GitHub! Follow these steps to deploy to Render.

## Quick Deploy Links

### 🔗 Direct Deployment URLs
- **GitHub Repository**: https://github.com/nexis84/rustybot-discord-twitch
- **Deploy to Render**: [Click here to deploy](https://render.com/deploy?repo=https://github.com/nexis84/rustybot-discord-twitch)

## Step-by-Step Render Deployment

### 1. Go to Render Dashboard
Visit: https://dashboard.render.com/

### 2. Create New Web Service
1. Click **"New"** → **"Web Service"**
2. Select **"Build and deploy from a Git repository"**
3. Connect your GitHub account if not already connected
4. Find and select: `nexis84/rustybot-discord-twitch`

### 3. Configure Service Settings
```
Name: rustybot-discord-twitch
Region: Oregon (US West) - or your preferred region
Branch: main
Runtime: Node
Build Command: npm install
Start Command: npm start
```

### 4. Add Environment Variables
Click **"Advanced"** and add these environment variables:

#### For Discord + Twitch (Full Bot):
```
DISCORD_TOKEN = [Get from Discord Developer Portal]
CLIENT_ID = [Your Discord Application ID]
TWITCH_USERNAME = [Your bot's Twitch username]
TWITCH_OAUTH_TOKEN = [Get from twitchapps.com/tmi]
TWITCH_CHANNELS = [channel1,channel2,channel3]
```

#### For Twitch-Only Bot:
```
TWITCH_USERNAME = [Your bot's Twitch username]
TWITCH_OAUTH_TOKEN = [Get from twitchapps.com/tmi]
TWITCH_CHANNELS = [channel1,channel2,channel3]
```
**Note:** Simply omit DISCORD_TOKEN and CLIENT_ID to run Twitch-only!

#### Additional Configuration:
```
USER_AGENT = RustyBot/1.0.0 (your@email.com)
NODE_ENV = production
```

### 5. Deploy!
1. Click **"Create Web Service"**
2. Wait for deployment (5-10 minutes)
3. Your bot will be live at: `https://rustybot-discord-twitch.onrender.com`

## Getting Your Tokens

### For Twitch-Only Bot
1. Go to https://twitchapps.com/tmi/
2. Login with your bot's Twitch account  
3. Copy the OAuth token (starts with `oauth:`)
4. Set your bot's Twitch username
5. List the channels you want the bot to join

### For Discord Bot (Optional)
1. Go to https://discord.com/developers/applications
2. Create new application or select existing
3. Go to "Bot" section
4. Copy the token
5. Copy the Application ID (Client ID)

### Twitch OAuth Token (Optional)
1. Go to https://twitchapps.com/tmi/
2. Login with your bot's Twitch account  
3. Copy the OAuth token (starts with `oauth:`)

## 🎮 Twitch-Only Deployment

**Want to use only Twitch?** No problem! Simply omit the Discord environment variables.

### Twitch-Only Environment Variables:
```
TWITCH_USERNAME = your_bot_username
TWITCH_OAUTH_TOKEN = oauth:your_oauth_token_here
TWITCH_CHANNELS = yourchannel,friendschannel,anotherchannel
USER_AGENT = RustyBot/1.0.0 (your@email.com)
NODE_ENV = production
```

**That's it!** The bot will automatically detect that Discord credentials are missing and run in Twitch-only mode.

### Twitch-Only Features:
- ✅ All market commands: `!market`, `!price`
- ✅ Manufacturing info: `!build`
- ✅ LP store data: `!lp corp | item`
- ✅ Item information: `!info`
- ✅ Help system: `!help`, `!rustybot`
- ✅ Rate limiting and spam protection
- ✅ Multi-channel support
- ✅ Compact responses optimized for Twitch chat

## Environment Variables Template
Copy the `.env.template` file for a complete example of all required variables.

## Verification Steps

### ✅ Check Deployment Status
1. Go to your Render dashboard
2. Check the "Logs" tab for any errors
3. Verify the service shows as "Live"
4. Test the health endpoint: `https://your-app.onrender.com/health`

### ✅ Test Discord Bot
1. Invite your bot to a Discord server
2. Try commands like `/market PLEX` and `/help`
3. Check that slash commands are registering

### ✅ Test Twitch Bot (if configured)
1. Check that your bot appears in the configured Twitch channels
2. Try commands like `!market Tritanium` and `!help`
3. Verify rate limiting is working

### ✅ Test Twitch-Only Bot
1. Your bot should appear in all configured Twitch channels
2. Test basic commands:
   - `!market PLEX` - Should return market prices
   - `!help` - Should show available commands
   - `!rustybot` - Should show bot information
3. Verify the bot responds only in Twitch (no Discord activity)
4. Check health endpoint shows: `"discord": {"ready": false}`, `"twitch": {"connected": true}`

## Health Check Endpoint

Your deployed bot includes a health check at:
`https://your-app.onrender.com/health`

Response example:
```json
{
  "status": "running",
  "discord": {
    "ready": true,
    "guilds": 5
  },
  "twitch": {
    "connected": true,
    "enabled": true
  },
  "uptime": 3600
}
```

## Troubleshooting

### ❌ Bot Not Starting
- Check environment variables are set correctly
- Verify Discord token is valid
- Check service logs in Render dashboard

### ❌ Discord Commands Not Working
- Verify bot has proper permissions in Discord servers
- Check if CLIENT_ID matches your Discord application
- Try the `/sync` command if you're a server admin

### ❌ Twitch Not Connecting
- Verify TWITCH_OAUTH_TOKEN includes `oauth:` prefix
- Check TWITCH_CHANNELS format (no # symbols)
- Ensure bot account has access to the channels

## Auto-Deployment

🎉 **Good news!** Your repository is set up with GitHub Actions. 

Every time you push code to the `main` branch, Render will automatically deploy the updates!

## Support

- **GitHub Issues**: https://github.com/nexis84/rustybot-discord-twitch/issues
- **Render Documentation**: https://render.com/docs
- **Discord Developer Portal**: https://discord.com/developers/docs

---

## 🎉 Congratulations!

Your RustyBot is now live and providing EVE Online market data to both Discord and Twitch users!

**Your deployed bot URL**: `https://rustybot-discord-twitch.onrender.com`