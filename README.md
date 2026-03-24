# RustyBot - EVE Online Discord & Twitch Market Bot

A multi-platform bot that provides real-time market data, manufacturing costs, loyalty point analysis, and route security checks for EVE Online on both Discord and Twitch.

**🚀 Live Repository**: https://github.com/nexis84/rustybot-discord-twitch

## Features

- **Multi-Platform Support**: Works on both Discord (slash commands) and Twitch (chat commands)
- **Market Data**: Get real-time prices from all major trade hubs (Jita, Amarr, Dodixie, Hek, Rens)
- **Route Security Checks**: Analyze routes for gate camps, bubbles, and smartbombs using live kill data
- **Manufacturing Costs**: Calculate build costs for craftable items
- **LP Store Analysis**: Analyze loyalty point store offers and profitability
- **Item Information**: Get detailed links and information for any EVE Online item
- **D-Scan Parser**: Parse and analyze directional scan results (Discord only)
- **Interactive Menus**: User-friendly dropdown menus and buttons (Discord only)
- **Rate Limiting**: Built-in cooldowns and rate limiting for both platforms
- **Multi-Channel Support**: Connect to multiple Twitch channels simultaneously
- **Auto-Deployment**: Automated deployment via GitHub Actions and Render

## Commands

### Discord Slash Commands
- `/market <item> [quantity]` - Get market prices across all trade hubs
- `/route <start> <end> [preference]` - Check route for gate camps and hazards (shortest/secure/insecure)
- `/build <item>` - Calculate manufacturing costs (Work in progress)
- `/lp <corporation> [item]` - Browse LP store offers or get specific item costs
- `/info <item>` - Get detailed information links
- `/dscan` - Open d-scan parser modal
- `/help` - Show all available commands

### Twitch Chat Commands
- `!market <item> [quantity]` - Get market prices
- `!route <start> <end> [preference]` - Check route for gate camps
- `!info <item>` - Get item information
- `!help` - Show available commands

### Text Commands (Legacy Discord)
- `!market <item>` - Alternative market command
- `!build <item>` - Alternative build command
- `!lp <corp> | <item>` - Alternative LP command
- `!info <item>` - Alternative info command
