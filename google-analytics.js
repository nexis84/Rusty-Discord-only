// Google Analytics 4 Integration for RustyBot
// Tracks events, user behavior, and custom metrics

import { performance } from 'perf_hooks';

export class GoogleAnalytics {
    constructor() {
        this.measurementId = process.env.GA_MEASUREMENT_ID; // Your GA4 Measurement ID
        this.apiSecret = process.env.GA_API_SECRET; // Your GA4 API Secret
        this.enabled = !!(this.measurementId && this.apiSecret);
        
        if (!this.enabled) {
            console.log('[GA4] Analytics disabled - missing GA_MEASUREMENT_ID or GA_API_SECRET');
        } else {
            console.log('[GA4] Google Analytics 4 enabled');
        }
        
        this.baseUrl = `https://www.google-analytics.com/mp/collect?measurement_id=${this.measurementId}&api_secret=${this.apiSecret}`;
    }

    // Generate a client ID for users (anonymized)
    generateClientId(username, platform) {
        // Create a hash-based client ID to anonymize users while keeping them consistent
        // Use a simple hash function for ES modules compatibility
        const input = `${platform}_${username}`;
        let hash = 0;
        for (let i = 0; i < input.length; i++) {
            const char = input.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16).padStart(8, '0').substring(0, 32);
    }

    // Send event to Google Analytics
    async sendEvent(eventData) {
        if (!this.enabled) return;

        try {
            const { default: fetch } = await import('node-fetch');
            
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(eventData)
            });

            if (!response.ok) {
                console.error('[GA4] Failed to send event:', response.status);
            }
        } catch (error) {
            // Silently fail to prevent bot crashes
            // console.error('[GA4] Error sending event:', error.message);
        }
    }

    // Track command usage
    async trackCommand(command, username, platform, additionalData = {}) {
        try {
            if (!this.enabled) return;
            const clientId = this.generateClientId(username, platform);
            
            await this.sendEvent({
                client_id: clientId,
                events: [{
                    name: 'bot_command',
                    parameters: {
                        command_name: command,
                        platform: platform,
                        user_id: clientId, // Anonymized user ID
                        engagement_time_msec: 1000,
                        session_id: Date.now().toString(),
                        ...additionalData
                    }
                }]
            });
        } catch (error) {
            // Silently fail to prevent bot crashes
        }
    }

    // Track market data requests
    async trackMarketData(itemName, typeId, quantity, username, platform, responseTime = 0) {
        const clientId = this.generateClientId(username, platform);
        
        await this.sendEvent({
            client_id: clientId,
            events: [{
                name: 'market_data_request',
                parameters: {
                    item_name: itemName,
                    type_id: typeId?.toString(),
                    quantity: quantity,
                    platform: platform,
                    response_time_ms: Math.round(responseTime),
                    user_id: clientId
                }
            }]
        });
    }

    // Track errors
    async trackError(error, context, username, platform) {
        try {
            if (!this.enabled) return;
            const clientId = this.generateClientId(username || 'anonymous', platform);
            
            await this.sendEvent({
                client_id: clientId,
                events: [{
                name: 'bot_error',
                parameters: {
                    error_message: error.message?.substring(0, 500), // Limit length
                    error_context: context,
                    platform: platform,
                    user_id: clientId
                }
            }]
        });
        } catch (trackingError) {
            // Silently fail to prevent bot crashes
        }
    }

    // Track user sessions
    async trackSession(username, platform, sessionStart = true) {
        const clientId = this.generateClientId(username, platform);
        
        await this.sendEvent({
            client_id: clientId,
            events: [{
                name: sessionStart ? 'session_start' : 'session_end',
                parameters: {
                    platform: platform,
                    user_id: clientId,
                    engagement_time_msec: sessionStart ? 0 : 30000
                }
            }]
        });
    }

    // Track API performance
    async trackApiPerformance(apiName, responseTime, success, username, platform) {
        const clientId = this.generateClientId(username, platform);
        
        await this.sendEvent({
            client_id: clientId,
            events: [{
                name: 'api_performance',
                parameters: {
                    api_name: apiName,
                    response_time_ms: Math.round(responseTime),
                    success: success,
                    platform: platform,
                    user_id: clientId
                }
            }]
        });
    }

    // Track custom events
    async trackCustomEvent(eventName, parameters, username, platform) {
        const clientId = this.generateClientId(username, platform);
        
        await this.sendEvent({
            client_id: clientId,
            events: [{
                name: eventName,
                parameters: {
                    platform: platform,
                    user_id: clientId,
                    ...parameters
                }
            }]
        });
    }

    // Create a performance timer
    createTimer() {
        const start = performance.now();
        return {
            end: () => performance.now() - start
        };
    }
}

// Export singleton instance
export const ga4 = new GoogleAnalytics();

// Helper function to wrap async operations with performance tracking
export async function trackPerformance(operation, apiName, username, platform) {
    const timer = ga4.createTimer();
    let success = true;
    let error = null;

    try {
        const result = await operation();
        return result;
    } catch (err) {
        success = false;
        error = err;
        await ga4.trackError(err, apiName, username, platform);
        throw err;
    } finally {
        const responseTime = timer.end();
        await ga4.trackApiPerformance(apiName, responseTime, success, username, platform);
    }
}