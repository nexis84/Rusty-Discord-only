# 🎉 RustyBot Giveaway System Guide

## Overview
RustyBot now includes a comprehensive giveaway system that allows server moderators to run automated giveaways with winner notifications, IGN collection, and automated announcements.

## Features
- ✅ Easy giveaway creation with slash commands
- ⏱️ Flexible duration settings (1 minute to 1 week)
- 👥 Multiple winner support
- 🎯 One-click entry via button
- 📧 Automatic DM notifications to winners
- 📝 IGN collection via modal forms
- 📢 Optional IGN announcement channel
- 🔄 Reroll functionality
- 📊 Active giveaway listing
- ⏹️ Manual early termination

## Commands

### `/giveaway` - Create a Giveaway
Create a new giveaway with customizable settings.

**Required Options:**
- `prize` - The prize description (e.g., "1 Billion ISK", "PLEX x500")
- `duration` - Duration in minutes (1-10080)

**Optional Options:**
- `winners` - Number of winners (default: 1, max: 20)
- `description` - Additional requirements or details
- `ign_channel` - Channel where winner IGNs will be posted

**Example:**
```
/giveaway prize:500 PLEX duration:60 winners:3 description:Must be subscribed to enter!
```

**Permissions Required:** Manage Server

---

### `/giveaway-list` - List Active Giveaways
View all currently active giveaways in the server.

**Example:**
```
/giveaway-list
```

Shows:
- Giveaway ID
- Prize
- Time remaining
- Number of entries
- Channel location

**Permissions Required:** Manage Server

---

### `/giveaway-end` - End a Giveaway Early
Manually end an active giveaway before its scheduled time.

**Required Options:**
- `giveaway_id` - The unique ID of the giveaway

**Example:**
```
/giveaway-end giveaway_id:giveaway_1696275600_abc123
```

**Permissions Required:** Manage Server (or be the giveaway creator)

---

### `/giveaway-reroll` - Reroll Winners
Pick new random winners from the existing participants.

**Required Options:**
- `giveaway_id` - The unique ID of the ended giveaway

**Example:**
```
/giveaway-reroll giveaway_id:giveaway_1696275600_abc123
```

**Use Cases:**
- Original winner doesn't respond
- Winner is disqualified
- Need to pick additional winners

**Permissions Required:** Manage Server (or be the giveaway creator)

---

## How It Works

### For Moderators:

1. **Create a Giveaway:**
   ```
   /giveaway prize:1 Billion ISK duration:120 winners:1
   ```

2. **Monitor Entries:**
   - The giveaway message updates in real-time with entry count
   - Use `/giveaway-list` to see all active giveaways

3. **Automatic Winner Selection:**
   - Bot automatically picks winners when time expires
   - Winners are announced in the channel
   - Winners receive DMs with instructions

4. **Collect IGNs:**
   - Winners submit IGNs via DM modal
   - IGNs are posted to designated channel (if configured)
   - You receive DM notifications when IGNs are submitted

5. **Reroll if Needed:**
   ```
   /giveaway-reroll giveaway_id:giveaway_1696275600_abc123
   ```

---

### For Participants:

1. **Enter the Giveaway:**
   - Click the "🎉 Enter Giveaway" button on the giveaway message
   - You'll receive confirmation that you've entered

2. **If You Win:**
   - You'll receive a DM from RustyBot
   - Click "📝 Submit IGN" button in the DM
   - Fill out the form with your EVE Online character name
   - Submit and wait for the host to contact you

3. **Claiming Your Prize:**
   - The giveaway host will contact you in-game or via Discord
   - Provide any additional information requested
   - Receive your prize!

---

## Winner Notification Flow

When a giveaway ends:

1. **Channel Announcement:**
   - Original giveaway message updates to "ENDED"
   - New message posted mentioning all winners
   - Entry button is removed

2. **Winner DMs:**
   - Each winner receives a congratulations DM
   - DM includes a button to submit IGN
   - Instructions for claiming prize

3. **IGN Submission:**
   - Winner clicks "Submit IGN" button
   - Modal form appears
   - Winner enters character name and optional contact
   - Confirmation message sent

4. **Host Notification:**
   - IGN posted to designated channel (if configured)
   - Host receives DM with winner details
   - Host can now deliver prize

---

## Best Practices

### Creating Effective Giveaways:

✅ **Be Clear About the Prize**
```
Good: "500 PLEX + 1B ISK"
Bad: "Some stuff"
```

✅ **Set Reasonable Durations**
- Short: 15-60 minutes (quick giveaways)
- Medium: 1-6 hours (during events)
- Long: 12-48 hours (major prizes)

✅ **Add Entry Requirements**
```
/giveaway prize:10B ISK duration:120 description:Must be level 15+ and have Discord Nitro
```

✅ **Use IGN Channel**
Set up a dedicated channel for winner announcements to keep things organized.

---

### Managing Giveaways:

✅ **Monitor Entries**
Use `/giveaway-list` periodically to check participation levels

✅ **Handle No-Shows**
If a winner doesn't respond within 24-48 hours, use `/giveaway-reroll`

✅ **Clear Communication**
Respond to winner DMs promptly with prize delivery instructions

✅ **Keep IDs Handy**
Copy the giveaway ID from `/giveaway-list` for easy management

---

## Troubleshooting

### "I can't DM the bot!"
Make sure your Discord privacy settings allow DMs from server members:
1. Server Settings → Privacy Settings
2. Enable "Allow direct messages from server members"

### "The winner didn't receive a DM"
- Check if they have DMs disabled
- The bot will notify in the channel if DM fails
- Winner can contact you directly with their IGN

### "I need to cancel a giveaway"
Use `/giveaway-end giveaway_id:YOUR_ID` to end it early

### "The giveaway ended but no winners"
This means no one entered the giveaway. The entry count is shown in real-time on the giveaway message.

### "How do I find the giveaway ID?"
- Use `/giveaway-list` to see all active giveaways with their IDs
- The ID is also shown in the footer of the giveaway message
- Format: `giveaway_1696275600_abc123`

---

## Examples

### Basic Giveaway:
```
/giveaway prize:100 Million ISK duration:30
```

### Large Multi-Winner Giveaway:
```
/giveaway prize:PLEX x50 duration:240 winners:10 description:Subscribe to the channel!
```

### Event Giveaway with IGN Channel:
```
/giveaway prize:Carrier + Fittings duration:1440 winners:1 ign_channel:#giveaway-winners description:Must attend the fleet event!
```

---

## Technical Details

- **Persistence:** Giveaways are stored in memory (will reset on bot restart)
- **Timers:** Automated end times are scheduled with millisecond precision
- **Random Selection:** Uses Fisher-Yates shuffle for fair winner selection
- **Duplicate Prevention:** Users can only enter each giveaway once
- **Rate Limiting:** Standard Discord API rate limits apply

---

## Future Enhancements

Planned features:
- Database persistence for giveaway history
- Role-based entry requirements
- Minimum account age requirements
- Entry multipliers for boosters
- Scheduled/recurring giveaways
- Analytics dashboard

---

## Support

For issues or questions:
- Check bot console logs for error messages
- Ensure bot has proper permissions (Send Messages, Embed Links, Add Reactions, Manage Messages)
- Verify giveaway IDs are correct
- Contact bot administrator if problems persist

---

**Happy Giveaway Hosting! 🎉**
