import axios from 'axios';
import Bottleneck from 'bottleneck';

const USER_AGENT = process.env.USER_AGENT || 'RustyBot/2.0 EVE Gatecheck Integration';

// Rate limiter specifically for ESI and zKillboard
const esiLimiter = new Bottleneck({
    minTime: 200,
    maxConcurrent: 3
});

const zkillLimiter = new Bottleneck({
    minTime: 1500, // zKillboard is strict
    maxConcurrent: 1
});

// Cache for system IDs and names
const systemCache = new Map();
const nameCache = new Map();

/**
 * Gatecheck Client for EVE Online route security analysis
 */
export class GatecheckClient {
    constructor() {
        this.esiBaseUrl = 'https://esi.evetech.net/latest';
        this.zkillBaseUrl = 'https://zkillboard.com/api';
    }

    /**
     * Resolve a solar system name to its ID using ESI
     * @param {string} name - Solar system name
     * @returns {Promise<number|null>} System ID or null if not found
     */
    async getIdFromName(name) {
        const normalizedName = name.toLowerCase().trim();
        
        // Check cache
        if (systemCache.has(normalizedName)) {
            return systemCache.get(normalizedName);
        }

        try {
            const response = await esiLimiter.schedule(() =>
                axios.post(`${this.esiBaseUrl}/universe/ids/`, [name], {
                    headers: { 'User-Agent': USER_AGENT },
                    timeout: 15000
                })
            );

            if (response.data && response.data.systems && response.data.systems.length > 0) {
                const systemId = response.data.systems[0].id;
                systemCache.set(normalizedName, systemId);
                return systemId;
            }

            console.log(`[Gatecheck] System '${name}' not found`);
            return null;
        } catch (error) {
            console.error(`[Gatecheck] Error resolving system name '${name}':`, error.message);
            return null;
        }
    }

    /**
     * Resolve a system ID to its name using ESI
     * @param {number} systemId - System ID
     * @returns {Promise<string|null>} System name or null if not found
     */
    async getNameFromId(systemId) {
        // Check cache
        if (nameCache.has(systemId)) {
            return nameCache.get(systemId);
        }

        try {
            const response = await esiLimiter.schedule(() =>
                axios.post(`${this.esiBaseUrl}/universe/names/`, [systemId], {
                    headers: { 'User-Agent': USER_AGENT },
                    timeout: 15000
                })
            );

            if (response.data && response.data.length > 0) {
                const systemName = response.data[0].name;
                nameCache.set(systemId, systemName);
                return systemName;
            }

            return null;
        } catch (error) {
            console.error(`[Gatecheck] Error resolving system ID ${systemId}:`, error.message);
            return null;
        }
    }

    /**
     * Calculate route between two systems
     * @param {number} originId - Origin system ID
     * @param {number} destinationId - Destination system ID
     * @param {string} preference - Route preference: 'shortest', 'secure', 'insecure'
     * @returns {Promise<number[]>} Array of system IDs in route
     */
    async getRoute(originId, destinationId, preference = 'shortest') {
        try {
            const response = await esiLimiter.schedule(() =>
                axios.get(`${this.esiBaseUrl}/route/${originId}/${destinationId}/`, {
                    params: { flag: preference },
                    headers: { 'User-Agent': USER_AGENT },
                    timeout: 10000
                })
            );

            return response.data || [];
        } catch (error) {
            console.error(`[Gatecheck] Error calculating route:`, error.message);
            return [];
        }
    }

    /**
     * Fetch recent kills for a system from zKillboard
     * @param {number} systemId - System ID
     * @param {number} duration - Duration in seconds (default: 3600 = 1 hour)
     * @returns {Promise<Array>} Array of kill data
     */
    async getKills(systemId, duration = 3600) {
        try {
            const response = await zkillLimiter.schedule(() =>
                axios.get(`${this.zkillBaseUrl}/kills/systemID/${systemId}/pastSeconds/${duration}/`, {
                    headers: { 'User-Agent': USER_AGENT },
                    timeout: 10000
                })
            );

            return response.data || [];
        } catch (error) {
            if (error.response?.status === 429) {
                console.warn('[Gatecheck] zKillboard rate limit hit, waiting...');
                await new Promise(resolve => setTimeout(resolve, 3000));
                // Try once more
                try {
                    const retryResponse = await axios.get(
                        `${this.zkillBaseUrl}/kills/systemID/${systemId}/pastSeconds/${duration}/`,
                        {
                            headers: { 'User-Agent': USER_AGENT },
                            timeout: 10000
                        }
                    );
                    return retryResponse.data || [];
                } catch (retryError) {
                    console.error('[Gatecheck] zKillboard retry failed:', retryError.message);
                }
            }
            console.error(`[Gatecheck] Error fetching kills for system ${systemId}:`, error.message);
            return [];
        }
    }

    /**
     * Analyze kills to detect hazards
     * @param {Array} kills - Array of kill data from zKillboard
     * @returns {Object} Hazard analysis results
     */
    analyzeSystem(kills) {
        const hazard = {
            camp: false,
            smartbomb: false,
            bubble: false,
            gateKills: 0,
            totalKills: kills.length,
            details: []
        };

        if (!kills || kills.length === 0) {
            return hazard;
        }

        // Ship type IDs for interdictors and HICs
        const interdictorIds = [22452, 22456, 22460, 22464]; // Heretic, Sabre, Eris, Flycatcher
        const hicIds = [11995, 12011, 12015, 12019]; // Onyx, Broadsword, Phobos, Devoter
        const bubbleShips = [...interdictorIds, ...hicIds];

        // Common smartbomb type IDs
        const smartbombIds = [
            3554, 3556, 3558, 3560, // Small smartbombs
            10846, 10848, 10850, 10852, // Medium smartbombs
            13278, 13280, 13282, 13284, // Large smartbombs
            19744, 19746, 19748, 19750  // XL smartbombs
        ];

        for (const kill of kills) {
            const attackers = kill.attackers || [];
            
            // Check for bubble ships
            for (const attacker of attackers) {
                const shipTypeId = attacker.ship_type_id;
                if (bubbleShips.includes(shipTypeId)) {
                    hazard.bubble = true;
                    hazard.details.push('Interdictor/HIC detected');
                    break;
                }

                // Check for smartbombs
                const weaponTypeId = attacker.weapon_type_id;
                if (smartbombIds.includes(weaponTypeId)) {
                    hazard.smartbomb = true;
                    hazard.details.push('Smartbomb kill detected');
                    break;
                }
            }

            hazard.gateKills++;
        }

        // Determine if it's a camp based on kill volume
        if (hazard.gateKills >= 3) {
            hazard.camp = true;
            hazard.details.push(`${hazard.gateKills} kills in last hour`);
        }

        return hazard;
    }

    /**
     * Get system security status from ESI
     * @param {number} systemId - System ID
     * @returns {Promise<number>} Security status (-1.0 to 1.0)
     */
    async getSystemSecurity(systemId) {
        try {
            const response = await esiLimiter.schedule(() =>
                axios.get(`${this.esiBaseUrl}/universe/systems/${systemId}/`, {
                    headers: { 'User-Agent': USER_AGENT },
                    timeout: 15000
                })
            );

            return response.data?.security_status || 0;
        } catch (error) {
            console.error(`[Gatecheck] Error fetching security for system ${systemId}:`, error.message);
            return 0;
        }
    }

    /**
     * Analyze an entire route for hazards
     * @param {number[]} routeIds - Array of system IDs in the route
     * @param {number} duration - Time window for kills (seconds)
     * @returns {Promise<Array>} Array of system analysis results
     */
    async analyzeRoute(routeIds, duration = 3600) {
        const results = [];

        for (const systemId of routeIds) {
            const [systemName, kills, security] = await Promise.all([
                this.getNameFromId(systemId),
                this.getKills(systemId, duration),
                this.getSystemSecurity(systemId)
            ]);

            const hazard = this.analyzeSystem(kills);
            
            // Determine threat level
            let threatLevel = 'safe';
            let emoji = '🟢';

            if (hazard.smartbomb || hazard.bubble) {
                threatLevel = 'extreme';
                emoji = '🟣';
            } else if (hazard.camp || hazard.totalKills >= 3) {
                threatLevel = 'high';
                emoji = '🔴';
            } else if (hazard.totalKills > 0) {
                threatLevel = 'moderate';
                emoji = '🟡';
            }

            results.push({
                systemId,
                systemName,
                security: security.toFixed(1),
                threatLevel,
                emoji,
                kills: hazard.totalKills,
                hazard
            });
        }

        return results;
    }
}

// Export singleton instance
export const gatecheckClient = new GatecheckClient();
