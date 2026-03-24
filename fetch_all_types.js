import axios from 'axios';
import fs from 'fs/promises';

const ESI_BASE_URL = 'https://esi.evetech.net/latest';

async function getAllTypeIds() {
    console.log('Fetching all Type IDs...');
    let allIds = [];
    let page = 1;

    while (true) {
        try {
            const response = await axios.get(`${ESI_BASE_URL}/universe/types/?datasource=tranquility&page=${page}`);
            const ids = response.data;

            if (!ids || ids.length === 0) {
                break;
            }

            allIds = allIds.concat(ids);
            console.log(`Fetched page ${page}, total IDs so far: ${allIds.length}`);
            page++;
        } catch (error) {
            if (error.response && error.response.status === 404) {
                // 404 means we went past the last page
                break;
            }
            console.error(`Error fetching page ${page}:`, error.message);
            throw error;
        }
    }

    return allIds;
}

async function resolveNames(ids) {
    console.log(`Resolving names for ${ids.length} IDs...`);
    const chunkSize = 1000; // ESI limit for /universe/names/
    let results = [];

    for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        try {
            const response = await axios.post(`${ESI_BASE_URL}/universe/names/?datasource=tranquility`, chunk);
            results = results.concat(response.data);
            process.stdout.write(`\rResolved ${Math.min(i + chunkSize, ids.length)} / ${ids.length} names...`);
        } catch (error) {
            console.error(`\nError resolving names for chunk starting at index ${i}:`, error.message);
            // Continue with other chunks even if one fails
        }
    }
    console.log('\nFinished resolving names.');
    return results;
}

async function main() {
    try {
        console.time('Total Time');

        // 1. Get all Type IDs
        const typeIds = await getAllTypeIds();
        console.log(`Total Type IDs found: ${typeIds.length}`);

        // 2. Resolve Names
        // Note: Resolving 30k+ IDs might take a bit, but it's the only way to get names for everything efficiently
        const namedItems = await resolveNames(typeIds);

        // 3. Sort by Name
        namedItems.sort((a, b) => a.name.localeCompare(b.name));

        // 4. Format and Write to File
        const fileContent = namedItems.map(item => `${item.id} - ${item.name}`).join('\n');

        await fs.writeFile('all_typeids.txt', fileContent, 'utf8');
        console.log('Successfully wrote to all_typeids.txt');

        console.timeEnd('Total Time');

    } catch (error) {
        console.error('Fatal Error:', error);
    }
}

main();
