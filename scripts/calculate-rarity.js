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
 * - Item registry from scan-items.js (all-items.json)
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

// ============================================================
// Configuration
// ============================================================

const PZ_PATH = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\ProjectZomboid';

const PROJECT_ROOT = path.join(__dirname, '..');

const DISTRIBUTION_FILES = [
    path.join(PZ_PATH, 'media', 'lua', 'server', 'Items', 'ProceduralDistributions.lua'),
    path.join(PZ_PATH, 'media', 'lua', 'server', 'Items', 'Distributions.lua'),
    path.join(PZ_PATH, 'media', 'lua', 'server', 'Vehicles', 'VehicleDistributions.lua'),
];

const ITEMS_REGISTRY_FILE = path.join(PROJECT_ROOT, 'all-items.json');

// Zombie drop definition files
const ZOMBIE_WEAPON_DEFS = path.join(PZ_PATH, 'media', 'lua', 'shared', 'Definitions', 'AttachedWeaponDefinitions.lua');
const ZOMBIE_CLOTHING_DEFS = path.join(PZ_PATH, 'media', 'lua', 'shared', 'Definitions', 'ClothingSelectionDefinitions.lua');

// Foraging definition file (items found by foraging the ground)
const FORAGE_DEFS = path.join(PZ_PATH, 'media', 'lua', 'shared', 'Foraging', 'forageDefinitions.lua');

// Determine output path based on --b41/--b42 flags
const VERSION_FLAG = process.argv.find(a => a === '--b41' || a === '--b42');
const VERSION_LABEL = VERSION_FLAG === '--b41' ? 'B41' : VERSION_FLAG === '--b42' ? 'B42' : 'auto';

function getOutputFile() {
    if (VERSION_FLAG === '--b42') {
        return path.join(PROJECT_ROOT, '42', 'media', 'lua', 'shared', 'ItemRarityData.lua');
    }
    // --b41 or no flag: write to root (B41 default location)
    return path.join(PROJECT_ROOT, 'media', 'lua', 'shared', 'ItemRarityData.lua');
}

const OUTPUT_FILE = getOutputFile();

// --- List importance weighting (dual-factor) ---
// Each list's contribution is weighted by TWO independent factors:
//
// 1. Size weight: min(listItems, SIZE_CAP) / SIZE_CAP
//    Larger lists = more important loot containers.
//
// 2. Volume weight: min(totalWeight, VOLUME_CAP) / VOLUME_CAP
//    Higher total weight = more substantial loot source.
//    Micro/outfit tables have totalWeight ~0.001-0.01 (penalized heavily).
//    Real containers have totalWeight ~50-500 (full contribution).
//
// Combined: listWeight = sizeWeight × volumeWeight
// This correctly handles edge cases:
//   - Zombie outfit (3 items, totalWeight=0.003) → ~0.00003 weight (negligible)
//   - Gun store (2 items, totalWeight=104) → ~0.067 weight (small but real)
//   - Locker (30 items, totalWeight=200) → 1.0 weight (full)
const LIST_SIZE_FULL_WEIGHT = 30;
const LIST_VOLUME_FULL_WEIGHT = 10;  // totalWeight >= 10 gets full volume weight

// Rarity thresholds (based on total weighted real chance)
const RARITY_THRESHOLDS = {
    legendary: 0.01,   // < 0.01 total weighted chance
    epic: 0.04,        // 0.01 - 0.04
    rare: 0.12,        // 0.04 - 0.12
    uncommon: 0.40,    // 0.12 - 0.40
    common: Infinity   // > 0.40
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

// Manual rarity overrides for items with hardcoded/world spawns
// that cannot be detected from any data file
const MANUAL_OVERRIDES = {
    'Base.Generator': 'rare',        // world object spawn in garages/sheds
    'Base.Chainsaw': 'rare',         // item exists but no loot table entry
    'Base.BookBlacksmith1': 'rare',   // B42 skill books
    'Base.BookBlacksmith2': 'rare',
    'Base.BookBlacksmith3': 'rare',
    'Base.BookBlacksmith4': 'rare',
    'Base.BookBlacksmith5': 'rare',
    'Base.SmithingMag1': 'rare',      // B42 smithing magazines
    'Base.SmithingMag2': 'rare',
    'Base.SmithingMag3': 'rare',
    'Base.SmithingMag4': 'rare',
};

// Items that are results of cooking/filling/player actions, not loot
// These get classified as "crafted" since they are player-made
const COOKED_AND_FILLED_ITEMS = [
    // Cooked/prepared food (cooking system, not standard recipes)
    'Base.EggBoiled', 'Base.EggPoached', 'Base.GrilledCheese', 'Base.Pancakes',
    'Base.Waffles', 'Base.Guacamole', 'Base.RamenBowl', 'Base.Smore',
    'Base.DoughRolled', 'Base.ConeIcecreamMelted', 'Base.IcecreamMelted',
    'Base.ColdCuppa', 'Base.BakingTrayBread', 'Base.Cornmeal',
    'Base.ColdDrinkRed', 'Base.ColdDrinkSpiffo', 'Base.ColdDrinkWhite',
    // Water-filled containers (player fills these)
    'Base.WaterMug', 'Base.WaterBowl', 'Base.WaterPot', 'Base.WaterSaucepan',
    'Base.WaterTeacup', 'Base.WaterMugRed', 'Base.WaterMugSpiffo',
    'Base.WaterMugWhite', 'Base.WaterPopBottle', 'Base.WaterBleachBottle',
    'Base.WaterPaintbucket', 'Base.BucketWaterFull', 'Base.FullKettle',
    'Base.Mugfull', 'Base.PlasticCupWater', 'Base.GlassTumblerWater',
    'Base.GlassWineWater', 'Base.BeerWaterFull', 'Base.WhiskeyWaterFull',
    'Base.WineWaterFull', 'Base.BathTowelWet', 'Base.DishClothWet',
    'Base.PetrolBleachBottle', 'Base.PetrolPopBottle', 'Base.WhiskeyPetrol',
    'Base.WinePetrol', 'Base.WaterBottlePetrol',
    // Farming intermediates
    'farming.MayonnaiseWaterFull', 'farming.RemouladeWaterFull',
    'farming.WateredCanFull', 'farming.MayonnaiseHalf', 'farming.RemouladeHalf',
    'farming.MayonnaiseEmpty', 'farming.RemouladeEmpty',
    'farming.GardeningSprayFull', 'farming.GardeningSprayMilk',
    'farming.GardeningSprayCigarettes', 'farming.BaconBits', 'farming.BaconRashers',
];

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
 * Process all distribution sources and accumulate item data.
 * 
 * Uses list-size weighting to prevent micro-lists (outfit tables, 
 * zombie-specific loot with 1-3 items) from inflating rarity values,
 * while still counting ALL loot sources proportionally.
 * 
 * A list with 1 item contributes 1/20 of its real chance.
 * A list with 10 items contributes 10/20 = 50%.
 * A list with 20+ items contributes 100%.
 * 
 * No data is discarded - every loot source contributes proportionally.
 */
function calculateRarities(allLists) {
    const itemData = {};
    let totalProcessed = 0;
    let fullWeightCount = 0;
    
    for (const [listName, items] of Object.entries(allLists)) {
        if (!items || items.length === 0) continue;
        
        // Calculate sum of all weights in this list
        const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
        if (totalWeight === 0) continue;
        
        // Dual-factor list importance weight:
        // Factor 1: list size (number of items)
        const sizeWeight = Math.min(items.length, LIST_SIZE_FULL_WEIGHT) / LIST_SIZE_FULL_WEIGHT;
        // Factor 2: list volume (total weight of all items)
        const volumeWeight = Math.min(totalWeight, LIST_VOLUME_FULL_WEIGHT) / LIST_VOLUME_FULL_WEIGHT;
        // Combined weight
        const listWeight = sizeWeight * volumeWeight;
        
        if (listWeight >= 0.99) fullWeightCount++;
        totalProcessed++;
        
        // Calculate weighted real chance for each item and accumulate
        for (const item of items) {
            const rawRealChance = item.weight / totalWeight;
            const weightedChance = rawRealChance * listWeight;
            
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
            
            itemData[fullName].totalRealChance += weightedChance;
            itemData[fullName].occurrences += 1;
            itemData[fullName].lists.push({
                list: listName,
                weight: item.weight,
                rawChance: rawRealChance,
                weightedChance: weightedChance,
                listSize: items.length,
                listWeight: listWeight
            });
        }
    }
    
    const weightedDown = totalProcessed - fullWeightCount;
    console.log(`  Processed ${totalProcessed} lists (${weightedDown} weighted down, ${fullWeightCount} at full weight)`);
    
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
// Crafted Items
// ============================================================

/**
 * Add "crafted" entries for items that:
 * - Are NOT in any loot table
 * - ARE the result of a crafting recipe (from all-items.json craftable flag)
 */
function processCraftedItems(itemData, itemRegistry) {
    if (!itemRegistry) return 0;
    
    let craftedCount = 0;
    
    for (const [itemName, regData] of Object.entries(itemRegistry)) {
        // Skip if already in loot tables
        if (itemData[itemName]) continue;
        
        // Skip if not craftable
        if (!regData.craftable) continue;
        
        // Skip system categories that players never see
        const skipCategories = ['ZedDmg', 'Wound', 'Bandage', 'Hidden', 'Corpse', 'MaleBody'];
        if (skipCategories.includes(regData.displayCategory)) continue;
        
        // Add as crafted item
        itemData[itemName] = {
            totalRealChance: -1,  // sentinel value for crafted
            occurrences: 0,
            lists: [],
            isCrafted: true
        };
        
        craftedCount++;
    }
    
    return craftedCount;
}

// ============================================================
// Zombie Drop Items
// ============================================================

// Outfit rarity tiers: how rare each profession's zombies are
// "default" applies to ALL zombies, specific professions are rarer
const OUTFIT_RARITY = {
    // Default outfit - every zombie can wear these
    'default': 'common',
    // Common professions - many zombies of these types
    'constructionworker': 'uncommon',
    'securityguard': 'uncommon',
    'carpenter': 'uncommon',
    'burglar': 'uncommon',
    'generic': 'uncommon',
    // Moderate professions
    'fireofficer': 'rare',
    'policeofficer': 'rare',
    'parkranger': 'rare',
    'nurse': 'rare',
    'doctor': 'rare',
    'chef': 'rare',
    'farmer': 'rare',
    'mechanic': 'uncommon',
    'fitness': 'uncommon',
    'hunter': 'rare',
    // Rare professions
    'veteran': 'epic',
    'army': 'epic',
    'inmate': 'rare',
    'prisoner': 'rare',
    'bandit': 'rare',
    'biker': 'rare',
    'clown': 'epic',
    'goth': 'rare',
    'punk': 'rare',
    'redneck': 'uncommon',
    'santa': 'epic',
    'priest': 'epic',
    'hockeypsycho': 'epic',
    'privatemilitia': 'epic',
    'policeriot': 'epic',
    'policestate': 'rare',
};

/**
 * Parse AttachedWeaponDefinitions.lua and extract weapon rarity data.
 * 
 * Structure: each definition has { chance, daySurvived, weapons[] }
 * - chance is relative weight among all weapon definitions
 * - daySurvived means rarer (only available later in game)
 * - weapons[] is list of possible items
 * 
 * Returns: Map of itemName -> rarity tier
 */
function parseZombieWeapons() {
    if (!fs.existsSync(ZOMBIE_WEAPON_DEFS)) {
        console.log('  WARNING: AttachedWeaponDefinitions.lua not found, skipping');
        return {};
    }
    
    const content = fs.readFileSync(ZOMBIE_WEAPON_DEFS, 'utf8');
    const weaponItems = {}; // itemName -> { totalChance, minDaySurvived }
    
    // Split content by top-level definition boundaries
    // Find each "AttachedWeaponDefinitions.xxx = {" and extract to the matching close
    const defNameRegex = /AttachedWeaponDefinitions\.(\w+)\s*=\s*\{/g;
    let match;
    const defPositions = [];
    
    while ((match = defNameRegex.exec(content)) !== null) {
        defPositions.push({ name: match[1], start: match.index, contentStart: match.index + match[0].length });
    }
    
    let totalChance = 0;
    const definitions = [];
    
    for (let i = 0; i < defPositions.length; i++) {
        const def = defPositions[i];
        // Skip non-weapon definitions (like chanceOfAttachedWeapon, attachedWeaponCustomOutfit)
        if (def.name === 'chanceOfAttachedWeapon' || def.name === 'attachedWeaponCustomOutfit') continue;
        
        // Get content from this definition to the next one
        const endPos = i + 1 < defPositions.length ? defPositions[i + 1].start : content.length;
        const block = content.substring(def.contentStart, endPos);
        
        // Extract chance
        const chanceMatch = block.match(/chance\s*=\s*(\d+)/);
        if (!chanceMatch) continue;
        const chance = parseInt(chanceMatch[1]);
        
        // Extract daySurvived
        const dayMatch = block.match(/daySurvived\s*=\s*(\d+)/);
        const daySurvived = dayMatch ? parseInt(dayMatch[1]) : 0;
        
        // Extract outfit restriction (if any)
        const outfitMatch = block.match(/outfit\s*=\s*\{([^}]*)\}/);
        const isOutfitSpecific = !!outfitMatch;
        
        // Extract weapons list - find the weapons = { ... } block
        const weaponsMatch = block.match(/weapons\s*=\s*\{([^}]*)\}/);
        if (!weaponsMatch) continue;
        
        const weaponsList = [];
        const itemRegex = /"(Base\.\w+)"/g;
        let itemMatch;
        while ((itemMatch = itemRegex.exec(weaponsMatch[1])) !== null) {
            weaponsList.push(itemMatch[1]);
        }
        
        if (weaponsList.length === 0) continue;
        
        definitions.push({ chance, daySurvived, weapons: weaponsList, isOutfitSpecific });
        totalChance += chance;
    }
    
    // Now calculate rarity for each weapon item
    // Global chance of ANY weapon: 6% (chanceOfAttachedWeapon = 6)
    // Per-definition share: chance / totalChance
    // Per-item share: perDefinitionShare / weaponsInDefinition
    // Day penalty: higher daySurvived = rarer
    
    for (const def of definitions) {
        const defShare = def.chance / totalChance;
        const perItemShare = defShare / def.weapons.length;
        
        // Apply day-survived penalty: items only available late-game are rarer
        // daySurvived 0 = multiplier 1.0, daySurvived 60 = multiplier 0.1
        const dayPenalty = 1.0 / (1 + def.daySurvived / 10);
        
        // Outfit-specific weapons are rarer (only appear on certain zombie types)
        const outfitPenalty = def.isOutfitSpecific ? 0.3 : 1.0;
        
        const effectiveShare = perItemShare * dayPenalty * outfitPenalty;
        
        for (const weaponName of def.weapons) {
            if (!weaponItems[weaponName]) {
                weaponItems[weaponName] = { totalShare: 0, minDay: Infinity, maxChance: 0 };
            }
            weaponItems[weaponName].totalShare += effectiveShare;
            weaponItems[weaponName].minDay = Math.min(weaponItems[weaponName].minDay, def.daySurvived);
            weaponItems[weaponName].maxChance = Math.max(weaponItems[weaponName].maxChance, def.chance);
        }
    }
    
    // Map effective share to rarity tiers
    // Higher share = more common on zombies
    const result = {};
    for (const [itemName, data] of Object.entries(weaponItems)) {
        let rarity;
        if (data.totalShare < 0.005) {
            // Very rare zombie weapon (Katana: ~0.0014)
            rarity = 'epic';
        } else if (data.totalShare < 0.02) {
            // Rare zombie weapon (Machete, Axe)
            rarity = 'rare';
        } else if (data.totalShare < 0.08) {
            // Uncommon zombie weapon (HuntingKnife, KitchenKnife)
            rarity = 'uncommon';
        } else {
            // Common zombie weapon (Fork, Screwdriver, LetterOpener)
            rarity = 'common';
        }
        result[itemName] = rarity;
    }
    
    console.log(`  Parsed ${definitions.length} weapon definitions, ${Object.keys(result).length} unique weapons`);
    return result;
}

/**
 * Parse ClothingSelectionDefinitions.lua and extract clothing rarity data.
 * 
 * Structure: outfits have body slots, each with optional chance and items[]
 * - default outfit = every zombie can wear these = common
 * - profession outfits = only specific zombies = uncommon to epic
 * 
 * Returns: Map of itemName -> rarity tier
 */
function parseZombieClothing() {
    if (!fs.existsSync(ZOMBIE_CLOTHING_DEFS)) {
        console.log('  WARNING: ClothingSelectionDefinitions.lua not found, skipping');
        return {};
    }
    
    const content = fs.readFileSync(ZOMBIE_CLOTHING_DEFS, 'utf8');
    const clothingItems = {}; // itemName -> best (most common) rarity
    
    // Match each outfit definition block:
    // ClothingSelectionDefinitions.outfitName = { ... }
    // We need to handle nested braces (Female = { Hat = { items = {...} } })
    
    // Strategy: find all outfit names, then for each find all item references
    const outfitNameRegex = /ClothingSelectionDefinitions\.(\w+)\s*=\s*\{/g;
    let outfitMatch;
    const outfitPositions = [];
    
    while ((outfitMatch = outfitNameRegex.exec(content)) !== null) {
        outfitPositions.push({
            name: outfitMatch[1].toLowerCase(),
            start: outfitMatch.index
        });
    }
    
    // For each outfit, extract the content between this definition and the next
    for (let i = 0; i < outfitPositions.length; i++) {
        const outfit = outfitPositions[i];
        const start = outfit.start;
        const end = i + 1 < outfitPositions.length ? outfitPositions[i + 1].start : content.length;
        const outfitContent = content.substring(start, end);
        
        // Determine rarity based on outfit name
        const outfitRarity = OUTFIT_RARITY[outfit.name] || 'uncommon';
        
        // Extract all item names from this outfit block
        const itemRefRegex = /"(Base\.\w+)"/g;
        let itemMatch;
        while ((itemMatch = itemRefRegex.exec(outfitContent)) !== null) {
            const itemName = itemMatch[1];
            
            // Keep the most common (least rare) tier for each item
            // An item in "default" outfit is common even if it also appears in "police"
            if (!clothingItems[itemName]) {
                clothingItems[itemName] = outfitRarity;
            } else {
                // Compare: keep the less rare one
                const currentIdx = RARITY_ORDER.indexOf(clothingItems[itemName]);
                const newIdx = RARITY_ORDER.indexOf(outfitRarity);
                if (newIdx > currentIdx) {
                    clothingItems[itemName] = outfitRarity; // less rare = higher index
                }
            }
        }
    }
    
    console.log(`  Parsed ${outfitPositions.length} outfit definitions, ${Object.keys(clothingItems).length} unique clothing items`);
    return clothingItems;
}

// ============================================================
// Foraging Items
// ============================================================

// Map forage tier names to our standard rarity tiers
const FORAGE_TIER_MAP = {
    // Exact tier names used in forageDefinitions.lua
    'normal': 'common',
    'common': 'common',
    'generic': 'common',       // berries
    'specific': 'common',      // berries
    'winter': 'uncommon',      // berries
    'poison': 'uncommon',      // berries
    'uncommon': 'uncommon',
    'unlikely': 'uncommon',    // junkItems
    'rare': 'rare',
    'epic': 'epic',
    'legendary': 'legendary',
};

/**
 * Parse forageDefinitions.lua and extract item rarity data.
 * 
 * This file has two types of item definitions:
 * 1. Individual items in the main forageDefs table (with zone chances)
 * 2. Generated items from functions like generateClothingDefs(), generateJunkDefs(), etc.
 *    These have explicit tier names (common, uncommon, rare, epic, legendary)
 * 
 * Returns: Map of itemFullName -> rarity tier
 */
function parseForageDefinitions() {
    if (!fs.existsSync(FORAGE_DEFS)) {
        console.log('  WARNING: forageDefinitions.lua not found, skipping');
        return {};
    }
    
    const content = fs.readFileSync(FORAGE_DEFS, 'utf8');
    const forageItems = {}; // itemFullName -> rarity
    
    // ---- PART 1: Parse generated functions with explicit tiers ----
    // Strategy: find each `items = { ... }` block, extract items, then look backwards
    // for the tier name. This avoids complex nested-brace regex.
    
    // Find all function bodies: generateXXXDefs() ... end
    const funcRegex = /local function (generate\w+Defs)\(\)([\s\S]*?)^end/gm;
    let funcMatch;
    let generatedCount = 0;
    
    while ((funcMatch = funcRegex.exec(content)) !== null) {
        const funcName = funcMatch[1];
        const funcBody = funcMatch[2];
        
        // Find all `items = { ... }` blocks in this function
        const itemsBlockRegex = /items\s*=\s*\{([^}]*)\}/g;
        let itemsMatch;
        
        // Build a regex for known tier names only
        const knownTierNames = Object.keys(FORAGE_TIER_MAP).join('|');
        const tierSearchRegex = new RegExp(`(${knownTierNames})\\s*=\\s*\\{`, 'gi');
        
        while ((itemsMatch = itemsBlockRegex.exec(funcBody)) !== null) {
            const itemsBlock = itemsMatch[1];
            const itemsPos = itemsMatch.index;
            
            // Look backwards from `items = {` to find the nearest known tier name
            const textBefore = funcBody.substring(Math.max(0, itemsPos - 1000), itemsPos);
            const allTierMatches = [...textBefore.matchAll(tierSearchRegex)];
            
            if (allTierMatches.length === 0) continue;
            const tierName = allTierMatches[allTierMatches.length - 1][1].toLowerCase();
            
            const ourRarity = FORAGE_TIER_MAP[tierName];
            if (!ourRarity) continue; // skip unknown tier names (like "spawnFuncs")
            
            // Extract item full names: "Base.ItemName" or "camping.ItemName"
            const itemNameRegex = /"((?:Base|camping)\.\w+)"/g;
            let itemMatch;
            
            while ((itemMatch = itemNameRegex.exec(itemsBlock)) !== null) {
                const itemFullName = itemMatch[1];
                
                // Keep the rarest tier if item appears in multiple tiers
                if (!forageItems[itemFullName]) {
                    forageItems[itemFullName] = ourRarity;
                } else {
                    const currentIdx = RARITY_ORDER.indexOf(forageItems[itemFullName]);
                    const newIdx = RARITY_ORDER.indexOf(ourRarity);
                    if (newIdx < currentIdx) {
                        forageItems[itemFullName] = ourRarity; // rarer = lower index
                    }
                }
                generatedCount++;
            }
        }
    }
    
    // ---- PART 2: Parse individual forageDefs items ----
    // Pattern: forageDefs[ItemName] or ItemName = { type = "Base.ItemName", ... zones = { Zone = chance, ... } }
    // These are in the main forageDefs = { ... } table at the top of the file
    
    // Find the main forageDefs table (everything before the first generateXXXDefs function)
    const mainTableEnd = content.indexOf('local function generate');
    const mainTable = mainTableEnd > 0 ? content.substring(0, mainTableEnd) : '';
    
    // Parse individual items: ItemName = { type = "Base.XXX", ... categories = { "Cat" }, zones = { ... } }
    const individualRegex = /\w+\s*=\s*\{[^}]*type\s*=\s*"((?:Base|camping)\.\w+)"[^}]*categories\s*=\s*\{\s*"(\w+)"/g;
    let indMatch;
    let individualCount = 0;
    
    while ((indMatch = individualRegex.exec(mainTable)) !== null) {
        const itemFullName = indMatch[1];
        const category = indMatch[2];
        
        if (forageItems[itemFullName]) continue; // already have from generated
        
        // Map category to rarity
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

/**
 * Apply forage rarity data to items NOT already in loot tables or crafted.
 * Returns: count of items added
 */
function processForageItems(itemData) {
    console.log('  Parsing forage definitions...');
    const forageRarity = parseForageDefinitions();
    
    let addedCount = 0;
    for (const [itemName, rarity] of Object.entries(forageRarity)) {
        if (itemData[itemName]) continue; // already has loot/crafted data
        
        itemData[itemName] = {
            totalRealChance: -4,  // sentinel value for forage item
            occurrences: 0,
            lists: [],
            isForage: true,
            forageRarity: rarity
        };
        addedCount++;
    }
    
    console.log(`  Forage items added: ${addedCount} (${Object.keys(forageRarity).length - addedCount} already in loot tables)`);
    return addedCount;
}

/**
 * Process zombie drop items: weapons stuck in zombies + clothing worn by zombies.
 * Only applies to items NOT already in loot tables or crafted.
 * 
 * Returns: count of items added
 */
function processZombieDropItems(itemData) {
    let addedCount = 0;
    
    // Parse both sources
    console.log('  Parsing zombie weapon definitions...');
    const zombieWeapons = parseZombieWeapons();
    
    console.log('  Parsing zombie clothing definitions...');
    const zombieClothing = parseZombieClothing();
    
    // Merge both sources: weapons take priority over clothing
    const allZombieItems = {};
    
    // Add clothing first
    for (const [itemName, rarity] of Object.entries(zombieClothing)) {
        allZombieItems[itemName] = rarity;
    }
    
    // Then weapons (override if present - weapons are generally more interesting)
    for (const [itemName, rarity] of Object.entries(zombieWeapons)) {
        const currentIdx = RARITY_ORDER.indexOf(allZombieItems[itemName] || 'common');
        const newIdx = RARITY_ORDER.indexOf(rarity);
        // Keep the rarer one for weapons (lower index = rarer)
        if (!allZombieItems[itemName] || newIdx < currentIdx) {
            allZombieItems[itemName] = rarity;
        }
    }
    
    // Apply to itemData: only add items not already present
    for (const [itemName, rarity] of Object.entries(allZombieItems)) {
        if (itemData[itemName]) continue; // already has loot/crafted data
        
        itemData[itemName] = {
            totalRealChance: -3,  // sentinel value for zombie drop
            occurrences: 0,
            lists: [],
            isZombieDrop: true,
            zombieRarity: rarity
        };
        addedCount++;
    }
    
    console.log(`  Total zombie-drop items added: ${addedCount}`);
    return addedCount;
}

// ============================================================
// Cooked/Filled Items (player-made, not loot)
// ============================================================

/**
 * Mark cooked food, water-filled containers, and farming intermediates as "crafted".
 * These are results of player actions (cooking, filling) not found as loot.
 * Only applies to items NOT already in loot tables.
 */
function processCookedAndFilledItems(itemData) {
    let addedCount = 0;
    
    for (const itemName of COOKED_AND_FILLED_ITEMS) {
        if (itemData[itemName]) continue; // already has loot/crafted data
        
        itemData[itemName] = {
            totalRealChance: -1,  // sentinel value for crafted
            occurrences: 0,
            lists: [],
            isCrafted: true
        };
        addedCount++;
    }
    
    return addedCount;
}

// ============================================================
// Manual Overrides (hardcoded world spawns)
// ============================================================

/**
 * Apply manual rarity overrides for items that spawn via hardcoded
 * mechanisms (world objects, special events) not covered by any data file.
 * Only applies to items NOT already classified by loot tables, forage, etc.
 */
function processManualOverrides(itemData) {
    let addedCount = 0;
    
    for (const [itemName, rarity] of Object.entries(MANUAL_OVERRIDES)) {
        if (itemData[itemName]) continue; // already has data from another source
        
        itemData[itemName] = {
            totalRealChance: -5,  // sentinel value for manual override
            occurrences: 0,
            lists: [],
            isManualOverride: true,
            manualRarity: rarity
        };
        addedCount++;
    }
    
    return addedCount;
}

// ============================================================
// Remaining Items (fill gaps from item registry)
// ============================================================

/**
 * Smart default rarity for items not covered by loot tables, crafting,
 * zombie drops, forage, or manual overrides.
 * 
 * Instead of blanket "uncommon", assigns rarity based on:
 * 1. displayCategory (from item definitions)
 * 2. Name patterns (crafted materials, cooked food, etc.)
 * 3. Item characteristics
 * 
 * Returns { added, breakdown } with counts per assigned type.
 */
function processRemainingItems(itemData, itemRegistry) {
    if (!itemRegistry) return 0;
    
    let addedCount = 0;
    const breakdown = { crafted: 0, common: 0, uncommon: 0, rare: 0 };
    
    // Categories of items that players never see or that are system-only
    const skipCategories = [
        'ZedDmg', 'Wound', 'Bandage', 'Hidden', 'Corpse', 
        'MaleBody', 'Bug', 'Tail', 'Fox', 'Bunny', 'Duck', 
        'Frog', 'Raccoon', 'Bear', 'Badger', 'Eye', 'Squirrel', 
        'Beaver', 'Mole', 'Hedgehog', 'Dog', 'Goblin', 'Spider',
        'Generic', 'Animal',
    ];
    
    // Categories whose items are almost always player-crafted when not in loot
    const craftedCategories = [
        'WeaponCrafted',    // spiked bats, flint knives, etc
        'BrokenWeapon',     // broken crafted weapons
        'Explosives',       // sensor bombs, remote traps
    ];
    
    // Categories whose items are common world objects / environmental
    const commonCategories = [
        'Furniture',        // skull mounts, moveable objects
        'VehicleMaintenance', // gas tanks, trunk doors, bumpers
        'Junk',             // props, dummy items
        'Water',            // test items
        'Fishing',          // fish guts, broken nets, fishing trash
        'MaterialWeapon',   // stone, steel rod halves, fork heads
        'JunkWeapon',       // spade heads, makeshift stuff
        'FishingWeapon',    // broken fishing rod
        'HouseholdWeapon',  // plunger spear etc
    ];
    
    // Categories whose items are rare finds / collectibles
    const rareCategories = [
        'Memento',          // gems, crystals, friendship bracelets
    ];
    
    // Name patterns that indicate crafted/player-made items
    const craftedNamePatterns = [
        // Crafting intermediates & products
        /Ingot|Nugget$/i,
        /Carved|Mold(?:ed)?|Unfired|Untreated|Assembled|Kiln|Forge[d]?$|Smelt/i,
        /Crude(?:Saw|Sword|ShortSword|Bench)|^Flint(?!stone)/i,
        // Crafted clothing from raw materials
        /(?:_|\b)(?:Burlap|Rag|Fur|Tarp|GarbageBag)(?:_|\b)/i,
        /(?:_|\b)(?:Knitted|Crocheted|Woven)(?:_|\b)/i,
        /(?:_|\b)(?:Chainmail|CoatOfPlates|Plated|MetalSheet_)(?:_|\b)/i,
        // Hide/leather crafted items (but not leather jacket from loot)
        /(?:_|\b)Hide(?:_|Tent|$)/i,
        /(?:_|\b)Rawhide(?:_|$)/i,
        // Bone crafting
        /(?:^|_)Bone(?:_|Knife|Needle|$)/i,
        /Antler(?:_|$)|Sinew|Tallow|Pelt(?:_|$)/i,
        // Pottery & glass
        /Clay(?!more)(?:Plate|Bowl|Cup|Pot|Mug|Vase|Jar|Jug|Crucible|Canteen|Cement)/i,
        /Ceramic(?:Teacup|Bowl|Plate|Mug)/i,
        // Cooked/prepared food not in COOKED_AND_FILLED_ITEMS
        /Cooked|Grilled|Fried|Boiled|Roasted|Baked|Smoked|Dried|Jerky/i,
        /Stew|Soup|Sandwich|Burger|Salad|Muffin|Porridge|Recipe$/i,
        /Baguette(?:Sandwich|Slice)|BakingTray_/i,
        // Filled containers
        /WaterFull|PetrolFull|Full$|ClayCement|ConcreteFull|PlasterFull|WallpaperPaste/i,
        // Animal butchering results
        /Animal_(?:Brain|Heart|Intestines|Liver|Tongue|Fat|Stomach)/i,
        /Bull_Head_|Cow_Head_|Deer.*_Head_|Pig_Head_|Sheep_Head_/i,
        // Alcohol/medical preparations
        /AlcoholBandage|AlcoholRippedSheets/i,
        // Crafted tools
        /(?:_|\b)Forged(?:_|\b|$)/i,
        // Crafted explosives / traps with sensors
        /Sensor(?:V\d)?$/i,
        // Packed tents / sleeping bags from crafting
        /_Packed$/i,
        // Crafted ammo straps
        /AmmoStrap/i,
        // Crafted bags
        /Bag_ClothSatchel|Bag_Crafted/i,
        // Crafted toys
        /Crafted_/i,
        // Crafted weapons patterns
        /Spiked(?:Bat|Short)|_Nails$|_Spiked$|Morningstar/i,
        /Mace_(?:Metal|Wood|Stone)|Scrap(?:Cleaver|_)|SpearCrude/i,
        /SpearKnife|SpearScissors|SpearScrewdriver|SpearHuntingKnife/i,
        // Lanterns (blacksmithing crafted)
        /Lantern_Hurricane_(?:Copper|Gold|Silver|Forged)/i,
        // Crafted cooking items
        /SkewersWooden|PaintbrushCrafted|KnittingNeedles_Wood/i,
        // Needle types (crafted)
        /Needle_(?:Brass|Copper|Iron)/i,
        // Seed paste, heading tool (crafted intermediates)
        /SeedPaste|HeadingTool/i,
        // Sheaf items (harvested crops)
        /Sheaf$/i,
    ];
    
    // Name patterns for common items (environmental, found everywhere)
    const commonNamePatterns = [
        // Seeds and farming basics
        /Seed$|BagSeed|_Empty$/i,
        // Vehicle parts (doors, bumpers, etc)
        /TrunkDoor\d|Hood\d|Door\d|Bumper|Fender|Muffler|Windshield\d|Spoiler|^(?:Big|Normal|Small)(?:GasTank|Trunk)\d/i,
        // Skull wall mounts and decorative
        /Skull_Wall|_Wall$/i,
        // Moveable furniture props
        /^Mov_/i,
        // Book props (not readable)
        /Book_(?:Prop|Classic)|BookFancy_(?:Prop|Classic|Religion)/i,
        // Animal parts that are environmental drops
        /AnimalMilkPowder|FishGuts|FishRoeSac|FishingTrash|FISH_DEV/i,
        // Broken fishing items
        /Broken(?:FishingNet|FishingRod|$)/i,
        // Test items
        /^Test/i,
        // Umbrella variants
        /^Umbrella/i,
        // Map (base item)
        /^(?:Base\.)?Map$/i,
        // Empty containers (buckets, bottles)
        /^Bucket(?:Empty|Carved)/i,
        /Empty$/i,
        // Wild herbs/plants (forageable)
        /^(?:Comfrey|CommonMallow|Plantain|WildGarlic|BlackSage)$/i,
        // Metal drum (common world object)
        /^MetalDrum$/i,
        // Spray paint
        /^SprayPaint$/i,
        // Feeding bottle, hot water bottle
        /^(?:FeedingBottle|HotWaterBottle)$/i,
        // Cap gun ammo (toy)
        /^CapGun(?:Cap|CapBox)$/i,
    ];
    
    for (const [itemName, regData] of Object.entries(itemRegistry)) {
        // Skip if already has loot data or crafted data
        if (itemData[itemName]) continue;
        
        // Skip system/invisible categories
        if (skipCategories.includes(regData.displayCategory)) continue;
        
        const cat = regData.displayCategory || '';
        const shortName = itemName.replace(/^Base\./, '');
        
        let assignedType = 'uncommon'; // fallback
        
        // 1. Check category-based crafted
        if (craftedCategories.includes(cat)) {
            assignedType = 'crafted';
        }
        // 2. Check category-based common
        else if (commonCategories.includes(cat)) {
            assignedType = 'common';
        }
        // 3. Check category-based rare
        else if (rareCategories.includes(cat)) {
            assignedType = 'rare';
        }
        // 4. Check name patterns for crafted
        else if (craftedNamePatterns.some(p => p.test(shortName))) {
            assignedType = 'crafted';
        }
        // 5. Check name patterns for common
        else if (commonNamePatterns.some(p => p.test(shortName))) {
            assignedType = 'common';
        }
        // 6. Category-based heuristics for remaining
        else if (cat === 'Material') {
            // Materials not in loot or crafted patterns → likely crafting intermediate
            assignedType = 'crafted';
        }
        else if (cat === 'AnimalPart') {
            // Animal parts from butchering
            assignedType = 'crafted';
        }
        else if (cat === 'Gardening') {
            // Seeds and gardening items → common
            assignedType = 'common';
        }
        else if (cat === 'Food') {
            // Food not in loot tables and not matching cook patterns
            // Could be wild food, caterpillars, fish → common
            assignedType = 'common';
        }
        else if (cat === 'ProtectiveGear') {
            // Armor and protective gear not in loot → crafted
            assignedType = 'crafted';
        }
        else if (cat === 'Weapon') {
            // Weapons not in loot → likely crafted (crude swords, long maces)
            // Except BareHands which is system
            if (shortName === 'BareHands') {
                assignedType = 'common';
            } else {
                assignedType = 'crafted';
            }
        }
        else if (cat === 'Tool') {
            // Tools not in loot → likely crafted (anvils, vises, needles)
            assignedType = 'crafted';
        }
        else if (cat === 'LightSource') {
            // Light sources not in loot → crafted lanterns
            assignedType = 'crafted';
        }
        else if (cat === 'Cooking') {
            // Cooking items not in loot → crafted
            assignedType = 'crafted';
        }
        else if (cat === 'SportsWeapon') {
            // Forged barbells etc → crafted
            assignedType = 'crafted';
        }
        else if (cat === 'WaterContainer') {
            // Empty water containers → common
            assignedType = 'common';
        }
        else if (cat === 'Household') {
            // Umbrellas etc → uncommon
            assignedType = 'uncommon';
        }
        else if (cat === 'FirstAid') {
            // Wild herbs not in loot → common (forageable)
            assignedType = 'common';
        }
        else if (cat === 'Bag') {
            // Crafted bags not in loot → crafted
            assignedType = 'crafted';
        }
        else if (cat === 'Container') {
            // Special containers (military cases, laundry bags)
            assignedType = 'uncommon';
        }
        else if (cat === 'Camping') {
            // Tents not in loot → uncommon (useful finds)
            assignedType = 'uncommon';
        }
        else if (cat === 'Appearance') {
            // Makeup, face paint → uncommon
            assignedType = 'uncommon';
        }
        else if (cat === 'SkillBook') {
            // Book sets (containers for skill books)
            assignedType = 'uncommon';
        }
        else if (cat === 'Accessory') {
            // Accessories not in loot: jewelry → rare, others → uncommon
            if (/Bracelet|Necklace|Ring_|Earring|Piercing|Monocle/i.test(shortName)) {
                assignedType = 'rare';
            } else {
                assignedType = 'uncommon';
            }
        }
        else if (cat === 'Clothing') {
            // Clothing not in loot or zombie outfits → uncommon
            assignedType = 'uncommon';
        }
        else if (cat === 'Literature') {
            // Literature not in loot → uncommon
            assignedType = 'uncommon';
        }
        else if (cat === 'Teddy') {
            // Crafted teddy bears
            assignedType = 'crafted';
        }
        else if (cat === 'WeaponPart') {
            // Weapon parts not in loot → crafted
            assignedType = 'crafted';
        }
        
        // Apply the assignment
        if (assignedType === 'crafted') {
            itemData[itemName] = {
                totalRealChance: -3,
                occurrences: 0,
                lists: [],
                isCrafted: true
            };
            breakdown.crafted++;
        } else if (assignedType === 'rare') {
            itemData[itemName] = {
                totalRealChance: -2,
                occurrences: 0,
                lists: [],
                isDefault: true,
                defaultRarity: 'rare'
            };
            breakdown.rare++;
        } else if (assignedType === 'common') {
            itemData[itemName] = {
                totalRealChance: -2,
                occurrences: 0,
                lists: [],
                isDefault: true,
                defaultRarity: 'common'
            };
            breakdown.common++;
        } else {
            // uncommon (default fallback)
            itemData[itemName] = {
                totalRealChance: -2,
                occurrences: 0,
                lists: [],
                isDefault: true,
                defaultRarity: 'uncommon'
            };
            breakdown.uncommon++;
        }
        
        addedCount++;
    }
    
    console.log(`    Breakdown: ${breakdown.crafted} crafted, ${breakdown.common} common, ${breakdown.uncommon} uncommon, ${breakdown.rare} rare`);
    
    return addedCount;
}

// ============================================================
// Output Generation
// ============================================================

/**
 * Generate Lua output file
 */
function generateLuaFile(itemData, itemRegistry) {
    const versionTag = VERSION_LABEL !== 'auto' ? ` (${VERSION_LABEL})` : '';
    let lua = `--[[
    Item Rarity Data${versionTag} - Auto-generated by calculate-rarity.js
    
    Method: List-Size-Weighted Real Chance (multi-source)
    Sources: ProceduralDistributions, Distributions, VehicleDistributions
    
    For each item in each list: realChance = weight / listTotalWeight
    Each list's contribution is weighted by two factors:
      sizeWeight  = min(listItems, ${LIST_SIZE_FULL_WEIGHT}) / ${LIST_SIZE_FULL_WEIGHT}
      volumeWeight = min(totalWeight, ${LIST_VOLUME_FULL_WEIGHT}) / ${LIST_VOLUME_FULL_WEIGHT}
      listWeight = sizeWeight × volumeWeight
    Micro-lists (zombie outfits, totalWeight ~0.001) contribute almost nothing.
    Real loot containers (totalWeight 50-500) contribute fully. No data is discarded.
    
    Adjustments:
    - Confidence threshold: Legendary needs 3+ occurrences, Epic needs 2+
    - Category cap: Junk/Hidden/ZedDmg items capped at lower tiers
    - Derived items: Box contents inherit rarity from their container
    - Crafted items: Items not in loot tables but craftable via recipes
    - Cooked/filled: Cooking results and water-filled containers → crafted
    - Forage items: Items from forageDefinitions.lua (with explicit game-defined tiers)
    - Zombie drops: Items from AttachedWeaponDefinitions + ClothingSelectionDefinitions
    - Manual overrides: Hardcoded world spawns (Generator, Chainsaw, Blacksmith books)
    - Default items: All remaining game items → uncommon
    
    Thresholds:
    - Legendary: < ${RARITY_THRESHOLDS.legendary} (3+ occurrences required)
    - Epic: ${RARITY_THRESHOLDS.legendary} - ${RARITY_THRESHOLDS.epic} (2+ occurrences required)
    - Rare: ${RARITY_THRESHOLDS.epic} - ${RARITY_THRESHOLDS.rare}
    - Uncommon: ${RARITY_THRESHOLDS.rare} - ${RARITY_THRESHOLDS.uncommon}
    - Common: > ${RARITY_THRESHOLDS.uncommon}
    - Crafted: items only obtainable via crafting (not found in loot tables)
]]

ItemRarityData = {
`;
    
    // Sort: loot items by rarity (rarest first), then forage, zombie drops, defaults (by rarity), crafted
    const defaultRarityOrder = { rare: 0, uncommon: 1, common: 2 };
    const sortedItems = Object.entries(itemData)
        .sort((a, b) => {
            // Special items go to the end: manual < forage < zombie < defaults < crafted
            const aSpecial = a[1].isCrafted ? 5 : a[1].isDefault ? 4 : a[1].isZombieDrop ? 3 : a[1].isForage ? 2 : a[1].isManualOverride ? 1 : 0;
            const bSpecial = b[1].isCrafted ? 5 : b[1].isDefault ? 4 : b[1].isZombieDrop ? 3 : b[1].isForage ? 2 : b[1].isManualOverride ? 1 : 0;
            if (aSpecial !== bSpecial) return aSpecial - bSpecial;
            // Within defaults, sort by rarity tier then name
            if (aSpecial === 4 && bSpecial === 4) {
                const aR = defaultRarityOrder[a[1].defaultRarity || 'uncommon'] || 1;
                const bR = defaultRarityOrder[b[1].defaultRarity || 'uncommon'] || 1;
                if (aR !== bR) return aR - bR;
            }
            if (aSpecial > 0) return a[0].localeCompare(b[0]);
            return a[1].totalRealChance - b[1].totalRealChance;
        });
    
    for (const [itemName, data] of sortedItems) {
        if (data.isCrafted) {
            lua += `    ["${itemName}"] = { chance = 0, rarity = "crafted", occurrences = 0 },\n`;
        } else if (data.isDefault) {
            const defRarity = data.defaultRarity || 'uncommon';
            lua += `    ["${itemName}"] = { chance = 0, rarity = "${defRarity}", occurrences = 0 },\n`;
        } else if (data.isManualOverride) {
            lua += `    ["${itemName}"] = { chance = 0, rarity = "${data.manualRarity}", occurrences = 0 },\n`;
        } else if (data.isForage) {
            lua += `    ["${itemName}"] = { chance = 0, rarity = "${data.forageRarity}", occurrences = 0 },\n`;
        } else if (data.isZombieDrop) {
            lua += `    ["${itemName}"] = { chance = 0, rarity = "${data.zombieRarity}", occurrences = 0 },\n`;
        } else {
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
        common: 0,
        crafted: 0
    };
    
    let demotedCount = 0;
    let cappedCount = 0;
    let derivedCount = 0;
    
    let minChance = Infinity;
    let maxChance = 0;
    let minItem = '';
    let maxItem = '';
    
    let defaultCount = 0;
    let zombieDropCount = 0;
    let forageCount = 0;
    let manualCount = 0;
    
    for (const [itemName, data] of Object.entries(itemData)) {
        if (data.isCrafted) {
            stats.crafted++;
            continue;
        }
        if (data.isDefault) {
            defaultCount++;
            const defRarity = data.defaultRarity || 'uncommon';
            stats[defRarity] = (stats[defRarity] || 0) + 1;
            continue;
        }
        if (data.isManualOverride) {
            manualCount++;
            stats[data.manualRarity] = (stats[data.manualRarity] || 0) + 1;
            continue;
        }
        if (data.isForage) {
            forageCount++;
            stats[data.forageRarity] = (stats[data.forageRarity] || 0) + 1;
            continue;
        }
        if (data.isZombieDrop) {
            zombieDropCount++;
            stats[data.zombieRarity] = (stats[data.zombieRarity] || 0) + 1;
            continue;
        }
        
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
    
    const totalItems = Object.keys(itemData).length;
    const lootItems = totalItems - stats.crafted - defaultCount - zombieDropCount - forageCount - manualCount;
    
    console.log('\n=== RARITY STATISTICS ===\n');
    console.log(`Total items: ${totalItems} (${lootItems} loot + ${forageCount} forage + ${zombieDropCount} zombie + ${manualCount} manual + ${defaultCount} default + ${stats.crafted} crafted)`);
    console.log('');
    console.log('Loot Distribution:');
    console.log(`  Legendary: ${stats.legendary} items`);
    console.log(`  Epic:      ${stats.epic} items`);
    console.log(`  Rare:      ${stats.rare} items`);
    console.log(`  Uncommon:  ${stats.uncommon} items`);
    console.log(`  Common:    ${stats.common} items`);
    console.log('');
    console.log(`Crafted (no loot): ${stats.crafted} items`);
    console.log('');
    console.log('Adjustments applied:');
    console.log(`  Confidence demotions: ${demotedCount} items (low occurrences)`);
    console.log(`  Category caps:        ${cappedCount} items (Junk/Hidden/etc)`);
    console.log(`  Derived items:        ${derivedCount} items (from containers)`);
    console.log(`  Forage items:         ${forageCount} items (from forageDefinitions.lua)`);
    console.log(`  Zombie drop items:    ${zombieDropCount} items (from outfit/weapon definitions)`);
    console.log(`  Manual overrides:     ${manualCount} items (hardcoded world spawns)`);
    console.log(`  Default (registry):   ${defaultCount} items (not in any source, default uncommon)`);
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
    console.log('==========================================');
    console.log(`Version: ${VERSION_LABEL} | Output: ${path.relative(PROJECT_ROOT, OUTPUT_FILE)}\n`);
    
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
    
    // Fill remaining items from registry (default rarity for items not covered above)
    console.log('\nProcessing remaining registry items...');
    const defaultCount = processRemainingItems(itemData, itemRegistry);
    console.log(`  Added ${defaultCount} default entries (from all-items.json)`);
    
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
