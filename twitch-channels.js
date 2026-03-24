// Twitch Bot Channel Configuration
// This file controls which Twitch channels the bot will join and monitor

export const TWITCH_CONFIG = {
    // List of Twitch channels the bot should join (without the # prefix)
    // Add or remove channels as needed - changes require bot restart
    channels: [
        // Add your channels here, one per line (remove the // to uncomment)
        'ne_x_is',
        'contempoenterprises',
        'pyrophobic',
        'gidiang',
        // 'your_channel_name',
        // 'friend_channel',
        // 'corp_channel',
        
        // Examples (uncomment and modify these):
        // 'evestreamer',
        // 'eveonline_official',
        // 'your_twitch_username',
    ],
    
    // Bot behavior settings
    settings: {
        // Should the bot respond to commands in all joined channels?
        respondInAllChannels: true,
        
        // Should the bot announce when it joins/leaves channels?
        announceJoinLeave: false,
        
        // Command prefix for Twitch chat (e.g., !market, !price)
        commandPrefix: '!',
        
        // Minimum time between responses to prevent spam (milliseconds)
        cooldownMs: 5000,
        
        // Should the bot auto-reconnect if disconnected?
        autoReconnect: true,
    },
    
    // Channel-specific settings (optional)
    channelSettings: {
        // Example of channel-specific configuration:
        // 'specificchannel': {
        //     commandPrefix: '$',
        //     cooldownMs: 10000,
        //     allowedCommands: ['market', 'price'], // Only these commands
        // },
    }
};

// Helper function to check if bot should respond in a specific channel
export function shouldRespondInChannel(channelName) {
    const cleanChannel = channelName.replace('#', '').toLowerCase();
    
    // Check if channel is in our list
    if (!TWITCH_CONFIG.channels.map(c => c.toLowerCase()).includes(cleanChannel)) {
        return false;
    }
    
    // Check channel-specific settings
    if (TWITCH_CONFIG.channelSettings[cleanChannel]) {
        return true; // Has specific settings, so it's allowed
    }
    
    return TWITCH_CONFIG.settings.respondInAllChannels;
}

// Helper function to get command prefix for a channel
export function getCommandPrefix(channelName) {
    const cleanChannel = channelName.replace('#', '').toLowerCase();
    
    if (TWITCH_CONFIG.channelSettings[cleanChannel]?.commandPrefix) {
        return TWITCH_CONFIG.channelSettings[cleanChannel].commandPrefix;
    }
    
    return TWITCH_CONFIG.settings.commandPrefix;
}

// Helper function to get cooldown for a channel
export function getCooldown(channelName) {
    const cleanChannel = channelName.replace('#', '').toLowerCase();
    
    if (TWITCH_CONFIG.channelSettings[cleanChannel]?.cooldownMs) {
        return TWITCH_CONFIG.channelSettings[cleanChannel].cooldownMs;
    }
    
    return TWITCH_CONFIG.settings.cooldownMs;
}

// Helper function to check if a command is allowed in a channel
export function isCommandAllowed(channelName, command) {
    const cleanChannel = channelName.replace('#', '').toLowerCase();
    
    if (TWITCH_CONFIG.channelSettings[cleanChannel]?.allowedCommands) {
        return TWITCH_CONFIG.channelSettings[cleanChannel].allowedCommands.includes(command);
    }
    
    return true; // All commands allowed by default
}
