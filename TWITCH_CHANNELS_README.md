# Twitch Channel Configuration

The `twitch-channels.js` file allows you to easily manage which Twitch channels your bot will join and how it behaves in each channel.

## Quick Setup

1. **Edit `twitch-channels.js`**
2. **Add your channel names** to the `channels` array
3. **Restart your bot**

## Example Configuration

```javascript
export const TWITCH_CONFIG = {
    channels: [
        'your_channel_name',      // Your main channel
        'friend_channel',         // Friend's channel
        'corp_channel',          // Corporation channel
        'alliance_channel',      // Alliance channel
    ],
    
    settings: {
        commandPrefix: '!',           // Commands start with !
        cooldownMs: 5000,            // 5 second cooldown between commands
        respondInAllChannels: true,   // Respond in all joined channels
    }
};
```

## Advanced Configuration

### Channel-Specific Settings

You can configure different settings for specific channels:

```javascript
channelSettings: {
    'special_channel': {
        commandPrefix: '$',                    // Use $ instead of !
        cooldownMs: 10000,                    // Longer cooldown (10 seconds)
        allowedCommands: ['market', 'price'], // Only allow certain commands
    },
    'quiet_channel': {
        cooldownMs: 30000,                    // Very long cooldown (30 seconds)
        allowedCommands: ['help'],            // Only allow help command
    }
}
```

### Settings Explained

| Setting | Description | Default |
|---------|-------------|---------|
| `commandPrefix` | What character starts commands (`!market`, `$market`, etc.) | `'!'` |
| `cooldownMs` | Milliseconds between command responses (prevents spam) | `5000` |
| `respondInAllChannels` | Should bot respond in all joined channels? | `true` |
| `autoReconnect` | Should bot reconnect if disconnected? | `true` |
| `announceJoinLeave` | Should bot announce when joining/leaving? | `false` |

### Channel-Specific Commands

Limit which commands work in specific channels:

```javascript
channelSettings: {
    'trading_channel': {
        allowedCommands: ['market', 'price', 'info'], // Only trading commands
    },
    'general_channel': {
        allowedCommands: ['help', 'ping'],            // Only basic commands
    }
}
```

## Adding New Channels

To add a new channel:

1. Open `twitch-channels.js`
2. Add the channel name to the `channels` array:
   ```javascript
   channels: [
       'existing_channel',
       'new_channel_name',  // <- Add this line
   ],
   ```
3. Save the file
4. Restart the bot

**Note:** Channel names should NOT include the `#` symbol.

## Removing Channels

To remove a channel:

1. Open `twitch-channels.js`
2. Delete or comment out the channel name:
   ```javascript
   channels: [
       'keep_this_channel',
       // 'remove_this_channel',  // <- Commented out
   ],
   ```
3. Save and restart the bot

## Testing Your Configuration

After making changes:

1. **Restart the bot**
2. **Check the console** for confirmation messages
3. **Test in each channel** with `!ping` or `!test`

The bot will log which channels it joins and any configuration issues.

## Troubleshooting

### Bot Not Responding in a Channel

1. **Check the channel name** is correct in `twitch-channels.js`
2. **Verify the channel is in the `channels` array**
3. **Check `shouldRespondInChannel`** returns `true` for that channel
4. **Look for errors** in the bot console

### Commands Not Working

1. **Check the command prefix** - default is `!`
2. **Verify command cooldown** hasn't been hit
3. **Check `allowedCommands`** if using channel-specific settings

### Bot Joins But Doesn't Respond

1. **Check bot permissions** in the Twitch channel
2. **Verify OAuth token** has chat permissions
3. **Look for permission errors** in bot console

## Environment Variable Fallback

If `twitch-channels.js` has no channels configured, the bot will fall back to the `TWITCH_CHANNELS` environment variable:

```bash
TWITCH_CHANNELS=channel1,channel2,channel3
```

However, using `twitch-channels.js` is recommended for easier management.