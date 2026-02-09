/**
 * Item processors.
 * Each processor enriches itemData with items from a specific source.
 */

const { DERIVED_ITEMS, COOKED_AND_FILLED_ITEMS, MANUAL_OVERRIDES, RARITY_ORDER } = require('./config');
const { parseZombieWeapons, parseZombieClothing } = require('./zombie-drops');
const { parseForageDefinitions } = require('./forage');

// ============================================================
// Derived Items
// ============================================================

/**
 * Process derived items: if NailsBox has data but Nails doesn't,
 * create an entry for Nails inheriting from NailsBox.
 */
function processDerivedItems(itemData) {
    let derivedCount = 0;
    
    for (const [containerName, contentName] of Object.entries(DERIVED_ITEMS)) {
        const containerFullName = `Base.${containerName}`;
        const contentFullName = `Base.${contentName}`;
        
        const containerData = itemData[containerFullName];
        if (!containerData) continue;
        if (itemData[contentFullName]) continue;
        
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
 * Add "crafted" entries for items that are NOT in any loot table
 * but ARE the result of a crafting recipe (from all-items.json).
 */
function processCraftedItems(itemData, itemRegistry) {
    if (!itemRegistry) return 0;
    
    let craftedCount = 0;
    
    for (const [itemName, regData] of Object.entries(itemRegistry)) {
        if (itemData[itemName]) continue;
        if (!regData.craftable) continue;
        
        const skipCategories = ['ZedDmg', 'Wound', 'Bandage', 'Hidden', 'Corpse', 'MaleBody'];
        if (skipCategories.includes(regData.displayCategory)) continue;
        
        itemData[itemName] = {
            totalRealChance: -1,
            occurrences: 0,
            lists: [],
            isCrafted: true
        };
        
        craftedCount++;
    }
    
    return craftedCount;
}

// ============================================================
// Cooked/Filled Items
// ============================================================

/**
 * Mark cooked food, water-filled containers, and farming intermediates as "crafted".
 * Only applies to items NOT already in loot tables.
 */
function processCookedAndFilledItems(itemData) {
    let addedCount = 0;
    
    for (const itemName of COOKED_AND_FILLED_ITEMS) {
        if (itemData[itemName]) continue;
        
        itemData[itemName] = {
            totalRealChance: -1,
            occurrences: 0,
            lists: [],
            isCrafted: true
        };
        addedCount++;
    }
    
    return addedCount;
}

// ============================================================
// Zombie Drop Items
// ============================================================

/**
 * Process zombie drop items: weapons stuck in zombies + clothing worn by zombies.
 * Only applies to items NOT already in loot tables or crafted.
 */
function processZombieDropItems(itemData) {
    let addedCount = 0;
    
    console.log('  Parsing zombie weapon definitions...');
    const zombieWeapons = parseZombieWeapons();
    
    console.log('  Parsing zombie clothing definitions...');
    const zombieClothing = parseZombieClothing();
    
    const allZombieItems = {};
    
    for (const [itemName, rarity] of Object.entries(zombieClothing)) {
        allZombieItems[itemName] = rarity;
    }
    
    for (const [itemName, rarity] of Object.entries(zombieWeapons)) {
        const currentIdx = RARITY_ORDER.indexOf(allZombieItems[itemName] || 'common');
        const newIdx = RARITY_ORDER.indexOf(rarity);
        if (!allZombieItems[itemName] || newIdx < currentIdx) {
            allZombieItems[itemName] = rarity;
        }
    }
    
    for (const [itemName, rarity] of Object.entries(allZombieItems)) {
        if (itemData[itemName]) continue;
        
        itemData[itemName] = {
            totalRealChance: -3,
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
// Forage Items
// ============================================================

/**
 * Apply forage rarity data to items NOT already in loot tables or crafted.
 */
function processForageItems(itemData) {
    console.log('  Parsing forage definitions...');
    const forageRarity = parseForageDefinitions();
    
    let addedCount = 0;
    for (const [itemName, rarity] of Object.entries(forageRarity)) {
        if (itemData[itemName]) continue;
        
        itemData[itemName] = {
            totalRealChance: -4,
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

// ============================================================
// Manual Overrides
// ============================================================

/**
 * Apply manual rarity overrides for hardcoded world spawns.
 * Only applies to items NOT already classified.
 */
function processManualOverrides(itemData) {
    let addedCount = 0;
    
    for (const [itemName, rarity] of Object.entries(MANUAL_OVERRIDES)) {
        if (itemData[itemName]) continue;
        
        itemData[itemName] = {
            totalRealChance: -5,
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
// Remaining Items (smart defaults)
// ============================================================

/**
 * Smart default rarity for items not covered by any other source.
 * Assigns rarity based on displayCategory and name patterns.
 */
function processRemainingItems(itemData, itemRegistry) {
    if (!itemRegistry) return 0;
    
    let addedCount = 0;
    const breakdown = { crafted: 0, common: 0, uncommon: 0, rare: 0 };
    
    const skipCategories = [
        'ZedDmg', 'Wound', 'Bandage', 'Hidden', 'Corpse', 
        'MaleBody', 'Bug', 'Tail', 'Fox', 'Bunny', 'Duck', 
        'Frog', 'Raccoon', 'Bear', 'Badger', 'Eye', 'Squirrel', 
        'Beaver', 'Mole', 'Hedgehog', 'Dog', 'Goblin', 'Spider',
        'Generic', 'Animal',
    ];
    
    const craftedCategories = [
        'WeaponCrafted', 'BrokenWeapon', 'Explosives',
    ];
    
    const commonCategories = [
        'Furniture', 'VehicleMaintenance', 'Junk', 'Water',
        'Fishing', 'MaterialWeapon', 'JunkWeapon', 'FishingWeapon', 'HouseholdWeapon',
    ];
    
    const rareCategories = [
        'Memento',
    ];
    
    const craftedNamePatterns = [
        /Ingot|Nugget$/i,
        /Carved|Mold(?:ed)?|Unfired|Untreated|Assembled|Kiln|Forge[d]?$|Smelt/i,
        /Crude(?:Saw|Sword|ShortSword|Bench)|^Flint(?!stone)/i,
        /(?:_|\b)(?:Burlap|Rag|Fur|Tarp|GarbageBag)(?:_|\b)/i,
        /(?:_|\b)(?:Knitted|Crocheted|Woven)(?:_|\b)/i,
        /(?:_|\b)(?:Chainmail|CoatOfPlates|Plated|MetalSheet_)(?:_|\b)/i,
        /(?:_|\b)Hide(?:_|Tent|$)/i,
        /(?:_|\b)Rawhide(?:_|$)/i,
        /(?:^|_)Bone(?:_|Knife|Needle|$)/i,
        /Antler(?:_|$)|Sinew|Tallow|Pelt(?:_|$)/i,
        /Clay(?!more)(?:Plate|Bowl|Cup|Pot|Mug|Vase|Jar|Jug|Crucible|Canteen|Cement)/i,
        /Ceramic(?:Teacup|Bowl|Plate|Mug)/i,
        /Cooked|Grilled|Fried|Boiled|Roasted|Baked|Smoked|Dried|Jerky/i,
        /Stew|Soup|Sandwich|Burger|Salad|Muffin|Porridge|Recipe$/i,
        /Baguette(?:Sandwich|Slice)|BakingTray_/i,
        /WaterFull|PetrolFull|Full$|ClayCement|ConcreteFull|PlasterFull|WallpaperPaste/i,
        /Animal_(?:Brain|Heart|Intestines|Liver|Tongue|Fat|Stomach)/i,
        /Bull_Head_|Cow_Head_|Deer.*_Head_|Pig_Head_|Sheep_Head_/i,
        /AlcoholBandage|AlcoholRippedSheets/i,
        /(?:_|\b)Forged(?:_|\b|$)/i,
        /Sensor(?:V\d)?$/i,
        /_Packed$/i,
        /AmmoStrap/i,
        /Bag_ClothSatchel|Bag_Crafted/i,
        /Crafted_/i,
        /Spiked(?:Bat|Short)|_Nails$|_Spiked$|Morningstar/i,
        /Mace_(?:Metal|Wood|Stone)|Scrap(?:Cleaver|_)|SpearCrude/i,
        /SpearKnife|SpearScissors|SpearScrewdriver|SpearHuntingKnife/i,
        /Lantern_Hurricane_(?:Copper|Gold|Silver|Forged)/i,
        /SkewersWooden|PaintbrushCrafted|KnittingNeedles_Wood/i,
        /Needle_(?:Brass|Copper|Iron)/i,
        /SeedPaste|HeadingTool/i,
        /Sheaf$/i,
    ];
    
    const commonNamePatterns = [
        /Seed$|BagSeed|_Empty$/i,
        /TrunkDoor\d|Hood\d|Door\d|Bumper|Fender|Muffler|Windshield\d|Spoiler|^(?:Big|Normal|Small)(?:GasTank|Trunk)\d/i,
        /Skull_Wall|_Wall$/i,
        /^Mov_/i,
        /Book_(?:Prop|Classic)|BookFancy_(?:Prop|Classic|Religion)/i,
        /AnimalMilkPowder|FishGuts|FishRoeSac|FishingTrash|FISH_DEV/i,
        /Broken(?:FishingNet|FishingRod|$)/i,
        /^Test/i,
        /^Umbrella/i,
        /^(?:Base\.)?Map$/i,
        /^Bucket(?:Empty|Carved)/i,
        /Empty$/i,
        /^(?:Comfrey|CommonMallow|Plantain|WildGarlic|BlackSage)$/i,
        /^MetalDrum$/i,
        /^SprayPaint$/i,
        /^(?:FeedingBottle|HotWaterBottle)$/i,
        /^CapGun(?:Cap|CapBox)$/i,
    ];
    
    for (const [itemName, regData] of Object.entries(itemRegistry)) {
        if (itemData[itemName]) continue;
        if (skipCategories.includes(regData.displayCategory)) continue;
        
        const cat = regData.displayCategory || '';
        const shortName = itemName.replace(/^Base\./, '');
        
        let assignedType = 'uncommon';
        
        if (craftedCategories.includes(cat)) {
            assignedType = 'crafted';
        }
        else if (commonCategories.includes(cat)) {
            assignedType = 'common';
        }
        else if (rareCategories.includes(cat)) {
            assignedType = 'rare';
        }
        else if (craftedNamePatterns.some(p => p.test(shortName))) {
            assignedType = 'crafted';
        }
        else if (commonNamePatterns.some(p => p.test(shortName))) {
            assignedType = 'common';
        }
        else if (cat === 'Material') { assignedType = 'crafted'; }
        else if (cat === 'AnimalPart') { assignedType = 'crafted'; }
        else if (cat === 'Gardening') { assignedType = 'common'; }
        else if (cat === 'Food') { assignedType = 'common'; }
        else if (cat === 'ProtectiveGear') { assignedType = 'crafted'; }
        else if (cat === 'Weapon') {
            assignedType = shortName === 'BareHands' ? 'common' : 'crafted';
        }
        else if (cat === 'Tool') { assignedType = 'crafted'; }
        else if (cat === 'LightSource') { assignedType = 'crafted'; }
        else if (cat === 'Cooking') { assignedType = 'crafted'; }
        else if (cat === 'SportsWeapon') { assignedType = 'crafted'; }
        else if (cat === 'WaterContainer') { assignedType = 'common'; }
        else if (cat === 'FirstAid') { assignedType = 'common'; }
        else if (cat === 'Bag') { assignedType = 'crafted'; }
        else if (cat === 'Teddy') { assignedType = 'crafted'; }
        else if (cat === 'WeaponPart') { assignedType = 'crafted'; }
        else if (cat === 'Accessory') {
            assignedType = /Bracelet|Necklace|Ring_|Earring|Piercing|Monocle/i.test(shortName) ? 'rare' : 'uncommon';
        }
        // Remaining: Household, Container, Camping, Appearance, SkillBook, Clothing, Literature → uncommon (default)
        
        if (assignedType === 'crafted') {
            itemData[itemName] = { totalRealChance: -3, occurrences: 0, lists: [], isCrafted: true };
            breakdown.crafted++;
        } else if (assignedType === 'rare') {
            itemData[itemName] = { totalRealChance: -2, occurrences: 0, lists: [], isDefault: true, defaultRarity: 'rare' };
            breakdown.rare++;
        } else if (assignedType === 'common') {
            itemData[itemName] = { totalRealChance: -2, occurrences: 0, lists: [], isDefault: true, defaultRarity: 'common' };
            breakdown.common++;
        } else {
            itemData[itemName] = { totalRealChance: -2, occurrences: 0, lists: [], isDefault: true, defaultRarity: 'uncommon' };
            breakdown.uncommon++;
        }
        
        addedCount++;
    }
    
    console.log(`    Breakdown: ${breakdown.crafted} crafted, ${breakdown.common} common, ${breakdown.uncommon} uncommon, ${breakdown.rare} rare`);
    
    return addedCount;
}

module.exports = {
    processDerivedItems,
    processCraftedItems,
    processCookedAndFilledItems,
    processZombieDropItems,
    processForageItems,
    processManualOverrides,
    processRemainingItems,
};
