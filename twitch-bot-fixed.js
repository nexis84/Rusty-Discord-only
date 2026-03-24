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

        const channels = process.env.TWITCH_CHANNELS ? 
            process.env.TWITCH_CHANNELS.split(',').map(ch => ch.trim()) : 
            [];

        if (channels.length === 0) {
            console.log('⚠️ No Twitch channels specified. Twitch bot will not be enabled.');
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

        console.log(`🔧 Initializing TwitchBot (based on working Python implementation):`);
        console.log(`   Nick: ${this.nick}`);
        console.log(`   Channel: ${this.targetChannel}`);
        console.log(`   Client ID: ${this.clientId ? this.clientId.substring(0, 8) + '...' : '❌ NOT PROVIDED'}`);
        console.log(`   Client Secret: ${this.clientSecret ? '✅ PROVIDED' : '❌ NOT PROVIDED'}`);
        console.log(`   Bot ID: ${this.botId || 'Not provided'}`);
        console.log(`   Token: ${this.token ? this.token.substring(0, 10) + '...' : 'Not provided'}`);

        // Set up HTTP headers for API calls (like Python bot)
        if (this.clientId && this.token) {
            this.httpClient.defaults.headers['Client-ID'] = this.clientId;
            this.httpClient.defaults.headers['Authorization'] = `Bearer ${this.token}`;
        }

        // Initialize TMI client with enhanced configuration (matching Python TwitchIO approach)
        this.client = new tmi.Client({
            options: { 
                debug: true, // Enable debug for troubleshooting
                messagesLogLevel: "info",
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
     * Validate OAuth token using Twitch API (like Python bot)
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
                scopes: response.data.scopes
            });
            
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
            
        } catch (error) {
            console.error('❌ Token validation failed:', error.response?.data || error.message);
            console.log('   This may cause message sending issues!');
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
            
            console.log(`[IRC] Message received: ${message} from ${from} in ${to}`);
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
                console.log('✅ TMI.js message sending works!');
                return;
            } catch (error) {
                console.error('❌ TMI.js message sending failed:', error);
            }
        }
        
        // Method 2: Try IRC fallback
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
        
        // Method 3: Try Twitch API (if we have app credentials)
        if (this.clientId && this.token) {
            try {
                console.log('🧪 Testing Twitch API message sending...');
                await this.sendMessageViaAPI(testChannel, testMessage);
                console.log('✅ Twitch API message sending works!');
                return;
            } catch (error) {
                console.error('❌ Twitch API message sending failed:', error);
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
        
        // Get bot user ID
        const botResponse = await this.httpClient.get(`https://api.twitch.tv/helix/users?login=${this.nick}`);
        if (!botResponse.data.data.length) {
            throw new Error(`Bot user ${this.nick} not found`);
        }
        
        const botId = botResponse.data.data[0].id;
        
        // Send message via API
        const response = await this.httpClient.post('https://api.twitch.tv/helix/chat/messages', {
            broadcaster_id: channelId,
            sender_id: botId,
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
            
            console.log(`[TMI.js] Message received: ${message} from ${tags.username} in ${channel}`);
            this.handleMessage(channel, tags, message);
        });

        this.client.on('messageFailed', (channel, reason) => {
            console.error(`[TMI.js] Message failed in ${channel}: ${reason}`);
        });
    }

    /**
     * Handle incoming Twitch chat messages
     */
    async handleMessage(channel, tags, message) {
        const username = tags.username;
        const prefix = '!';

        console.log(`[TwitchBot] Processing message: "${message}" from ${username}`);

        if (!message.startsWith(prefix)) {
            return;
        }

        // Rate limiting check
        if (!this.checkRateLimit(username)) {
            console.log(`[TwitchBot] Rate limited user: ${username}`);
            return;
        }

        const args = message.slice(prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        console.log(`[TwitchBot] Command: ${command}, Args: ${args.join(' ')}`);

        // Command cooldown check
        const cooldownKey = `${command}:${channel}`;
        const now = Date.now();
        const cooldownTime = 3000;

        if (this.cooldowns.has(cooldownKey)) {
            const expirationTime = this.cooldowns.get(cooldownKey) + cooldownTime;
            if (now < expirationTime) {
                console.log(`[TwitchBot] Command ${command} on cooldown`);
                return;
            }
        }

        this.cooldowns.set(cooldownKey, now);

        try {
            console.log(`[TwitchBot] Executing command: ${command}`);
            await this.executeCommand(channel, username, command, args);
        } catch (error) {
            console.error(`[TwitchBot] Error executing command ${command}:`, error);
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
                await this.handleMarketCommand(channel, mention, args);
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

            default:
                // Don't respond to unknown commands
                break;
        }
    }

    /**
     * Handle market price commands
     */
    async handleMarketCommand(channel, mention, args) {
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
            const typeID = await getEnhancedItemTypeID(itemName);
            if (!typeID) {
                await this.say(channel, `${mention} Item "${itemName}" not found. Check your spelling?`);
                return;
            }

            const marketData = await fetchMarketDataForTwitch(itemName, typeID, quantity);
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
                await this.say(channel, `${mention} No market data found for "${itemName}"`);
            }
        } catch (error) {
            console.error(`[TwitchBot] Error in handleMarketCommand:`, error);
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
        const helpMessages = [
            `${mention} RustyBot Commands: !market <item> [qty] - Market prices | !build <item> - Manufacturing costs`,
            `!lp <corp> | <item> - LP store offers | !info <item> - Item details | Examples: !market PLEX, !build Retriever`
        ];

        for (const msg of helpMessages) {
            await this.say(channel, msg);
            await this.delay(1000);
        }
    }

    /**
     * Handle about command
     */
    async handleAboutCommand(channel, mention) {
        await this.say(channel, `${mention} RustyBot - EVE Online market data bot. Get real-time prices, manufacturing costs & LP store analysis. Type !help for commands.`);
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
        console.log(`[TwitchBot] Attempting to send: "${message}" to ${channel}`);
        
        const cleanChannel = channel.startsWith('#') ? channel : `#${channel}`;
        const cleanMessage = message.replace(/[^\x00-\x7F]/g, ""); // ASCII only
        
        // Add delay to be more human-like
        await this.delay(1000);
        
        // Method 1: Try TMI.js (primary)
        if (this.client && this.isConnected) {
            try {
                console.log(`[TwitchBot] Using TMI.js to send message`);
                await this.client.say(cleanChannel, cleanMessage);
                console.log(`✅ TMI.js message sent successfully`);
                return { success: true, method: 'TMI.js' };
            } catch (error) {
                console.error(`❌ TMI.js send failed:`, error);
            }
        }
        
        // Method 2: Try IRC fallback
        if (this.ircClient && this.ircConnected) {
            try {
                console.log(`[TwitchBot] Using IRC fallback to send message`);
                this.ircClient.say(cleanChannel, cleanMessage);
                console.log(`✅ IRC fallback message sent`);
                return { success: true, method: 'IRC' };
            } catch (error) {
                console.error(`❌ IRC send failed:`, error);
            }
        }
        
        // Method 3: Try Twitch API (if credentials available)
        if (this.clientId && this.token) {
            try {
                console.log(`[TwitchBot] Using Twitch API to send message`);
                await this.sendMessageViaAPI(cleanChannel.replace('#', ''), cleanMessage);
                console.log(`✅ Twitch API message sent successfully`);
                return { success: true, method: 'API' };
            } catch (error) {
                console.error(`❌ Twitch API send failed:`, error);
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