# Deployment Checklist for RustyBot

## Pre-Deployment Checklist

### ✅ Code Preparation
- [ ] All environment variables documented in `.env.template`
- [ ] Dependencies updated and locked in `package-lock.json`
- [ ] No hardcoded secrets or tokens in code
- [ ] Error handling implemented for all API calls
- [ ] Graceful shutdown handlers implemented
- [ ] Health check endpoints functional
- [ ] Twitch integration tested and working

### ✅ GitHub Repository Setup
- [ ] Repository created and configured
- [ ] `.gitignore` properly excludes sensitive files
- [ ] README.md updated with deployment instructions
- [ ] All deployment documentation included
- [ ] Repository is public or deploy keys configured

### ✅ Environment Configuration
- [ ] `.env.template` file created with all required variables
- [ ] Production environment variables prepared
- [ ] Discord bot token obtained and tested
- [ ] Twitch OAuth token obtained (if using Twitch)
- [ ] All API endpoints tested

## GitHub Deployment Steps

### 1. Initialize Git Repository (if not already done)
```bash
git init
git add .
git commit -m "feat: Add Twitch integration to RustyBot"
```

### 2. Create GitHub Repository
1. Go to https://github.com/new
2. Repository name: `rustybot-discord-bot` (or your preferred name)
3. Description: "EVE Online Discord & Twitch Market Bot"
4. Set to Public (recommended for easier deployment)
5. **DO NOT** initialize with README (since you already have one)

### 3. Push to GitHub
```bash
git remote add origin https://github.com/nexis84/rustybot-discord-twitch.git
git branch -M main
git push -u origin main
```

## Render Deployment Steps

### 1. Render Account Setup
1. Go to https://render.com
2. Sign up or log in
3. Connect your GitHub account

### 2. Create New Web Service
1. Click "New" → "Web Service"
2. Connect your GitHub repository
3. Select the `rustybot-discord-bot` repository

### 3. Configure Web Service Settings
```
Name: rustybot-discord-bot
Region: Oregon (US West) or your preferred region
Branch: main
Runtime: Node
Build Command: npm install
Start Command: npm start
```

### 4. Environment Variables
Add these in the Render dashboard under "Environment":

**Required for Discord:**
```
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_application_id
```

**Optional for Twitch:**
```
TWITCH_USERNAME=your_twitch_bot_username
TWITCH_OAUTH_TOKEN=oauth:your_twitch_oauth_token
TWITCH_CHANNELS=channel1,channel2,channel3
```

**Additional Configuration:**
```
USER_AGENT=RustyBot/1.0.0 (your@email.com)
NODE_ENV=production
```

### 5. Deploy
1. Click "Create Web Service"
2. Wait for initial deployment (5-10 minutes)
3. Check logs for any errors
4. Test health endpoint: `https://your-app.onrender.com/health`

## Post-Deployment Verification

### ✅ Health Checks
- [ ] Service starts without errors
- [ ] Health endpoint returns 200 status
- [ ] Discord bot comes online
- [ ] Twitch bot connects (if configured)
- [ ] API calls work correctly

### ✅ Discord Testing
- [ ] Slash commands register properly
- [ ] `/market` command works
- [ ] `/help` command displays correctly
- [ ] Error handling works
- [ ] Rate limiting functions properly

### ✅ Twitch Testing (if enabled)
- [ ] Bot joins configured channels
- [ ] `!help` command works
- [ ] `!market` command returns data
- [ ] Rate limiting prevents spam
- [ ] Cooldowns function correctly

## Quick Reference

### Render Environment Variables Template
```
DISCORD_TOKEN=NDk3...
CLIENT_ID=497159...
TWITCH_USERNAME=your_bot_name
TWITCH_OAUTH_TOKEN=oauth:abc123...
TWITCH_CHANNELS=channel1,channel2
USER_AGENT=RustyBot/1.0.0 (you@email.com)
```

Remember to test thoroughly in a development environment before deploying to production!

### Discord Setup
- [ ] Discord application created
- [ ] Bot token obtained (`DISCORD_TOKEN`)
- [ ] Application ID copied (`CLIENT_ID`)
- [ ] Bot added to test server with proper permissions:
  - [ ] Send Messages
  - [ ] Use Slash Commands  
  - [ ] Embed Links
  - [ ] Read Message History

### Repository Setup
- [ ] GitHub repository created
- [ ] All files committed and pushed
- [ ] `.gitignore` includes `.env` and `node_modules`
- [ ] README.md updated with your information

## Deployment Steps ✅

### Render Deployment
- [ ] Render account created/logged in
- [ ] Repository connected to Render
- [ ] Web Service created with settings:
  - [ ] Build Command: `npm install`
  - [ ] Start Command: `npm start`
  - [ ] Environment: Node
- [ ] Environment variables added:
  - [ ] `DISCORD_TOKEN`
  - [ ] `CLIENT_ID`
  - [ ] `USER_AGENT`
- [ ] Service deployed successfully

### Alternative Platforms
- [ ] **Heroku**: App created, environment vars set, deployed
- [ ] **Railway**: Repository connected, vars configured
- [ ] **Docker**: Image built and tested

## Post-Deployment Testing ✅

### Basic Functionality
- [ ] Service is running (check health endpoint)
- [ ] Bot shows as online in Discord
- [ ] Slash commands are registered and visible
- [ ] `/help` command works
- [ ] `/market PLEX` returns market data
- [ ] `/info Tritanium` returns item link

### Advanced Features
- [ ] `/lp Sisters of EVE` opens LP store menu
- [ ] `/dscan` modal opens and works
- [ ] Interactive menus respond correctly
- [ ] Error handling works (try invalid item names)

### Performance
- [ ] Response times acceptable (<5 seconds)
- [ ] No memory leaks in logs
- [ ] API rate limits not exceeded
- [ ] Health check endpoint responds

## Monitoring Setup ✅

### Logs
- [ ] Deployment logs show no errors
- [ ] Bot startup logs appear clean
- [ ] API calls completing successfully
- [ ] No unhandled promise rejections

### Alerts (Optional)
- [ ] Uptime monitoring configured
- [ ] Error rate monitoring
- [ ] Discord webhook for critical alerts
- [ ] Log aggregation (if using multiple instances)

## Security Review ✅

### Environment
- [ ] No secrets in code repository
- [ ] Environment variables properly secured
- [ ] Bot token not exposed in logs
- [ ] User-Agent string configured

### Permissions
- [ ] Bot has minimal required permissions
- [ ] No administrator privileges unless needed
- [ ] Rate limiting enabled for API calls
- [ ] Input validation in place

## Documentation ✅

### User Documentation
- [ ] README.md complete and accurate
- [ ] QUICKSTART.md updated
- [ ] Command examples tested
- [ ] Links to support channels

### Developer Documentation
- [ ] DEPLOYMENT.md reflects current process
- [ ] Environment variables documented
- [ ] API endpoints documented
- [ ] Architecture notes updated

## Final Checks ✅

### Repository
- [ ] All branches merged to main
- [ ] Tags created for releases
- [ ] Issues/bugs documented
- [ ] Contributing guidelines clear

### Support
- [ ] Support channels configured
- [ ] Issue templates created
- [ ] Community guidelines posted
- [ ] Feedback collection method set up

---

## Emergency Rollback Plan 🚨

If deployment fails:

1. **Check logs** in Render dashboard
2. **Verify environment variables** are set correctly
3. **Test locally** with same environment
4. **Rollback to previous version** if needed:
   ```bash
   git revert <commit-hash>
   git push origin main
   ```
5. **Contact support** if platform issues

---

## Success Criteria ✅

Deployment is successful when:
- ✅ Bot responds to `/help` in Discord
- ✅ Market data commands return valid results  
- ✅ No errors in deployment logs
- ✅ Health check endpoint returns 200
- ✅ Interactive features work properly

**🎉 Deployment Complete!** 

Your EVE Online Discord market bot is now live and ready to serve capsuleers!