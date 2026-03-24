import axios from 'axios';
import fs from 'fs/promises';
import { MANUAL_TYPEID_MAPPINGS, getManualTypeID } from './manual-typeids.js';

/**
 * Utility functions for Twitch bot integration
 * Provides simplified versions of Discord bot functions optimized for Twitch chat
 */

// Import constants and functions from the main server
const USER_AGENT = process.env.USER_AGENT || 'RustyBot-Twitch/1.0.0 (contact@example.com)';
const JITA_SYSTEM_ID = 30000142;
const JITA_REGION_ID = 10000002;
const PLEX_TYPE_ID = 44992;
const GLOBAL_PLEX_REGION_ID = 19000001;

// Trade hub mappings for multi-hub market data (in preferred display order)
const TRADE_HUBS = [
    { name: 'Jita', regionId: 10000002, systemId: 30000142 },
    { name: 'Amarr', regionId: 10000043, systemId: 30002187 },
    { name: 'Hek', regionId: 10000042, systemId: 30002053 },
    { name: 'Dodixie', regionId: 10000032, systemId: 30002659 },
    { name: 'Rens', regionId: 10000030, systemId: 30002510 }
];

// Shared caches
const typeIDCache = new Map();
const marketCache = new Map();

// Export cache for debugging
export { marketCache, typeIDCache };

// Corporation IDs for LP stores
const CORPORATION_IDS = {
    'Sisters of EVE': 1000130,
    'Federation Navy': 1000017,
    'Republic Fleet': 1000048,
    'Imperial Navy': 1000051,
    'Caldari Navy': 1000020,
    'Concord': 1000147,
    'Inner Zone Shipping': 1000080,
    'Ishukone Corporation': 1000045,
    'Lai Dai Corporation': 1000016,
    'Hyasyoda Corporation': 1000115,
    'ORE': 1000109
};

// Maps for eve-files.com data
const eveFilesTypeIDMap = new Map();
const eveFilesIDToNameMap = new Map();
let isEveFilesTypeIDMapLoaded = false;

/**
 * Load Type IDs from local file first, fallback to remote if not available
 */
async function loadTypeIDs() {
    const localFilePath = './all_typeids.txt';
    const remoteUrl = 'https://eve-files.com/chribba/typeid.txt';

    try {
        // Try loading from local file first
        console.log('[Twitch Utils] Attempting to load Type IDs from local file:', localFilePath);
        const fileContent = await fs.readFile(localFilePath, 'utf-8');
        const lines = fileContent.split('\n');

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

                if (trimmedLine.startsWith('typeID') || trimmedLine.startsWith('-----------')) continue;

                // Parse either "TypeID - Name" or fixed-width table format.
                const match = trimmedLine.match(/^(\d+)\s*(?:-\s*|\s{2,})(.+)$/);
            if (match) {
                const typeID = parseInt(match[1], 10);
                const name = match[2].trim();
                const lowerCaseName = name.toLowerCase();

                eveFilesTypeIDMap.set(lowerCaseName, typeID);
                eveFilesIDToNameMap.set(typeID, name);
            }
        }

        isEveFilesTypeIDMapLoaded = true;
        console.log(`[Twitch Utils] ✅ Successfully loaded ${eveFilesTypeIDMap.size} Type IDs from LOCAL file`);

        // Clear any bad cached entries for PLEX
        typeIDCache.delete('plex');
        console.log('[Twitch Utils] Cleared PLEX cache for fresh lookup');
        return;

    } catch (localError) {
        console.log(`[Twitch Utils] ⚠️ Local file not found or failed to load: ${localError.message}`);
        console.log('[Twitch Utils] Falling back to remote source...');
    }

    // Fallback to remote source
    try {
        console.log('[Twitch Utils] Fetching Type IDs from remote:', remoteUrl);
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
        console.log(`[Twitch Utils] ✅ Successfully loaded ${eveFilesTypeIDMap.size} Type IDs from REMOTE source`);

        // Clear any bad cached entries for PLEX
        typeIDCache.delete('plex');
        console.log('[Twitch Utils] Cleared PLEX cache for fresh lookup');

    } catch (remoteError) {
        console.error('[Twitch Utils] ❌ Failed to load Type IDs from remote source:', remoteError.message);
        console.error('[Twitch Utils] ❌ Type ID lookups will rely on ESI and Fuzzwork only');
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
        console.log(`[Twitch Utils - isValidTradeableItem] TypeID ${typeID}: name="${itemData.name}", published=${itemData.published}, group_id=${itemData.group_id}`);

        // Allow published items - SKINs are published and should be included
        // Group ID 1950 is SKINs, which should be allowed
        if (itemData.published === true) {
            return true;
        }

        // For debugging: log why item was rejected
        console.log(`[Twitch Utils - isValidTradeableItem] Rejected TypeID ${typeID}: published=${itemData.published}`);
        return false;
    } catch (error) {
        console.log(`[Twitch Utils] Failed to validate type ID ${typeID}: ${error.message}`);
        return false;
    }
}

/**
 * Find all matching typeID candidates from the local database
 * Returns candidates ranked by relevance
 */
function findMatchingCandidates(searchTerm) {
    const lowerSearchTerm = searchTerm.toLowerCase().trim();
    const candidates = [];
    const isBlueprintRequest = lowerSearchTerm.includes('blueprint');

    // Search through all loaded type names
    for (const [typeID, name] of eveFilesIDToNameMap.entries()) {
        const lowerName = name.toLowerCase();
        
        // Exact match gets highest priority
        if (lowerName === lowerSearchTerm) {
            candidates.push({ typeID, name, score: 1000, matchType: 'exact' });
        }
        // Partial match - item name contains search term
        else if (lowerName.includes(lowerSearchTerm)) {
            // Exclude blueprints unless explicitly requested
            if (!isBlueprintRequest && lowerName.includes('blueprint')) {
                continue;
            }
            // Prefer shorter names (more specific matches)
            const score = 500 - name.length;
            candidates.push({ typeID, name, score, matchType: 'partial' });
        }
    }

    // Sort by score (highest first)
    candidates.sort((a, b) => b.score - a.score);
    return candidates;
}

/**
 * Check if a typeID has active market orders in Jita
 */
async function hasMarketActivity(typeID) {
    try {
        const jitaRegion = 10000002;
        const url = `https://esi.evetech.net/latest/markets/${jitaRegion}/orders/?datasource=tranquility&type_id=${typeID}`;
        const response = await axios.get(url, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 5000
        });
        const hasOrders = response.data && response.data.length > 0;
        console.log(`[Twitch Utils] [hasMarketActivity] TypeID ${typeID}: ${hasOrders ? 'HAS' : 'NO'} market orders`);
        return hasOrders;
    } catch (error) {
        console.log(`[Twitch Utils] [hasMarketActivity] Error checking TypeID ${typeID}: ${error.message}`);
        return false;
    }
}

/**
 * Get item TypeID with enhanced exact matching - improved version
 */
export async function getEnhancedItemTypeID(itemName) {
    const lowerCaseItemName = itemName.toLowerCase().trim();

    // Check local cache first
    if (typeIDCache.has(lowerCaseItemName)) {
        console.log(`[Twitch Utils] Found in cache: "${itemName}" -> ${typeIDCache.get(lowerCaseItemName)}`);
        return typeIDCache.get(lowerCaseItemName);
    }

    // Check manual TypeID mappings first (for items not in standard databases)
    const manualTypeID = getManualTypeID(itemName);
    if (manualTypeID) {
        console.log(`[Twitch Utils] Manual mapping found: "${itemName}" -> ${manualTypeID}`);
        typeIDCache.set(lowerCaseItemName, manualTypeID);
        return manualTypeID;
    }

    // Special handling for PLEX - hardcode the correct type ID to avoid confusion
    if (lowerCaseItemName === 'plex' || lowerCaseItemName === 'pilot license extension') {
        console.log(`[Twitch Utils] PLEX special handling: "${itemName}" -> ${PLEX_TYPE_ID}`);
        typeIDCache.set(lowerCaseItemName, PLEX_TYPE_ID);
        return PLEX_TYPE_ID;
    }

    // Multi-candidate intelligent selection with market validation
    if (isEveFilesTypeIDMapLoaded) {
        console.log(`[Twitch Utils] Searching for candidates matching "${itemName}"`);
        const candidates = findMatchingCandidates(itemName);
        
        if (candidates.length > 0) {
            console.log(`[Twitch Utils] Found ${candidates.length} candidates:`, 
                candidates.slice(0, 5).map(c => `${c.name} (${c.typeID}, ${c.matchType})`));
            
            // Try each candidate in order, looking for one with market activity
            for (const candidate of candidates) {
                // First validate it's a tradeable item
                if (await isValidTradeableItem(candidate.typeID)) {
                    // Then check if it has market activity
                    if (await hasMarketActivity(candidate.typeID)) {
                        console.log(`[Twitch Utils] Selected "${candidate.name}" (${candidate.typeID}) with market activity`);
                        typeIDCache.set(lowerCaseItemName, candidate.typeID);
                        return candidate.typeID;
                    } else {
                        console.log(`[Twitch Utils] Skipping "${candidate.name}" (${candidate.typeID}) - no market activity`);
                    }
                } else {
                    console.log(`[Twitch Utils] Skipping "${candidate.name}" (${candidate.typeID}) - not tradeable`);
                }
            }
            
            // If no candidate has market activity, return first valid tradeable candidate
            for (const candidate of candidates) {
                if (await isValidTradeableItem(candidate.typeID)) {
                    console.log(`[Twitch Utils] No market activity found, using first tradeable: "${candidate.name}" (${candidate.typeID})`);
                    typeIDCache.set(lowerCaseItemName, candidate.typeID);
                    return candidate.typeID;
                }
            }
        }
    }

    // Try direct ESI search for items not found in other databases (like new SKINs)
    try {
        console.log(`[Twitch Utils] Trying ESI search for: "${itemName}"`);
        const esiSearchUrl = `https://esi.evetech.net/latest/search/?categories=inventory_type&search=${encodeURIComponent(itemName)}&strict=false`;
        const searchResponse = await axios.get(esiSearchUrl, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 5000
        });

        if (searchResponse.data.inventory_type && searchResponse.data.inventory_type.length > 0) {
            // Get the first result and validate it
            const candidateTypeID = searchResponse.data.inventory_type[0];
            console.log(`[Twitch Utils] ESI search found: "${itemName}" -> ${candidateTypeID}`);

            if (await isValidTradeableItem(candidateTypeID)) {
                console.log(`[Twitch Utils] ESI result validated: "${itemName}" -> ${candidateTypeID}`);
                typeIDCache.set(lowerCaseItemName, candidateTypeID);
                return candidateTypeID;
            }
        }
    } catch (error) {
        console.log(`[Twitch Utils] ESI search failed for "${itemName}": ${error.message}`);
    }

    // Fallback to Fuzzwork API with enhanced matching
    try {
        const cleanItemName = itemName.replace(/[^a-zA-Z0-9\s'-]/g, '').trim();
        if (!cleanItemName) return null;

        console.log(`[Twitch Utils] Searching Fuzzwork for: "${cleanItemName}"`);
        const response = await axios.get(`https://www.fuzzwork.co.uk/api/typeid.php?typename=${encodeURIComponent(cleanItemName)}`, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 5000
        });

        let foundTypeID = null;
        if (Array.isArray(response.data) && response.data.length > 0) {
            console.log(`[Twitch Utils] Fuzzwork returned ${response.data.length} results`);

            // Look for exact match first
            const exactMatch = response.data.find(item =>
                item.typeName.toLowerCase() === lowerCaseItemName
            );

            if (exactMatch) {
                console.log(`[Twitch Utils] Exact match in Fuzzwork: "${exactMatch.typeName}" -> ${exactMatch.typeID}`);
                foundTypeID = exactMatch.typeID;
            } else {
                // Look for closest match (shortest name containing the search term)
                const sortedResults = response.data
                    .filter(item => item.typeName.toLowerCase().includes(lowerCaseItemName))
                    .sort((a, b) => a.typeName.length - b.typeName.length);

                if (sortedResults.length > 0) {
                    console.log(`[Twitch Utils] Best partial match: "${sortedResults[0].typeName}" -> ${sortedResults[0].typeID}`);
                    foundTypeID = sortedResults[0].typeID;
                } else {
                    console.log(`[Twitch Utils] Using first result: "${response.data[0].typeName}" -> ${response.data[0].typeID}`);
                    foundTypeID = response.data[0].typeID;
                }
            }
        } else if (response.data && response.data.typeID) {
            foundTypeID = Number(response.data.typeID);
            console.log(`[Twitch Utils] Single result from Fuzzwork: ${foundTypeID}`);
        }

        if (foundTypeID) {
            typeIDCache.set(lowerCaseItemName, foundTypeID);
            return foundTypeID;
        }
    } catch (error) {
        console.error(`[Twitch Utils] Error fetching TypeID for "${itemName}":`, error.message);
    }

    console.log(`[Twitch Utils] No match found for: "${itemName}"`);
    return null;
}

/**
 * Clear cached market data for a specific item (useful for debugging)
 */
export function clearMarketCache(typeID, quantity = 1) {
    const cacheKey = `${typeID}:${quantity}`;
    if (marketCache.has(cacheKey)) {
        marketCache.delete(cacheKey);
        console.log(`[Twitch Utils] Cleared cache for TypeID ${typeID} quantity ${quantity}`);
        return true;
    }
    return false;
}

/**
 * Clear all cached market data
 */
export function clearAllMarketCache() {
    const size = marketCache.size;
    marketCache.clear();
    console.log(`[Twitch Utils] Cleared all market cache (${size} entries)`);
}

/**
 * Get type name by ID
 */
function getTypeNameByID(typeID) {
    return eveFilesIDToNameMap.get(typeID) || `Item (ID: ${typeID})`;
}

/**
 * Fetch market data from all major trade hubs optimized for Twitch
 */
export async function fetchMarketDataForTwitch(itemName, typeID, quantity = 1) {
    const cacheKey = `${typeID}:${quantity}:all_hubs`;
    const cacheTTL = 300000; // 5 minutes cache

    // Check cache first
    if (marketCache.has(cacheKey)) {
        const cached = marketCache.get(cacheKey);
        if (Date.now() - cached.timestamp < cacheTTL) {
            return cached.data.replace(/ITEM_NAME/g, itemName);
        }
    }

    const itemNameLower = itemName.toLowerCase().trim();
    const isPlex = (typeID === PLEX_TYPE_ID) || itemNameLower === 'plex';

    try {
        // Special handling for PLEX - use global market
        if (isPlex) {
            const sellOrdersURL = `https://esi.evetech.net/latest/markets/${GLOBAL_PLEX_REGION_ID}/orders/?datasource=tranquility&order_type=sell&type_id=${typeID}`;
            const buyOrdersURL = `https://esi.evetech.net/latest/markets/${GLOBAL_PLEX_REGION_ID}/orders/?datasource=tranquility&order_type=buy&type_id=${typeID}`;

            const [sellRes, buyRes] = await Promise.all([
                axios.get(sellOrdersURL, { headers: { 'User-Agent': USER_AGENT }, timeout: 7000 }),
                axios.get(buyOrdersURL, { headers: { 'User-Agent': USER_AGENT }, timeout: 7000 })
            ]);

            const sellOrders = sellRes.data;
            const buyOrders = buyRes.data;

            const lowestSell = sellOrders.length > 0 ? sellOrders.reduce((min, o) => o.price < min.price ? o : min) : null;
            const highestBuy = buyOrders.length > 0 ? buyOrders.reduce((max, o) => o.price > max.price ? o : max) : null;

            const formatIsk = (amount) => {
                if (amount >= 1000000000) return `${(amount / 1000000000).toFixed(1)}B`;
                if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
                if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
                return amount.toFixed(0);
            };

            const buyStr = highestBuy ? `Buy-${formatIsk(highestBuy.price * quantity)}` : 'Buy-';
            const sellStr = lowestSell ? `Sell-${formatIsk(lowestSell.price * quantity)}` : 'Sell-';

            let result = `ITEM_NAME${quantity > 1 ? ` x${quantity}` : ''} - Global: ${buyStr} - ${sellStr}`;

            marketCache.set(cacheKey, { data: result, timestamp: Date.now() });
            return result.replace(/ITEM_NAME/g, itemName);
        }

        // For regular items, fetch from all trade hubs
        const hubPromises = TRADE_HUBS.map(async (hubData) => {
            try {
                const sellOrdersURL = `https://esi.evetech.net/latest/markets/${hubData.regionId}/orders/?datasource=tranquility&order_type=sell&type_id=${typeID}`;
                const buyOrdersURL = `https://esi.evetech.net/latest/markets/${hubData.regionId}/orders/?datasource=tranquility&order_type=buy&type_id=${typeID}`;

                const [sellRes, buyRes] = await Promise.all([
                    axios.get(sellOrdersURL, { headers: { 'User-Agent': USER_AGENT }, timeout: 7000 }),
                    axios.get(buyOrdersURL, { headers: { 'User-Agent': USER_AGENT }, timeout: 7000 })
                ]);

                const sellOrders = sellRes.data;
                const buyOrders = buyRes.data;

                // Filter orders for the specific system
                const systemSells = sellOrders.filter(o => o.system_id === hubData.systemId);
                const systemBuys = buyOrders.filter(o => o.system_id === hubData.systemId);

                const lowestSell = systemSells.length > 0 ? systemSells.reduce((min, o) => o.price < min.price ? o : min) : null;
                const highestBuy = systemBuys.length > 0 ? systemBuys.reduce((max, o) => o.price > max.price ? o : max) : null;

                return {
                    hub: hubData.name,
                    sellPrice: lowestSell ? lowestSell.price * quantity : null,
                    buyPrice: highestBuy ? highestBuy.price * quantity : null
                };
            } catch (error) {
                console.error(`[Twitch Utils] Error fetching ${hubData.name} data:`, error.message);
                return { hub: hubData.name, sellPrice: null, buyPrice: null };
            }
        });

        const hubResults = await Promise.all(hubPromises);

        const formatIsk = (amount) => {
            if (amount >= 1000000000) return `${(amount / 1000000000).toFixed(1)}B`;
            if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
            if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
            return amount.toFixed(0);
        };

        // Show all hubs in the preferred order (Jita - Amarr - Hek - Dodixie - Rens)
        // Only include hubs that have any valid prices (buy or sell)
        const validResults = hubResults.filter(r => r.sellPrice !== null || r.buyPrice !== null);

        if (validResults.length === 0) {
            const result = `ITEM_NAME${quantity > 1 ? ` x${quantity}` : ''} - No market data found`;
            marketCache.set(cacheKey, { data: result, timestamp: Date.now() });
            return result.replace(/ITEM_NAME/g, itemName);
        }

        // Build result in the preferred hub order with buy/sell format
        const hubStrings = validResults.map(r => {
            const buyStr = r.buyPrice ? `Buy-${formatIsk(r.buyPrice)}` : 'Buy-';
            const sellStr = r.sellPrice ? `Sell-${formatIsk(r.sellPrice)}` : 'Sell-';
            return `${r.hub}: ${buyStr} - ${sellStr}`;
        });

        let result = `ITEM_NAME${quantity > 1 ? ` x${quantity}` : ''} - ${hubStrings.join(' | ')}`;

        // Twitch has ~500 char limit, truncate if needed
        if (result.length > 450) {
            const firstThree = hubStrings.slice(0, 3);
            result = `ITEM_NAME${quantity > 1 ? ` x${quantity}` : ''} - ${firstThree.join(' | ')} (+${validResults.length - 3} more)`;
        }

        marketCache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result.replace(/ITEM_NAME/g, itemName);

    } catch (error) {
        console.error(`[Twitch Utils] Market data error for "${itemName}":`, error.message);
        return null;
    }
}

/**
 * Fetch blueprint cost data for Twitch (simplified)
 */
export async function fetchBlueprintCostForTwitch(itemName) {
    try {
        const typeID = await getEnhancedItemTypeID(itemName);
        if (!typeID) return null;

        // For now, return a placeholder since manufacturing data API needs work
        const everefUrl = `https://everef.net/type/${typeID}`;
        return `Manufacturing data for "${itemName}" - Check: ${everefUrl}`;

    } catch (error) {
        console.error(`[Twitch Utils] Build cost error for "${itemName}":`, error.message);
        return null;
    }
}

/**
 * Fetch LP offer data for Twitch (simplified)
 */
export async function fetchLpOfferForTwitch(corpName, itemName) {
    try {
        const corpID = getCorporationID(corpName);
        const itemTypeID = await getEnhancedItemTypeID(itemName);

        if (!corpID || !itemTypeID) return null;

        const offersUrl = `https://esi.evetech.net/latest/loyalty/stores/${corpID}/offers/?datasource=tranquility`;
        const response = await axios.get(offersUrl, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 10000
        });

        const offer = response.data.find(o => o.type_id === itemTypeID);
        if (!offer) return null;

        const formatIsk = (amount) => {
            if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
            if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
            return amount.toFixed(0);
        };

        return `"${itemName}" LP cost: ${offer.lp_cost.toLocaleString()} LP + ${formatIsk(offer.isk_cost)} ISK`;

    } catch (error) {
        console.error(`[Twitch Utils] LP offer error for "${corpName}" / "${itemName}":`, error.message);
        return null;
    }
}

/**
 * Get corporation ID for LP stores
 */
function getCorporationID(corpName) {
    if (CORPORATION_IDS[corpName]) return CORPORATION_IDS[corpName];

    // Fuzzy match
    const searchTerm = corpName.toLowerCase();
    for (const [name, id] of Object.entries(CORPORATION_IDS)) {
        if (name.toLowerCase().includes(searchTerm) || searchTerm.includes(name.toLowerCase().split(' ')[0])) {
            return id;
        }
    }
    return null;
}

/**
 * Get item info for Twitch
 */
export async function getItemInfoForTwitch(itemName) {
    try {
        const typeID = await getEnhancedItemTypeID(itemName);
        if (!typeID) return null;

        const everefUrl = `https://everef.net/type/${typeID}`;
        return `"${itemName}" info: ${everefUrl}`;

    } catch (error) {
        console.error(`[Twitch Utils] Item info error for "${itemName}":`, error.message);
        return null;
    }
}

// Initialize the type ID database
loadTypeIDs().catch(console.error);