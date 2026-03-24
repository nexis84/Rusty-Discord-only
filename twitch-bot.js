/**
 * Twitch Bot Integration for RustyBot
 * Provides EVE Online market data and tools through Twitch chat
 * Based on working Python TwitchIO implementation with OAuth app credentials
 */

import tmi from 'tmi.js';
import irc from 'irc';
import net from 'net';
import axios from 'axios';
import { 
    fetchMarketDataForTwitch, 
    getEnhancedItemTypeID, 
    fetchBlueprintCostForTwitch, 
    fetchLpOfferForTwitch, 
    getItemInfoForTwitch 
} from './twitch-utils.js';
import { 
    TWITCH_CONFIG, 
    shouldRespondInChannel, 
    getCommandPrefix, 
    getCooldown, 
    isCommandAllowed 
} from './twitch-channels.js';
import { ga4, trackPerformance } from './google-analytics.js';
import { gatecheckClient } from './gatecheck.js';

export class TwitchBot {
    constructor() {
        this.client = null;
        this.ircClient = null; // IRC fallback client
        this.isConnected = false;
        this.ircConnected = false;
        this.useIrcFallback = false;
        this.cooldowns = new Map(); // Command cooldowns
        this.rateLimits = new Map(); // Rate limiting per user
        this.channels = []; // Store channels for IRC fallback
        
        // OAuth application credentials (required for proper Twitch API access like Python bot)
        this.clientId = null;
        this.clientSecret = null;
        this.botId = null;
        this.token = null;
        this.nick = null;
        this.targetChannel = null;
        
        // HTTP client for Twitch API calls (like Python bot's HTTP approach)
        this.httpClient = axios.create({
            timeout: 10000,
            headers: {
                'User-Agent': 'RustyBot/1.0'
            }
        });
    }

    /**
     * Initialize and connect the Twitch bot
     * Based on working Python TwitchIO implementation
     */
    async initialize() {
        // Validate required credentials (matching working Python bot requirements)
        if (!process.env.TWITCH_USERNAME || !process.env.TWITCH_OAUTH_TOKEN) {
            console.log('⚠️ Twitch credentials not provided. Twitch bot will not be enabled.');
            return false;
        }

        // Check for OAuth application credentials (CRITICAL - your Python bot has these)
        if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) {
            console.log('⚠️ Twitch OAuth application credentials missing. This may cause message sending issues.');
            console.log('   Required: TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET');
            console.log('   Get them from: https://dev.twitch.tv/console/apps');
            console.log('   Your working Python bot uses these for proper authentication!');
        }

        // Load channels from configuration file first, then fallback to environment
        let channels = TWITCH_CONFIG.channels.filter(ch => ch && ch.trim());
        
        // Fallback to environment variable if config file is empty
        if (channels.length === 0 && process.env.TWITCH_CHANNELS) {
            channels = process.env.TWITCH_CHANNELS.split(',').map(ch => ch.trim());
            console.log('📋 Using channels from environment variable (consider adding to twitch-channels.js)');
        }

        if (channels.length === 0) {
            console.log('⚠️ No Twitch channels specified in twitch-channels.js or TWITCH_CHANNELS env var.');
            console.log('   Edit twitch-channels.js to add channels the bot should join.');
            return false;
        }

        // Store configuration (matching Python bot approach)
        this.token = process.env.TWITCH_OAUTH_TOKEN.replace(/^oauth:/, '');
        this.nick = process.env.TWITCH_USERNAME;
        this.clientId = process.env.TWITCH_CLIENT_ID;
        this.clientSecret = process.env.TWITCH_CLIENT_SECRET;
        this.botId = process.env.TWITCH_BOT_ID;
        this.channels = channels;
        this.targetChannel = channels[0]; // Primary channel
        this.validatedUserId = null; // Store the actual user ID from token validation

        console.log(`🔧 Initializing TwitchBot (based on working Python implementation):`);
        console.log(`   Nick: ${this.nick}`);
        console.log(`   Channels: ${channels.join(', ')} (${channels.length} total)`);
        console.log(`   Primary Channel: ${this.targetChannel}`);
        console.log(`   Client ID: ${this.clientId ? this.clientId.substring(0, 8) + '...' : '❌ NOT PROVIDED'}`);
        console.log(`   Client Secret: ${this.clientSecret ? '✅ PROVIDED' : '❌ NOT PROVIDED'}`);
        console.log(`   Bot ID: ${this.botId || 'Not provided'}`);
        console.log(`   Token: ${this.token ? this.token.substring(0, 10) + '...' : 'Not provided'}`);
        console.log(`   Command Prefix: ${TWITCH_CONFIG.settings.commandPrefix}`);
        console.log(`   Auto Reconnect: ${TWITCH_CONFIG.settings.autoReconnect}`);

        // Set up HTTP headers for API calls (like Python bot)
        if (this.clientId && this.token) {
            this.httpClient.defaults.headers['Client-ID'] = this.clientId;
            this.httpClient.defaults.headers['Authorization'] = `Bearer ${this.token}`;
        }

        // Validate token before trying to connect (catch invalid/expired tokens early)
        try {
            const validation = await this.validateToken();
            if (!validation) {
                console.log('❌ Twitch OAuth token validation failed - TMI.js connect aborted.');
                console.log('   Tips: Ensure `TWITCH_OAUTH_TOKEN` is a user OAuth token (not an app token), has `chat:read` and `chat:edit` scopes, and matches `TWITCH_USERNAME`.');
                console.log('   Generate a chat token: https://twitchapps.com/tmi/ or follow TWITCH_SETUP.md');
                return false;
            }
            // If TWITCH_USERNAME is provided, ensure token belongs to that username
            if (process.env.TWITCH_USERNAME && validation.login && validation.login.toLowerCase() !== process.env.TWITCH_USERNAME.toLowerCase()) {
                console.log('❌ TWITCH_OAUTH_TOKEN belongs to a different user than TWITCH_USERNAME');
                console.log(`   Token login: ${validation.login}  TWITCH_USERNAME: ${process.env.TWITCH_USERNAME}`);
                console.log('   Update TWITCH_OAUTH_TOKEN or TWITCH_USERNAME so they match. Aborting Twitch connection.');
                return false;
            }
        } catch (e) {
            console.error('❌ Error while validating token before connect:', e?.message || e);
            return false;
        }

        // Initialize TMI client with enhanced configuration (matching Python TwitchIO approach)
        this.client = new tmi.Client({
            options: { 
                debug: false, // Reduce log noise
                messagesLogLevel: "error", // Only show errors
                skipUpdatingEmotesets: true
            },
            connection: {
                reconnect: true,
                secure: true,
                timeout: 180000,
                reconnectDecay: 1.5,
                reconnectInterval: 1000,
                maxReconnectAttempts: 10,
                maxReconnectInverval: 30000
            },
            identity: {
                username: this.nick,
                password: `oauth:${this.token}`
            },
            channels: channels.map(ch => ch.startsWith('#') ? ch : `#${ch}`)
        });

        // Initialize IRC fallback client (matching Python bot approach)
        this.setupIrcFallback();

        this.setupEventHandlers();

        try {
            console.log(`🎮 Connecting TMI.js client with OAuth app credentials...`);
            await this.client.connect();
            this.isConnected = true;
            console.log(`🎮 Twitch bot connected to channels: ${channels.join(', ')}`);
            
            // Validate token and get user info (like Python bot does)
            if (this.clientId && this.token) {
                await this.validateToken();
            }
            
            // Test message sending capability with delay
            setTimeout(async () => {
                await this.testMessageSending();
            }, 5000);
            
            return true;
        } catch (error) {
            console.error('❌ Failed to connect TMI.js client:', error);
            console.log('🔄 Trying IRC fallback...');
            return this.connectIrcFallback();
        }
    }

    /**
     * Update token at runtime (for token manager)
     */
    async updateToken(newToken) {
        console.log('[TwitchBot] Updating token...');
        
        // Update stored token (strip oauth: prefix if present)
        this.token = newToken.replace(/^oauth:/, '');
        
        // Update HTTP client headers
        if (this.httpClient) {
            this.httpClient.defaults.headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        // Disconnect and reconnect TMI client with new token
        if (this.client && this.isConnected) {
            try {
                await this.client.disconnect();
                this.isConnected = false;
            } catch (err) {
                console.log('[TwitchBot] Disconnect error (may already be disconnected):', err.message);
            }
        }
        
        // Create new TMI client with updated token
        this.client = new tmi.Client({
            options: { 
                debug: false,
                messagesLogLevel: "error",
                skipUpdatingEmotesets: true
            },
            connection: {
                reconnect: true,
                secure: true,
                timeout: 180000,
                reconnectDecay: 1.5,
                reconnectInterval: 1000,
                maxReconnectAttempts: 10,
                maxReconnectInverval: 30000
            },
            identity: {
                username: this.nick,
                password: `oauth:${this.token}`
            },
            channels: this.channels.map(ch => ch.startsWith('#') ? ch : `#${ch}`)
        });
        
        // Re-setup event handlers
        this.setupEventHandlers();
        
        // Reconnect
        try {
            await this.client.connect();
            this.isConnected = true;
            console.log('[TwitchBot] Reconnected with new token');
        } catch (err) {
            console.error('[TwitchBot] Failed to reconnect with new token:', err);
            throw err;
        }
        
        // Update IRC fallback client if active
        if (this.ircClient && this.ircConnected) {
            try {
                this.ircClient.disconnect('Token updated');
                this.ircConnected = false;
                this.setupIrcFallback();
            } catch (err) {
                console.log('[TwitchBot] IRC fallback update error:', err.message);
            }
        }
    }

    /**
     * Validate OAuth token using Twitch API (like Python bot)
     * Returns validation data on success, or null on failure
     */
    async validateToken() {
        try {
            console.log('🔍 Validating OAuth token...');
            const response = await this.httpClient.get('https://id.twitch.tv/oauth2/validate', {
                headers: {
                    'Authorization': `OAuth ${this.token}`
                }
            });

            console.log('✅ Token validation successful:', {
                client_id: response.data.client_id,
                user_id: response.data.user_id,
                login: response.data.login,
                scopes: response.data.scopes
            });

            // Store the validated user ID for API calls
            this.validatedUserId = response.data.user_id;

            // Check if we have chat scopes
            const requiredScopes = ['chat:read', 'chat:edit'];
            const hasRequiredScopes = requiredScopes.every(scope =>
                response.data.scopes.includes(scope)
            );

            if (!hasRequiredScopes) {
                console.log('⚠️ Token missing required chat scopes:', requiredScopes);
                console.log('   Current scopes:', response.data.scopes);
                console.log('   This may cause message sending issues!');
            } else {
                console.log('✅ Token has required chat scopes');
            }

            return response.data;
        } catch (error) {
            console.error('❌ Token validation failed:', error.response?.data || error.message);
            console.log('   This may cause message sending issues!');
            return null;
        }
    }

    /**
     * Setup IRC fallback client (matching Python bot IRC implementation)
     */
    setupIrcFallback() {
        if (!this.token || !this.nick) return;

        console.log('🔧 Setting up IRC fallback client (matching Python bot)...');
        
        this.ircClient = new irc.Client('irc.chat.twitch.tv', this.nick, {
            port: 6667,
            secure: false,
            password: `oauth:${this.token}`,
            autoConnect: false,
            debug: false,
            showErrors: false,
            autoRejoin: false,
            autoRenick: false,
            nick: this.nick,
            userName: this.nick,
            realName: this.nick,
            messageSplit: 450,
            floodProtection: false,
            floodProtectionDelay: 0,
            sasl: false,
            stripColors: true,
            channelPrefixes: '#'
        });

        this.ircClient.addListener('registered', () => {
            console.log('🎮 IRC fallback client connected and registered');
            this.ircConnected = true;
            
            // Request Twitch-specific capabilities (matching Python bot)
            console.log('🔧 Requesting Twitch IRC capabilities...');
            this.ircClient.send('CAP', 'REQ', ':twitch.tv/membership');
            this.ircClient.send('CAP', 'REQ', ':twitch.tv/tags');
            this.ircClient.send('CAP', 'REQ', ':twitch.tv/commands');
            
            // Join channels
            setTimeout(() => {
                this.channels.forEach(channel => {
                    const cleanChannel = channel.replace(/^#+/, '');
                    console.log(`🎮 IRC joining channel: #${cleanChannel}`);
                    this.ircClient.join(`#${cleanChannel}`);
                });
            }, 1000);
        });

        this.ircClient.addListener('join', (channel, nick, message) => {
            if (nick.toLowerCase() === this.nick.toLowerCase()) {
                console.log(`🎮 IRC bot successfully joined: ${channel}`);
            }
        });

        this.ircClient.addListener('error', (error) => {
            // Ignore harmless errors
            if (error.command === 'err_unknowncommand' || error.rawCommand === '421') {
                return;
            }
            console.error('❌ IRC error:', error);
        });

        this.ircClient.addListener('message#', (from, to, message) => {
            if (from.toLowerCase() === this.nick.toLowerCase()) return;
            
            // Only log if it's a command (starts with prefix)
            const prefix = getCommandPrefix(to.replace('#', ''));
            if (message.startsWith(prefix)) {
                console.log(`[IRC] Command received: ${message} from ${from} in ${to}`);
            }
            const tags = { username: from };
            this.handleMessage(to, tags, message);
        });
    }

    /**
     * Connect IRC fallback (matching Python bot approach)
     */
    async connectIrcFallback() {
        return new Promise((resolve) => {
            if (!this.ircClient) {
                console.log('❌ IRC fallback not available');
                resolve(false);
                return;
            }

            console.log('🔄 Connecting IRC fallback...');
            this.useIrcFallback = true;
            
            const onRegistered = () => {
                console.log('✅ IRC fallback connected successfully');
                resolve(true);
            };
            
            this.ircClient.once('registered', onRegistered);
            this.ircClient.connect();

            // Timeout fallback
            setTimeout(() => {
                if (!this.ircConnected) {
                    console.log('❌ IRC fallback connection timeout');
                    resolve(false);
                }
            }, 10000);
        });
    }

    /**
     * Test message sending capability (matching Python bot approach)
     */
    async testMessageSending() {
        if (!this.isConnected && !this.ircConnected) {
            console.log('❌ No connection available for message test');
            return;
        }

        const testChannel = this.targetChannel;
        console.log(`🧪 Testing message send capability to #${testChannel}...`);
        
        // Try multiple approaches like the Python bot
        const testMessage = `Im back online, ready to kick bottom!`;
        
        // Method 1: Try TMI.js
        if (this.client && this.isConnected) {
            try {
                console.log('🧪 Testing TMI.js message sending...');
                await this.client.say(`#${testChannel}`, testMessage);
                console.log('✅ TMI.js message sent - waiting for confirmation...');
                
                // Wait a bit to see if we get a permission error
                await this.delay(2000);
                
                if (this.useIrcFallback) {
                    console.log('❌ TMI.js failed with permission error - trying fallbacks');
                    
                    // Make sure IRC fallback is connected
                    if (!this.ircConnected) {
                        console.log('🔄 Connecting IRC fallback...');
                        await this.connectIrcFallback();
                    }
                } else {
                    console.log('✅ TMI.js message sending works!');
                    return;
                }
            } catch (error) {
                console.error('❌ TMI.js message sending failed:', error);
                this.useIrcFallback = true;
            }
        }
        
        // Method 2: Try Twitch API first (might work better with your scopes)
        if (this.clientId && this.token) {
            try {
                console.log('🧪 Testing Twitch API message sending...');
                await this.sendMessageViaAPI(testChannel, testMessage);
                console.log('✅ Twitch API message sending works!');
                return;
            } catch (error) {
                console.error('❌ Twitch API message sending failed:', error.response?.data || error.message);
            }
        }
        
        // Method 3: Try IRC fallback
        if (this.ircClient && this.ircConnected) {
            try {
                console.log('🧪 Testing IRC fallback message sending...');
                this.ircClient.say(`#${testChannel}`, testMessage);
                console.log('✅ IRC fallback message sending works!');
                return;
            } catch (error) {
                console.error('❌ IRC fallback message sending failed:', error);
            }
        }
        
        console.log('❌ All message sending methods failed!');
    }

    /**
     * Send message via Twitch API (like Python bot HTTP approach)
     */
    async sendMessageViaAPI(channel, message) {
        if (!this.clientId || !this.token) {
            throw new Error('Missing OAuth app credentials for API calls');
        }
        
        // Get user ID for the channel
        const userResponse = await this.httpClient.get(`https://api.twitch.tv/helix/users?login=${channel}`);
        if (!userResponse.data.data.length) {
            throw new Error(`Channel ${channel} not found`);
        }
        
        const channelId = userResponse.data.data[0].id;
        
        // Use the validated user ID from token validation
        const botUserId = this.validatedUserId || this.botId;
        
        if (!botUserId) {
            throw new Error('Bot user ID not available - token validation may have failed');
        }
        
        console.log(`🔧 API Call: Channel ID: ${channelId}, Bot ID: ${botUserId}`);
        
        // Send message via API
        const response = await this.httpClient.post('https://api.twitch.tv/helix/chat/messages', {
            broadcaster_id: channelId,
            sender_id: botUserId,
            message: message
        });
        
        return response.data;
    }

    /**
     * Setup event handlers
     */
    setupEventHandlers() {
        this.client.on('connected', (addr, port) => {
            console.log(`🎮 TMI.js connected to ${addr}:${port}`);
        });

        this.client.on('disconnected', (reason) => {
            console.log(`🎮 TMI.js disconnected: ${reason}`);
            this.isConnected = false;
        });

        this.client.on('join', (channel, username, self) => {
            if (self) {
                console.log(`🎮 Bot joined channel: ${channel}`);
            }
        });

        this.client.on('message', (channel, tags, message, self) => {
            if (self) return;
            
            // Log ALL messages for debugging
            const prefix = getCommandPrefix(channel.replace('#', ''));
            console.log(`[TMI.js] Message: "${message}" from ${tags.username} in ${channel}`);
            
            if (message.startsWith(prefix)) {
                console.log(`[TMI.js] ✅ Command detected: ${message}`);
            }
            this.handleMessage(channel, tags, message);
        });

        this.client.on('messageFailed', (channel, reason) => {
            console.error(`[TMI.js] Message failed in ${channel}: ${reason}`);
            // If TMI.js fails, enable IRC fallback automatically
            if (reason.includes('permission') || reason.includes('no_permission')) {
                console.log('🔄 TMI.js permission denied - enabling IRC fallback automatically');
                this.useIrcFallback = true;
            }
        });

        // Listen for NOTICE messages that indicate permission issues
        this.client.on('notice', (channel, msgid, message) => {
            console.log(`[TMI.js] NOTICE - ${msgid}: ${message} in ${channel}`);
            if (msgid === 'no_permission' || message.includes("don't have permission")) {
                console.log('🔄 Permission denied detected - enabling IRC fallback');
                this.useIrcFallback = true;
            }
        });
    }

    /**
     * Handle incoming Twitch chat messages
     */
    async handleMessage(channel, tags, message) {
        const username = tags.username;
        const cleanChannel = channel.replace('#', '');
        
        // Check if bot should respond in this channel
        if (!shouldRespondInChannel(cleanChannel)) {
            return; // Silently ignore - no need to log every ignored message
        }
        
        const prefix = getCommandPrefix(cleanChannel);

        if (!message.startsWith(prefix)) {
            return; // Silently ignore non-commands
        }

        // Rate limiting check
        if (!this.checkRateLimit(username)) {
            return; // Silently ignore rate limited users
        }

        const args = message.slice(prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();
        
        console.log(`[TwitchBot] ${command} from ${username}`);

        // Check if command is allowed in this channel
        if (!isCommandAllowed(cleanChannel, command)) {
            return; // Silently ignore disallowed commands
        }

        // Command cooldown check
        const cooldownKey = `${command}:${channel}`;
        const now = Date.now();
        const cooldownTime = getCooldown(cleanChannel);

        if (this.cooldowns.has(cooldownKey)) {
            const expirationTime = this.cooldowns.get(cooldownKey) + cooldownTime;
            if (now < expirationTime) {
                // Silently ignore cooldown hits to reduce log noise
                return;
            }
        }

        this.cooldowns.set(cooldownKey, now);

        try {
            // Track command usage in Google Analytics
            await ga4.trackCommand(command, username, 'twitch', { 
                channel: cleanChannel,
                args_count: args.length 
            });
            
            await this.executeCommand(channel, username, command, args);
        } catch (error) {
            console.error(`[TwitchBot] Error executing ${command} for ${username}:`, error);
            
            // Track error in Google Analytics
            await ga4.trackError(error, `twitch_command_${command}`, username, 'twitch');
            
            await this.say(channel, `@${username} Sorry, an error occurred while processing your command.`);
        }
    }

    /**
     * Check rate limiting for users
     */
    checkRateLimit(username) {
        const now = Date.now();
        const rateLimitWindow = 60000; // 1 minute
        const maxCommands = 5;

        if (!this.rateLimits.has(username)) {
            this.rateLimits.set(username, []);
        }

        const userCommands = this.rateLimits.get(username);
        const recentCommands = userCommands.filter(time => now - time < rateLimitWindow);
        
        if (recentCommands.length >= maxCommands) {
            return false;
        }

        recentCommands.push(now);
        this.rateLimits.set(username, recentCommands);
        return true;
    }

    /**
     * Execute Twitch chat commands
     */
    async executeCommand(channel, username, command, args) {
        const mention = `@${username}`;
        
        switch (command) {
            case 'market':
            case 'price':
                await this.handleMarketCommand(channel, mention, args, username);
                break;

            case 'build':
            case 'manufacture':
                await this.handleBuildCommand(channel, mention, args);
                break;

            case 'lp':
                await this.handleLpCommand(channel, mention, args);
                break;

            case 'info':
            case 'item':
                await this.handleInfoCommand(channel, mention, args);
                break;

            case 'help':
            case 'commands':
                await this.handleHelpCommand(channel, mention);
                break;

            case 'test':
                await this.say(channel, `${mention} RustyBot is online and responding! 🤖`);
                break;

            case 'ping':
                await this.say(channel, `${mention} Pong! 🏓`);
                break;

            case 'rustybot':
                await this.handleAboutCommand(channel, mention);
                break;

            case 'lookup':
            case 'search':
                await this.handleLookupCommand(channel, mention, args);
                break;

            case 'route':
            case 'gatecheck':
                await this.handleRouteCommand(channel, mention, args, username);
                break;

            default:
                // Don't respond to unknown commands
                break;
        }
    }

    /**
     * Handle market price commands
     */
    async handleMarketCommand(channel, mention, args, username) {
        if (args.length === 0) {
            await this.say(channel, `${mention} Usage: !market <item name> [quantity] - Get market prices for EVE items`);
            return;
        }

        let itemName = args.join(' ').trim();
        let quantity = 1;

        // Parse quantity
        const quantityMatch = itemName.match(/^(.+?)\s*(?:x|×|\s)(\d+)$/i);
        if (quantityMatch) {
            itemName = quantityMatch[1].trim();
            quantity = parseInt(quantityMatch[2]);
        }

        try {
            const typeID = await trackPerformance(
                () => getEnhancedItemTypeID(itemName),
                'get_type_id',
                username,
                'twitch'
            );
            
            if (!typeID) {
                await ga4.trackCustomEvent('item_not_found', { item_name: itemName }, username, 'twitch');
                await this.say(channel, `${mention} Item "${itemName}" not found. Check your spelling?`);
                return;
            }

            const marketData = await trackPerformance(
                () => fetchMarketDataForTwitch(itemName, typeID, quantity),
                'fetch_market_data',
                username,
                'twitch'
            );
            
            // Track successful market data request
            await ga4.trackMarketData(itemName, typeID, quantity, username, 'twitch', 0);
            
            if (marketData) {
                if (marketData.length > 450) {
                    const parts = this.splitMessage(marketData, 450);
                    for (const part of parts) {
                        await this.say(channel, `${mention} ${part}`);
                        await this.delay(1000);
                    }
                } else {
                    await this.say(channel, `${mention} ${marketData}`);
                }
            } else {
                await ga4.trackCustomEvent('no_market_data', { item_name: itemName }, username, 'twitch');
                await this.say(channel, `${mention} No market data found for "${itemName}"`);
            }
        } catch (error) {
            console.error(`[TwitchBot] Error in handleMarketCommand:`, error);
            await ga4.trackError(error, 'market_command', username, 'twitch');
            await this.say(channel, `${mention} Error fetching market data for "${itemName}". Please try again later.`);
        }
    }

    /**
     * Handle build cost commands
     */
    async handleBuildCommand(channel, mention, args) {
        if (args.length === 0) {
            await this.say(channel, `${mention} Usage: !build <item name> - Get manufacturing costs for EVE items`);
            return;
        }

        const itemName = args.join(' ').trim();

        try {
            const buildData = await fetchBlueprintCostForTwitch(itemName);
            if (buildData) {
                await this.say(channel, `${mention} ${buildData}`);
            } else {
                await this.say(channel, `${mention} No manufacturing data found for "${itemName}". Try !info ${itemName} for more details.`);
            }
        } catch (error) {
            console.error('[TwitchBot] Build command error:', error);
            await this.say(channel, `${mention} Error fetching build data for "${itemName}"`);
        }
    }

    /**
     * Handle LP store commands
     */
    async handleLpCommand(channel, mention, args) {
        if (args.length < 3) {
            await this.say(channel, `${mention} Usage: !lp <corporation> | <item> - Get LP store offers`);
            return;
        }

        const fullArgs = args.join(' ');
        if (!fullArgs.includes('|')) {
            await this.say(channel, `${mention} Usage: !lp <corporation> | <item> - Example: !lp Sisters of EVE | Cybernetic Subprocessor`);
            return;
        }

        const parts = fullArgs.split('|').map(p => p.trim());
        const corpName = parts[0];
        const itemName = parts[1];

        if (!corpName || !itemName) {
            await this.say(channel, `${mention} Please specify both corporation and item name`);
            return;
        }

        try {
            const lpData = await fetchLpOfferForTwitch(corpName, itemName);
            if (lpData) {
                await this.say(channel, `${mention} ${lpData}`);
            } else {
                await this.say(channel, `${mention} No LP offer found for "${itemName}" in "${corpName}" store`);
            }
        } catch (error) {
            console.error('[TwitchBot] LP command error:', error);
            await this.say(channel, `${mention} Error fetching LP data`);
        }
    }

    /**
     * Handle item info commands
     */
    async handleInfoCommand(channel, mention, args) {
        if (args.length === 0) {
            await this.say(channel, `${mention} Usage: !info <item name> - Get information link for EVE items`);
            return;
        }

        const itemName = args.join(' ').trim();

        try {
            const infoData = await getItemInfoForTwitch(itemName);
            if (infoData) {
                await this.say(channel, `${mention} ${infoData}`);
            } else {
                await this.say(channel, `${mention} Item "${itemName}" not found`);
            }
        } catch (error) {
            console.error('[TwitchBot] Info command error:', error);
            await this.say(channel, `${mention} Error fetching item info`);
        }
    }

    /**
     * Handle help command
     */
    async handleHelpCommand(channel, mention) {
        const helpMessage = `${mention} RustyBot Commands: !market <item> [qty] - Market prices | !route <start> <end> - Check route for camps | !info <item> - Item info | Examples: !market PLEX, !route Jita Amarr`;
        
        await this.say(channel, helpMessage);
    }

    /**
     * Handle about command
     */
    async handleAboutCommand(channel, mention) {
        await this.say(channel, `${mention} RustyBot - EVE Online market data bot. Get real-time prices, manufacturing costs & LP store analysis. Type !help for commands.`);
    }

    /**
     * Handle lookup/search command for debugging item matching
     */
    async handleLookupCommand(channel, mention, args) {
        if (args.length === 0) {
            await this.say(channel, `${mention} Usage: !lookup <item name> - Debug item name matching`);
            return;
        }

        const itemName = args.join(' ').trim();
        
        try {
            const typeID = await getEnhancedItemTypeID(itemName);
            
            if (typeID) {
                await this.say(channel, `${mention} Found: "${itemName}" -> Type ID: ${typeID} | Use !market ${itemName} for prices`);
            } else {
                await this.say(channel, `${mention} Not found: "${itemName}" - Try a different spelling or check !help for examples`);
            }
        } catch (error) {
            console.error('[TwitchBot] Lookup command error:', error);
            await this.say(channel, `${mention} Error looking up "${itemName}"`);
        }
    }

    /**
     * Handle route checking command
     */
    async handleRouteCommand(channel, mention, args, username) {
        if (args.length < 2) {
            await this.say(channel, `${mention} Usage: !route <start> <end> [preference] - Check route for gate camps. Preferences: shortest, secure, insecure`);
            return;
        }

        let start, end, preference = 'shortest';
        
        // Parse command: !route Jita Amarr secure
        if (args.length === 2) {
            [start, end] = args;
        } else if (args.length >= 3) {
            // Last arg might be preference
            const lastArg = args[args.length - 1].toLowerCase();
            if (['shortest', 'secure', 'insecure'].includes(lastArg)) {
                preference = lastArg;
                end = args[args.length - 2];
                start = args.slice(0, args.length - 2).join(' ');
            } else {
                // All args are part of system names (e.g., "HED GP" "VFK-IV")
                const mid = Math.floor(args.length / 2);
                start = args.slice(0, mid).join(' ');
                end = args.slice(mid).join(' ');
            }
        }

        start = start.trim();
        end = end.trim();

        try {
            // Track route check usage
            await ga4.trackCustomEvent('route_check', {
                start: start,
                end: end,
                preference: preference
            }, username, 'twitch');

            // Notify user processing is starting
            await this.say(channel, `${mention} Checking route from ${start} to ${end}...`);

            // Resolve system IDs
            const startId = await gatecheckClient.getIdFromName(start);
            const endId = await gatecheckClient.getIdFromName(end);

            if (!startId) {
                await this.say(channel, `${mention} System "${start}" not found. Check spelling?`);
                return;
            }
            if (!endId) {
                await this.say(channel, `${mention} System "${end}" not found. Check spelling?`);
                return;
            }

            // Get route
            const routeIds = await gatecheckClient.getRoute(startId, endId, preference);

            if (!routeIds || routeIds.length === 0) {
                await this.say(channel, `${mention} No route found between ${start} and ${end}`);
                return;
            }

            // For Twitch, we'll only analyze a subset to avoid spam and timeouts
            const maxSystemsToCheck = Math.min(routeIds.length, 15);
            const systemsToCheck = routeIds.slice(0, maxSystemsToCheck);
            
            const analysis = await gatecheckClient.analyzeRoute(systemsToCheck);
            
            // Find dangerous systems
            const dangerous = analysis.filter(s => s.threatLevel !== 'safe');
            const totalJumps = routeIds.length;
            
            if (dangerous.length === 0) {
                await this.say(channel, `${mention} Route ${start} → ${end}: ${totalJumps} jumps, clear (last hour). Safe travels! ✓`);
            } else {
                const dangerList = dangerous.slice(0, 3).map(s => 
                    `${s.systemName}(${s.kills} kills)`
                ).join(', ');
                
                const warningEmoji = dangerous.some(s => s.threatLevel === 'extreme') ? '⚠️' : '⚠️';
                await this.say(channel, `${mention} Route ${start} → ${end}: ${totalJumps} jumps. ${warningEmoji} DANGER: ${dangerList}${dangerous.length > 3 ? ` +${dangerous.length - 3} more` : ''}`);
            }
            
            // Provide link for detailed info
            await this.delay(1000);
            const gatecheckUrl = `https://eve-gatecheck.space/eve/#Target:${encodeURIComponent(start)}:${encodeURIComponent(end)}:${preference}`;
            await this.say(channel, `${mention} Full route analysis: ${gatecheckUrl}`);

        } catch (error) {
            console.error('[TwitchBot] Route command error:', error);
            await ga4.trackError(error, 'route_command', username, 'twitch');
            await this.say(channel, `${mention} Error checking route. Try again later.`);
        }
    }

    /**
     * Split long messages into smaller parts
     */
    splitMessage(message, maxLength) {
        const parts = [];
        let current = '';

        const words = message.split(' ');
        for (const word of words) {
            if ((current + ' ' + word).length > maxLength) {
                if (current) parts.push(current);
                current = word;
            } else {
                current = current ? current + ' ' + word : word;
            }
        }

        if (current) parts.push(current);
        return parts;
    }

    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Send message using best available method (matching Python bot approach)
     */
    async say(channel, message) {
        const cleanChannel = channel.startsWith('#') ? channel : `#${channel}`;
        const cleanMessage = message.replace(/[^\x00-\x7F]/g, ""); // ASCII only
        
        // Add delay to be more human-like
        await this.delay(1000);
        
        // Method 1: Try TMI.js (primary) - unless we know it has permission issues
        if (this.client && this.isConnected && !this.useIrcFallback) {
            try {
                await this.client.say(cleanChannel, cleanMessage);
                
                // Wait briefly to see if we get a permission error
                await this.delay(500);
                
                if (!this.useIrcFallback) {
                    return { success: true, method: 'TMI.js' };
                } else {
                    console.log(`🔄 TMI.js permission error - switching to fallback`);
                }
            } catch (error) {
                console.error(`❌ TMI.js send failed:`, error);
                this.useIrcFallback = true;
            }
        }
        
        // Method 2: Try Twitch API (might work better with user:write:chat scope)
        if (this.clientId && this.token) {
            try {
                await this.sendMessageViaAPI(cleanChannel.replace('#', ''), cleanMessage);
                return { success: true, method: 'API' };
            } catch (error) {
                console.error(`❌ Twitch API send failed:`, error.response?.data || error.message);
            }
        }
        
        // Method 3: Try IRC fallback
        if (this.ircClient && this.ircConnected) {
            try {
                this.ircClient.say(cleanChannel, cleanMessage);
                return { success: true, method: 'IRC' };
            } catch (error) {
                console.error(`❌ IRC send failed:`, error);
            }
        }
        
        console.error(`❌ All message sending methods failed for: "${message}"`);
        return { success: false, method: 'none' };
    }

    /**
     * Disconnect the bot
     */
    async disconnect() {
        if (this.client && this.isConnected) {
            try {
                await this.client.disconnect();
                console.log('🎮 TMI.js client disconnected');
            } catch (error) {
                console.error('Error disconnecting TMI.js:', error);
            }
        }
        
        if (this.ircClient && this.ircConnected) {
            try {
                this.ircClient.disconnect('Bot shutting down');
                console.log('🎮 IRC client disconnected');
            } catch (error) {
                console.error('Error disconnecting IRC:', error);
            }
        }
        
        this.isConnected = false;
        this.ircConnected = false;
    }

    /**
     * Check if bot is connected
     */
    isReady() {
        return this.isConnected || this.ircConnected;
    }
}