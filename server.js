import fs from 'fs/promises';
import dotenv from 'dotenv';
dotenv.config();

console.log("🚀 server.js loading...");
console.log("📋 Environment variables check:");
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
console.log(`   DISCORD_TOKEN exists: ${!!process.env.DISCORD_TOKEN}`);
console.log(`   DISCORD_CLIENT_ID exists: ${!!process.env.DISCORD_CLIENT_ID}`);

import pkg from 'web-streams-polyfill/dist/polyfill.js';
const { ReadableStream, WritableStream, TransformStream } = pkg;

import { TwitchBot } from './twitch-bot.js';
import { startTokenManager } from './token-manager.js';
import { MANUAL_TYPEID_MAPPINGS, getManualTypeID } from './manual-typeids.js';
import { ga4, trackPerformance } from './google-analytics.js';
import { GiveawayManager } from './giveaway-manager.js';
import { gatecheckClient } from './gatecheck.js';

if (!globalThis.ReadableStream) {

    globalThis.ReadableStream = ReadableStream;

} if (!globalThis.WritableStream) {

    globalThis.WritableStream = WritableStream;

}

if (!globalThis.TransformStream) {

    globalThis.TransformStream = TransformStream;

}

import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType } from 'discord.js';

import axios from 'axios';

import Bottleneck from 'bottleneck';

import express from 'express';



// Set up Express server for Cloud Run
const app = express();

// Basic middleware for production
app.use(express.json({ limit: '10mb' }));
app.disable('x-powered-by'); // Security: Hide Express server info

// Serve static files from public directory
app.use(express.static('public'));



// Set up rate limiter with Bottleneck

const limiter = new Bottleneck({

    minTime: 500, // 500ms between requests (2 requests per second), Fuzzwork recommended min is 1000ms

    maxConcurrent: 4 // how many requests at a time
});

// Set up rate limiter for external APIs (ESI, Fuzzwork, EveRef)
const apiLimiter = new Bottleneck({
    minTime: 500, // 500ms between external API requests (2 request per second)
    maxConcurrent: 1 // Only one external API request at a time
});



// Set up Discord bot client with AGGRESSIVE cloud-friendly settings for Render

const client = new Client({

    intents: [

        GatewayIntentBits.Guilds,

        GatewayIntentBits.GuildMessages,

        GatewayIntentBits.MessageContent,

    ],
    
    // EXTREME Render optimizations - try everything!
    ws: {
        large_threshold: 50,
        compress: false, // Disable compression for reliability
        handshakeTimeout: 600000, // 10 minutes - give it LOTS of time
        version: 10,
        properties: {
            os: 'linux',
            browser: 'discord.js',
            device: 'discord.js'
        }
    },
    
    // Aggressive REST settings
    rest: {
        timeout: 120000, // 2 minute timeout for API requests
        retries: 5, // More retries
        offset: 0,
        api: 'https://discord.com/api', // Explicit API endpoint
        api: 'https://discord.com/api'
    },
    
    // Render-specific settings
    failIfNotExists: false,
    presence: {
        status: 'online',
        activities: []
    }

});

// Add connection error handlers
client.on('error', error => {
    console.error('❌ Discord client error:', error);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error message:', error.message);
});

client.on('shardError', error => {
    console.error('❌ Discord websocket error:', error);
    console.error('❌ Shard error code:', error.code);
    console.error('❌ Shard error message:', error.message);
});

client.on('shardDisconnect', (event, id) => {
    console.warn(`⚠️ Discord shard ${id} disconnected`);
    console.warn(`⚠️ Close code: ${event.code}`);
    console.warn(`⚠️ Close reason: ${event.reason || 'No reason provided'}`);
    console.warn(`⚠️ Was clean: ${event.wasClean}`);
});

client.on('shardReconnecting', id => {
    console.log(`🔄 Discord shard ${id} reconnecting...`);
});

client.on('warn', warning => {
    console.warn('⚠️ Discord warning:', warning);
});

client.on('debug', info => {
    // Only log important debug info, not heartbeats
    if (info.includes('Heartbeat') === false && info.includes('Session Limit Information')) {
        console.log('🔍 Discord debug:', info);
    }
});



const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID; // Discord Application ID

// Debug: Log Discord credential status
console.log("🔍 Discord Credential Check:");
console.log(`   DISCORD_TOKEN: ${DISCORD_TOKEN ? '✅ PROVIDED (length: ' + DISCORD_TOKEN.length + ')' : '❌ MISSING'}`);
console.log(`   DISCORD_CLIENT_ID: ${CLIENT_ID ? '✅ PROVIDED (' + CLIENT_ID + ')' : '❌ MISSING'}`);

// Initialize Twitch Bot
const twitchBot = new TwitchBot();
// Start token manager early so it can refresh tokens before the bot attempts to connect
let tokenManagerHandle = null;
if (process.env.DISCORD_ONLY_MODE !== 'true') {
    tokenManagerHandle = startTokenManager(twitchBot);
    console.log(`🔄 Token manager started (initial check running)`);
} else {
    console.log(`⚪ DISCORD_ONLY_MODE enabled - skipping Token Manager initialization`);
}

// Initialize Giveaway Manager
const giveawayManager = new GiveawayManager();

// Discord connection retry logic
let discordRetryAttempt = 0;
const MAX_DISCORD_RETRIES = 3; // Back to 3 attempts with new strategy
const DISCORD_RETRY_DELAY = 20000; // 20 seconds between retries

// EXTREME timeout for Render - give it every chance to connect
const connectionTimeout = process.env.RENDER ? 180000 : 60000; // 180 sec (3 min) on Render

async function testDiscordAPI() {
    try {
        console.log('🔍 Testing Discord API connectivity...');
        const response = await axios.get('https://discord.com/api/v10/gateway/bot', {
            headers: {
                'Authorization': `Bot ${DISCORD_TOKEN}`
            },
            timeout: 30000
        });
        console.log('✅ Discord API reachable');
        console.log('📡 Gateway URL:', response.data.url);
        console.log('🔢 Recommended shards:', response.data.shards);
        console.log('📊 Session start limit:', response.data.session_start_limit);
        return response.data.url;
    } catch (error) {
        console.error('❌ Discord API test failed:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', error.response.data);
        }
        return null;
    }
}

async function connectDiscordWithRetry() {
    if (discordRetryAttempt >= MAX_DISCORD_RETRIES) {
        console.error("❌ Discord connection failed after", MAX_DISCORD_RETRIES, "attempts");
        console.log("🎮 Continuing with Twitch-only mode...");
        initializeTwitchBot();
        return;
    }
    
    discordRetryAttempt++;
    console.log(`🔵 Discord connection attempt ${discordRetryAttempt}/${MAX_DISCORD_RETRIES}...`);
    console.log("🔑 Token preview:", DISCORD_TOKEN.substring(0, 20) + "...");
    console.log("🔑 Token suffix:", "..." + DISCORD_TOKEN.substring(DISCORD_TOKEN.length - 10));
    console.log("🔑 Token length:", DISCORD_TOKEN.length);
    
    // NEW: Test API connectivity BEFORE trying WebSocket
    const gatewayUrl = await testDiscordAPI();
    if (!gatewayUrl) {
        console.error("❌ Cannot reach Discord API - network blocked or token invalid");
        if (discordRetryAttempt < MAX_DISCORD_RETRIES) {
            console.log(`🔄 Retrying in ${DISCORD_RETRY_DELAY / 1000} seconds...`);
            setTimeout(connectDiscordWithRetry, DISCORD_RETRY_DELAY);
        } else {
            console.error("❌ All Discord connection attempts failed");
            console.log("🎮 Initializing Twitch bot...");
            initializeTwitchBot();
        }
        return;
    }
    
    // Set a timeout to detect if login hangs
    const loginTimeout = setTimeout(() => {
        console.error(`⚠️ Discord login timeout (attempt ${discordRetryAttempt}/${MAX_DISCORD_RETRIES})`);
        console.error(`⚠️ No response after ${connectionTimeout / 1000} seconds`);
        console.error("⚠️ Discord API works but WebSocket connection is blocked");
        console.error("⚠️ This is a Render platform limitation");
        
        if (discordRetryAttempt < MAX_DISCORD_RETRIES) {
            console.log(`🔄 Retrying in ${DISCORD_RETRY_DELAY / 1000} seconds...`);
            setTimeout(connectDiscordWithRetry, DISCORD_RETRY_DELAY);
        } else {
            console.error("❌ All Discord connection attempts failed");
            console.log("🎮 Initializing Twitch bot...");
            initializeTwitchBot();
        }
    }, connectionTimeout);
    
    // Log in to Discord with your client's token
    try {
        console.log("🔌 Attempting WebSocket connection to Discord Gateway...");
        console.log(`🌐 Platform: ${process.env.RENDER ? 'Render' : 'Local'}`);
        console.log(`🌐 Node version: ${process.version}`);
        console.log(`🌐 Discord.js version: ${(await import('discord.js')).version}`);
        console.log(`⏱️ Connection timeout: ${connectionTimeout / 1000} seconds`);
        console.log(`⏱️ WebSocket handshake timeout: 600 seconds (10 min)`);
        console.log(`📡 Connecting to: ${gatewayUrl}`);
        
        let wsConnected = false;
        let wsReady = false;
        
        // Track WebSocket connection progress
        client.ws.on('debug', (info) => {
            // Log ALL connection events on Render for diagnostics
            if (process.env.RENDER || info.includes('heartbeat') === false) {
                console.log('[Discord WS Debug]', info);
            }
            if (info.includes('connect')) wsConnected = true;
        });
        
        client.ws.on('ready', () => {
            console.log('✅ [Discord WS] WebSocket READY - Connection successful!');
            wsReady = true;
        });
        
        client.ws.on('close', (code, reason) => {
            console.log(`⚠️ [Discord WS] Connection closed: Code ${code}, Reason: ${reason || 'No reason provided'}`);
            console.log(`   Was connected: ${wsConnected}, Was ready: ${wsReady}`);
        });
        
        client.ws.on('error', (error) => {
            console.error('❌ [Discord WS] WebSocket error:', error.message);
            console.error('   Error code:', error.code);
            console.error('   Was connected:', wsConnected);
        });
        
        // Add 'shardConnect' event to track initial connection
        client.on('shardConnect', (id) => {
            console.log(`✅ Shard ${id} connected to Discord Gateway!`);
        });
        
        console.log('🚀 Starting client.login()...');
        await client.login(DISCORD_TOKEN);
        clearTimeout(loginTimeout);
        console.log("✅ Discord login successful!");
    } catch (err) {
        clearTimeout(loginTimeout);
        console.error(`❌ Discord login error (attempt ${discordRetryAttempt}/${MAX_DISCORD_RETRIES}):`, err.message);
        console.error("❌ Error code:", err.code);
        console.error("❌ Error name:", err.name);
        console.error("❌ Full error:", err);
        
        // Check if it's a permanent error or temporary
        const permanentErrors = ['TOKEN_INVALID', 'DISALLOWED_INTENTS', 'TOKEN_MISSING'];
        if (permanentErrors.includes(err.code)) {
            console.error("❌ Permanent error detected - will not retry");
            console.log("🎮 Initializing Twitch bot...");
            initializeTwitchBot();
            return;
        }
        
        // Retry for temporary errors
        if (discordRetryAttempt < MAX_DISCORD_RETRIES) {
            console.log(`🔄 Retrying in ${DISCORD_RETRY_DELAY / 1000} seconds...`);
            setTimeout(connectDiscordWithRetry, DISCORD_RETRY_DELAY);
        } else {
            console.error("❌ All Discord connection attempts failed");
            console.log("🎮 Initializing Twitch bot...");
            initializeTwitchBot();
        }
    }
}

// Check if Discord credentials are provided
const hasDiscordCredentials = DISCORD_TOKEN && CLIENT_ID;

// Allow forcing Twitch-only or Discord-only mode via environment variable
const forceTwitchOnly = process.env.TWITCH_ONLY_MODE === 'true';
const forceDiscordOnly = process.env.DISCORD_ONLY_MODE === 'true';

console.log("🔍 Bot Mode check:");
console.log(`   hasDiscordCredentials: ${hasDiscordCredentials}`);
console.log(`   forceTwitchOnly: ${forceTwitchOnly}`);
console.log(`   forceDiscordOnly: ${forceDiscordOnly}`);
console.log(`   Will initialize Discord: ${!forceTwitchOnly && hasDiscordCredentials}`);
console.log(`   Will initialize Twitch: ${!forceDiscordOnly}`);

if (forceTwitchOnly) {
    console.log("⚪ TWITCH_ONLY_MODE enabled - skipping Discord initialization");
    console.log("🎮 Starting Twitch-only mode...");
    (async () => {
        if (tokenManagerHandle && tokenManagerHandle.ready) {
            try {
                await tokenManagerHandle.ready;
            } catch (e) {
                console.error('⚠️ Token manager initial check failed:', e);
            }
        }
        await initializeTwitchBot();
    })();
} else if (hasDiscordCredentials) {
    console.log("🔵 Discord credentials found - initializing Discord bot...");
    connectDiscordWithRetry();
} else {
    console.log("⚪ Discord credentials not provided - running in Twitch-only mode");
    console.log("💡 To enable Discord: Set DISCORD_TOKEN and DISCORD_CLIENT_ID environment variables");
}

// Define slash commands
const commands = [
    new SlashCommandBuilder()
        .setName('market')
        .setDescription('Get market data for an EVE Online item')
        .addStringOption(option =>
            option.setName('item')
                .setDescription('The name of the item to search for')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('quantity')
                .setDescription('Number of items to calculate total cost for (default: 1)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(1000000)),

    new SlashCommandBuilder()
        .setName('build')
        .setDescription('Calculate manufacturing costs for an item')
        .addStringOption(option =>
            option.setName('item')
                .setDescription('The name of the item to calculate build costs for')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('me')
                .setDescription('Blueprint Material Efficiency (0-10, default 0)')
                .setMinValue(0)
                .setMaxValue(10)
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('te')
                .setDescription('Blueprint Time Efficiency (0-20, default 0)')
                .setMinValue(0)
                .setMaxValue(20)
                .setRequired(false))
        .addStringOption(option =>
            option.setName('facility')
                .setDescription('Manufacturing Facility (default: Station)')
                .addChoices(
                    { name: 'NPC Station', value: 'Station' },
                    { name: 'Engineering Complex', value: 'Engineering Complex' }
                )
                .setRequired(false))
        .addStringOption(option =>
            option.setName('rigs')
                .setDescription('Facility Rigs (default: None)')
                .addChoices(
                    { name: 'None', value: 'None' },
                    { name: 'T1 Rigs', value: 'T1' },
                    { name: 'T2 Rigs', value: 'T2' }
                )
                .setRequired(false))
        .addStringOption(option =>
            option.setName('security')
                .setDescription('System Security Status (default: High-Sec)')
                .addChoices(
                    { name: 'High-Sec', value: 'High' },
                    { name: 'Low-Sec', value: 'Low' },
                    { name: 'Null-Sec / WH', value: 'Null' }
                )
                .setRequired(false))
        .addStringOption(option =>
            option.setName('implant')
                .setDescription('Beancounter Industry Implant (default: None)')
                .addChoices(
                    { name: 'None', value: '0' },
                    { name: '1% (BX-801)', value: '1' },
                    { name: '2% (BX-802)', value: '2' },
                    { name: '4% (BX-804)', value: '4' }
                )
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName('lp')
        .setDescription('Analyze LP store offers')
        .addStringOption(option =>
            option.setName('corporation')
                .setDescription('Select LP store corporation')
                .setRequired(true)
                .addChoices(
                    { name: 'Sisters of EVE', value: 'Sisters of EVE' },
                    { name: 'Federation Navy', value: 'Federation Navy' },
                    { name: 'Republic Fleet', value: 'Republic Fleet' },
                    { name: 'Imperial Navy', value: 'Imperial Navy' },
                    { name: 'Caldari Navy', value: 'Caldari Navy' },
                    { name: 'Concord', value: 'Concord' },
                    { name: 'Inner Zone Shipping', value: 'Inner Zone Shipping' },
                    { name: 'Ishukone Corporation', value: 'Ishukone Corporation' },
                    { name: 'Lai Dai Corporation', value: 'Lai Dai Corporation' },
                    { name: 'Hyasyoda Corporation', value: 'Hyasyoda Corporation' },
                    { name: 'ORE', value: 'ORE' },
                    { name: '24th Imperial Crusade', value: '24th Imperial Crusade' },
                    { name: 'Federal Defense Union', value: 'Federal Defense Union' },
                    { name: 'Tribal Liberation Force', value: 'Tribal Liberation Force' },
                    { name: 'State Protectorate', value: 'State Protectorate' }
                ))
        .addStringOption(option =>
            option.setName('item')
                .setDescription('The item name (optional: leave blank to list top offers)')
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName('info')
        .setDescription('Get information link for an EVE Online item')
        .addStringOption(option =>
            option.setName('item')
                .setDescription('The name of the item to get info for')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('dscan')
        .setDescription('Opens a form to parse a directional scan result.'),

    new SlashCommandBuilder()
        .setName('route')
        .setDescription('Check an EVE Online route for gate camps and hazards')
        .addStringOption(option =>
            option.setName('start')
                .setDescription('Starting solar system')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('end')
                .setDescription('Destination solar system')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('preference')
                .setDescription('Route preference (default: shortest)')
                .setRequired(false)
                .addChoices(
                    { name: 'Shortest', value: 'shortest' },
                    { name: 'Secure (High-Sec)', value: 'secure' },
                    { name: 'Insecure (Low-Sec/Null)', value: 'insecure' }
                )),

    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show available commands and how to use RustyBot'),

    new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Create a new giveaway')
        .addStringOption(option =>
            option.setName('prize')
                .setDescription('The prize for the giveaway')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('duration')
                .setDescription('Duration in minutes')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(10080))
        .addIntegerOption(option =>
            option.setName('winners')
                .setDescription('Number of winners (default: 1)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(20))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('Additional description or requirements')
                .setRequired(false))
        .addChannelOption(option =>
            option.setName('ign_channel')
                .setDescription('Channel to post winner IGNs (optional)')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(false)),

    new SlashCommandBuilder()
        .setName('giveaway-end')
        .setDescription('Manually end an active giveaway early')
        .addStringOption(option =>
            option.setName('giveaway_id')
                .setDescription('The giveaway ID to end')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('giveaway-list')
        .setDescription('List all active giveaways'),

    new SlashCommandBuilder()
        .setName('giveaway-reroll')
        .setDescription('Reroll a giveaway to pick new winners')
        .addStringOption(option =>
            option.setName('giveaway_id')
                .setDescription('The giveaway ID to reroll')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('giveaway-cancel')
        .setDescription('Cancel a giveaway without selecting winners')
        .addStringOption(option =>
            option.setName('giveaway_id')
                .setDescription('The giveaway ID to cancel')
                .setRequired(true)),

    new SlashCommandBuilder()
        .setName('sync')
        .setDescription('FOR ADMINS: Manually re-syncs the slash commands with Discord.')
        .setDefaultMemberPermissions(0)
];

// Register slash commands - only if Discord is enabled
const rest = hasDiscordCredentials ? new REST({ version: '10' }).setToken(DISCORD_TOKEN) : null;

async function deployCommands() {
    if (!hasDiscordCredentials) {
        console.log('⚪ Skipping Discord command deployment (Discord not enabled)');
        return;
    }

    try {
        console.log('Started refreshing application (/) commands.');
        console.log(`📝 Total commands to deploy: ${commands.length}`);
        console.log(`📋 Command names: ${commands.map(c => c.name).join(', ')}`);

        // If a GUILD_ID is provided in environment, register commands to that guild
        // (guild commands update instantly and are useful during development).
        const guildId = process.env.GUILD_ID;
        if (guildId) {
            await rest.put(
                Routes.applicationGuildCommands(CLIENT_ID, guildId),
                { body: commands.map(command => command.toJSON()) }
            );
            console.log(`Successfully reloaded guild (/) commands for guild ${guildId}.`);
        } else {
            await rest.put(
                Routes.applicationCommands(CLIENT_ID),
                { body: commands.map(command => command.toJSON()) }
            );
            console.log('Successfully reloaded global application (/) commands.');
        }
    } catch (error) {
        console.error('Error deploying commands:', error);
    }
}



client.on('clientReady', async () => {
    console.log(`🤖 Logged in as ${client.user.tag}!`);
    console.log(`📊 Serving ${client.guilds.cache.size} guilds`);
    console.log(`🔧 Deploying commands...`);
    await deployCommands();
    console.log(`✅ Discord bot is ready and operational!`);

    // Initialize Twitch bot after Discord is ready
    if (process.env.DISCORD_ONLY_MODE === 'true') {
        console.log("⚪ DISCORD_ONLY_MODE enabled - skipping Twitch initialization");
        return;
    }

    // Wait for token manager's initial check to complete (so tokens can be refreshed before connect)
    if (tokenManagerHandle && tokenManagerHandle.ready) {
        try {
            await tokenManagerHandle.ready;
        } catch (e) {
            console.error('⚠️ Token manager initial check failed:', e);
        }
    }
    await initializeTwitchBot();
});

// Function to initialize Twitch bot (can be called independently)
async function initializeTwitchBot() {
    try {
        console.log('🎮 Initializing Twitch bot...');
        console.log(`   Username: ${process.env.TWITCH_USERNAME || 'NOT SET'}`);
        console.log(`   Channels: ${process.env.TWITCH_CHANNELS || 'NOT SET'}`);
        console.log(`   OAuth Token: ${process.env.TWITCH_OAUTH_TOKEN ? '✅ PROVIDED (length: ' + process.env.TWITCH_OAUTH_TOKEN.length + ')' : '❌ NOT SET'}`);
        console.log(`   Client ID: ${process.env.TWITCH_CLIENT_ID ? '✅ PROVIDED' : '❌ NOT SET'}`);
        console.log(`   Client Secret: ${process.env.TWITCH_CLIENT_SECRET ? '✅ PROVIDED' : '❌ NOT SET'}`);
        
        const twitchConnected = await twitchBot.initialize();
        if (twitchConnected) {
            console.log(`✅ Twitch bot is ready and operational!`);
            // Token manager was started at process start; it will keep tokens refreshed.
        } else {
            console.log(`ℹ️ Twitch bot not enabled (missing credentials or channels)`);
        }
    } catch (error) {
        console.error(`❌ Failed to initialize Twitch bot:`, error);
        console.error(`❌ Error message:`, error.message);
        console.error(`❌ Error stack:`, error.stack);
    }
}

// If Discord is not enabled, initialize Twitch bot immediately
if (!hasDiscordCredentials) {
    if (process.env.DISCORD_ONLY_MODE === 'true') {
        console.log("⚪ Discord disabled AND DISCORD_ONLY_MODE set - nothing to start.");
    } else {
        console.log("🎮 Starting Twitch-only mode...");
        (async () => {
            if (tokenManagerHandle && tokenManagerHandle.ready) {
                try {
                    await tokenManagerHandle.ready;
                } catch (e) {
                    console.error('⚠️ Token manager initial check failed:', e);
                }
            }
            await initializeTwitchBot();
        })();
    }
}

// Set a default User Agent if one is not set in the environment variables.

const USER_AGENT = process.env.USER_AGENT || 'DiscordBot/1.0.0 (contact@example.com)';



// Cache for Type IDs

const typeIDCache = new Map();



// Function to fetch TypeID for an item name

async function getItemTypeID(itemName) {
    if (!itemName) {
        console.error(`Item name is invalid: "${itemName}"`);
        return null;
    }
    return getEnhancedItemTypeID(itemName);
}



// Region ID mappings for the four main trade hubs

const tradeHubRegions = {

    jita: 10000002,

    amarr: 10000043,

    dodixie: 10000032,

    hek: 10000042,

    rens: 10000030

};



// Function to fetch market data for an item with improved PLEX handling
async function fetchMarketDataImproved(itemName, typeID, channel, quantity = 1) {
    try {
        console.log(`[fetchMarketDataImproved] Start: Fetching market data for ${itemName} (TypeID: ${typeID}), Quantity: ${quantity}`);
        const isPlex = (typeID === PLEX_TYPE_ID);
        const targetRegionId = isPlex ? GLOBAL_PLEX_REGION_ID : JITA_REGION_ID;

        const sellOrdersURL = `https://esi.evetech.net/latest/markets/${targetRegionId}/orders/?datasource=tranquility&order_type=sell&type_id=${typeID}`;
        const buyOrdersURL = `https://esi.evetech.net/latest/markets/${targetRegionId}/orders/?datasource=tranquility&order_type=buy&type_id=${typeID}`;

        const [sellOrdersRes, buyOrdersRes] = await Promise.all([
            limiter.schedule(() => axios.get(sellOrdersURL, { headers: { 'User-Agent': USER_AGENT }, validateStatus: (s) => s >= 200 && s < 500, timeout: 7000 })),
            limiter.schedule(() => axios.get(buyOrdersURL, { headers: { 'User-Agent': USER_AGENT }, validateStatus: (s) => s >= 200 && s < 500, timeout: 7000 }))
        ]);

        if (sellOrdersRes.status !== 200) throw new Error(`ESI returned status ${sellOrdersRes.status} for sell orders.`);
        if (buyOrdersRes.status !== 200) throw new Error(`ESI returned status ${buyOrdersRes.status} for buy orders.`);

        const sellOrders = sellOrdersRes.data;
        const buyOrders = buyOrdersRes.data;

        let lowestSellOrder = null;
        let highestBuyOrder = null;

        if (isPlex) {
            // For PLEX, use global market data directly
            lowestSellOrder = sellOrders.length > 0 ? sellOrders.reduce((min, o) => (o.price < min.price ? o : min)) : null;
            highestBuyOrder = buyOrders.length > 0 ? buyOrders.reduce((max, o) => (o.price > max.price ? o : max)) : null;
        } else {
            // For other items, filter by Jita system
            const jitaSellOrders = sellOrders.filter(o => o.system_id === JITA_SYSTEM_ID);
            lowestSellOrder = jitaSellOrders.length > 0 ? jitaSellOrders.reduce((min, o) => (o.price < min.price ? o : min)) : null;
            const jitaBuyOrders = buyOrders.filter(o => o.system_id === JITA_SYSTEM_ID);
            highestBuyOrder = jitaBuyOrders.length > 0 ? jitaBuyOrders.reduce((max, o) => (o.price > max.price ? o : max)) : null;
        }

        let message = `${itemName}${quantity > 1 ? ` x${quantity}` : ''} - `;
        const formatIsk = (amount) => parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        if (lowestSellOrder) message += `${isPlex ? 'Global Sell' : 'Jita Sell'}: ${formatIsk(lowestSellOrder.price * quantity)} ISK`;
        else message += `${isPlex ? 'Global Sell' : 'Jita Sell'}: (None)`;

        if (highestBuyOrder) message += `, ${isPlex ? 'Global Buy' : 'Jita Buy'}: ${formatIsk(highestBuyOrder.price * quantity)} ISK`;
        else message += `, ${isPlex ? 'Global Buy' : 'Jita Buy'}: (None)`;

        if (!lowestSellOrder && !highestBuyOrder) {
            channel.send(`❌ No market data found for "${itemName}" in ${isPlex ? 'the global market' : 'Jita'}. ❌`);
        } else {
            channel.send(message);
        }

    } catch (error) {
        console.error(`[fetchMarketDataImproved] Error for "${itemName}":`, error.message);
        channel.send(`❌ Error fetching market data for "${itemName}". Please try again later. ❌`);
    }
}

// Function to fetch market data for an item in trade hubs (Improved with Embed)

async function fetchMarketDataTradeHubs(itemName, typeID, channel, quantity = 1) {
    const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`📊 Market Orders for "${itemName}"${quantity > 1 ? ` x${quantity}` : ''}`)
        .setDescription('Real-time market prices from major trade hubs')
        .setTimestamp();

    let hasData = false;

    for (const [regionName, regionID] of Object.entries(tradeHubRegions)) {
        try {
            const sellOrdersURL = `https://esi.evetech.net/latest/markets/${regionID}/orders/?datasource=tranquility&order_type=sell&type_id=${typeID}`;
            const buyOrdersURL = `https://esi.evetech.net/latest/markets/${regionID}/orders/?datasource=tranquility&order_type=buy&type_id=${typeID}`;

            const [sellOrdersRes, buyOrdersRes] = await Promise.all([
                limiter.schedule(() => axios.get(sellOrdersURL, { headers: { 'User-Agent': USER_AGENT }, validateStatus: status => status >= 200 && status < 500 })),
                limiter.schedule(() => axios.get(buyOrdersURL, { headers: { 'User-Agent': USER_AGENT }, validateStatus: status => status >= 200 && status < 500 }))
            ]);

            if (sellOrdersRes.status !== 200 || buyOrdersRes.status !== 200) {
                console.error(`[fetchMarketDataTradeHubs] Error fetching data for "${itemName}" in region ${regionName}`);
                continue;
            }

            const sellOrders = sellOrdersRes.data;
            const buyOrders = buyOrdersRes.data;

            let sellPrice = 'No Sell Orders';
            let buyPrice = 'No Buy Orders';

            if (Array.isArray(sellOrders) && sellOrders.length > 0) {
                const lowestSellOrder = sellOrders.reduce((min, order) => (order.price < min.price ? order : min), sellOrders[0]);
                sellPrice = parseFloat(lowestSellOrder.price * quantity).toLocaleString(undefined, { minimumFractionDigits: 2 });
            }

            if (Array.isArray(buyOrders) && buyOrders.length > 0) {
                const highestBuyOrder = buyOrders.reduce((max, order) => (order.price > max.price ? order : max), buyOrders[0]);
                buyPrice = parseFloat(highestBuyOrder.price * quantity).toLocaleString(undefined, { minimumFractionDigits: 2 });
            }

            // Only add field if there is actual data
            if (sellPrice !== 'No Sell Orders' || buyPrice !== 'No Buy Orders') {
                embed.addFields({ name: regionName.toUpperCase(), value: `Sell: ${sellPrice} ISK\nBuy: ${buyPrice} ISK`, inline: true });
                hasData = true;
            }
        } catch (error) {
            console.error(`[fetchMarketDataTradeHubs] Error fetching market data for "${itemName}" in ${regionName}:`, error?.message || error);
            // Optionally add a field to indicate an error for that region
            embed.addFields({ name: regionName.toUpperCase(), value: 'Error fetching data', inline: true });
        }
    }

    if (hasData) {
        try {
            await channel.send({ embeds: [embed] });
        } catch (sendError) {
            console.error('[fetchMarketDataTradeHubs] Error sending embed:', sendError);
            channel.send(`📊 Market Orders for "${itemName}" (summary):\n${embed.data.fields?.map(f => `**${f.name}**: ${f.value}`).join('\n')}`);
        }
    } else {
        channel.send(`❌ No market data found for "${itemName}" in any trade hubs. ❌`);
    }
}
// Handle interactions (buttons, select menus, and chat input commands)
client.on('interactionCreate', async interaction => {

    // --- Button Handler for D-Scan Copy ---
    if (interaction.isButton() && interaction.customId.startsWith('dscan_copy:')) {
        const sessionId = interaction.customId.split(':')[1];
        const rawText = activeDscanSessions.get(sessionId);

        if (rawText) {
            await interaction.reply({
                content: "Here is the raw text for you to copy and share:\n```\n" + rawText + "```",
                flags: 64
            });
        } else {
            await interaction.reply({
                content: "This d-scan session has expired. Please run the command again.",
                flags: 64
            });
        }
        return;
    }

    // --- Button Handler for Giveaway Entry ---
    if (interaction.isButton() && interaction.customId.startsWith('giveaway_enter:')) {
        const giveawayId = interaction.customId.split(':')[1];
        
        // Acknowledge interaction immediately to prevent timeout
        await interaction.deferReply({ flags: 64 });
        
        const giveaway = giveawayManager.getGiveaway(giveawayId);

        if (!giveaway) {
            return interaction.editReply({
                content: '❌ This giveaway no longer exists or has expired.'
            });
        }

        if (giveaway.status !== 'active') {
            return interaction.editReply({
                content: '❌ This giveaway has ended and is no longer accepting entries.'
            });
        }

        const added = giveawayManager.addParticipant(giveawayId, interaction.user.id);

        if (!added) {
            return interaction.editReply({
                content: '✅ You have already entered this giveaway! Good luck! 🍀'
            });
        }

        console.log(`[Giveaway] User ${interaction.user.id} entered, updating message...`);
        console.log(`[Giveaway] Total participants: ${giveawayManager.participants.get(giveawayId)?.size}`);

        // Update the giveaway message with new participant count
        try {
            const channel = await client.channels.fetch(giveaway.channelId);
            const message = await channel.messages.fetch(giveaway.messageId);
            const currentCount = giveawayManager.participants.get(giveawayId)?.size || 0;
            console.log(`[Giveaway] Fetched message ${message.id} in channel ${channel.name} - Current count: ${currentCount}`);

            const updatedEmbed = giveawayManager.createGiveawayEmbed(giveaway);
            const buttons = giveawayManager.createEntryButton(giveawayId);

            // Add timestamp to force Discord to refresh the embed
            updatedEmbed.setTimestamp(new Date());

            await message.edit({
                content: `🎉 **GIVEAWAY** 🎉 - ${currentCount} ${currentCount === 1 ? 'entry' : 'entries'}`,
                embeds: [updatedEmbed],
                components: [buttons]
            });
            console.log(`[Giveaway] Message updated successfully with new count: ${currentCount}`);
        } catch (error) {
            console.error('[Giveaway] Error updating message:', error.message);
            console.error('[Giveaway] Giveaway ID:', giveawayId);
            console.error('[Giveaway] Channel ID:', giveaway.channelId);
            console.error('[Giveaway] Message ID:', giveaway.messageId);
        }

        return interaction.editReply({
            content: '🎉 You have successfully entered the giveaway! Good luck! 🍀'
        });
    }

    // --- Button Handler for Giveaway Leave ---
    if (interaction.isButton() && interaction.customId.startsWith('giveaway_leave:')) {
        const giveawayId = interaction.customId.split(':')[1];
        
        // Acknowledge interaction immediately to prevent timeout
        await interaction.deferReply({ ephemeral: true });
        
        const giveaway = giveawayManager.getGiveaway(giveawayId);

        if (!giveaway) {
            return interaction.editReply({
                content: '❌ This giveaway no longer exists or has expired.'
            });
        }

        if (giveaway.status !== 'active') {
            return interaction.editReply({
                content: '❌ This giveaway has ended.'
            });
        }

        const removed = giveawayManager.removeParticipant(giveawayId, interaction.user.id);

        if (!removed) {
            return interaction.editReply({
                content: '❌ You are not entered in this giveaway.'
            });
        }

        console.log(`[Giveaway] User ${interaction.user.id} left, updating message...`);
        console.log(`[Giveaway] Total participants: ${giveawayManager.participants.get(giveawayId)?.size}`);

        // Update the giveaway message with new participant count
        try {
            const channel = await client.channels.fetch(giveaway.channelId);
            const message = await channel.messages.fetch(giveaway.messageId);
            const currentCount = giveawayManager.participants.get(giveawayId)?.size || 0;
            const updatedEmbed = giveawayManager.createGiveawayEmbed(giveaway);
            const buttons = giveawayManager.createEntryButton(giveawayId);

            // Add timestamp to force Discord to refresh the embed
            updatedEmbed.setTimestamp(new Date());

            await message.edit({
                content: `🎉 **GIVEAWAY** 🎉 - ${currentCount} ${currentCount === 1 ? 'entry' : 'entries'}`,
                embeds: [updatedEmbed],
                components: [buttons]
            });
            console.log(`[Giveaway] Message updated successfully with new count: ${currentCount}`);
        } catch (error) {
            console.error('[Giveaway] Error updating message:', error.message);
            console.error('[Giveaway] Giveaway ID:', giveawayId);
            console.error('[Giveaway] Channel ID:', giveaway.channelId);
            console.error('[Giveaway] Message ID:', giveaway.messageId);
        }

        return interaction.editReply({
            content: '👋 You have left the giveaway.'
        });
    }

    // --- Button Handler for IGN Modal ---
    if (interaction.isButton() && interaction.customId.startsWith('giveaway_ign_modal:')) {
        const parts = interaction.customId.split(':');
        const giveawayId = parts[1];
        const winnerId = parts[2];

        // Verify the user clicking is the winner
        if (interaction.user.id !== winnerId) {
            return interaction.reply({
                content: '❌ This button is only for the giveaway winner.',
                flags: 64
            });
        }

        const modal = giveawayManager.createIgnModal(giveawayId);
        await interaction.showModal(modal);
        return;
    }

    // --- Modal Handler for IGN Submission ---
    if (interaction.isModalSubmit() && interaction.customId.startsWith('giveaway_ign:')) {
        const giveawayId = interaction.customId.split(':')[1];
        const giveaway = giveawayManager.getGiveaway(giveawayId);
        const ign = interaction.fields.getTextInputValue('ign');

        if (!giveaway) {
            return interaction.reply({
                content: '❌ This giveaway no longer exists.',
                flags: 64
            });
        }

        await interaction.reply({
            content: `✅ Thank you! Your IGN has been recorded: **${ign}**\n\nThe giveaway host will contact you soon!`,
            flags: 64
        });

        console.log(`[Giveaway] IGN submitted for ${giveawayId}: ${ign} by ${interaction.user.id}`);
        console.log(`[Giveaway] IGN Channel ID: ${giveaway.ignChannelId || 'NOT SET'}`);

        // Lookup character via ESI to get portrait
        const characterData = await getEveCharacterInfo(ign);

        // Post to IGN channel if configured
        if (giveaway.ignChannelId) {
            try {
                console.log(`[Giveaway] Attempting to fetch channel: ${giveaway.ignChannelId}`);
                const ignChannel = await client.channels.fetch(giveaway.ignChannelId);
                console.log(`[Giveaway] Channel fetched: ${ignChannel.name}`);

                const ignEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('🎉 Giveaway Winner IGN Submitted')
                    .setDescription(`**Prize:** ${giveaway.prize}`)
                    .addFields(
                        { name: '👤 Discord Winner', value: `<@${interaction.user.id}>`, inline: true },
                        { name: '🎮 EVE Character', value: characterData ? `[${characterData.characterName}](https://evewho.com/character/${characterData.characterId})` : ign, inline: true }
                    )
                    .setFooter({ text: `Giveaway ID: ${giveawayId}` })
                    .setTimestamp();

                // Add character portrait if found
                if (characterData && characterData.portraitUrl) {
                    ignEmbed.setThumbnail(characterData.portraitUrl);
                    console.log(`[Giveaway] Added character portrait for ${characterData.characterName}`);
                }

                await ignChannel.send({ embeds: [ignEmbed] });
                console.log(`[Giveaway] IGN posted to channel successfully`);
            } catch (error) {
                console.error('[Giveaway] Error posting to IGN channel:', error);
            }
        } else {
            console.log(`[Giveaway] No IGN channel configured for this giveaway`);
        }

        // Notify giveaway creator
        try {
            const creator = await client.users.fetch(giveaway.creatorId);
            await creator.send({
                content: `🎉 A winner from your giveaway has submitted their IGN!\n\n**Prize:** ${giveaway.prize}\n**Winner:** <@${interaction.user.id}>\n**IGN:** ${ign}`
            });
        } catch (error) {
            console.error('[Giveaway] Error notifying creator:', error);
        }

        return;
    }

    // --- Modal Submission Handler for D-Scan ---
    if (interaction.isModalSubmit() && interaction.customId === 'dscanModal') {
        const dscanPaste = interaction.fields.getTextInputValue('dscanInput');
        await interaction.deferReply({ ephemeral: false });
        try {
            const result = await processDscan(dscanPaste);

            if (typeof result === 'string') {
                await interaction.editReply({ content: result, embeds: [], components: [] });
            } else {
                const sessionId = interaction.id; // Use the unique interaction ID as our session key
                activeDscanSessions.set(sessionId, result.rawText);
                // Remove the data from the cache after 5 minutes
                setTimeout(() => activeDscanSessions.delete(sessionId), 5 * 60 * 1000);

                const copyButton = new ButtonBuilder()
                    .setCustomId(`dscan_copy:${sessionId}`)
                    .setLabel('📋 Copy Raw Text')
                    .setStyle(ButtonStyle.Secondary);

                const row = new ActionRowBuilder().addComponents(copyButton);

                await interaction.editReply({
                    content: '',
                    embeds: [result.embed],
                    components: [row]
                });
            }
        } catch (error) {
            console.error("Error processing d-scan modal:", error);
            await interaction.editReply({ content: "❌ An error occurred while processing the d-scan.", embeds: [], components: [] });
        }
        return;
    }

    // --- Interaction Handlers for LP Store Components ---
    if (interaction.isButton() && interaction.customId.startsWith('lp_')) {
        const [action, sessionId] = interaction.customId.split(':');
        const sessionData = activeLpSessions.get(sessionId);

        if (!sessionData) {
            return interaction.update({ content: 'This interactive session has expired. Please run the command again.', components: [] });
        }

        if (action === 'lp_prev') {
            sessionData.currentPage = Math.max(0, sessionData.currentPage - 1);
        } else if (action === 'lp_next') {
            sessionData.currentPage = Math.min(Math.ceil(sessionData.offers.length / 25) - 1, sessionData.currentPage + 1);
        }

        const pageComponents = generateLpPageComponent(sessionId, sessionData);
        return interaction.update(pageComponents);
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('lp_select:')) {
        const [, sessionId] = interaction.customId.split(':');
        const sessionData = activeLpSessions.get(sessionId);

        if (!sessionData) {
            return interaction.update({ content: 'This interactive session has expired. Please run the command again.', components: [] });
        }

        await interaction.deferUpdate();
        const parts = interaction.values[0].split(':');
        const itemTypeID = parseInt(parts[0]);
        const offer = sessionData.offers.find(o => o.type_id === itemTypeID);

        if (offer) {
            const itemName = getTypeNameByID(offer.type_id);
            const mockChannel = {
                send: async (message) => {
                    await interaction.editReply({ content: message, components: [] });
                }
            };
            await calculateAndSendLpOfferCost(itemName, offer, mockChannel);
        } else {
            await interaction.editReply({ content: 'Error: Could not find the selected offer.', components: [] });
        }

        // Clean up the session
        activeLpSessions.delete(sessionId);
        return;
    }

    // --- Main Command Handler ---
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;
    
    // The 'route' command is now handled in JS via gatecheckClient!

    try {
        // CRITICAL: Defer reply FIRST to avoid 3-second timeout
        // Some commands should be ephemeral (only visible to user)
        const ephemeralCommands = ['giveaway-end', 'giveaway-list', 'giveaway-cancel', 'sync'];
        const isEphemeral = ephemeralCommands.includes(commandName);

        // Commands that use modals (dscan) will handle their own interaction flow
        if (commandName !== 'dscan') {
            // Check if interaction is still valid before deferring
            if (Date.now() - interaction.createdTimestamp > 2500) {
                console.warn(`[Discord] Interaction ${interaction.id} too old (${Date.now() - interaction.createdTimestamp}ms), skipping`);
                return;
            }

            // Use MessageFlags for ephemeral instead of deprecated option
            await interaction.deferReply({
                flags: isEphemeral ? 64 : undefined // 64 = MessageFlags.Ephemeral
            });
        }

        // Track Discord command usage (after deferring to avoid timeout)
        const username = interaction.user.username;
        ga4.trackCommand(commandName, username, 'discord', {
            guild_id: interaction.guildId,
            channel_id: interaction.channelId
        }).catch(err => console.error('[GA4] Track error:', err.message));

        if (commandName === 'market') {

            let itemName = interaction.options.getString('item');
            let quantity = interaction.options.getInteger('quantity') || 1;
            const quantityMatch = itemName.match(/^(.+?)\s*(?:x|×|\s)(\d+)$/i);
            if (quantityMatch && !interaction.options.getInteger('quantity')) {
                itemName = quantityMatch[1].trim();
                quantity = parseInt(quantityMatch[2]);
            }
            console.log(`[SEARCH] Market lookup: ${itemName} (Quantity: ${quantity}) by ${username}`);
            const typeID = await trackPerformance(
                () => getEnhancedItemTypeID(itemName),
                'get_type_id_discord',
                username,
                'discord'
            );

            if (typeID) {
                await ga4.trackMarketData(itemName, typeID, quantity, username, 'discord');

                const mockChannel = { send: async (message) => { await interaction.editReply(message); } };
                // Check if it's PLEX and use the appropriate function
                if (typeID === PLEX_TYPE_ID) {
                    await fetchMarketDataImproved(itemName, typeID, mockChannel, quantity);
                } else {
                    await fetchMarketDataTradeHubs(itemName, typeID, mockChannel, quantity);
                }
            } else {
                await ga4.trackCustomEvent('item_not_found', { item_name: itemName }, username, 'discord');
                await interaction.editReply(`❌ No TypeID found for "${itemName}". ❌`);
            }
        } else if (commandName === 'route') {
            const startSys = interaction.options.getString('start');
            const endSys = interaction.options.getString('end');
            const preference = interaction.options.getString('preference') || 'shortest';
            
            console.log(`[SEARCH] Route check: ${startSys} to ${endSys} (${preference}) by ${username}`);
            
            try {
                const startId = await gatecheckClient.getIdFromName(startSys);
                if (!startId) return interaction.editReply(`❌ Could not find starting system: "${startSys}"`);
                
                const endId = await gatecheckClient.getIdFromName(endSys);
                if (!endId) return interaction.editReply(`❌ Could not find destination system: "${endSys}"`);
                
                const routeIds = await gatecheckClient.getRoute(startId, endId, preference);
                if (!routeIds || routeIds.length === 0) {
                     return interaction.editReply(`❌ Could not find a route from **${startSys}** to **${endSys}** using preference: ${preference}`);
                }
                
                const numJumps = routeIds.length > 0 ? routeIds.length - 1 : 0;
                await interaction.editReply(`🗺️ Analyzing route from **${startSys}** to **${endSys}** (${numJumps} jumps). Fetching zKillboard data...`);
                
                const results = await gatecheckClient.analyzeRoute(routeIds);
                
                const embed = new EmbedBuilder()
                    .setTitle(`🗺️ Route: ${startSys} ➔ ${endSys}`)
                    .setTimestamp();
                
                let hazardText = "";
                let extremeCount = 0;
                let highCount = 0;
                
                for (const sys of results) {
                    if (sys.threatLevel !== 'safe') {
                        if (sys.threatLevel === 'extreme') extremeCount++;
                        if (sys.threatLevel === 'high') highCount++;
                        
                        let details = sys.hazard.details.join(', ');
                        hazardText += `${sys.emoji} **${sys.systemName}** (${sys.security}) - ${sys.kills} kills - *${details}*\n`;
                    }
                }
                
                if (hazardText === "") {
                    hazardText = "✅ No kills, camps, or smartbombs detected on this route in the past hour. Fly safe!";
                    embed.setColor(0x4CAF50);
                } else if (extremeCount > 0) {
                    embed.setColor(0x9C27B0);
                } else if (highCount > 0) {
                    embed.setColor(0xF44336);
                } else {
                    embed.setColor(0xFF9800);
                }
                
                if (hazardText.length > 2000) {
                    hazardText = hazardText.substring(0, 1900) + "\n... *(Route too long, some hazards omitted)*";
                }
                embed.setDescription(`**Distance:** ${numJumps} jumps\n**Preference:** ${preference}\n\n**Hazards on Route (Last Hour):**\n\n${hazardText}`);
                
                await interaction.editReply({ content: '', embeds: [embed] });
            } catch (error) {
                console.error(`[Route Error]`, error);
                await interaction.editReply(`❌ An error occurred while calculating the route.`);
            }
        } else if (commandName === 'build') {
            const itemName = interaction.options.getString('item');
            const me = interaction.options.getInteger('me') ?? 0;
            const te = interaction.options.getInteger('te') ?? 0;
            const facility = interaction.options.getString('facility') || 'Station';
            const rigs = interaction.options.getString('rigs') || 'None';
            const security = interaction.options.getString('security') || 'High';
            const implant = interaction.options.getString('implant') || '0';
            
            const options = { me, te, facility, rigs, security, implant: parseInt(implant) };
            
            console.log(`[SEARCH] Build calculation: ${itemName} by ${username}`);
            const mockChannel = { send: async (message) => { await interaction.editReply(message); } };
            await fetchBlueprintCost(itemName, mockChannel, options);
        } else if (commandName === 'lp') {
            const corpName = interaction.options.getString('corporation');
            const itemName = interaction.options.getString('item');

            if (itemName) {
                console.log(`[SEARCH] LP Offer lookup: ${corpName} - ${itemName} by ${username}`);
                const mockChannel = { send: async (message) => { await interaction.editReply(message); } };
                await fetchLpOffer(corpName, itemName, mockChannel);
            } else {
                // PAGINATION FLOW: Create an interactive, paginated dropdown menu.
                const corpID = await getCorporationID(corpName);
                if (!corpID) {
                    return interaction.editReply(`❌ Could not find corporation "${corpName}".`);
                }

                await interaction.editReply(`🔍 Fetching all offers for **${corpName}**, please wait...`);

                const offersUrl = `https://esi.evetech.net/latest/loyalty/stores/${corpID}/offers/?datasource=tranquility`;
                const offersRes = await axios.get(offersUrl, { headers: { 'User-Agent': USER_AGENT } });
                const offers = offersRes.data;

                if (!offers || offers.length === 0) {
                    return interaction.editReply(`ℹ️ The LP store for **${corpName}** has no offers.`);
                }

                // Store the session data
                const sessionId = interaction.id;
                // Remove duplicate offers for the same type_id to avoid duplicate menu entries
                const uniqueOffers = offers.filter((offer, idx, arr) => arr.findIndex(o => o.type_id === offer.type_id) === idx);
                const sessionData = {
                    offers: uniqueOffers,
                    currentPage: 0,
                    corpId: corpID,
                    corpName: corpName
                };
                activeLpSessions.set(sessionId, sessionData);

                // Set a timeout to automatically clear the session
                setTimeout(() => activeLpSessions.delete(sessionId), 5 * 60 * 1000); // 5 minutes

                const pageComponents = generateLpPageComponent(sessionId, sessionData);
                await interaction.editReply(pageComponents);
            }
        } else if (commandName === 'info') {
            const itemName = interaction.options.getString('item');
            console.log(`[SEARCH] Item info: ${itemName} by ${username}`);
            const typeID = await getEnhancedItemTypeID(itemName);
            if (typeID) {
                const eveRefUrl = `https://everef.net/type/${typeID}`;
                await interaction.editReply(`${itemName} info: ${eveRefUrl}`);
            } else {
                await interaction.editReply(`❌ Could not find an EVE Online item matching "${itemName}". Check spelling? ❌`);
            }
        } else if (commandName === 'dscan') {
            // Build and show a modal for the user to paste their d-scan
            const modal = new ModalBuilder()
                .setCustomId('dscanModal')
                .setTitle('Directional Scan Parser');

            const dscanInput = new TextInputBuilder()
                .setCustomId('dscanInput')
                .setLabel("Paste your d-scan results here")
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("Copy and paste the entire content from your EVE Online scan window here (Ctrl+A, Ctrl+C).")
                .setRequired(true);

            const firstActionRow = new ActionRowBuilder().addComponents(dscanInput);
            modal.addComponents(firstActionRow);

            await interaction.showModal(modal);
            return;
        } else if (commandName === 'help') {
            const helpEmbed = {
                color: 0x0099ff,
                title: '🤖 RustyBot - EVE Online Market Assistant',
                description: 'Here are all the commands you can use with RustyBot:',
                fields: [
                    { name: '📊 `/market <item> [quantity]`', value: 'Get current market prices for any EVE Online item across all major trade hubs (Jita, Amarr, Dodixie, Hek, Rens)\n*Examples: `/market Tritanium`, `/market PLEX 200`, `/market plex x200`*', inline: false },
                    { name: '�️ `/route <start> <end> [preference]`', value: 'Check a route for gate camps and hazards using live kill data\n*Examples: `/route Jita Amarr`, `/route HED-GP Jita preference:secure`*', inline: false },
                    { name: '🔧 `/build <item>` (Work in progress)', value: 'Get manufacturing cost and materials for buildable items\n*Example: `/build Retriever`*', inline: false },
                    { name: '🏢 `/lp <corporation> <item>` (Work in progress)', value: 'Get Loyalty Point store offers from NPC corporations\n*Features easy corporation selection dropdown*', inline: false },
                    { name: '🛰️ `/dscan`', value: 'Parse and analyze directional scan results\n*Opens a form to paste your d-scan*', inline: false },
                    { name: 'ℹ️ `/info <item>`', value: 'Get detailed information and links for any item\n*Example: `/info Condor`*', inline: false },
                    { name: '❓ `/help`', value: 'Show this help message', inline: false }
                ],
                footer: { text: 'RustyBot uses live market data from EVE Online APIs • Made for capsuleers by capsuleers' },
                timestamp: new Date().toISOString()
            };
            await interaction.editReply({ embeds: [helpEmbed] });
        } else if (commandName === 'giveaway') {
            const prize = interaction.options.getString('prize');
            const durationMinutes = interaction.options.getInteger('duration');
            const winnersCount = interaction.options.getInteger('winners') || 1;
            const description = interaction.options.getString('description') || '';
            const ignChannel = interaction.options.getChannel('ign_channel');

            const durationMs = durationMinutes * 60 * 1000;

            const giveawayId = giveawayManager.createGiveaway({
                prize: prize,
                description: description,
                duration: durationMs,
                channelId: interaction.channelId,
                creatorId: interaction.user.id,
                creatorName: interaction.user.username,
                winnersCount: winnersCount,
                ignChannelId: ignChannel ? ignChannel.id : null
            });

            const giveaway = giveawayManager.getGiveaway(giveawayId);
            const embed = giveawayManager.createGiveawayEmbed(giveaway);
            const button = giveawayManager.createEntryButton(giveawayId);

            const giveawayMessage = await interaction.editReply({
                content: '🎉 **GIVEAWAY** 🎉 - 0 entries',
                embeds: [embed],
                components: [button]
            });

            giveawayManager.setMessageId(giveawayId, giveawayMessage.id);

            // Schedule the giveaway end
            giveawayManager.scheduleEnd(giveawayId, async (endedGiveawayId) => {
                await endGiveaway(endedGiveawayId);
            });

            console.log(`[Giveaway] Started by ${interaction.user.username}: ${prize} - ${durationMinutes}min - ${winnersCount} winner(s)`);

        } else if (commandName === 'giveaway-end') {
            const giveawayId = interaction.options.getString('giveaway_id');
            const giveaway = giveawayManager.getGiveaway(giveawayId);

            if (!giveaway) {
                return interaction.editReply('❌ Giveaway not found. Please check the ID and try again.');
            }

            if (giveaway.status !== 'active') {
                return interaction.editReply('❌ This giveaway has already ended.');
            }

            // Only allow creator or admins to end
            if (giveaway.creatorId !== interaction.user.id && !interaction.memberPermissions.has('Administrator')) {
                return interaction.editReply('❌ You do not have permission to end this giveaway.');
            }

            await endGiveaway(giveawayId);
            await interaction.editReply('✅ Giveaway ended successfully!');

        } else if (commandName === 'giveaway-list') {
            const activeGiveaways = giveawayManager.getActiveGiveaways();

            if (activeGiveaways.length === 0) {
                return interaction.editReply('ℹ️ There are no active giveaways at the moment.');
            }

            const listEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('📋 Active Giveaways')
                .setDescription(`Found ${activeGiveaways.length} active giveaway(s)`)
                .setTimestamp();

            activeGiveaways.forEach(g => {
                const timeRemaining = g.endTime - Date.now();
                const minutesRemaining = Math.ceil(timeRemaining / 60000);
                const participants = giveawayManager.participants.get(g.id)?.size || 0;

                listEmbed.addFields({
                    name: `🎁 ${g.prize}`,
                    value: `**ID:** \`${g.id}\`\n**Ends in:** ${minutesRemaining} minutes\n**Entries:** ${participants}\n**Channel:** <#${g.channelId}>`,
                    inline: false
                });
            });

            await interaction.editReply({ embeds: [listEmbed] });

        } else if (commandName === 'giveaway-reroll') {
            const giveawayId = interaction.options.getString('giveaway_id');
            const giveaway = giveawayManager.getGiveaway(giveawayId);

            if (!giveaway) {
                return interaction.editReply('❌ Giveaway not found. Please check the ID and try again.');
            }

            if (giveaway.status !== 'ended') {
                return interaction.editReply('❌ This giveaway must be ended before rerolling.');
            }

            // Only allow creator or admins to reroll
            if (giveaway.creatorId !== interaction.user.id && !interaction.memberPermissions.has('Administrator')) {
                return interaction.editReply('❌ You do not have permission to reroll this giveaway.');
            }

            const winners = giveawayManager.pickWinners(giveawayId);

            if (winners.length === 0) {
                return interaction.editReply('❌ No participants available to reroll.');
            }

            const rerollEmbed = new EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle('🔄 GIVEAWAY REROLLED 🔄')
                .setDescription(`**Prize:** ${giveaway.prize}\n\nNew winners have been selected!`)
                .addFields({
                    name: '🏆 New Winners',
                    value: winners.map(id => `<@${id}>`).join('\n'),
                    inline: false
                })
                .setFooter({ text: `Rerolled by ${interaction.user.username}` })
                .setTimestamp();

            await interaction.editReply({
                content: winners.map(id => `<@${id}>`).join(' '),
                embeds: [rerollEmbed]
            });

            // DM new winners
            for (const winnerId of winners) {
                try {
                    const winner = await client.users.fetch(winnerId);
                    const modal = giveawayManager.createIgnModal(giveawayId);

                    await winner.send({
                        content: `🎉 **Congratulations!** 🎉\n\nYou won the **${giveaway.prize}** giveaway (reroll)!\n\nPlease reply to this message or wait for the giveaway host to contact you for prize details.`
                    });
                } catch (error) {
                    console.error(`[Giveaway] Error DMing reroll winner ${winnerId}:`, error);
                }
            }

        } else if (commandName === 'giveaway-cancel') {
            const giveawayId = interaction.options.getString('giveaway_id');
            const giveaway = giveawayManager.getGiveaway(giveawayId);

            if (!giveaway) {
                return interaction.editReply('❌ Giveaway not found. Please check the ID and try again.');
            }

            if (giveaway.status !== 'active') {
                return interaction.editReply('❌ This giveaway has already ended or been cancelled.');
            }

            // Only allow creator or admins to cancel
            if (giveaway.creatorId !== interaction.user.id && !interaction.memberPermissions.has('Administrator')) {
                return interaction.editReply('❌ You do not have permission to cancel this giveaway.');
            }

            // Cancel the giveaway
            giveawayManager.cancelGiveaway(giveawayId);

            try {
                // Get the channel and original message
                const channel = await client.channels.fetch(giveaway.channelId);
                const message = await channel.messages.fetch(giveaway.messageId);

                // Create cancelled embed
                const cancelledEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ GIVEAWAY CANCELLED ❌')
                    .setDescription(`**Prize:** ${giveaway.prize}\n\n${giveaway.description}`)
                    .addFields(
                        { name: '👥 Total Entries', value: `${giveawayManager.participants.get(giveaway.id)?.size || 0}`, inline: true },
                        { name: '🚫 Status', value: 'Cancelled by host', inline: true }
                    )
                    .setFooter({ text: `Hosted by ${giveaway.creatorName} • Cancelled by ${interaction.user.username}` })
                    .setTimestamp();

                // Update the original message
                await message.edit({
                    content: '❌ **GIVEAWAY CANCELLED** ❌',
                    embeds: [cancelledEmbed],
                    components: [] // Remove the entry buttons
                });

                // Announce cancellation in the channel
                await channel.send({
                    content: `⚠️ The giveaway for **${giveaway.prize}** has been cancelled by the host.`
                });

                await interaction.editReply('✅ Giveaway cancelled successfully!');

                console.log(`[Giveaway] Cancelled by ${interaction.user.username}: ${giveawayId}`);

            } catch (error) {
                console.error(`[Giveaway] Error cancelling giveaway ${giveawayId}:`, error);
                await interaction.editReply('❌ Failed to cancel the giveaway. The giveaway was marked as cancelled but the message could not be updated.');
            }

        } else if (commandName === 'sync') {
            try {
                await deployCommands();
                await interaction.editReply('✅ Commands have been successfully re-synced with Discord.');
            } catch (e) {
                console.error('Manual sync failed:', e);
                await interaction.editReply('❌ Failed to sync commands. Please check the bot\'s console for errors.');
            }
        }
    } catch (error) {
        // Check if it's an expired interaction error (10062)
        if (error.code === 10062) {
            console.warn(`[Discord] Interaction expired for command ${commandName} - likely network latency or old interaction`);
            return; // Don't try to respond to expired interactions
        }

        console.error('Error handling slash command:', error);
        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply('❌ An error occurred while processing your command. ❌');
            } else {
                await interaction.reply('❌ An error occurred while processing your command. ❌');
            }
        } catch (replyError) {
            // Only log non-10062 errors
            if (replyError.code !== 10062) {
                console.error('Failed to send error message to user:', replyError.message);
            }
        }
    }
});

// Discord message event handler

client.on('messageCreate', async message => {

    if (message.author.bot) return; // Ignore messages from other bots

    const prefix = '!';

    if (!message.content.startsWith(prefix)) return;



    const args = message.content.slice(prefix.length).trim().split(/ +/);

    const command = args.shift().toLowerCase();



    if (command === 'market') {

        const itemName = args.join(' ').trim(); // Use full input as item name

        if (!itemName) {

            message.channel.send('❌ Please specify an item to search for. ❌');

            return;

        }



        message.channel.send(`🔍 I will get the market data for "${itemName}". This may take a little while (up to 30 seconds). Please stand by...`);



        console.log(`[SEARCH] Legacy Market lookup: ${itemName} by ${message.author.username}`);
        getItemTypeID(itemName)

            .then(typeID => {

                if (typeID) {

                    // Check if it's PLEX and use the appropriate function
                    if (typeID === PLEX_TYPE_ID) {
                        fetchMarketDataImproved(itemName, typeID, message.channel);
                    } else {
                        fetchMarketDataTradeHubs(itemName, typeID, message.channel);
                    }

                } else {

                    message.channel.send(`❌ No TypeID found for "${itemName}". ❌`);
                }

            }).catch(error => {

                message.channel.send(`❌ Error fetching TypeID for "${itemName}": ${error.message} ❌`);
            });
    } else if (command === 'build') {
        const itemName = args.join(' ').trim();
        if (!itemName) {
            message.channel.send('❌ Please specify an item name. Usage: !build <item name> ❌');
            return;
        }
        console.log(`[SEARCH] Legacy Build calculation: ${itemName} by ${message.author.username}`);
        fetchBlueprintCost(itemName, message.channel);
    } else if (command === 'lp') {
        const fullArgs = args.join(' ');
        if (!fullArgs.includes('|')) {
            message.channel.send('❌ Usage: !lp <corporation name> | <item name> ❌');
            return;
        }
        const parts = fullArgs.split('|').map(p => p.trim());
        const corpName = parts[0];
        const itemName = parts[1];

        if (!corpName || !itemName) {
            message.channel.send('❌ Usage: !lp <corporation name> | <item name> ❌');
            return;
        }
        console.log(`[SEARCH] Legacy LP Offer lookup: ${corpName} - ${itemName} by ${message.author.username}`);
        fetchLpOffer(corpName, itemName, message.channel);
    } else if (command === 'info') {
        const itemName = args.join(' ').trim();
        if (!itemName) {
            message.channel.send('❌ Please specify an item name. Usage: !info <item name> ❌');
            return;
        }

        console.log(`[SEARCH] Legacy Item info: ${itemName} by ${message.author.username}`);
        getEnhancedItemTypeID(itemName)
            .then(typeID => {
                if (typeID) {
                    const eveRefUrl = `https://everef.net/type/${typeID}`;
                    message.channel.send(`${itemName} info: ${eveRefUrl}`);
                } else {
                    message.channel.send(`❌ Could not find an EVE Online item matching "${itemName}". Check spelling? ❌`);
                }
            })
            .catch(error => {
                console.error(`[messageCreate] Error during !info lookup for "${itemName}":`, error);
                message.channel.send(`❌ Error looking up item "${itemName}". ❌`);
            });
    }
});

// Keep-alive ping removed to avoid noisy 410 responses from deprecated Glitch URL.



// Set up health check route for Cloud Run
app.get('/', (req, res) => {
    res.json({
        status: 'running',
        discord: {
            enabled: hasDiscordCredentials,
            bot: hasDiscordCredentials && client.user ? client.user.tag : 'disabled',
            guilds: hasDiscordCredentials && client.guilds ? client.guilds.cache.size : 0,
            ready: hasDiscordCredentials ? !!client.readyAt : false
        },
        twitch: {
            connected: twitchBot.isReady(),
            enabled: process.env.TWITCH_USERNAME ? true : false
        },
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Health check endpoint
// Always return healthy if Express is running, even if Discord is still connecting
// This prevents Render from restarting the service during Discord connection attempts
app.get('/health', (req, res) => {
    const health = {
        status: 'healthy', // Always healthy if server is running
        discord: {
            enabled: hasDiscordCredentials,
            ready: hasDiscordCredentials ? !!client.readyAt : false,
            guilds: hasDiscordCredentials && client.guilds ? client.guilds.cache.size : 0
        },
        twitch: {
            connected: twitchBot.isReady(),
            enabled: !!process.env.TWITCH_USERNAME
        },
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
    };
    res.json(health);
});

// Test command endpoint for web interface
app.post('/api/test-command', async (req, res) => {
    try {
        const { command } = req.body;

        if (!command) {
            return res.status(400).json({ success: false, error: 'Command is required' });
        }

        // Parse command like the bot would
        const args = command.trim().split(/ +/);
        const cmd = args.shift().toLowerCase();

        console.log(`[Web Test] Testing command: ${cmd} with args: ${args.join(' ')}`);

        let response;

        // Simulate the bot's command handling
        switch (cmd) {
            case 'market':
            case 'price':
                if (args.length === 0) {
                    response = 'Usage: market <item name> [quantity] - Get market prices for EVE items';
                } else {
                    const itemName = args.join(' ');
                    try {
                        const { getEnhancedItemTypeID, fetchMarketDataForTwitch } = await import('./twitch-utils.js');
                        const typeID = await getEnhancedItemTypeID(itemName);
                        if (!typeID) {
                            response = `Item "${itemName}" not found. Check your spelling?`;
                        } else {
                            response = await fetchMarketDataForTwitch(typeID, itemName);
                        }
                    } catch (error) {
                        response = `Error fetching market data: ${error.message}`;
                    }
                }
                break;

            case 'ping':
                response = 'Pong! Bot is online and responding.';
                break;

            case 'help':
            case 'commands':
                response = 'Available commands: !market <item>, !build <item>, !info <item>, !lp <corp> | <item>, !help, !ping';
                break;

            case 'info':
            case 'item':
                if (args.length === 0) {
                    response = 'Usage: info <item name> - Get detailed item information';
                } else {
                    const itemName = args.join(' ');
                    try {
                        const { getItemInfoForTwitch } = await import('./twitch-utils.js');
                        response = await getItemInfoForTwitch(itemName);
                    } catch (error) {
                        response = `Error fetching item info: ${error.message}`;
                    }
                }
                break;

            default:
                response = `Unknown command: ${cmd}. Try: market, info, build, help, ping`;
        }

        res.json({ success: true, response });

    } catch (error) {
        console.error('[Web Test] Error processing command:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// === NEW FEATURES FROM TWITCH BOT ===

// Additional constants for new features
const corpIDCache = new Map(); // Cache for Corporation IDs
const manufacturingCache = new Map(); // Cache for product manufacturing data
// Active in-memory sessions for paginated LP browsing (keyed by interaction id)
const activeLpSessions = new Map();
const itemInfoCache = new Map(); // Cache for item info like groupID
const activeDscanSessions = new Map(); // Cache for raw d-scan text results


/**
 * Fetches manufacturing data (materials) for an item from Fuzzwork.
 * @param {number} blueprintTypeID - The typeID of the blueprint.
 * @returns {Promise<Array|null>} Array of materials or null.
 */
async function fetchManufacturingData(blueprintTypeID) {
    if (manufacturingCache.has(blueprintTypeID)) return manufacturingCache.get(blueprintTypeID);
    try {
        // Fuzzwork Blueprint API provides manufacturing materials
        const url = `https://www.fuzzwork.co.uk/blueprint/api/blueprint.php?typeid=${blueprintTypeID}`;
        const response = await axios.get(url, { 
            headers: { 'User-Agent': USER_AGENT },
            timeout: 7000 
        });
        
        // Fuzzwork API returns data in activityMaterials[activityID]
        // 1 = Manufacturing, 3 = Researching Material Efficiency, etc.
        let materials = null;
        let time = 0;
        
        if (response.data && response.data.activityMaterials && response.data.activityMaterials["1"]) {
            materials = response.data.activityMaterials["1"];
            time = response.data.blueprintDetails?.times?.["1"] || 0;
        } else if (response.data && response.data.activity === 'manufacturing') {
            // Fallback for older/different formats
            materials = response.data.materials;
            time = response.data.time || 0;
        } else if (response.data && response.data[1] && response.data[1].activity === 'manufacturing') {
            materials = response.data[1].materials;
            time = response.data[1].time || 0;
        }
        
        if (materials) {
            console.log(`[fetchManufacturingData] ✅ Found ${materials.length} materials for BP ${blueprintTypeID}`);
            const result = { materials, time };
            manufacturingCache.set(blueprintTypeID, result);
            return result;
        }
        
        console.log(`[fetchManufacturingData] ⚠️ No manufacturing materials found in response for BP ${blueprintTypeID}`);
        return null;
    } catch (error) {
        console.error(`[fetchManufacturingData] Error for blueprint typeID ${blueprintTypeID}:`, error.message);
        return null;
    }
}


/**
 * Calculates and sends the manufacturing cost for an item.
 * @param {string} itemName - The name of the item.
 * @param {object} channel - The Discord channel or interaction to send the response to.
 */
async function fetchBlueprintCost(itemName, channel, options = { me: 0, te: 0, facility: 'Station', rigs: 'None', security: 'High', implant: 0 }) {
    try {
        console.log(`[fetchBlueprintCost] Start lookup for "${itemName}"`);
        
        // 1. Get the TypeID of the product
        const productTypeID = await getEnhancedItemTypeID(itemName);
        if (!productTypeID) {
            return channel.send(`❌ Could not find item "${itemName}". Check your spelling?`);
        }

        // 2. Get the TypeID of the blueprint (conventionally "[Item Name] Blueprint")
        const blueprintName = `${itemName} Blueprint`;
        const blueprintTypeID = await getEnhancedItemTypeID(blueprintName);
        
        if (!blueprintTypeID) {
            return channel.send(`❌ Could not find a blueprint for "${itemName}". Is it a buildable item? (Check everef.net)`);
        }

        console.log(`[fetchBlueprintCost] Found ${itemName} (${productTypeID}) and ${blueprintName} (${blueprintTypeID})`);

        // 3. Fetch materials for the blueprint
        const mfgData = await fetchManufacturingData(blueprintTypeID);
        if (!mfgData || !mfgData.materials || mfgData.materials.length === 0) {
            return channel.send(`❌ No manufacturing data found for "${itemName}" (Blueprint ID: ${blueprintTypeID}).`);
        }
        
        const materials = mfgData.materials;
        const baseTime = mfgData.time;
        
        // Calculate Modifiers
        // Security Multiplier
        let secMultiplier = 1.0;
        if (options.security === 'Low') secMultiplier = 1.9;
        if (options.security === 'Null') secMultiplier = 2.1;
        
        // Rig Multiplier
        let rigMeBonus = 0;
        let rigTeBonus = 0;
        if (options.rigs === 'T1') { rigMeBonus = 4.2; rigTeBonus = 20; }
        if (options.rigs === 'T2') { rigMeBonus = 5.04; rigTeBonus = 24; }
        
        // Facility Multiplier
        let facMeBonus = 0;
        let facTeBonus = 0;
        if (options.facility === 'Engineering Complex') { facMeBonus = 1; facTeBonus = 15; }
        
        // Overall ME Multiplier
        const meMult = (1 - (options.me / 100)) * (1 - (facMeBonus / 100)) * (1 - ((rigMeBonus * secMultiplier) / 100));
        
        // Overall TE Multiplier
        const teMult = (1 - (options.te / 100)) * (1 - (facTeBonus / 100)) * (1 - ((rigTeBonus * secMultiplier) / 100)) * (1 - (options.implant / 100));

        const finalTimeSeconds = Math.round(baseTime * teMult);
        const formatTime = (secs) => {
            const h = Math.floor(secs / 3600);
            const m = Math.floor((secs % 3600) / 60);
            const s = secs % 60;
            return `${h}h ${m}m ${s}s`;
        };

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle(`🔧 Manufacturing Cost: ${itemName}`)
            .setDescription(`Material requirements for 1x unit\n**Facility:** ${options.facility} (${options.security})\n**Rigs:** ${options.rigs}\n**BP ME/TE:** ${options.me}/${options.te} | **Implant:** ${options.implant}%\n**Est. Time:** ${formatTime(finalTimeSeconds)}`)
            .setTimestamp()
            .setFooter({ text: 'RustyBot Manufacturing Calculator' });

        let totalCost = 0;
        const materialLines = [];

        // Fetch prices for all materials
        for (const mat of materials) {
            const finalQty = Math.max(1, Math.round(mat.quantity * meMult));
            const matPrice = await getLowestSellPrice(mat.typeid);
            const lineCost = matPrice ? matPrice * finalQty : 0;
            totalCost += lineCost;
            
            const matName = mat.name || `Item ${mat.typeid}`;
            materialLines.push(`${finalQty.toLocaleString()}x ${matName}: ${lineCost > 0 ? lineCost.toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' ISK' : 'Price Unknown'}`);
        }

        embed.addFields({ name: 'Required Materials', value: materialLines.join('\n').substring(0, 1024) || 'None' });
        embed.addFields({ name: 'Total Production Cost', value: `**${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} ISK**` });

        // Get product price to show profitability
        const productPrice = await getLowestSellPrice(productTypeID);
        if (productPrice) {
            const profit = productPrice - totalCost;
            const margin = (profit / productPrice) * 100;
            embed.addFields(
                { name: 'Jita Sell Price', value: `${productPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })} ISK`, inline: true },
                { name: 'Est. Profit', value: `${profit > 0 ? '🟢' : '🔴'} ${profit.toLocaleString(undefined, { maximumFractionDigits: 0 })} ISK (${margin.toFixed(1)}%)`, inline: true }
            );
        }

        await channel.send({ embeds: [embed] });
        console.log(`[fetchBlueprintCost] ✅ Successfully sent build cost for ${itemName}`);
    } catch (error) {
        console.error(`[fetchBlueprintCost] Error for "${itemName}":`, error.message);
        channel.send(`❌ An error occurred while calculating the build cost for "${itemName}".`);
    }
}


/**
 * Fetches and sends LP offer data.
 * @param {string} corpName - The NPC corporation name.
 * @param {string} itemName - The item name to find in the store.
 * @param {object} channel - The Discord channel or interaction to respond to.
 */
async function fetchLpOffer(corpName, itemName, channel) {
    try {
        console.log(`[fetchLpOffer] Looking up ${itemName} in ${corpName} store`);
        const corpID = await getCorporationID(corpName);
        if (!corpID) return channel.send(`❌ Could not find corporation "${corpName}".`);

        const typeID = await getEnhancedItemTypeID(itemName);
        if (!typeID) return channel.send(`❌ Could not find item "${itemName}".`);

        // Fetch store offers via ESI
        const offersUrl = `https://esi.evetech.net/latest/loyalty/stores/${corpID}/offers/?datasource=tranquility`;
        const response = await apiLimiter.schedule(() => axios.get(offersUrl, { 
            headers: { 'User-Agent': USER_AGENT },
            timeout: 7000 
        }));
        
        const offer = response.data.find(o => o.type_id === typeID);
        if (!offer) {
            return channel.send(`❌ **${itemName}** is not available in the **${corpName}** LP store.`);
        }

        await calculateAndSendLpOfferCost(itemName, offer, channel);
    } catch (error) {
        console.error(`[fetchLpOffer] Error for ${corpName} / ${itemName}:`, error.message);
        channel.send(`❌ Error fetching LP store data for "${itemName}".`);
    }
}

/**
 * Calculates total ISK value and ISK/LP for a specific store offer.
 * @param {string} itemName - Product name.
 * @param {object} offer - The ESI offer object.
 * @param {object} channel - Channel/Interaction to send to.
 */
async function calculateAndSendLpOfferCost(itemName, offer, channel) {
    try {
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`🏢 LP Store Offer: ${itemName}`)
            .setDescription(`Analysis for ${itemName} upgrade`)
            .setTimestamp()
            .setFooter({ text: 'RustyBot LP Calculator' });

        embed.addFields(
            { name: 'LP Cost', value: `${offer.lp_cost.toLocaleString()} LP`, inline: true },
            { name: 'ISK Cost', value: `${offer.isk_cost.toLocaleString()} ISK`, inline: true }
        );

        let totalMatCost = 0;
        const matLines = [];

        // Handle required items (e.g., base hull for faction ships)
        if (offer.required_items && offer.required_items.length > 0) {
            for (const req of offer.required_items) {
                const matPrice = await getLowestSellPrice(req.type_id);
                const lineCost = matPrice ? matPrice * req.quantity : 0;
                totalMatCost += lineCost;
                
                // Get name from our local maps if possible
                const matName = eveFilesIDToNameMap.get(req.type_id) || `Item ${req.type_id}`;
                matLines.push(`${req.quantity}x ${matName}: ${lineCost > 0 ? lineCost.toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' ISK' : 'Price Unknown'}`);
            }
            embed.addFields({ name: 'Required Items', value: matLines.join('\n').substring(0, 1024) });
        }

        const totalIskOut = offer.isk_cost + totalMatCost;
        embed.addFields({ name: 'Total ISK Investment', value: `**${totalIskOut.toLocaleString(undefined, { maximumFractionDigits: 0 })} ISK**` });

        // Get current Jita sell price to calculate profit
        const sellPrice = await getLowestSellPrice(offer.type_id);
        if (sellPrice) {
            const netProfit = (sellPrice * (offer.quantity || 1)) - totalIskOut;
            const iskPerLp = netProfit / offer.lp_cost;
            embed.addFields(
                { name: 'Jita Sell Price', value: `${(sellPrice * (offer.quantity || 1)).toLocaleString(undefined, { maximumFractionDigits: 0 })} ISK`, inline: true },
                { name: 'Est. ISK/LP', value: `**${iskPerLp.toFixed(0)} ISK/LP**`, inline: true }
            );
        }

        await channel.send({ embeds: [embed] });
        console.log(`[LpCalculator] ✅ Successfully sent LP cost for ${itemName}`);
    } catch (error) {
        console.error(`[LpCalculator] Error for "${itemName}":`, error.message);
        channel.send(`❌ An error occurred while calculating the LP cost for "${itemName}".`);
    }
}


/**
 * Fetches detailed item information (like groupID) from ESI.
 * @param {number} typeID - The typeID of the item.
 * @returns {Promise<object|null>} The item details object or null.
 */
async function getItemInfo(typeID) {
    if (itemInfoCache.has(typeID)) {
        return itemInfoCache.get(typeID);
    }
    try {
        const esiUrl = `https://esi.evetech.net/latest/universe/types/${typeID}/?datasource=tranquility`;
        const response = await axios.get(esiUrl, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 5000
        });
        if (response.data) {
            itemInfoCache.set(typeID, response.data);
            return response.data;
        }
        return null;
    } catch (error) {
        console.error(`[getItemInfo] Error fetching info for typeID ${typeID}:`, error.message);
        return null;
    }
}

// Cache for Group info (groupID -> group details)
const groupInfoCache = new Map();

/**
 * Look up EVE Online character by name and get their portrait
 * @param {string} characterName - Character name to search for
 * @returns {Promise<object|null>} Object with characterId and portrait URL, or null if not found
 */
async function getEveCharacterInfo(characterName) {
    try {
        // Use /universe/ids/ endpoint (doesn't require authentication)
        const idsUrl = `https://esi.evetech.net/latest/universe/ids/?datasource=tranquility`;

        const idsResponse = await apiLimiter.schedule(() =>
            axios.post(idsUrl, [characterName], {
                headers: {
                    'User-Agent': USER_AGENT,
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            })
        );

        if (!idsResponse.data.characters || idsResponse.data.characters.length === 0) {
            console.log(`[ESI] Character "${characterName}" not found`);
            return null;
        }

        const characterId = idsResponse.data.characters[0].id;
        const verifiedName = idsResponse.data.characters[0].name;

        // Use direct image URL (more reliable than portrait endpoint)
        const portraitUrl = `https://images.evetech.net/characters/${characterId}/portrait?size=256`;

        console.log(`[ESI] Found character "${verifiedName}" (ID: ${characterId})`);

        return {
            characterId: characterId,
            characterName: verifiedName,
            portraitUrl: portraitUrl
        };

    } catch (error) {
        console.error(`[ESI] Error looking up character "${characterName}":`, error.message);
        return null;
    }
}

/**
 * Fetches group information (like name and category) from ESI.
 * @param {number} groupID - The groupID of the item.
 * @returns {Promise<object|null>} The group details object or null.
 */
async function getGroupInfo(groupID) {
    if (!groupID) return null;
    if (groupInfoCache.has(groupID)) return groupInfoCache.get(groupID);
    try {
        const esiUrl = `https://esi.evetech.net/latest/universe/groups/${groupID}/?datasource=tranquility`;
        const response = await axios.get(esiUrl, { headers: { 'User-Agent': USER_AGENT }, timeout: 5000 });
        if (response.data) {
            groupInfoCache.set(groupID, response.data);
            return response.data;
        }
        return null;
    } catch (error) {
        console.error(`[getGroupInfo] Error fetching info for groupID ${groupID}:`, error.message);
        return null;
    }
}

/**
 * End a giveaway and announce winners
 * @param {string} giveawayId - Giveaway ID
 */
async function endGiveaway(giveawayId) {
    const giveaway = giveawayManager.getGiveaway(giveawayId);
    if (!giveaway) {
        console.error(`[Giveaway] Cannot end - giveaway ${giveawayId} not found`);
        return;
    }

    console.log(`[Giveaway] Ending giveaway: ${giveawayId}`);

    // Pick winners
    const winners = giveawayManager.pickWinners(giveawayId);

    // Mark as ended
    giveawayManager.endGiveaway(giveawayId);

    try {
        // Get the channel and original message
        const channel = await client.channels.fetch(giveaway.channelId);
        const message = await channel.messages.fetch(giveaway.messageId);

        // Create ended embed
        const endedEmbed = giveawayManager.createEndedEmbed(giveaway, winners);

        // Update the original message
        await message.edit({
            content: '🎉 **GIVEAWAY ENDED** 🎉',
            embeds: [endedEmbed],
            components: [] // Remove the entry button
        });

        // Announce winners in the channel
        if (winners.length > 0) {
            const winnerMentions = winners.map(id => `<@${id}>`).join(', ');
            await channel.send({
                content: `🎊 **Congratulations ${winnerMentions}!** 🎊\n\nYou won: **${giveaway.prize}**\n\nCheck your DMs for instructions on how to claim your prize!`
            });
        }

        // DM each winner (no separate channel announcement since they get DMs)
        if (winners.length > 0) {
            // DM each winner
            for (const winnerId of winners) {
                try {
                    const winner = await client.users.fetch(winnerId);

                    // Send initial congratulations message
                    const dmEmbed = new EmbedBuilder()
                        .setColor(0xFFD700)
                        .setTitle('🎉 YOU WON A GIVEAWAY! 🎉')
                        .setDescription(`Congratulations! You won the giveaway!\n\n**Prize:** ${giveaway.prize}`)
                        .addFields(
                            { name: '📝 Next Steps', value: 'Please provide your EVE Online In-Game Name (IGN) so the host can deliver your prize.' },
                            { name: '🎮 How to Submit', value: 'Click the button below to submit your IGN via a quick form.' }
                        )
                        .setFooter({ text: `Giveaway ID: ${giveawayId} • Hosted by ${giveaway.creatorName}` })
                        .setTimestamp();

                    // Create button for IGN submission
                    const ignButton = new ButtonBuilder()
                        .setCustomId(`giveaway_ign_modal:${giveawayId}:${winnerId}`)
                        .setLabel('📝 Submit IGN')
                        .setStyle(ButtonStyle.Success);

                    const row = new ActionRowBuilder().addComponents(ignButton);

                    await winner.send({
                        embeds: [dmEmbed],
                        components: [row]
                    });

                    console.log(`[Giveaway] DM sent to winner ${winnerId}`);
                } catch (error) {
                    console.error(`[Giveaway] Failed to DM winner ${winnerId}:`, error);
                    // Notify in channel if DM fails
                    await channel.send(`⚠️ <@${winnerId}> - I couldn't send you a DM! Please enable DMs from server members or contact <@${giveaway.creatorId}> directly with your IGN: **[Your Character Name]**`);
                }
            }
        } else {
            await channel.send('😢 No valid entries were received for this giveaway. Better luck next time!');
        }

    } catch (error) {
        console.error(`[Giveaway] Error ending giveaway ${giveawayId}:`, error);
    }
}

/**
 * Parses d-scan text and returns an EmbedBuilder object with the results.
 * @param {string} dscanText - The raw text from the d-scan window.
 * @returns {Promise<EmbedBuilder|string>} An EmbedBuilder on success, or a string on failure.
 */
async function processDscan(dscanText) {
    const lines = dscanText.trim().split('\n');
    const itemCounts = new Map();
    const itemTypeIDs = new Map();

    // 1. Parse lines and count items
    lines.forEach(line => {
        const parts = line.split('\t');
        if (parts.length >= 3) {
            const typeID = parseInt(parts[0].trim(), 10);
            const typeName = parts[2].trim();
            if (!typeName || isNaN(typeID)) return;
            itemCounts.set(typeName, (itemCounts.get(typeName) || 0) + 1);
            if (!itemTypeIDs.has(typeName)) {
                itemTypeIDs.set(typeName, typeID);
            }
        }
    });

    if (itemCounts.size === 0) {
        return "Could not parse any items from the input. Please ensure you are pasting directly from the EVE Online d-scan window.";
    }

    // 2. Dynamically categorize items using ESI
    const categorizedItems = new Map();
    const otherItems = new Map();

    const SHIP_CATEGORY_ID = 6;
    const DRONE_CATEGORY_ID = 18;
    const FIGHTER_CATEGORY_ID = 87;

    const processingPromises = Array.from(itemTypeIDs.entries()).map(async ([typeName, typeID]) => {
        const itemInfo = await getItemInfo(typeID);
        if (!itemInfo || !itemInfo.group_id) return; // Skip if we can't get basic info

        const groupInfo = await getGroupInfo(itemInfo.group_id);
        if (!groupInfo) return;

        const itemCount = itemCounts.get(typeName) || 0;

        if (groupInfo.category_id === SHIP_CATEGORY_ID) {
            const categoryName = groupInfo.name || 'Unknown Ship Group';
            if (!categorizedItems.has(categoryName)) categorizedItems.set(categoryName, []);
            categorizedItems.get(categoryName).push({ name: typeName, count: itemCount });
        } else if (groupInfo.category_id === DRONE_CATEGORY_ID || groupInfo.category_id === FIGHTER_CATEGORY_ID) {
            otherItems.set(typeName, itemCount);
        }
    });

    await Promise.all(processingPromises);

    // --- NEW STEP 3: BUILD THE EMBED ---
    const totalShips = Array.from(categorizedItems.values()).flat().reduce((sum, item) => sum + item.count, 0);

    if (totalShips === 0 && otherItems.size === 0) {
        return "No ships, drones, or fighters were found on d-scan.";
    }

    const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('🛰️ D-Scan Analysis')
        .setDescription(`Found a total of **${totalShips}** ships on scan.`)
        .setTimestamp()
        .setFooter({ text: 'RustyBot D-Scan' });

    const sortedCategories = new Map([...categorizedItems.entries()].sort((a, b) => a[0].localeCompare(b[0])));

    // Add a field for each ship category
    sortedCategories.forEach((items, category) => {
        // Sort items within the category by name
        items.sort((a, b) => a.name.localeCompare(b.name));
        const shipList = items.map(item => `${item.count} x ${item.name}`).join('\n');
        embed.addFields({
            name: `🚀 ${category}`,
            value: `\`\`\`\n${shipList}\n\`\`\``,
            inline: true
        });
    });

    // Add a separate field for drones and fighters if any were found
    if (otherItems.size > 0) {
        const sortedOther = new Map([...otherItems.entries()].sort((a, b) => a[0].localeCompare(b[0])));
        const otherList = Array.from(sortedOther.entries()).map(([name, count]) => `${count} x ${name}`).join('\n');
        embed.addFields({
            name: '🐝 Drones & Fighters',
            value: `\`\`\`\n${otherList}\n\`\`\``,
            inline: true
        });
    }

    // --- BUILD RAW TEXT ---
    let rawText = "--- D-Scan Analysis ---\n\n";
    sortedCategories.forEach((items, category) => {
        rawText += `--- ${category} ---\n`;
        items.sort((a, b) => a.name.localeCompare(b.name));
        items.forEach(item => {
            rawText += `${item.count.toString().padStart(3, ' ')} x ${item.name}\n`;
        });
        rawText += '\n';
    });

    if (otherItems.size > 0) {
        rawText += '--- Drones & Fighters ---\n';
        const sortedOther = new Map([...otherItems.entries()].sort((a, b) => a[0].localeCompare(b[0])));
        sortedOther.forEach((count, name) => {
            rawText += `${count.toString().padStart(3, ' ')} x ${name}\n`;
        });
        rawText += '\n';
    }

    rawText += `--- Summary ---\nTotal Ships: ${totalShips}\n`;

    return { embed, rawText };
}

const JITA_SYSTEM_ID = 30000142; // Jita system ID
const JITA_REGION_ID = 10000002; // The Forge Region ID
const PLEX_TYPE_ID = 44992; // Correct Type ID for PLEX
const GLOBAL_PLEX_REGION_ID = 19000001; // New Global PLEX Market Region ID

/**
 * Corporation ID mapping for LP stores - verified working IDs
 * Updated with correct Sisters of EVE corporation
 */
const CORPORATION_IDS = {
    'Sisters of EVE': 1000130,        // REAL Sisters of EVE - confirmed with Fuzzwork
    'Federation Navy': 1000017,       // Federation Navy faction items
    'Republic Fleet': 1000048,        // Minmatar faction items
    'Imperial Navy': 1000051,         // Amarr faction items
    'Caldari Navy': 1000020,          // Caldari faction items
    'Concord': 1000147,               // Intaki Syndicate (offers CONCORD items)
    'Inner Zone Shipping': 1000080,   // Mining/hauling items
    'Ishukone Corporation': 1000045,  // Caldari corporate items
    'Lai Dai Corporation': 1000016,   // Research/tech items
    'Hyasyoda Corporation': 1000115,  // Industrial items
    'ORE': 1000109,                   // Duvolle Laboratories (mining items)
    '24th Imperial Crusade': 1000180, // Amarr faction warfare
    'Federal Defense Union': 1000181, // Gallente faction warfare
    'Tribal Liberation Force': 1000182, // Minmatar faction warfare
    'State Protectorate': 1000183     // Caldari faction warfare
};

// Maps for Type ID and Name lookups from eve-files.com
const eveFilesTypeIDMap = new Map(); // Maps lowercase name -> typeID
const eveFilesIDToNameMap = new Map(); // Maps typeID -> proper name
let isEveFilesTypeIDMapLoaded = false;


/**
 * Load Type IDs from local file first, fallback to remote if not available
 */
async function loadTypeIDs() {
    const localFilePath = './all_typeids.txt';
    const remoteUrl = 'https://eve-files.com/chribba/typeid.txt';
    
    try {
        // Try loading from local file first
        console.log('[loadTypeIDs] Attempting to load Type IDs from local file:', localFilePath);
        const fileContent = await fs.readFile(localFilePath, 'utf-8');
        const lines = fileContent.split('\n');
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            
            // Parse format: "TypeID - Name"
            const match = trimmedLine.match(/^(\d+)\s*-\s*(.+)$/);
            if (match) {
                const typeID = parseInt(match[1], 10);
                const name = match[2].trim();
                const lowerCaseName = name.toLowerCase();
                
                eveFilesTypeIDMap.set(lowerCaseName, typeID);
                eveFilesIDToNameMap.set(typeID, name);
            }
        }
        
        isEveFilesTypeIDMapLoaded = true;
        console.log(`[loadTypeIDs] ✅ Successfully loaded ${eveFilesTypeIDMap.size} Type IDs from LOCAL file`);
        return;
        
    } catch (localError) {
        console.log(`[loadTypeIDs] ⚠️ Local file not found or failed to load: ${localError.message}`);
        console.log('[loadTypeIDs] Falling back to remote source...');
    }
    
    // Fallback to remote source
    try {
        console.log('[loadTypeIDs] Fetching Type IDs from remote:', remoteUrl);
        const response = await axios.get(remoteUrl, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 10000
        });
        
        const lines = response.data.split('\n');
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            
            // Parse format: "TypeID,Name"
            const parts = trimmedLine.split(',');
            if (parts.length >= 2) {
                const typeID = parseInt(parts[0], 10);
                const name = parts.slice(1).join(',').trim();
                const lowerCaseName = name.toLowerCase();
                
                if (!isNaN(typeID) && name) {
                    eveFilesTypeIDMap.set(lowerCaseName, typeID);
                    eveFilesIDToNameMap.set(typeID, name);
                }
            }
        }
        
        isEveFilesTypeIDMapLoaded = true;
        console.log(`[loadTypeIDs] ✅ Successfully loaded ${eveFilesTypeIDMap.size} Type IDs from REMOTE source`);
        
    } catch (remoteError) {
        console.error('[loadTypeIDs] ❌ Failed to load Type IDs from remote source:', remoteError.message);
        console.error('[loadTypeIDs] ❌ Type ID lookups will rely on ESI and Fuzzwork only');
    }
}

/**
 * Validate if a type ID represents a published, tradeable item
 */
async function isValidTradeableItem(typeID) {
    try {
        const esiUrl = `https://esi.evetech.net/latest/universe/types/${typeID}/`;
        const response = await axios.get(esiUrl, { timeout: 5000 });

        const itemData = response.data;
        console.log(`[isValidTradeableItem] TypeID ${typeID}: name="${itemData.name}", published=${itemData.published}, group_id=${itemData.group_id}`);

        // Allow published items - SKINs are published and should be included
        // Group ID 1950 is SKINs, which should be allowed
        if (itemData.published === true) {
            return true;
        }

        // For debugging: log why item was rejected
        console.log(`[isValidTradeableItem] Rejected TypeID ${typeID}: published=${itemData.published}`);
        return false;
    } catch (error) {
        console.log(`[server.js] Failed to validate type ID ${typeID}: ${error.message}`);
        return false;
    }
}

// Enhanced getItemTypeID function with eve-files.com support
async function getEnhancedItemTypeID(itemName) {
    const lowerCaseItemName = itemName.toLowerCase().trim();

    // Check local cache first
    if (typeIDCache.has(lowerCaseItemName)) {
        console.log(`[getEnhancedItemTypeID] Fuzzwork Cache HIT for "${itemName}"`);
        return typeIDCache.get(lowerCaseItemName);
    }

    // Check manual TypeID mappings first (for items not in standard databases)
    const manualTypeID = getManualTypeID(itemName);
    if (manualTypeID) {
        console.log(`[getEnhancedItemTypeID] Manual mapping found: "${itemName}" -> ${manualTypeID}`);
        typeIDCache.set(lowerCaseItemName, manualTypeID);
        return manualTypeID;
    }

    // Special handling for PLEX - hardcode the correct type ID to avoid confusion
    if (lowerCaseItemName === 'plex' || lowerCaseItemName === 'pilot license extension') {
        console.log(`[getEnhancedItemTypeID] PLEX special handling: "${itemName}" -> ${PLEX_TYPE_ID}`);
        typeIDCache.set(lowerCaseItemName, PLEX_TYPE_ID);
        return PLEX_TYPE_ID;
    }

    // Debug: Check what's in the local map
    console.log(`[getEnhancedItemTypeID] Checking local map: isLoaded=${isEveFilesTypeIDMapLoaded}, mapSize=${eveFilesTypeIDMap.size}, hasItem=${eveFilesTypeIDMap.has(lowerCaseItemName)}`);

    // Check eve-files cache for exact match, but validate it's tradeable
    if (isEveFilesTypeIDMapLoaded && eveFilesTypeIDMap.has(lowerCaseItemName)) {
        const candidateTypeID = eveFilesTypeIDMap.get(lowerCaseItemName);
        console.log(`[getEnhancedItemTypeID] Found potential match in eve-files: "${itemName}" -> ${candidateTypeID}`);

        // Validate this is a published, tradeable item
        if (await isValidTradeableItem(candidateTypeID)) {
            console.log(`[getEnhancedItemTypeID] Validated tradeable item: "${itemName}" -> ${candidateTypeID}`);
            typeIDCache.set(lowerCaseItemName, candidateTypeID);
            return candidateTypeID;
        } else {
            console.log(`[getEnhancedItemTypeID] Item ${candidateTypeID} not tradeable, trying Fuzzwork instead`);
        }
    }

    // Try direct ESI search for items not found in other databases (like new SKINs)
    try {
        console.log(`[getEnhancedItemTypeID] Trying ESI search for: "${itemName}"`);
        const esiSearchUrl = `https://esi.evetech.net/latest/search/?categories=inventory_type&search=${encodeURIComponent(itemName)}&strict=false`;
        const searchResponse = await axios.get(esiSearchUrl, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 5000
        });

        if (searchResponse.data.inventory_type && searchResponse.data.inventory_type.length > 0) {
            // Get the first result and validate it
            const candidateTypeID = searchResponse.data.inventory_type[0];
            console.log(`[getEnhancedItemTypeID] ESI search found: "${itemName}" -> ${candidateTypeID}`);

            if (await isValidTradeableItem(candidateTypeID)) {
                console.log(`[getEnhancedItemTypeID] ESI result validated: "${itemName}" -> ${candidateTypeID}`);
                typeIDCache.set(lowerCaseItemName, candidateTypeID);
                return candidateTypeID;
            }
        }
    } catch (error) {
        console.log(`[getEnhancedItemTypeID] ESI search failed for "${itemName}": ${error.message}`);
    }

    console.log(`[getEnhancedItemTypeID] Cache MISS for "${itemName}". Fetching from Fuzzwork...`);
    try {
        let cleanItemName = itemName.replace(/[^a-zA-Z0-9\s'-]/g, '').trim();
        if (!cleanItemName) return null;

        const fuzzworkTypeIdUrl = `https://www.fuzzwork.co.uk/api/typeid.php?typename=${encodeURIComponent(cleanItemName)}`;
        const searchRes = await axios.get(fuzzworkTypeIdUrl, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 5000
        });

        const responseData = searchRes.data;
        let foundTypeID = null;

        if (Array.isArray(responseData)) {
            if (responseData.length > 0) {
                const exactMatch = responseData.find(item => item.typeName.toLowerCase() === lowerCaseItemName);
                foundTypeID = exactMatch ? exactMatch.typeID : responseData[0].typeID;
            }
        } else if (typeof responseData === 'object' && responseData !== null && responseData.typeID) {
            foundTypeID = Number(responseData.typeID);
        }

        if (foundTypeID) {
            console.log(`[getEnhancedItemTypeID] Fuzzwork Success: Found TypeID ${foundTypeID} for "${itemName}"`);
            typeIDCache.set(lowerCaseItemName, foundTypeID);
            return foundTypeID;
        } else {
            console.warn(`[getEnhancedItemTypeID] Fuzzwork Warning: No match found for "${itemName}". Response: ${JSON.stringify(responseData)}`);
            return null;
        }
    } catch (error) {
        console.error(`[getEnhancedItemTypeID] Error fetching TypeID from Fuzzwork for "${itemName}": ${error.message}`);
        return null;
    }
}

async function getLowestSellPrice(typeID) {
    const isPlex = (typeID === PLEX_TYPE_ID);
    const targetRegionId = isPlex ? GLOBAL_PLEX_REGION_ID : JITA_REGION_ID;
    const sellOrdersURL = `https://esi.evetech.net/latest/markets/${targetRegionId}/orders/?datasource=tranquility&order_type=sell&type_id=${typeID}`;

    try {
        const sellOrdersRes = await axios.get(sellOrdersURL, {
            headers: { 'User-Agent': USER_AGENT },
            validateStatus: (status) => status >= 200 && status < 500,
            timeout: 5000
        });

        if (sellOrdersRes.status !== 200) {
            console.error(`[getLowestSellPrice] Error fetching sell orders for typeID ${typeID}. Status: ${sellOrdersRes.status}`);
            return null;
        }

        const sellOrders = sellOrdersRes.data;
        if (sellOrders.length === 0) return null;

        let lowestSellOrder = null;
        if (isPlex) {
            lowestSellOrder = sellOrders.reduce((min, o) => (o.price < min.price ? o : min));
        } else {
            const jitaSellOrders = sellOrders.filter(o => o.system_id === JITA_SYSTEM_ID);
            lowestSellOrder = jitaSellOrders.length > 0 ? jitaSellOrders.reduce((min, o) => (o.price < min.price ? o : min)) : null;
        }

        return lowestSellOrder ? lowestSellOrder.price : null;

    } catch (error) {
        console.error(`[getLowestSellPrice] Error fetching lowest sell price for typeID ${typeID}: ${error.message}`);
        return null;
    }
}

// Helper to build a paginated LP store page (select + nav buttons)
function generateLpPageComponent(sessionId, sessionData) {
    const { offers, currentPage, corpName } = sessionData;
    const itemsPerPage = 25;
    const totalPages = Math.max(1, Math.ceil(offers.length / itemsPerPage));
    const start = currentPage * itemsPerPage;
    const end = start + itemsPerPage;
    const currentItems = offers.slice(start, end);

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`lp_select:${sessionId}`)
        .setPlaceholder(`Page ${currentPage + 1} of ${totalPages} - Select an item...`)
        .addOptions(currentItems.map((offer, idx) => {
            const itemName = getTypeNameByID(offer.type_id) || `Item ID ${offer.type_id}`;
            const truncatedName = itemName.length > 90 ? itemName.substring(0, 87) + '...' : itemName;
            // Make the value unique by appending the absolute index on the page
            const absoluteIdx = start + idx;
            return {
                label: truncatedName,
                description: `${offer.lp_cost.toLocaleString()} LP`.substring(0, 100),
                value: `${offer.type_id}:${absoluteIdx}`
            };
        }));

    const prevButton = new ButtonBuilder()
        .setCustomId(`lp_prev:${sessionId}`)
        .setLabel('Previous')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(currentPage === 0);

    const nextButton = new ButtonBuilder()
        .setCustomId(`lp_next:${sessionId}`)
        .setLabel('Next')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(currentPage >= totalPages - 1);

    const selectRow = new ActionRowBuilder().addComponents(selectMenu);
    const buttonRow = new ActionRowBuilder().addComponents(prevButton, nextButton);

    return {
        content: `**${corpName}** LP Store | **${offers.length}** items found. Page **${currentPage + 1}** of **${totalPages}**.`,
        components: [selectRow, buttonRow]
    };
}

/**
 * Fetches the Corporation ID for a given corporation name.
 * @param {string} corpName - The name of the corporation.
 * @returns {Promise<number|null>} The corporation ID or null if not found.
 */
async function getCorporationID(corpName) {
    console.log(`[getCorporationID] Looking up corporation: "${corpName}"`);

    // First, try direct match with our verified corporation IDs
    if (CORPORATION_IDS[corpName]) {
        const corpID = CORPORATION_IDS[corpName];
        console.log(`[getCorporationID] ✅ Direct match found: ${corpName} = ${corpID}`);
        return corpID;
    }

    // Try fuzzy matching - check if any corp name contains the search term
    const searchTerm = corpName.toLowerCase();
    for (const [name, id] of Object.entries(CORPORATION_IDS)) {
        if (name.toLowerCase().includes(searchTerm) || searchTerm.includes(name.toLowerCase())) {
            console.log(`[getCorporationID] ✅ Fuzzy match found: "${corpName}" matched "${name}" = ${id}`);
            return id;
        }
    }

    console.log(`[getCorporationID] ❌ No match found for "${corpName}"`);
    console.log(`[getCorporationID] Available corporations:`, Object.keys(CORPORATION_IDS).join(', '));
    return null;
}


// Load Type IDs on startup (Local file -> Remote fallback)
loadTypeIDs().then(() => {
    console.log("✅ Type ID database loaded successfully");
}).catch(error => {
    console.error("❌ Failed to load Type ID database:", error.message);
});

// Error handling for unhandled promises and exceptions
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('📴 SIGTERM received, shutting down gracefully...');
    await twitchBot.disconnect();
    if (hasDiscordCredentials) {
        client.destroy();
    }
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('📴 SIGINT received, shutting down gracefully...');
    await twitchBot.disconnect();
    if (hasDiscordCredentials) {
        client.destroy();
    }
    process.exit(0);
});

// Set the server to listen on the appropriate port
const port = process.env.PORT || 8080;

app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Server is running on port ${port}`);
    console.log(`🤖 Discord Bot: ${hasDiscordCredentials ? (client.user ? client.user.tag : 'connecting...') : 'disabled'}`);
    console.log(`🎮 Twitch Bot: ${twitchBot.isReady() ? 'connected' : 'not connected'}`);
    console.log(`📊 Health check: http://localhost:${port}/health`);
});
