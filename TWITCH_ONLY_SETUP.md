# 🎮 RustyBot Twitch-Only Quick Setup

Deploy RustyBot as a Twitch-only EVE Online market bot in 5 minutes!

## Step 1: Get Your Twitch OAuth Token

1. **Create/Use a Twitch Account** for your bot
2. **Get OAuth Token**:
   - Go to https://twitchapps.com/tmi/
   - Login with your bot's Twitch account
   - Copy the OAuth token (starts with `oauth:`)

## Step 2: Deploy to Render

### Quick Deploy:
1. Go to https://dashboard.render.com/
2. Click "New" → "Web Service"
3. Connect to GitHub repository: `nexis84/rustybot-discord-twitch`
4. Configure:
   ```
   Name: rustybot-twitch
   Build Command: npm install
   Start Command: npm start
   ```

### Environment Variables (Twitch-Only):
```
TWITCH_USERNAME = your_bot_username
TWITCH_OAUTH_TOKEN = oauth:your_oauth_token_here
TWITCH_CHANNELS = yourchannel,friendschannel
USER_AGENT = RustyBot/1.0.0 (your@email.com)
NODE_ENV = production
```

**Important**: Do NOT add `DISCORD_TOKEN` or `CLIENT_ID` - the bot will automatically run in Twitch-only mode!

## Step 3: Test Your Bot

Once deployed, test in your Twitch channels:

### Available Commands:
- `!market PLEX` - Get PLEX market prices
- `!price Tritanium x1000000` - Get bulk item prices
- `!build Retriever` - Get manufacturing costs
- `!lp Sisters of EVE | Cybernetic Subprocessor` - LP store analysis
- `!info Condor` - Get item information link
- `!help` - Show all commands
- `!rustybot` - About the bot

### Example Usage:
```
you: !market PLEX
RustyBot: @you PLEX - Global Sell: 4.5M ISK | Buy: 4.4M ISK

you: !price Tritanium x1000000  
RustyBot: @you Tritanium x1000000 - Jita Sell: 6.2M ISK | Buy: 6.1M ISK

you: !help
RustyBot: @you RustyBot Commands: !market <item> [qty] - Market prices | !build <item> - Manufacturing costs
RustyBot: !lp <corp> | <item> - LP store offers | !info <item> - Item details | Examples: !market PLEX, !build Retriever
```

## Features

### ✅ Twitch-Optimized:
- **Compact Responses** - Designed for 500-character Twitch limit
- **Rate Limiting** - 5 commands per minute per user
- **Command Cooldowns** - 3-second cooldowns per channel
- **Multi-Channel** - Works in multiple channels simultaneously
- **Smart Formatting** - ISK amounts use K/M/B abbreviations

### ✅ EVE Online Data:
- **Real-Time Market Prices** - All major trade hubs
- **Manufacturing Costs** - Build cost calculations
- **LP Store Analysis** - Loyalty point profitability
- **Item Information** - Direct links to item details

### ✅ Production Ready:
- **Auto-Deployment** - Updates automatically from GitHub
- **Health Monitoring** - Built-in status endpoints
- **Error Handling** - Robust error recovery
- **Caching** - Efficient API usage

## Health Check

Your bot's status: `https://your-app.onrender.com/health`

Twitch-only response:
```json
{
  "status": "running",
  "discord": {
    "ready": false,
    "enabled": false
  },
  "twitch": {
    "connected": true,
    "enabled": true
  },
  "uptime": 3600
}
```

## Troubleshooting

### ❌ Bot Not Joining Channels
- Check `TWITCH_OAUTH_TOKEN` includes `oauth:` prefix
- Verify `TWITCH_CHANNELS` format: `channel1,channel2` (no spaces, no #)
- Ensure bot account has access to channels

### ❌ Commands Not Working
- Bot needs a moment to connect after deployment
- Check health endpoint shows `"twitch": {"connected": true}`
- Try `!help` first to verify bot is responding

### ❌ Rate Limited
- Users limited to 5 commands per minute
- Channels have 3-second cooldowns between commands
- This is normal spam protection

## Advanced Configuration

### Multiple Channels:
```
TWITCH_CHANNELS = mychannel,guildchannel,friendschannel,eventchannel
```

### Custom User Agent:
```
USER_AGENT = MyEveBot/1.0.0 (myemail@example.com)
```

## Support

- **GitHub Repository**: https://github.com/nexis84/rustybot-discord-twitch
- **Issues**: https://github.com/nexis84/rustybot-discord-twitch/issues
- **Render Docs**: https://render.com/docs

---

## 🎉 That's It!

Your Twitch-only RustyBot is now live and providing EVE Online market data to your Twitch community!

**No Discord setup required** - just pure Twitch chat integration for EVE Online market analysis! 🚀