/**
 * Item Rarity Calculator for Project Zomboid
 * 
 * Reads multiple distribution sources and calculates item rarities
 * using the List-Size-Weighted Real Chance method:
 * - For each list, calculate the sum of all weights
 * - For each item: realChance = weight / sumOfList
 * - Weight each list's contribution by its size (proxy for importance)
 *   Small lists (zombie outfits) contribute less, large lists (lockers) contribute fully
 * - Sum all weighted chances for each item across all lists
 * 
 * Data sources:
 * - ProceduralDistributions.lua (procedural loot tables)
 * - Distributions.lua (room/container loot, direct items only)
 * - VehicleDistributions.lua (vehicle loot)
 * 
 * Improvements:
 * - List-size weighting (micro-lists contribute proportionally, not equally)
 * - Derived items (NailsBox -> Nails, ammo boxes -> ammo)
 * - Confidence threshold (min occurrences for high tiers)
 * - Category-based rarity cap (Junk items can't be Legendary)
 * - Item registry from scan-items.js (all-items-b41.json / all-items-b42.json)
 * 
 * Usage:
 *   node calculate-rarity.js            Generate for current game version
 *   node calculate-rarity.js --b42      Explicitly generate B42 data (into 42/ folder)
 *   node calculate-rarity.js --b41      Explicitly generate B41 data (into root)
 * 
 * Output: ItemRarityData.lua with pre-calculated rarity data
 */

const fs = require('fs');
const path = require('path');

// --- Helpers ---
const config = require('./helpers/config');
const { parseDistributionFile } = require('./helpers/parsers');
const { calculateRarities } = require('./helpers/rarity');
const {
    processDerivedItems,
    processCraftedItems,
    processCookedAndFilledItems,
    processZombieDropItems,
    processForageItems,
    processManualOverrides,
    processRemainingItems,
} = require('./helpers/processors');
const { generateLuaFile, printStatistics } = require('./helpers/output');

// ============================================================
// Main
// ============================================================

function main() {
    console.log('Item Rarity Calculator for Project Zomboid');
    console.log('==========================================');
    const detectedInfo = config.VERSION_FLAG ? '(manual)' : '(auto-detected)';
    console.log(`Version: ${config.VERSION_LABEL} ${detectedInfo} | Output: ${path.relative(config.PROJECT_ROOT, config.OUTPUT_FILE)}\n`);
    
    // Load item registry (from scan-items.js output)
    let itemRegistry = null;
    if (fs.existsSync(config.ITEMS_REGISTRY_FILE)) {
        console.log(`Loading item registry: ${config.ITEMS_REGISTRY_FILE}`);
        const registryData = JSON.parse(fs.readFileSync(config.ITEMS_REGISTRY_FILE, 'utf8'));
        itemRegistry = registryData.items;
        console.log(`  ${Object.keys(itemRegistry).length} items in registry\n`);
    } else {
        console.log(`WARNING: ${path.basename(config.ITEMS_REGISTRY_FILE)} not found. Run scan-items.js first.`);
        console.log('Continuing without category data...\n');
    }
    
    // Parse all distribution files
    const allLists = {};
    let totalLists = 0;
    
    for (const filePath of config.DISTRIBUTION_FILES) {
        if (!fs.existsSync(filePath)) {
            console.log(`WARNING: File not found, skipping: ${filePath}`);
            continue;
        }
        
        const fileName = path.basename(filePath);
        console.log(`Reading: ${fileName}`);
        
        const lists = parseDistributionFile(filePath);
        const listCount = Object.keys(lists).length;
        console.log(`  Found ${listCount} item blocks`);
        
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
    
    // Process crafted items (items not in loot but craftable)
    console.log('\nProcessing crafted items...');
    const craftedCount = processCraftedItems(itemData, itemRegistry);
    console.log(`  Added ${craftedCount} crafted item entries`);
    
    // Process cooked/filled items (cooking results, water containers)
    console.log('\nProcessing cooked/filled items...');
    const cookedCount = processCookedAndFilledItems(itemData);
    console.log(`  Added ${cookedCount} cooked/filled item entries as crafted`);
    
    // Process zombie drop items (more specific profession-based rarity)
    console.log('\nProcessing zombie drop items...');
    processZombieDropItems(itemData);
    
    // Process forage items (items found by foraging the ground)
    console.log('\nProcessing forage items...');
    processForageItems(itemData);
    
    // Process manual overrides (hardcoded world spawns)
    console.log('\nProcessing manual overrides...');
    const manualCount = processManualOverrides(itemData);
    console.log(`  Added ${manualCount} manual override entries`);
    
    // Fill remaining items from registry (smart default rarity)
    console.log('\nProcessing remaining registry items...');
    const defaultCount = processRemainingItems(itemData, itemRegistry);
    console.log(`  Added ${defaultCount} default entries (from ${path.basename(config.ITEMS_REGISTRY_FILE)})`);
    
    // Print statistics
    printStatistics(itemData, itemRegistry);
    
    // Generate output
    console.log(`Generating: ${config.OUTPUT_FILE}`);
    const luaContent = generateLuaFile(itemData, itemRegistry);
    
    // Ensure output directory exists
    const outputDir = path.dirname(config.OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Write output file
    fs.writeFileSync(config.OUTPUT_FILE, luaContent, 'utf8');
    
    console.log('\nDone! ItemRarityData.lua has been generated.');
    console.log('Copy the mod folder to your Zomboid/mods/ directory to test.');
}

// Run
main();
