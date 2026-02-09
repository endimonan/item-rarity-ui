/**
 * Forage definition parser.
 * Parses forageDefinitions.lua to determine rarity for items found by foraging.
 */

const fs = require('fs');
const { FORAGE_DEFS, FORAGE_TIER_MAP, RARITY_ORDER } = require('./config');

/**
 * Parse forageDefinitions.lua and extract item rarity data.
 * 
 * Two types of item definitions:
 * 1. Individual items in the main forageDefs table (with zone chances)
 * 2. Generated items from functions like generateClothingDefs(), etc.
 *    with explicit tier names (common, uncommon, rare, epic, legendary)
 * 
 * Returns: Map of itemFullName -> rarity tier
 */
function parseForageDefinitions() {
    if (!fs.existsSync(FORAGE_DEFS)) {
        console.log('  WARNING: forageDefinitions.lua not found, skipping');
        return {};
    }
    
    const content = fs.readFileSync(FORAGE_DEFS, 'utf8');
    const forageItems = {};
    
    // ---- PART 1: Parse generated functions with explicit tiers ----
    const funcRegex = /local function (generate\w+Defs)\(\)([\s\S]*?)^end/gm;
    let funcMatch;
    let generatedCount = 0;
    
    while ((funcMatch = funcRegex.exec(content)) !== null) {
        const funcBody = funcMatch[2];
        
        const itemsBlockRegex = /items\s*=\s*\{([^}]*)\}/g;
        let itemsMatch;
        
        const knownTierNames = Object.keys(FORAGE_TIER_MAP).join('|');
        const tierSearchRegex = new RegExp(`(${knownTierNames})\\s*=\\s*\\{`, 'gi');
        
        while ((itemsMatch = itemsBlockRegex.exec(funcBody)) !== null) {
            const itemsBlock = itemsMatch[1];
            const itemsPos = itemsMatch.index;
            
            const textBefore = funcBody.substring(Math.max(0, itemsPos - 1000), itemsPos);
            const allTierMatches = [...textBefore.matchAll(tierSearchRegex)];
            
            if (allTierMatches.length === 0) continue;
            const tierName = allTierMatches[allTierMatches.length - 1][1].toLowerCase();
            
            const ourRarity = FORAGE_TIER_MAP[tierName];
            if (!ourRarity) continue;
            
            const itemNameRegex = /"((?:Base|camping)\.\w+)"/g;
            let itemMatch;
            
            while ((itemMatch = itemNameRegex.exec(itemsBlock)) !== null) {
                const itemFullName = itemMatch[1];
                
                if (!forageItems[itemFullName]) {
                    forageItems[itemFullName] = ourRarity;
                } else {
                    const currentIdx = RARITY_ORDER.indexOf(forageItems[itemFullName]);
                    const newIdx = RARITY_ORDER.indexOf(ourRarity);
                    if (newIdx < currentIdx) {
                        forageItems[itemFullName] = ourRarity;
                    }
                }
                generatedCount++;
            }
        }
    }
    
    // ---- PART 2: Parse individual forageDefs items ----
    const mainTableEnd = content.indexOf('local function generate');
    const mainTable = mainTableEnd > 0 ? content.substring(0, mainTableEnd) : '';
    
    const individualRegex = /\w+\s*=\s*\{[^}]*type\s*=\s*"((?:Base|camping)\.\w+)"[^}]*categories\s*=\s*\{\s*"(\w+)"/g;
    let indMatch;
    let individualCount = 0;
    
    while ((indMatch = individualRegex.exec(mainTable)) !== null) {
        const itemFullName = indMatch[1];
        const category = indMatch[2];
        
        if (forageItems[itemFullName]) continue;
        
        let rarity;
        switch (category) {
            case 'ForestRarities':
                rarity = 'rare';
                break;
            case 'Plants':
            case 'Insects':
            case 'FishBait':
                rarity = 'common';
                break;
            case 'MedicinalPlants':
                rarity = 'uncommon';
                break;
            default:
                rarity = 'uncommon';
        }
        
        forageItems[itemFullName] = rarity;
        individualCount++;
    }
    
    console.log(`  Parsed forageDefinitions: ${generatedCount} generated items + ${individualCount} individual items = ${Object.keys(forageItems).length} unique`);
    return forageItems;
}

module.exports = {
    parseForageDefinitions,
};
