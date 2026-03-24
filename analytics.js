// Simple Analytics System for RustyBot
// Tracks command usage, errors, and basic metrics

export class BotAnalytics {
    constructor() {
        this.stats = {
            commands: new Map(), // Command usage count
            users: new Set(), // Unique users
            errors: [],
            startTime: Date.now(),
            totalCommands: 0,
            platforms: { discord: 0, twitch: 0 }
        };
        
        // Save stats periodically
        setInterval(() => this.saveStats(), 300000); // Every 5 minutes
    }

    // Track command usage
    trackCommand(command, username, platform = 'unknown') {
        this.stats.totalCommands++;
        this.stats.users.add(username);
        this.stats.platforms[platform] = (this.stats.platforms[platform] || 0) + 1;
        
        if (!this.stats.commands.has(command)) {
            this.stats.commands.set(command, 0);
        }
        this.stats.commands.set(command, this.stats.commands.get(command) + 1);
        
        console.log(`[Analytics] ${platform}:${command} by ${username}`);
    }

    // Track errors
    trackError(error, context) {
        this.stats.errors.push({
            timestamp: Date.now(),
            error: error.message,
            context,
            stack: error.stack
        });
        
        // Keep only last 100 errors
        if (this.stats.errors.length > 100) {
            this.stats.errors = this.stats.errors.slice(-100);
        }
    }

    // Get statistics summary
    getStats() {
        const uptime = Date.now() - this.stats.startTime;
        const uptimeHours = Math.floor(uptime / (1000 * 60 * 60));
        
        return {
            uptime: `${uptimeHours} hours`,
            totalCommands: this.stats.totalCommands,
            uniqueUsers: this.stats.users.size,
            topCommands: Array.from(this.stats.commands.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5),
            platforms: this.stats.platforms,
            errorCount: this.stats.errors.length,
            commandsPerHour: Math.round(this.stats.totalCommands / Math.max(uptimeHours, 1))
        };
    }

    // Save stats to file
    saveStats() {
        try {
            const fs = require('fs');
            const statsData = {
                ...this.getStats(),
                timestamp: new Date().toISOString()
            };
            fs.writeFileSync('bot-stats.json', JSON.stringify(statsData, null, 2));
        } catch (error) {
            console.error('[Analytics] Failed to save stats:', error);
        }
    }
}

// Export singleton instance
export const analytics = new BotAnalytics();