# RustyBot Twitch Integration Deployment Checklist

## Pre-Deployment Setup

### 1. Twitch Bot Account Setup
- [ ] Create dedicated Twitch account for the bot
- [ ] Verify account with phone number
- [ ] Choose a recognizable username (e.g., `rustybot_eve`, `your_bot_name`)

### 2. OAuth Token Generation
- [ ] Go to https://twitchapps.com/tmi/
- [ ] Login with bot account
- [ ] Copy OAuth token (starts with `oauth:`)
- [ ] Store token securely

### 3. Environment Configuration
- [ ] Copy `.env.template` to `.env`
- [ ] Fill in `TWITCH_USERNAME` with bot account username
- [ ] Fill in `TWITCH_OAUTH_TOKEN` with OAuth token
- [ ] Set `TWITCH_CHANNELS` with target channels (comma-separated)
- [ ] Verify Discord tokens are still present if using both platforms

### 4. Local Testing
- [ ] Run `npm install` to install dependencies
- [ ] Run `npm start` to test locally
- [ ] Verify both Discord and Twitch connections in console
- [ ] Test commands in a private Twitch channel
- [ ] Check health endpoint at `http://localhost:8080/health`

## Deployment Steps

### For Render.com Deployment

#### Environment Variables Setup
- [ ] Add `TWITCH_USERNAME` to Render environment variables
- [ ] Add `TWITCH_OAUTH_TOKEN` to Render environment variables
- [ ] Add `TWITCH_CHANNELS` to Render environment variables
- [ ] Verify existing Discord variables are present

#### Deployment
- [ ] Push code to GitHub repository
- [ ] Trigger Render deployment
- [ ] Monitor deployment logs for Twitch connection success
- [ ] Check health endpoint for both Discord and Twitch status

### For Other Hosting Providers

#### Docker Deployment
- [ ] Update Dockerfile if needed (current one should work)
- [ ] Set environment variables in Docker run command or compose file
- [ ] Deploy container
- [ ] Monitor logs for connection status

#### VPS/Server Deployment
- [ ] Install Node.js 16+ on server
- [ ] Clone repository
- [ ] Run `npm install`
- [ ] Set up environment variables
- [ ] Use PM2 or similar for process management
- [ ] Set up reverse proxy if needed

## Post-Deployment Verification

### Connection Testing
- [ ] Check bot appears in configured Twitch channels
- [ ] Verify bot responds to `!help` command
- [ ] Test market command: `!market PLEX`
- [ ] Test info command: `!info Condor`
- [ ] Verify rate limiting works (test multiple rapid commands)

### Functionality Testing
- [ ] Market data commands work correctly
- [ ] LP store commands function properly
- [ ] Build commands return appropriate responses
- [ ] Error handling works (test with invalid item names)
- [ ] Message splitting works for long responses

### Performance Monitoring
- [ ] Monitor server resource usage
- [ ] Check API rate limits are respected
- [ ] Verify caching is working (faster subsequent requests)
- [ ] Monitor error logs for any issues

## Channel Setup (For Each Target Channel)

### Bot Permissions
- [ ] Add bot to channel (just needs to be in chat)
- [ ] Consider giving moderator status: `/mod your_bot_username`
- [ ] Test bot responds to commands

### Channel Integration
- [ ] Create Twitch panel explaining bot commands (optional)
- [ ] Add bot commands to channel rules/info (optional)
- [ ] Train moderators on bot functionality
- [ ] Set expectations for command usage

## Troubleshooting Common Issues

### Bot Not Connecting
- [ ] Verify `TWITCH_USERNAME` is exact match (case-sensitive)
- [ ] Check OAuth token includes `oauth:` prefix
- [ ] Ensure no extra spaces in environment variables
- [ ] Verify channels exist and are spelled correctly

### Bot Not Responding
- [ ] Check bot is actually in the channel
- [ ] Verify commands start with `!` prefix
- [ ] Test with `!help` command first
- [ ] Check console logs for errors
- [ ] Verify rate limits aren't blocking commands

### API Errors
- [ ] Check internet connectivity from server
- [ ] Verify EVE Online API endpoints are accessible
- [ ] Monitor for ESI (EVE API) maintenance windows
- [ ] Check server logs for specific error messages

### Performance Issues
- [ ] Monitor server CPU and memory usage
- [ ] Check for memory leaks in long-running processes
- [ ] Verify cache sizes aren't growing indefinitely
- [ ] Consider increasing rate limits if needed

## Monitoring and Maintenance

### Regular Checks
- [ ] Monitor health endpoint daily
- [ ] Check error logs weekly
- [ ] Verify OAuth token hasn't expired
- [ ] Test random commands monthly

### Updates and Maintenance
- [ ] Keep dependencies updated
- [ ] Monitor for new EVE Online API changes
- [ ] Update OAuth tokens as needed
- [ ] Backup environment configuration

### Scaling Considerations
- [ ] Monitor channel count vs performance
- [ ] Consider rate limit adjustments for more channels
- [ ] Plan for horizontal scaling if needed
- [ ] Monitor API usage quotas

## Security Checklist

### Token Security
- [ ] OAuth tokens stored securely (not in code)
- [ ] Environment variables not exposed in logs
- [ ] Regular token rotation schedule
- [ ] Secure backup of configuration

### Bot Account Security
- [ ] Two-factor authentication enabled on bot account
- [ ] Strong password for bot account
- [ ] Regular security checkups
- [ ] Monitor for unauthorized access

## Success Metrics

### Technical Metrics
- [ ] 99%+ uptime for both Discord and Twitch
- [ ] Sub-3 second response time for market commands
- [ ] Zero rate limit violations
- [ ] Clean error logs

### User Engagement
- [ ] Commands used regularly in channels
- [ ] Positive feedback from streamers/viewers
- [ ] No spam complaints
- [ ] Growing usage over time

## Rollback Plan

### If Issues Arise
- [ ] Disable Twitch bot by removing environment variables
- [ ] Keep Discord functionality intact
- [ ] Investigate issues in development environment
- [ ] Re-enable after fixes are verified

### Emergency Contacts
- [ ] Discord for community support
- [ ] GitHub issues for bug reports
- [ ] Hosting provider support if deployment issues

## Documentation Updates

### After Successful Deployment
- [ ] Update README with live Twitch channels
- [ ] Document any custom configuration
- [ ] Share setup guide with other users
- [ ] Update any screenshots or examples

This checklist ensures a smooth deployment and ongoing operation of RustyBot's Twitch integration!