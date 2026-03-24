# RustyBot Twitch Integration Guide

This guide explains how to set up and use RustyBot on Twitch alongside its Discord functionality.

## Quick Setup

### 1. Get Twitch OAuth Token
1. Go to https://twitchapps.com/tmi/
2. Login with your bot's Twitch account
3. Copy the OAuth token (starts with `oauth:`)

### 2. Configure Environment Variables
Add these to your `.env` file:
```env
TWITCH_USERNAME=your_bot_username
TWITCH_OAUTH_TOKEN=oauth:your_oauth_token_here
TWITCH_CHANNELS=yourchannel,anotherchannel
```

### 3. Start the Bot
```bash
npm start
```

The bot will automatically connect to both Discord and Twitch if both sets of credentials are provided.

## Twitch Commands

All commands use the `!` prefix and are designed for Twitch's 500-character message limit.

### Market Commands
- `!market <item>` - Get market prices
- `!price <item>` - Alias for market command
- `!market <item> x<quantity>` - Get prices for specific quantity

**Examples:**
```
!market PLEX
!price Tritanium x1000000
!market Condor
```

**Response Format:**
```
@username Condor - Jita Sell: 1.2M ISK | Buy: 980K ISK
@username PLEX x100 - Global Sell: 450M ISK | Buy: 445M ISK
```

### Manufacturing Commands
- `!build <item>` - Get manufacturing info
- `!manufacture <item>` - Alias for build command

**Examples:**
```
!build Retriever
!manufacture Condor
```

### LP Store Commands
- `!lp <corporation> | <item>` - Get LP store offers

**Examples:**
```
!lp Sisters of EVE | Cybernetic Subprocessor
!lp Federation Navy | Federation Navy Comet
```

### Information Commands
- `!info <item>` - Get item information link
- `!item <item>` - Alias for info command

**Examples:**
```
!info Condor
!item PLEX
```

**Response:**
```
@username "Condor" info: https://everef.net/type/583
```

### Help Commands
- `!help` - Show available commands
- `!commands` - Alias for help
- `!rustybot` - About the bot

## Rate Limiting & Cooldowns

### User Rate Limits
- **5 commands per minute per user**
- Prevents spam and API overload
- Silently ignored if exceeded

### Command Cooldowns
- **3 seconds per command per channel**
- Applies globally to all users in that channel
- Prevents rapid-fire command spam

### Cooldown Messages
- Only 10% of cooldown violations show a message
- Prevents chat spam from cooldown notifications

## Twitch-Specific Features

### Compact Formatting
All responses are optimized for Twitch's character limits:
- ISK amounts use K/M/B abbreviations (1.2B, 543M, 123K)
- Shortened location names (Jita vs "Jita IV - Moon 4")
- Essential information only

### Message Splitting
If a response exceeds 450 characters, it's automatically split:
```
@username Part 1 of the response...
@username Part 2 of the response...
```

### Automatic Mentions
All responses include `@username` to ensure the user sees the reply in busy chats.

## Channel Setup

### Bot Account Setup
1. Create a dedicated Twitch account for your bot
2. Verify the account with a phone number
3. Generate an OAuth token using the account

### Adding to Channels
1. Add the bot account to your channel's chat
2. Optionally give it moderator status: `/mod your_bot_username`
3. The bot will automatically join when started

### Multiple Channels
You can run the bot in multiple channels:
```env
TWITCH_CHANNELS=channel1,channel2,channel3
```

## Troubleshooting

### Bot Not Responding
1. Check that `TWITCH_USERNAME` matches exactly (case-sensitive)
2. Verify OAuth token starts with `oauth:`
3. Ensure channels are listed correctly in `TWITCH_CHANNELS`
4. Check console for connection errors

### OAuth Token Issues
- Tokens can expire - regenerate if needed
- Ensure no extra spaces in the token
- Token must include the `oauth:` prefix

### Rate Limiting
If users report unresponsive commands:
- Check if they've exceeded 5 commands/minute
- Wait for the cooldown period to reset
- Consider adjusting rate limits in the code if needed

### Common Error Messages
```
Error: Login authentication failed
```
- Check username and OAuth token
- Regenerate OAuth token if expired

```
Error: No response from IRC
```
- Network connectivity issues
- Twitch API may be down temporarily

## Configuration Options

### Environment Variables
```env
# Required for Twitch functionality
TWITCH_USERNAME=your_bot_username
TWITCH_OAUTH_TOKEN=oauth:your_token

# Channel configuration
TWITCH_CHANNELS=channel1,channel2,channel3

# Optional: Custom user agent
USER_AGENT=MyBot/1.0.0 (myemail@example.com)
```

### Customizing Rate Limits
In `twitch-bot.js`, you can modify:
```javascript
const rateLimitWindow = 60000; // 1 minute
const maxCommands = 5; // Max commands per window
const cooldownTime = 3000; // 3 seconds between commands
```

## Health Monitoring

The bot includes health check endpoints that show Twitch status:

**GET /** or **GET /health**
```json
{
  "status": "running",
  "discord": {
    "bot": "RustyBot#1234",
    "guilds": 5
  },
  "twitch": {
    "connected": true,
    "enabled": true
  },
  "uptime": 3600,
  "timestamp": "2025-01-01T12:00:00.000Z"
}
```

## Advanced Features

### Command Aliases
Multiple command names for the same function:
- `!market` = `!price`
- `!build` = `!manufacture`
- `!info` = `!item`
- `!help` = `!commands`

### Smart Quantity Parsing
The bot automatically detects quantity in various formats:
- `!market Tritanium x1000000`
- `!market PLEX 100`
- `!price "Condor" x5`

### Cross-Platform Caching
Market data and item lookups are cached and shared between Discord and Twitch for better performance.

## Best Practices

### For Streamers
1. Give the bot moderator status for better rate limits
2. Pin commands in chat or create a `!commands` panel
3. Consider creating custom Twitch panels explaining the bot

### For Bot Operators
1. Monitor console logs for errors
2. Keep OAuth tokens secure and regenerate periodically
3. Test commands in a private channel before going live
4. Consider separate bot accounts for different channels

### Chat Integration
- Use the bot for interactive market analysis during streams
- Great for EVE Online corporation/alliance Discord integration
- Useful for answer market questions during gameplay

## Support

For Twitch-specific issues:
1. Check the console logs for connection errors
2. Verify all environment variables are set correctly
3. Test with a single channel first before adding multiple
4. Create an issue on GitHub with Twitch logs if problems persist

## Example .env File

```env
# Discord Configuration
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_application_id

# Twitch Configuration
TWITCH_USERNAME=rustybot_eve
TWITCH_OAUTH_TOKEN=oauth:your_oauth_token_here
TWITCH_CHANNELS=your_channel,another_channel

# General Configuration
PORT=8080
USER_AGENT=RustyBot/1.0.0 (your@email.com)
```

This setup will run RustyBot on both Discord and Twitch simultaneously!