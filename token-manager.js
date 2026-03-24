import axios from 'axios';

/**
 * Token manager: validates Twitch OAuth token periodically and attempts refresh or swap
 * - Checks every `TWITCH_TOKEN_CHECK_MS` (default 5 minutes)
 * - If process.env.TWITCH_OAUTH_TOKEN changes, updates the running bot
 * - If token is expired and TWITCH_REFRESH_TOKEN + client creds are present, attempts refresh
 * - Note: Render environment variables are not mutable from the runtime; refreshed tokens
 *   are set on process.env for the running process but you'll still want to update Render
 *   environment variables (TWITCH_OAUTH_TOKEN and TWITCH_REFRESH_TOKEN) to persist.
 * - Updated: 2025-10-19 (force redeploy)
 */

export function startTokenManager(twitchBot, options = {}) {
    const intervalMs = parseInt(process.env.TWITCH_TOKEN_CHECK_MS || options.intervalMs || (5 * 60 * 1000), 10);

    // Track last persisted token to avoid unnecessary Render updates
    let lastPersistedAccessToken = null;
    let lastPersistedRefreshToken = null;

    async function getEnvToken() {
        const raw = process.env.TWITCH_OAUTH_TOKEN || '';
        return raw.replace(/^oauth:/, '');
    }

    async function validateToken(token) {
        if (!token) return null;
        try {
            const resp = await axios.get('https://id.twitch.tv/oauth2/validate', {
                headers: {
                    'Authorization': `OAuth ${token}`
                },
                timeout: 10000
            });
            return resp.data;
        } catch (err) {
            return null;
        }
    }

    async function refreshWithRefreshToken() {
        const clientId = twitchBot.clientId || process.env.TWITCH_CLIENT_ID;
        const clientSecret = twitchBot.clientSecret || process.env.TWITCH_CLIENT_SECRET;
        const refreshToken = process.env.TWITCH_REFRESH_TOKEN;

        if (!clientId || !clientSecret || !refreshToken) return null;

        try {
            const params = new URLSearchParams();
            params.append('grant_type', 'refresh_token');
            params.append('refresh_token', refreshToken);
            params.append('client_id', clientId);
            params.append('client_secret', clientSecret);

            const resp = await axios.post('https://id.twitch.tv/oauth2/token', params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 10000
            });

            // Twitch returns access_token and refresh_token
            if (resp.data && resp.data.access_token) {
                return { access_token: resp.data.access_token, refresh_token: resp.data.refresh_token };
            }
        } catch (err) {
            console.error('❌ Token refresh failed:', err.response?.data || err.message);
        }
        return null;
    }

    // --- Render persistence helpers ---
    function maskToken(t) {
        if (!t) return '';
        if (t.length <= 10) return '*****';
        return `${t.slice(0,6)}...${t.slice(-4)}`;
    }

    async function renderPersistEnvVars(newAccessToken, newRefreshToken) {
        const apiKey = process.env.RENDER_API_KEY;
        const serviceId = process.env.RENDER_SERVICE_ID;
        const persistEnabled = (process.env.RENDER_PERSIST || 'true').toLowerCase() === 'true';
        const dryRun = (process.env.RENDER_DRY_RUN || 'false').toLowerCase() === 'true';

        if (!persistEnabled) {
            console.log('ℹ️ Token refreshed in-memory only (Render persistence disabled)');
            console.log('   To enable: set RENDER_PERSIST=true, RENDER_API_KEY, and RENDER_SERVICE_ID');
            return false;
        }

        if (!apiKey || !serviceId) {
            console.log('⚠️ Render persistence enabled but missing RENDER_API_KEY or RENDER_SERVICE_ID');
            return false;
        }

        // Skip if token hasn't changed (avoid unnecessary redeploys)
        if (newAccessToken === lastPersistedAccessToken && 
            newRefreshToken === lastPersistedRefreshToken) {
            console.log('ℹ️ Token unchanged - skipping Render update to avoid redeploy');
            return true;
        }

        try {
            const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

            console.log('📥 Fetching current env-vars from Render...');
            const getResp = await axios.get(`https://api.render.com/v1/services/${serviceId}/env-vars`, { headers, timeout: 10000 });
            const current = Array.isArray(getResp.data) ? getResp.data : [];

            // Build a map of current env vars
            const updatedMap = {};
            current.forEach(e => { if (e && e.key) updatedMap[e.key] = e.value || ''; });

            // Overwrite with new values
            updatedMap['TWITCH_OAUTH_TOKEN'] = newAccessToken;
            if (newRefreshToken) updatedMap['TWITCH_REFRESH_TOKEN'] = newRefreshToken;

            // Convert back to array expected by Render API
            const envArray = Object.keys(updatedMap).map(k => ({ key: k, value: updatedMap[k] }));

            console.log(`🔁 Render persistence ${dryRun ? '(DRY RUN) ' : ''}will set TWITCH_OAUTH_TOKEN -> ${maskToken(newAccessToken)}, TWITCH_REFRESH_TOKEN -> ${newRefreshToken ? maskToken(newRefreshToken) : '(unchanged)'}
  total env vars to PUT: ${envArray.length}`);

            if (dryRun) return true;

            // Use PUT to replace the env-vars array for the service
            await axios.put(`https://api.render.com/v1/services/${serviceId}/env-vars`, envArray, { headers, timeout: 20000 });
            console.log('✅ Render env-vars updated (PUT). Render will trigger a deploy.');
            
            // Track what we persisted
            lastPersistedAccessToken = newAccessToken;
            lastPersistedRefreshToken = newRefreshToken;
            
            return true;
        } catch (err) {
            console.error('❌ Failed to persist env vars to Render:', err.response?.data || err.message);
            return false;
        }
    }

    async function checkOnce() {
        try {
            const envToken = await getEnvToken();
            const runningToken = twitchBot.token || '';

            // If environment token changed externally, prefer it immediately
            if (envToken && envToken !== runningToken) {
                console.log('🔁 Detected updated TWITCH_OAUTH_TOKEN in environment - updating running bot token');
                // If bot has already loaded channels (i.e. initialized), update runtime client.
                if (twitchBot.channels && twitchBot.channels.length > 0) {
                    await twitchBot.updateToken(envToken);
                } else {
                    // Bot not initialized yet: stash token into process.env and bot object for initialize()
                    process.env.TWITCH_OAUTH_TOKEN = envToken;
                    twitchBot.token = envToken.replace(/^oauth:/, '');
                }
                return;
            }

            // If no running token but env has one, load it (but avoid creating clients before initialization)
            if (!runningToken && envToken) {
                console.log('🔁 Loading TWITCH_OAUTH_TOKEN from environment into running bot');
                if (twitchBot.channels && twitchBot.channels.length > 0) {
                    await twitchBot.updateToken(envToken);
                } else {
                    process.env.TWITCH_OAUTH_TOKEN = envToken;
                    twitchBot.token = envToken.replace(/^oauth:/, '');
                }
                return;
            }

            // If we still don't have a token, nothing to validate
            if (!runningToken) {
                console.log('⚠️ No Twitch token available to validate');
                return;
            }

            // Validate running token
            const validation = await validateToken(runningToken);
            if (validation) {
                // Token is valid - check if it's expiring soon (within 1 hour)
                const expiresInSeconds = validation.expires_in || 0;
                const oneHourInSeconds = 60 * 60;
                
                if (expiresInSeconds < oneHourInSeconds) {
                    console.log(`⚠️ Token expires in ${expiresInSeconds} seconds (less than 1 hour) - refreshing proactively`);
                    
                    // Attempt refresh with refresh token
                    const refreshed = await refreshWithRefreshToken();
                    if (refreshed && refreshed.access_token) {
                        process.env.TWITCH_OAUTH_TOKEN = refreshed.access_token;
                        if (refreshed.refresh_token) process.env.TWITCH_REFRESH_TOKEN = refreshed.refresh_token;
                        console.log('✅ Token refreshed successfully (in-memory). Bot will continue running without restart.');

                        // Attempt to persist to Render if configured
                        try {
                            await renderPersistEnvVars(refreshed.access_token, refreshed.refresh_token);
                        } catch (e) {
                            console.error('❌ Render persistence attempt failed:', e.message || e);
                        }

                        // If bot already initialized, update runtime token; otherwise stash for initialize
                        if (twitchBot.channels && twitchBot.channels.length > 0) {
                            await twitchBot.updateToken(refreshed.access_token);
                        } else {
                            twitchBot.token = refreshed.access_token.replace(/^oauth:/, '');
                        }
                        return;
                    } else {
                        console.log('⚠️ Token expiring soon but refresh failed - will retry on next check');
                    }
                }
                
                // Token is valid. Ensure it belongs to expected username (if provided)
                const expectedLogin = process.env.TWITCH_USERNAME;
                if (expectedLogin) {
                    try {
                        const userResp = await axios.get(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(expectedLogin)}`, {
                            headers: {
                                'Client-ID': twitchBot.clientId || process.env.TWITCH_CLIENT_ID || '',
                                'Authorization': `Bearer ${runningToken}`
                            },
                            timeout: 10000
                        });

                        const expectedId = userResp.data?.data?.[0]?.id;
                        if (expectedId && validation.user_id !== expectedId) {
                            console.log('⚠️ Token is valid but for a different user than TWITCH_USERNAME');

                            // If env token changed since last check, swap to it
                            if (envToken && envToken !== runningToken) {
                                await twitchBot.updateToken(envToken);
                                return;
                            }

                            // Otherwise attempt refresh (if possible)
                            const refreshed = await refreshWithRefreshToken();
                            if (refreshed && refreshed.access_token) {
                                process.env.TWITCH_OAUTH_TOKEN = refreshed.access_token;
                                if (refreshed.refresh_token) process.env.TWITCH_REFRESH_TOKEN = refreshed.refresh_token;
                                console.log('✅ Token refreshed successfully (in-memory). Bot will continue running without restart.');

                                // Attempt to persist to Render if configured
                                try {
                                    await renderPersistEnvVars(refreshed.access_token, refreshed.refresh_token);
                                } catch (e) {
                                    console.error('❌ Render persistence attempt failed:', e.message || e);
                                }

                                await twitchBot.updateToken(refreshed.access_token);
                                return;
                            }

                            console.log('❌ Token belongs to a different user and no refresh path is available. Please update TWITCH_OAUTH_TOKEN in Render.');
                        }
                    } catch (err) {
                        console.log('⚠️ Could not verify token owner:', err.response?.data || err.message);
                    }
                }

                // Token is valid and either matches expected user or no expected user set
                // Check expiry again to log status
                const hoursRemaining = (expiresInSeconds / 3600).toFixed(1);
                console.log(`✅ Twitch token is valid (expires in ${hoursRemaining} hours)`);
                return;
            }

            // Validation failed - token likely expired or invalid
            console.log('❌ Twitch token invalid or expired');

            // First, try to see if environment has a different token we can use
            if (envToken && envToken !== runningToken) {
                console.log('🔁 Found a different TWITCH_OAUTH_TOKEN in environment - switching to it');
                await twitchBot.updateToken(envToken);
                return;
            }

            // Attempt refresh with refresh token (if available)
            const refreshed = await refreshWithRefreshToken();
            if (refreshed && refreshed.access_token) {
                process.env.TWITCH_OAUTH_TOKEN = refreshed.access_token;
                if (refreshed.refresh_token) process.env.TWITCH_REFRESH_TOKEN = refreshed.refresh_token;
                console.log('✅ Token refreshed successfully (in-memory). Bot will continue running without restart.');

                // Attempt to persist to Render if configured
                try {
                    await renderPersistEnvVars(refreshed.access_token, refreshed.refresh_token);
                } catch (e) {
                    console.error('❌ Render persistence attempt failed:', e.message || e);
                }

                if (twitchBot.channels && twitchBot.channels.length > 0) {
                    await twitchBot.updateToken(refreshed.access_token);
                } else {
                    twitchBot.token = refreshed.access_token.replace(/^oauth:/, '');
                }
                return;
            }

            console.log('❌ No refresh token or refresh failed. Please update TWITCH_OAUTH_TOKEN (and optionally TWITCH_REFRESH_TOKEN) in Render.');
        } catch (err) {
            console.error('❌ Error during token check:', err.message || err);
        }
    }

    // Run an immediate check, then schedule
    let initialResolve, initialReject;
    const initialCheckPromise = new Promise((resolve, reject) => { initialResolve = resolve; initialReject = reject; });

    (async () => {
        try {
            await checkOnce();
            initialResolve();
        } catch (err) {
            initialReject(err);
            console.error('Token manager initial check failed:', err);
        }
    })();

    const timer = setInterval(() => checkOnce().catch(err => console.error('Token manager check failed:', err)), intervalMs);

    return {
        stop: () => clearInterval(timer),
        ready: initialCheckPromise
    };
}
