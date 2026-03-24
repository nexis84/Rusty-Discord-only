# Fix: Twitch Token Not Auto-Updating on Render

## Problem
The Twitch token is refreshing in-memory but not persisting to Render's environment variables, causing the bot to use an expired token after redeployment.

## Root Cause
The token manager requires these environment variables to persist tokens to Render:
- `RENDER_API_KEY` - API key to authenticate with Render
- `RENDER_SERVICE_ID` - Your Render service ID
- `RENDER_PERSIST` - Enable/disable persistence (optional, defaults to true)

**These are currently missing from your Render environment variables.**

## Solution

### Step 1: Get Your Render API Key

1. Go to your Render Dashboard: https://dashboard.render.com
2. Click on your account menu (top right) → "Account Settings"
3. Click "API Keys" in the left sidebar
4. Click "Create API Key"
5. Give it a name like "RustyBot Token Manager"
6. **Important**: Select the appropriate permissions:
   - For account-level key: Can update all services
   - For service-level key: Can only update specific service (more secure)
7. Copy the API key immediately (it won't be shown again!)

### Step 2: Get Your Render Service ID

Your service ID is visible in two ways:

**Method 1: From the URL**
- Go to your Render dashboard
- Click on your RustyBot service
- Look at the URL: `https://dashboard.render.com/web/srv-XXXXX`
- The `srv-XXXXX` part is your service ID

**Method 2: From the service settings**
- Go to your service settings
- The service ID is shown at the top

**Your service ID appears to be**: `srv-d2tovf6r433s73dkarfg` (from render_update_env_v2.js)

### Step 3: Add Environment Variables to Render

1. Go to your Render dashboard
2. Click on your RustyBot service
3. Go to "Environment" in the left sidebar
4. Add these three new environment variables:

```
Key: RENDER_API_KEY
Value: [paste your API key from Step 1]

Key: RENDER_SERVICE_ID
Value: srv-d2tovf6r433s73dkarfg

Key: RENDER_PERSIST
Value: true
```

5. Click "Save Changes"
6. Render will automatically redeploy your service

### Step 4: Verify It's Working

After the redeploy completes, check your logs:

**What you should see when token refreshes:**
```
⚠️ Token expires in XXX seconds (less than 1 hour) - refreshing proactively
✅ Token refreshed successfully (in-memory). Bot will continue running without restart.
📥 Fetching current env-vars from Render...
🔁 Render persistence will set TWITCH_OAUTH_TOKEN -> [masked], TWITCH_REFRESH_TOKEN -> [masked]
  total env vars to PUT: [number]
✅ Render env-vars updated (PUT). Render will trigger a deploy.
```

**What you currently see (persistence disabled):**
```
⚠️ Token expires in XXX seconds (less than 1 hour) - refreshing proactively
✅ Token refreshed successfully (in-memory). Bot will continue running without restart.
ℹ️ Token refreshed in-memory only (Render persistence disabled)
   To enable: set RENDER_PERSIST=true, RENDER_API_KEY, and RENDER_SERVICE_ID
```

## How It Works

The token manager automatically:
1. **Checks token every 5 minutes** (configurable via `TWITCH_TOKEN_CHECK_MS`)
2. **Validates the token** with Twitch API
3. **Refreshes proactively** when token expires in less than 1 hour
4. **Updates process.env** for the running bot instance
5. **Persists to Render** via API (if configured) so the refreshed token survives redeployments

## Important Notes

### Security
- The API key has full access to your Render account/service
- Never commit it to git or share it publicly
- Only add it as an environment variable in Render

### Redeployment Behavior
- When the token is updated on Render, it triggers a redeploy
- This is intentional to ensure the new token is loaded
- The bot will automatically reconnect after redeploy

### Token Expiration
- Twitch tokens typically expire after 4 hours
- The bot refreshes them proactively before expiration
- The refresh token is also updated when Twitch provides a new one

### Monitoring
- Watch your Render logs for token refresh messages
- If you see "⚠️ Render persistence enabled but missing RENDER_API_KEY or RENDER_SERVICE_ID", the variables aren't set correctly
- If you see "✅ Render env-vars updated", persistence is working!

## Troubleshooting

### "Failed to persist env vars to Render: Unauthorized"
- Check that your `RENDER_API_KEY` is correct
- Ensure the API key has proper permissions
- Try creating a new API key

### "Failed to persist env vars to Render: Not Found"
- Check that your `RENDER_SERVICE_ID` is correct
- Verify the service ID matches your actual service

### "Token unchanged - skipping Render update to avoid redeploy"
- This is normal! The bot avoids unnecessary redeployments
- It only updates Render when the token actually changes

### Token still expiring
- Check that `TWITCH_REFRESH_TOKEN` is set correctly
- Ensure `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` are set
- Verify the refresh token hasn't been revoked

## Alternative: Manual Token Updates

If you prefer not to enable automatic Render updates:

1. Set `RENDER_PERSIST=false` in Render
2. The bot will still refresh tokens in-memory (no restarts needed)
3. Manually update `TWITCH_OAUTH_TOKEN` and `TWITCH_REFRESH_TOKEN` in Render when you redeploy

## Testing

To test the token refresh manually:

1. SSH into your Render service (if available) or check logs
2. Look for token validation messages every 5 minutes
3. The token should automatically refresh when it expires in less than 1 hour

## Additional Resources

- Render API Documentation: https://render.com/docs/api
- Twitch OAuth Documentation: https://dev.twitch.tv/docs/authentication
- Token Manager Code: `token-manager.js` line 88-123

---

**Quick Summary**: Add `RENDER_API_KEY`, `RENDER_SERVICE_ID`, and `RENDER_PERSIST=true` to your Render environment variables, and the token will automatically update on Render when it refreshes.
