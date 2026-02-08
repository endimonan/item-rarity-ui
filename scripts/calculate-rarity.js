/**
 * Item Rarity Calculator for Project Zomboid
 * 
 * Reads multiple distribution sources and calculates item rarities
 * using the Weighted Real Chance method:
 * - For each list, calculate the sum of all weights
 * - For each item occurrence: realChance = weight / sumOfList
 * - Sum all realChances for each item across all lists
 * 
 * Data sources:
 * - ProceduralDistributions.lua (procedural loot tables)
 * - Distributions.lua (room/container loot, direct items only)
 * - VehicleDistributions.lua (vehicle loot)
 * 
 * Improvements:
 * - Derived items (NailsBox -> Nails, ammo boxes -> ammo)
 * - Confidence threshold (min occurrences for high tiers)
 * - Category-based rarity cap (Junk items can't be Legendary)
 * - Item registry from scan-items.js (all-items.json)
 * 
 * Output: ItemRarityData.lua with pre-calculated rarity data
 */

const fs = require('fs');
const path = require('path');

// ============================================================
// Configuration
// ============================================================

const PZ_PATH = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\ProjectZomboid';

const DISTRIBUTION_FILES = [
    path.join(__dirname, 'test.lua'),  // ProceduralDistributions.lua copy
    path.join(PZ_PATH, 'media', 'lua', 'server', 'Items', 'Distributions.lua'),
    path.join(PZ_PATH, 'media', 'lua', 'server', 'Vehicles', 'VehicleDistributions.lua'),
];

const ITEMS_REGISTRY_FILE = path.join(__dirname, 'all-items.json');
const OUTPUT_FILE = path.join(__dirname, 'media', 'lua', 'shared', 'ItemRarityData.lua');

// Rarity thresholds (based on total real chance)
const RARITY_THRESHOLDS = {
    legendary: 0.02,   // < 0.02 total real chance
    epic: 0.06,        // 0.02 - 0.06
    rare: 0.15,        // 0.06 - 0.15
    uncommon: 0.50,    // 0.15 - 0.50
    common: Infinity   // > 0.50
};

// Rarity tier order (for comparisons)
const RARITY_ORDER = ['legendary', 'epic', 'rare', 'uncommon', 'common'];

// Minimum occurrences required for high tiers
// If an item doesn't meet the minimum, it gets demoted
const TIER_MIN_OCCURRENCES = {
    legendary: 3,   // must appear in at least 3 lists
    epic: 2,        // must appear in at least 2 lists
};

// Demotion map: where to send items that don't meet the confidence threshold
const TIER_DEMOTION = {
    legendary: 'rare',      // legendary with < 3 occurrences -> rare
    epic: 'uncommon',       // epic with < 2 occurrences -> uncommon
};

// Category-based max rarity cap
// Items in these DisplayCategories can never exceed this rarity
const CATEGORY_MAX_RARITY = {
    'Junk': 'uncommon',
    'Hidden': 'common',
    'Appearance': 'uncommon',
    'ZedDmg': 'common',       // zombie damage clothing variants
    'Corpse': 'common',       // corpse items
};

// Derived items: items obtained by opening/using container items
// Key = container item that spawns in loot, Value = item you get from it
const DERIVED_ITEMS = {
    'NailsBox': 'Nails',
    'ScrewsBox': 'Screws',
    'Bullets9mmBox': 'Bullets9mm',
    'Bullets45Box': 'Bullets45',
    'Bullets44Box': 'Bullets44',
    'Bullets38Box': 'Bullets38',
    'ShotgunShellsBox': 'ShotgunShells',
    '223Box': '223Bullets',
    '308Box': '308Bullets',
    '556Box': '556Bullets',
    'PaperclipBox': 'Paperclip',
};

// ============================================================
// Parsing Functions
// ============================================================

/**
 * Extract all "ItemName", weight pairs from a content string.
 * Works on any content that contains items = { "Item", weight, ... } blocks.
 */
function extractAllItemBlocks(content) {
    const blocks = [];
    
    // Find all items = { ... } blocks (including nested ones in junk sections)
    // We match: items = { <content> }
    const itemsBlockRegex = /items\s*=\s*\{([^}]*)\}/g;
    
    let match;
    while ((match = itemsBlockRegex.exec(content)) !== null) {
        const blockContent = match[1];
        const items = [];
        
        // Match pairs of "ItemName", weight
        const pairRegex = /"([^"]+)"\s*,\s*([\d.]+)/g;
        let pairMatch;
        
        while ((pairMatch = pairRegex.exec(blockContent)) !== null) {
            const itemName = pairMatch[1];
            const weight = parseFloat(pairMatch[2]);
            
            if (itemName && !isNaN(weight) && weight > 0) {
                items.push({ name: itemName, weight: weight });
            }
        }
        
        if (items.length > 0) {
            blocks.push(items);
        }
    }
    
    return blocks;
}

/**
 * Parse a distribution file and extract all item lists.
 * Works for ProceduralDistributions, Distributions, and VehicleDistributions.
 */
function parseDistributionFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const blocks = extractAllItemBlocks(content);
    
    const fileName = path.basename(filePath, '.lua');
    const lists = {};
    
    blocks.forEach((items, index) => {
        const listName = `${fileName}_block_${index}`;
        lists[listName] = items;
    });
    
    return lists;
}

// ============================================================
// Rarity Calculation
// ============================================================

/**
 * Process all distribution sources and accumulate item data
 */
function calculateRarities(allLists) {
    const itemData = {};
    
    for (const [listName, items] of Object.entries(allLists)) {
        if (!items || items.length === 0) continue;
        
        // Calculate sum of all weights in this list
        const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
        if (totalWeight === 0) continue;
        
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
    
    return itemData;
}

/**
 * Determine raw rarity tier based on total real chance (no adjustments)
 */
function getRawRarityTier(totalRealChance) {
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
 * Cap a rarity tier to a maximum allowed tier
 * Returns the less rare of the two
 */
function capRarity(currentTier, maxTier) {
    const currentIdx = RARITY_ORDER.indexOf(currentTier);
    const maxIdx = RARITY_ORDER.indexOf(maxTier);
    
    // Higher index = less rare. If current is rarer than max, demote to max
    if (currentIdx < maxIdx) {
        return maxTier;
    }
    return currentTier;
}

/**
 * Apply all rarity adjustments:
 * 1. Confidence threshold (min occurrences)
 * 2. Category-based cap
 */
function getAdjustedRarity(totalRealChance, occurrences, displayCategory) {
    let rarity = getRawRarityTier(totalRealChance);
    
    // 1. Confidence threshold: demote if not enough occurrences
    const minOccurrences = TIER_MIN_OCCURRENCES[rarity];
    if (minOccurrences && occurrences < minOccurrences) {
        const demotedTo = TIER_DEMOTION[rarity];
        if (demotedTo) {
            rarity = demotedTo;
        }
    }
    
    // 2. Category-based cap
    if (displayCategory && CATEGORY_MAX_RARITY[displayCategory]) {
        rarity = capRarity(rarity, CATEGORY_MAX_RARITY[displayCategory]);
    }
    
    return rarity;
}

// ============================================================
// Derived Items
// ============================================================

/**
 * Process derived items: if NailsBox has data but Nails doesn't,
 * create an entry for Nails inheriting from NailsBox
 */
function processDerivedItems(itemData) {
    let derivedCount = 0;
    
    for (const [containerName, contentName] of Object.entries(DERIVED_ITEMS)) {
        const containerFullName = `Base.${containerName}`;
        const contentFullName = `Base.${contentName}`;
        
        const containerData = itemData[containerFullName];
        
        // Only derive if container exists in loot tables
        if (!containerData) continue;
        
        // If content item already has its own loot data, skip
        // (it spawns on its own too - its own data is fine)
        if (itemData[contentFullName]) continue;
        
        // Create derived entry with same tier as container
        itemData[contentFullName] = {
            totalRealChance: containerData.totalRealChance,
            occurrences: containerData.occurrences,
            lists: containerData.lists.map(l => ({
                ...l,
                list: l.list + '_derived'
            })),
            derivedFrom: containerFullName
        };
        
        derivedCount++;
    }
    
    return derivedCount;
}

// ============================================================
// Output Generation
// ============================================================

/**
 * Generate Lua output file
 */
function generateLuaFile(itemData, itemRegistry) {
    let lua = `--[[
    Item Rarity Data - Auto-generated by calculate-rarity.js
    
    Method: Weighted Real Chance (multi-source)
    Sources: ProceduralDistributions, Distributions, VehicleDistributions
    
    For each item, we sum (weight / listTotal) across all lists where it appears.
    
    Adjustments:
    - Confidence threshold: Legendary needs 3+ occurrences, Epic needs 2+
    - Category cap: Junk/Hidden/ZedDmg items capped at lower tiers
    - Derived items: Box contents inherit rarity from their container
    
    Thresholds:
    - Legendary: < ${RARITY_THRESHOLDS.legendary} (3+ occurrences required)
    - Epic: ${RARITY_THRESHOLDS.legendary} - ${RARITY_THRESHOLDS.epic} (2+ occurrences required)
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
        // Look up DisplayCategory from registry
        const registryItem = itemRegistry ? itemRegistry[itemName] : null;
        const displayCategory = registryItem ? registryItem.displayCategory : null;
        
        const rarity = getAdjustedRarity(
            data.totalRealChance,
            data.occurrences,
            displayCategory
        );
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
function printStatistics(itemData, itemRegistry) {
    const stats = {
        legendary: 0,
        epic: 0,
        rare: 0,
        uncommon: 0,
        common: 0
    };
    
    let demotedCount = 0;
    let cappedCount = 0;
    let derivedCount = 0;
    
    let minChance = Infinity;
    let maxChance = 0;
    let minItem = '';
    let maxItem = '';
    
    for (const [itemName, data] of Object.entries(itemData)) {
        const registryItem = itemRegistry ? itemRegistry[itemName] : null;
        const displayCategory = registryItem ? registryItem.displayCategory : null;
        
        const rawRarity = getRawRarityTier(data.totalRealChance);
        const adjustedRarity = getAdjustedRarity(
            data.totalRealChance,
            data.occurrences,
            displayCategory
        );
        
        stats[adjustedRarity]++;
        
        if (rawRarity !== adjustedRarity) {
            // Check if it was confidence demotion or category cap
            const minOcc = TIER_MIN_OCCURRENCES[rawRarity];
            if (minOcc && data.occurrences < minOcc) {
                demotedCount++;
            } else {
                cappedCount++;
            }
        }
        
        if (data.derivedFrom) {
            derivedCount++;
        }
        
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
    console.log(`Total items in loot tables: ${Object.keys(itemData).length}`);
    console.log('');
    console.log('Distribution:');
    console.log(`  Legendary: ${stats.legendary} items`);
    console.log(`  Epic:      ${stats.epic} items`);
    console.log(`  Rare:      ${stats.rare} items`);
    console.log(`  Uncommon:  ${stats.uncommon} items`);
    console.log(`  Common:    ${stats.common} items`);
    console.log('');
    console.log('Adjustments applied:');
    console.log(`  Confidence demotions: ${demotedCount} items (low occurrences)`);
    console.log(`  Category caps:        ${cappedCount} items (Junk/Hidden/etc)`);
    console.log(`  Derived items:        ${derivedCount} items (from containers)`);
    console.log('');
    console.log(`Rarest item: ${minItem} (chance: ${minChance.toFixed(6)})`);
    console.log(`Most common: ${maxItem} (chance: ${maxChance.toFixed(6)})`);
    console.log('');
}

// ============================================================
// Main
// ============================================================

function main() {
    console.log('Item Rarity Calculator for Project Zomboid');
    console.log('==========================================\n');
    
    // Load item registry (from scan-items.js output)
    let itemRegistry = null;
    if (fs.existsSync(ITEMS_REGISTRY_FILE)) {
        console.log(`Loading item registry: ${ITEMS_REGISTRY_FILE}`);
        const registryData = JSON.parse(fs.readFileSync(ITEMS_REGISTRY_FILE, 'utf8'));
        itemRegistry = registryData.items;
        console.log(`  ${Object.keys(itemRegistry).length} items in registry\n`);
    } else {
        console.log('WARNING: all-items.json not found. Run scan-items.js first for category-based caps.');
        console.log('Continuing without category data...\n');
    }
    
    // Parse all distribution files
    const allLists = {};
    let totalLists = 0;
    
    for (const filePath of DISTRIBUTION_FILES) {
        if (!fs.existsSync(filePath)) {
            console.log(`WARNING: File not found, skipping: ${filePath}`);
            continue;
        }
        
        const fileName = path.basename(filePath);
        console.log(`Reading: ${fileName}`);
        
        const lists = parseDistributionFile(filePath);
        const listCount = Object.keys(lists).length;
        console.log(`  Found ${listCount} item blocks`);
        
        // Merge into allLists
        for (const [name, items] of Object.entries(lists)) {
            allLists[name] = items;
        }
        totalLists += listCount;
    }
    
    console.log(`\nTotal item blocks across all sources: ${totalLists}`);
    
    // Calculate rarities
    console.log('\nCalculating weighted real chances...');
    const itemData = calculateRarities(allLists);
    console.log(`Processed ${Object.keys(itemData).length} unique items from loot tables`);
    
    // Process derived items
    console.log('\nProcessing derived items (box -> contents)...');
    const derivedCount = processDerivedItems(itemData);
    console.log(`  Created ${derivedCount} derived item entries`);
    
    // Print statistics
    printStatistics(itemData, itemRegistry);
    
    // Generate output
    console.log(`Generating: ${OUTPUT_FILE}`);
    const luaContent = generateLuaFile(itemData, itemRegistry);
    
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
