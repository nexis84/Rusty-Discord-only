// Manual TypeID mappings for items not found in standard databases
export const MANUAL_TYPEID_MAPPINGS = {
    // SKINs that might not be in Fuzzwork or eve-files
    'omen arkombine arisen skin': 89712,
    'arkombine arisen skin': 89712,
    'omen arkombine arisen': 89712, // Alternative search terms

    // === EQUINOX EXPANSION (June 2024) - Upwell Industrial Ships ===
    'squall': 81008,
    'upwell squall': 81008,

    'deluge': 81046,
    'upwell deluge': 81046,
    'deluge blockade runner': 81046,

    'torrent': 81047,
    'upwell torrent': 81047,
    'torrent deep space transport': 81047,

    'avalanche': 81040,
    'upwell avalanche': 81040,
    'avalanche freighter': 81040,

    // === REVENANT EXPANSION (November 2024) - Deathless Ships ===
    'tholos': 85087,
    'deathless tholos': 85087,
    'tholos destroyer': 85087,

    'cenotaph': 85086,
    'deathless cenotaph': 85086,
    'cenotaph battlecruiser': 85086,

    // === LEGION EXPANSION (May 2025) - Tech II Warships ===
    'babaroga': 88001,
    'triglavian babaroga': 88001,
    'babaroga marauder': 88001,
    'triglavian marauder': 88001,

    'sarathiel': 87383,
    'angel sarathiel': 87383,
    'angel cartel sarathiel': 87383,
    'sarathiel dreadnought': 87383,
    'angel dreadnought': 87383,

    // === CATALYST EXPANSION (November 2025) - Mining & Exploration ===
    // Note: Pioneer variants removed - let resolver pick from all_typeids.txt with market validation
    // This ensures correct variant selection (ORE Pioneer vs Pioneer Consortium Issue, etc.)

    'outrider': 89649,
    'ore outrider': 89649,
    'outrider command destroyer': 89649,

    'odysseus': 89607,
    'sisters of eve odysseus': 89607,
    'soe odysseus': 89607,
    'odysseus exploration': 89607,
    'odysseus command ship': 89607,
    'exploration command ship': 89607,

    // Add more SKINs here as needed. To find TypeIDs:
    // 1. Check https://www.adam4eve.eu/commodity.php?typeID=XXXXX
    // 2. Or search EVE Market websites
    // 3. Or use ESI: https://esi.evetech.net/latest/universe/types/XXXXX/

    // Example format for adding more:
    // 'rifter krusual skin': 12345,
    // 'caracal navy issue skin': 67890,
    // 'dominix quafe skin': 54321,
};

// Function to check manual mappings first
export function getManualTypeID(itemName) {
    const lowerName = itemName.toLowerCase().trim();

    // Try exact match first
    if (MANUAL_TYPEID_MAPPINGS[lowerName]) {
        console.log(`[Manual Mapping] Found exact match: "${itemName}" -> ${MANUAL_TYPEID_MAPPINGS[lowerName]}`);
        return MANUAL_TYPEID_MAPPINGS[lowerName];
    }

    // Try partial match
    for (const [key, typeID] of Object.entries(MANUAL_TYPEID_MAPPINGS)) {
        if (lowerName.includes(key) || key.includes(lowerName)) {
            console.log(`[Manual Mapping] Found partial match: "${itemName}" -> ${typeID} (via "${key}")`);
            return typeID;
        }
    }

    return null;
}