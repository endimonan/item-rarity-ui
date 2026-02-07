/**
 * Item Rarity Calculator for Project Zomboid
 * 
 * This script reads ProceduralDistributions.lua and calculates item rarities
 * using the Weighted Real Chance method:
 * - For each list, calculate the sum of all weights
 * - For each item occurrence: realChance = weight / sumOfList
 * - Sum all realChances for each item across all lists
 * 
 * Output: ItemRarityData.lua with pre-calculated rarity data
 */

const fs = require('fs');
const path = require('path');

// Configuration
const INPUT_FILE = path.join(__dirname, 'test.lua');
const OUTPUT_FILE = path.join(__dirname, 'media', 'lua', 'shared', 'ItemRarityData.lua');

// Rarity thresholds (based on percentile distribution)
// More strict thresholds for better rarity distribution
const RARITY_THRESHOLDS = {
    legendary: 0.02,   // < 0.02 total real chance (top ~5%)
    epic: 0.06,        // 0.02 - 0.06 (next ~10%)
    rare: 0.15,        // 0.06 - 0.15 (next ~15%)
    uncommon: 0.50,    // 0.15 - 0.50 (next ~20%)
    common: Infinity   // > 0.50 (remaining ~50%)
};

/**
 * Parse the Lua file and extract all distribution lists
 */
function parseLuaFile(content) {
    const lists = {};
    
    // Match each distribution list: ListName = { ... }
    // We need to handle nested braces carefully
    const listRegex = /(\w+)\s*=\s*\{([^{}]*(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}[^{}]*)*)\}/g;
    
    let match;
    while ((match = listRegex.exec(content)) !== null) {
        const listName = match[1];
        const listContent = match[2];
        
        // Skip if it's the main ProceduralDistributions object
        if (listName === 'ProceduralDistributions') continue;
        
        // Extract items array
        const items = extractItems(listContent, 'items');
        const junkItems = extractItems(listContent, 'junk');
        
        if (items.length > 0 || junkItems.length > 0) {
            lists[listName] = {
                items: items,
                junkItems: junkItems
            };
        }
    }
    
    return lists;
}

/**
 * Extract items from a list content string
 */
function extractItems(content, type) {
    const items = [];
    
    let itemsMatch;
    if (type === 'items') {
        // Match: items = { "Item", 10, "Item2", 20, ... }
        itemsMatch = content.match(/items\s*=\s*\{([^}]*)\}/);
    } else if (type === 'junk') {
        // Match junk section with its own items
        const junkMatch = content.match(/junk\s*=\s*\{[^}]*items\s*=\s*\{([^}]*)\}/);
        if (junkMatch) {
            itemsMatch = [null, junkMatch[1]];
        }
    }
    
    if (!itemsMatch || !itemsMatch[1]) return items;
    
    const itemsContent = itemsMatch[1];
    
    // Match pairs of "ItemName", weight
    const pairRegex = /"([^"]+)"\s*,\s*([\d.]+)/g;
    let pairMatch;
    
    while ((pairMatch = pairRegex.exec(itemsContent)) !== null) {
        const itemName = pairMatch[1];
        const weight = parseFloat(pairMatch[2]);
        
        if (itemName && !isNaN(weight)) {
            items.push({ name: itemName, weight: weight });
        }
    }
    
    return items;
}

/**
 * Calculate weighted real chance for all items
 */
function calculateRarities(lists) {
    const itemData = {};
    
    for (const [listName, listContent] of Object.entries(lists)) {
        // Process main items
        processItemList(listContent.items, itemData, listName);
        
        // Process junk items
        processItemList(listContent.junkItems, itemData, listName + '_junk');
    }
    
    return itemData;
}

/**
 * Process a single item list and accumulate real chances
 */
function processItemList(items, itemData, listName) {
    if (!items || items.length === 0) return;
    
    // Calculate sum of all weights in this list
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    
    if (totalWeight === 0) return;
    
    // Calculate real chance for each item and accumulate
    for (const item of items) {
        const realChance = item.weight / totalWeight;
        
        // Normalize item name (add Base. prefix if not present)
        let fullName = item.name;
        if (!fullName.includes('.')) {
            fullName = 'Base.' + fullName;
        }
        
        if (!itemData[fullName]) {
            itemData[fullName] = {
                totalRealChance: 0,
                occurrences: 0,
                lists: []
            };
        }
        
        itemData[fullName].totalRealChance += realChance;
        itemData[fullName].occurrences += 1;
        itemData[fullName].lists.push({
            list: listName,
            weight: item.weight,
            realChance: realChance
        });
    }
}

/**
 * Determine rarity tier based on total real chance
 */
function getRarityTier(totalRealChance) {
    if (totalRealChance < RARITY_THRESHOLDS.legendary) {
        return 'legendary';
    } else if (totalRealChance < RARITY_THRESHOLDS.epic) {
        return 'epic';
    } else if (totalRealChance < RARITY_THRESHOLDS.rare) {
        return 'rare';
    } else if (totalRealChance < RARITY_THRESHOLDS.uncommon) {
        return 'uncommon';
    } else {
        return 'common';
    }
}

/**
 * Generate Lua output file
 */
function generateLuaFile(itemData) {
    let lua = `--[[
    Item Rarity Data - Auto-generated by calculate-rarity.js
    
    Method: Weighted Real Chance
    For each item, we sum (weight / listTotal) across all lists where it appears.
    
    Thresholds:
    - Legendary: < ${RARITY_THRESHOLDS.legendary}
    - Epic: ${RARITY_THRESHOLDS.legendary} - ${RARITY_THRESHOLDS.epic}
    - Rare: ${RARITY_THRESHOLDS.epic} - ${RARITY_THRESHOLDS.rare}
    - Uncommon: ${RARITY_THRESHOLDS.rare} - ${RARITY_THRESHOLDS.uncommon}
    - Common: > ${RARITY_THRESHOLDS.uncommon}
]]

ItemRarityData = {
`;
    
    // Sort items by rarity (rarest first)
    const sortedItems = Object.entries(itemData)
        .sort((a, b) => a[1].totalRealChance - b[1].totalRealChance);
    
    for (const [itemName, data] of sortedItems) {
        const rarity = getRarityTier(data.totalRealChance);
        const chance = data.totalRealChance.toFixed(6);
        
        lua += `    ["${itemName}"] = { chance = ${chance}, rarity = "${rarity}", occurrences = ${data.occurrences} },\n`;
    }
    
    lua += `}

return ItemRarityData
`;
    
    return lua;
}

/**
 * Print statistics about the calculated rarities
 */
function printStatistics(itemData) {
    const stats = {
        legendary: 0,
        epic: 0,
        rare: 0,
        uncommon: 0,
        common: 0
    };
    
    let minChance = Infinity;
    let maxChance = 0;
    let minItem = '';
    let maxItem = '';
    
    for (const [itemName, data] of Object.entries(itemData)) {
        const rarity = getRarityTier(data.totalRealChance);
        stats[rarity]++;
        
        if (data.totalRealChance < minChance) {
            minChance = data.totalRealChance;
            minItem = itemName;
        }
        if (data.totalRealChance > maxChance) {
            maxChance = data.totalRealChance;
            maxItem = itemName;
        }
    }
    
    console.log('\n=== RARITY STATISTICS ===\n');
    console.log(`Total items processed: ${Object.keys(itemData).length}`);
    console.log('');
    console.log('Distribution:');
    console.log(`  Legendary: ${stats.legendary} items`);
    console.log(`  Epic:      ${stats.epic} items`);
    console.log(`  Rare:      ${stats.rare} items`);
    console.log(`  Uncommon:  ${stats.uncommon} items`);
    console.log(`  Common:    ${stats.common} items`);
    console.log('');
    console.log(`Rarest item: ${minItem} (chance: ${minChance.toFixed(6)})`);
    console.log(`Most common: ${maxItem} (chance: ${maxChance.toFixed(6)})`);
    console.log('');
}

/**
 * Main function
 */
function main() {
    console.log('Item Rarity Calculator for Project Zomboid');
    console.log('==========================================\n');
    
    // Read input file
    console.log(`Reading: ${INPUT_FILE}`);
    const content = fs.readFileSync(INPUT_FILE, 'utf8');
    
    // Parse Lua file
    console.log('Parsing distribution lists...');
    const lists = parseLuaFile(content);
    console.log(`Found ${Object.keys(lists).length} distribution lists`);
    
    // Calculate rarities
    console.log('Calculating weighted real chances...');
    const itemData = calculateRarities(lists);
    console.log(`Processed ${Object.keys(itemData).length} unique items`);
    
    // Print statistics
    printStatistics(itemData);
    
    // Generate output
    console.log(`Generating: ${OUTPUT_FILE}`);
    const luaContent = generateLuaFile(itemData);
    
    // Ensure output directory exists
    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Write output file
    fs.writeFileSync(OUTPUT_FILE, luaContent, 'utf8');
    
    console.log('\nDone! ItemRarityData.lua has been generated.');
    console.log('Copy the mod folder to your Zomboid/mods/ directory to test.');
}

// Run
main();
