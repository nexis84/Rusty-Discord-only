# Google Analytics 4 Setup Guide for RustyBot

## 🎯 What You'll Get

With GA4 integration, you'll track:
- **Command usage** - Which commands are most popular
- **User behavior** - Active users, retention, platform preferences  
- **Performance metrics** - API response times, error rates
- **Market data requests** - Most searched items, quantities
- **Real-time analytics** - Live usage dashboard

## 📊 Setup Steps

### 1. Create Google Analytics 4 Property

1. Go to [Google Analytics](https://analytics.google.com/)
2. Click **"Create Account"** or use existing account
3. Set up a **new GA4 property**:
   - Property name: "RustyBot Analytics"
   - Country: Your location
   - Currency: Your preference
4. **Skip** the "Business Information" (not required for bots)

### 2. Create Data Stream

1. In your GA4 property, go to **Admin** → **Data Streams**
2. Click **"Add stream"** → **"Web"**
3. Website settings:
   - **Website URL**: `https://your-bot-domain.com` (or use `https://localhost:8080`)
   - **Stream name**: "RustyBot Events"
4. Click **"Create stream"**

### 3. Get Your Credentials

**Measurement ID:**
1. In your new data stream, find **"Measurement ID"**
2. Copy the ID (looks like `G-ABC123DEF4`)

**API Secret:**
1. In the data stream, scroll down to **"Measurement Protocol API secrets"**
2. Click **"Create"**
3. Give it a nickname: "RustyBot API"
4. Click **"Create"** and copy the **secret value**

### 4. Configure Environment Variables

Add these to your `.env` file:

```bash
# Google Analytics 4
GA_MEASUREMENT_ID=G-ABC123DEF4
GA_API_SECRET=xYz789AbC_dEf456GhI
```

### 5. Install Dependencies

```bash
npm install
```

### 6. Test Analytics

Restart your bot and run some commands. Then check GA4:

1. Go to **Reports** → **Real-time** in GA4
2. Run commands like `!market PLEX` in your bot
3. You should see events appearing in real-time!

## 📈 What Gets Tracked

### Commands
- **Event**: `bot_command`
- **Parameters**: command name, platform (discord/twitch), user ID, channel

### Market Data Requests  
- **Event**: `market_data_request`
- **Parameters**: item name, type ID, quantity, response time

### Errors
- **Event**: `bot_error`
- **Parameters**: error message, context, platform

### Performance
- **Event**: `api_performance` 
- **Parameters**: API name, response time, success rate

### Custom Events
- Item not found
- No market data
- Session tracking

## 🔍 Key Reports to Watch

### 1. Real-time Overview
- **Reports** → **Real-time**
- See live command usage and active users

### 2. Events Report
- **Reports** → **Engagement** → **Events**
- Top commands, error rates, usage patterns

### 3. Custom Reports
- **Explore** → **Free Form**
- Create custom dashboards for:
  - Most popular EVE items
  - Platform comparison (Discord vs Twitch)
  - Peak usage times
  - User retention

### 4. Demographics
- **Reports** → **User** → **Demographics**
- Geographic distribution of users

## 🛡️ Privacy & Data

**What's Tracked:**
- ✅ Commands used
- ✅ Item names searched
- ✅ Performance metrics
- ✅ Error rates
- ✅ Platform usage (Discord/Twitch)

**What's NOT Tracked:**
- ❌ Real usernames (uses hashed IDs)
- ❌ Message content (only commands)
- ❌ Personal information
- ❌ IP addresses (handled by GA4)

**GDPR Compliance:**
- User IDs are anonymized using SHA-256 hashes
- No personally identifiable information is sent
- Data retention follows GA4 defaults (14 months)

## 🚀 Advanced Setup

### Custom Dimensions
Add these in GA4 for better insights:
1. **Admin** → **Custom Definitions** → **Custom Dimensions**
2. Add dimensions for:
   - `item_category` - Ship, Module, Resource, etc.
   - `command_success` - Track success rates
   - `user_type` - New vs returning users

### Goals & Conversions
Mark important events as conversions:
1. **Admin** → **Events** → **Mark as conversion**
2. Mark these events:
   - `market_data_request` (successful commands)
   - `session_start` (user engagement)

### Audience Segments
Create user segments:
- **High-value users** (>10 commands/day)
- **PLEX traders** (frequent PLEX queries)
- **Discord vs Twitch users**

## 🎯 Example Insights You'll Get

- "Most searched item this week: Tritanium (2,431 searches)"
- "Discord users search 3x more items than Twitch users"
- "Peak usage: 18:00-22:00 UTC (EVE primetime)"
- "Average response time: 847ms"
- "Error rate: 2.3% (mostly item not found)"
- "58% of users return within 7 days"

## 🔧 Troubleshooting

**No data showing up?**
1. Check `.env` file has correct GA_MEASUREMENT_ID and GA_API_SECRET
2. Verify GA4 property is active
3. Check bot console for GA4 errors
4. Test with Real-time reports (shows data immediately)

**Getting 400 errors?**
- Double-check your API secret
- Ensure Measurement ID format is correct (G-XXXXXXXXXX)

**Want to disable analytics?**
Remove or comment out the GA environment variables in `.env`

## 📊 Dashboard Examples

The bot now tracks everything you need to understand:
- **User engagement** - Who uses your bot and how often
- **Feature popularity** - Which commands are most valuable
- **Performance** - Where to optimize for better UX
- **Growth metrics** - How your bot community is growing

Your GA4 dashboard will become mission control for your EVE bot operations! 🚀