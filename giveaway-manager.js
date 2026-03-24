// Giveaway Manager for Discord Bot
// Handles giveaway creation, participant tracking, and winner selection

import { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

class GiveawayManager {
    constructor() {
        this.activeGiveaways = new Map(); // Map of giveawayId -> giveaway data
        this.giveawayTimers = new Map(); // Map of giveawayId -> timeout
        this.participants = new Map(); // Map of giveawayId -> Set of user IDs
    }

    /**
     * Create a new giveaway
     * @param {Object} options - Giveaway configuration
     * @returns {string} Giveaway ID
     */
    createGiveaway(options) {
        const giveawayId = `giveaway_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const giveaway = {
            id: giveawayId,
            prize: options.prize,
            description: options.description || 'No description provided',
            duration: options.duration, // in milliseconds
            endTime: Date.now() + options.duration,
            channelId: options.channelId,
            messageId: null, // Will be set after message is sent
            creatorId: options.creatorId,
            creatorName: options.creatorName,
            winnersCount: options.winnersCount || 1,
            requirementText: options.requirementText || 'React with 🎉 to enter!',
            ignChannelId: options.ignChannelId || null, // IGN announcement channel
            status: 'active' // active, ended, cancelled
        };

        this.activeGiveaways.set(giveawayId, giveaway);
        this.participants.set(giveawayId, new Set());

        console.log(`[Giveaway] Created: ${giveawayId} - Prize: ${options.prize} - Duration: ${options.duration}ms`);
        
        return giveawayId;
    }

    /**
     * Generate giveaway embed
     * @param {Object} giveaway - Giveaway data
     * @returns {EmbedBuilder} Discord embed
     */
    createGiveawayEmbed(giveaway) {
        const timeRemaining = giveaway.endTime - Date.now();
        const endTimestamp = Math.floor(giveaway.endTime / 1000);
        
        const embed = new EmbedBuilder()
            .setColor(0xFF6B6B)
            .setTitle('🎉 GIVEAWAY 🎉')
            .setDescription(`**Prize:** ${giveaway.prize}\n\n${giveaway.description}`)
            .addFields(
                { name: '📋 How to Enter', value: giveaway.requirementText, inline: false },
                { name: '⏰ Ends', value: `<t:${endTimestamp}:R> (<t:${endTimestamp}:F>)`, inline: true },
                { name: '🏆 Winners', value: `${giveaway.winnersCount}`, inline: true },
                { name: '👥 Entries', value: `${this.participants.get(giveaway.id)?.size || 0}`, inline: true }
            )
            .setFooter({ text: `Hosted by ${giveaway.creatorName} • ID: ${giveaway.id}` });

        return embed;
    }

    /**
     * Create entry and leave buttons for giveaway
     * @param {string} giveawayId - Giveaway ID
     * @returns {ActionRowBuilder} Button row
     */
    createEntryButton(giveawayId) {
        const enterButton = new ButtonBuilder()
            .setCustomId(`giveaway_enter:${giveawayId}`)
            .setLabel('🎉 Enter Giveaway')
            .setStyle(ButtonStyle.Success);

        const leaveButton = new ButtonBuilder()
            .setCustomId(`giveaway_leave:${giveawayId}`)
            .setLabel('❌ Leave Giveaway')
            .setStyle(ButtonStyle.Danger);

        return new ActionRowBuilder().addComponents(enterButton, leaveButton);
    }

    /**
     * Add a participant to a giveaway
     * @param {string} giveawayId - Giveaway ID
     * @param {string} userId - User ID
     * @returns {boolean} Success status
     */
    addParticipant(giveawayId, userId) {
        const giveaway = this.activeGiveaways.get(giveawayId);
        if (!giveaway || giveaway.status !== 'active') {
            return false;
        }

        const participants = this.participants.get(giveawayId);
        if (participants.has(userId)) {
            return false; // Already entered
        }

        participants.add(userId);
        console.log(`[Giveaway] User ${userId} entered giveaway ${giveawayId} (Total: ${participants.size})`);
        return true;
    }

    /**
     * Remove a participant from a giveaway
     * @param {string} giveawayId - Giveaway ID
     * @param {string} userId - User ID
     * @returns {boolean} Success status
     */
    removeParticipant(giveawayId, userId) {
        const participants = this.participants.get(giveawayId);
        if (!participants) return false;
        
        const removed = participants.delete(userId);
        console.log(`[Giveaway] User ${userId} left giveaway ${giveawayId}`);
        return removed;
    }

    /**
     * Schedule giveaway end
     * @param {string} giveawayId - Giveaway ID
     * @param {Function} endCallback - Callback function to execute when giveaway ends
     */
    scheduleEnd(giveawayId, endCallback) {
        const giveaway = this.activeGiveaways.get(giveawayId);
        if (!giveaway) return;

        const timeUntilEnd = giveaway.endTime - Date.now();
        
        if (timeUntilEnd <= 0) {
            // Giveaway should end immediately
            endCallback(giveawayId);
            return;
        }

        const timer = setTimeout(() => {
            endCallback(giveawayId);
        }, timeUntilEnd);

        this.giveawayTimers.set(giveawayId, timer);
        console.log(`[Giveaway] Scheduled end for ${giveawayId} in ${timeUntilEnd}ms`);
    }

    /**
     * Pick random winners from participants
     * @param {string} giveawayId - Giveaway ID
     * @returns {Array<string>} Array of winner user IDs
     */
    pickWinners(giveawayId) {
        const giveaway = this.activeGiveaways.get(giveawayId);
        const participants = this.participants.get(giveawayId);

        if (!giveaway || !participants || participants.size === 0) {
            return [];
        }

        const participantArray = Array.from(participants);
        const winnersCount = Math.min(giveaway.winnersCount, participantArray.length);
        const winners = [];

        // Fisher-Yates shuffle and pick winners
        const shuffled = [...participantArray];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        for (let i = 0; i < winnersCount; i++) {
            winners.push(shuffled[i]);
        }

        console.log(`[Giveaway] Picked ${winners.length} winners for ${giveawayId}: ${winners.join(', ')}`);
        return winners;
    }

    /**
     * End a giveaway
     * @param {string} giveawayId - Giveaway ID
     */
    endGiveaway(giveawayId) {
        const giveaway = this.activeGiveaways.get(giveawayId);
        if (!giveaway) return;

        giveaway.status = 'ended';
        
        // Clear timer if exists
        const timer = this.giveawayTimers.get(giveawayId);
        if (timer) {
            clearTimeout(timer);
            this.giveawayTimers.delete(giveawayId);
        }

        console.log(`[Giveaway] Ended: ${giveawayId}`);
    }

    /**
     * Create ended giveaway embed
     * @param {Object} giveaway - Giveaway data
     * @param {Array<string>} winnerIds - Winner user IDs
     * @returns {EmbedBuilder} Discord embed
     */
    createEndedEmbed(giveaway, winnerIds) {
        const embed = new EmbedBuilder()
            .setColor(0x90EE90)
            .setTitle('🎉 GIVEAWAY ENDED 🎉')
            .setDescription(`**Prize:** ${giveaway.prize}\n\n${giveaway.description}`)
            .addFields(
                { name: '👥 Total Entries', value: `${this.participants.get(giveaway.id)?.size || 0}`, inline: true },
                { name: '🏆 Winners', value: winnerIds.length > 0 ? winnerIds.map(id => `<@${id}>`).join('\n') : 'No valid entries', inline: false }
            )
            .setFooter({ text: `Hosted by ${giveaway.creatorName} • Ended` })
            .setTimestamp();

        return embed;
    }

    /**
     * Create IGN submission modal
     * @param {string} giveawayId - Giveaway ID
     * @returns {ModalBuilder} Discord modal
     */
    createIgnModal(giveawayId) {
        const modal = new ModalBuilder()
            .setCustomId(`giveaway_ign:${giveawayId}`)
            .setTitle('🎉 Giveaway Winner - Submit IGN');

        const ignInput = new TextInputBuilder()
            .setCustomId('ign')
            .setLabel('Your EVE Online In-Game Name (IGN)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter your character name here')
            .setRequired(true)
            .setMaxLength(100);

        const firstRow = new ActionRowBuilder().addComponents(ignInput);

        modal.addComponents(firstRow);
        return modal;
    }

    /**
     * Get giveaway by ID
     * @param {string} giveawayId - Giveaway ID
     * @returns {Object} Giveaway data
     */
    getGiveaway(giveawayId) {
        return this.activeGiveaways.get(giveawayId);
    }

    /**
     * Cancel a giveaway
     * @param {string} giveawayId - Giveaway ID
     */
    cancelGiveaway(giveawayId) {
        const giveaway = this.activeGiveaways.get(giveawayId);
        if (!giveaway) return false;

        giveaway.status = 'cancelled';
        
        const timer = this.giveawayTimers.get(giveawayId);
        if (timer) {
            clearTimeout(timer);
            this.giveawayTimers.delete(giveawayId);
        }

        console.log(`[Giveaway] Cancelled: ${giveawayId}`);
        return true;
    }

    /**
     * Get all active giveaways
     * @returns {Array<Object>} Array of active giveaways
     */
    getActiveGiveaways() {
        return Array.from(this.activeGiveaways.values()).filter(g => g.status === 'active');
    }

    /**
     * Update giveaway message ID
     * @param {string} giveawayId - Giveaway ID
     * @param {string} messageId - Message ID
     */
    setMessageId(giveawayId, messageId) {
        const giveaway = this.activeGiveaways.get(giveawayId);
        if (giveaway) {
            giveaway.messageId = messageId;
        }
    }
}

export { GiveawayManager };
