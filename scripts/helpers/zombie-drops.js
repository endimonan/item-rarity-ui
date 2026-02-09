/**
 * Zombie drop parsers.
 * Parses AttachedWeaponDefinitions.lua and ClothingSelectionDefinitions.lua
 * to determine rarity for items found on zombies.
 */

const fs = require('fs');
const { ZOMBIE_WEAPON_DEFS, ZOMBIE_CLOTHING_DEFS, OUTFIT_RARITY, RARITY_ORDER } = require('./config');

/**
 * Parse AttachedWeaponDefinitions.lua and extract weapon rarity data.
 * Returns: Map of itemName -> rarity tier
 */
function parseZombieWeapons() {
    if (!fs.existsSync(ZOMBIE_WEAPON_DEFS)) {
        console.log('  WARNING: AttachedWeaponDefinitions.lua not found, skipping');
        return {};
    }
    
    const content = fs.readFileSync(ZOMBIE_WEAPON_DEFS, 'utf8');
    const weaponItems = {};
    
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
        if (def.name === 'chanceOfAttachedWeapon' || def.name === 'attachedWeaponCustomOutfit') continue;
        
        const endPos = i + 1 < defPositions.length ? defPositions[i + 1].start : content.length;
        const block = content.substring(def.contentStart, endPos);
        
        const chanceMatch = block.match(/chance\s*=\s*(\d+)/);
        if (!chanceMatch) continue;
        const chance = parseInt(chanceMatch[1]);
        
        const dayMatch = block.match(/daySurvived\s*=\s*(\d+)/);
        const daySurvived = dayMatch ? parseInt(dayMatch[1]) : 0;
        
        const outfitMatch = block.match(/outfit\s*=\s*\{([^}]*)\}/);
        const isOutfitSpecific = !!outfitMatch;
        
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
    
    for (const def of definitions) {
        const defShare = def.chance / totalChance;
        const perItemShare = defShare / def.weapons.length;
        const dayPenalty = 1.0 / (1 + def.daySurvived / 10);
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
    
    const result = {};
    for (const [itemName, data] of Object.entries(weaponItems)) {
        let rarity;
        if (data.totalShare < 0.005) {
            rarity = 'epic';
        } else if (data.totalShare < 0.02) {
            rarity = 'rare';
        } else if (data.totalShare < 0.08) {
            rarity = 'uncommon';
        } else {
            rarity = 'common';
        }
        result[itemName] = rarity;
    }
    
    console.log(`  Parsed ${definitions.length} weapon definitions, ${Object.keys(result).length} unique weapons`);
    return result;
}

/**
 * Parse ClothingSelectionDefinitions.lua and extract clothing rarity data.
 * Returns: Map of itemName -> rarity tier
 */
function parseZombieClothing() {
    if (!fs.existsSync(ZOMBIE_CLOTHING_DEFS)) {
        console.log('  WARNING: ClothingSelectionDefinitions.lua not found, skipping');
        return {};
    }
    
    const content = fs.readFileSync(ZOMBIE_CLOTHING_DEFS, 'utf8');
    const clothingItems = {};
    
    const outfitNameRegex = /ClothingSelectionDefinitions\.(\w+)\s*=\s*\{/g;
    let outfitMatch;
    const outfitPositions = [];
    
    while ((outfitMatch = outfitNameRegex.exec(content)) !== null) {
        outfitPositions.push({
            name: outfitMatch[1].toLowerCase(),
            start: outfitMatch.index
        });
    }
    
    for (let i = 0; i < outfitPositions.length; i++) {
        const outfit = outfitPositions[i];
        const start = outfit.start;
        const end = i + 1 < outfitPositions.length ? outfitPositions[i + 1].start : content.length;
        const outfitContent = content.substring(start, end);
        
        const outfitRarity = OUTFIT_RARITY[outfit.name] || 'uncommon';
        
        const itemRefRegex = /"(Base\.\w+)"/g;
        let itemMatch;
        while ((itemMatch = itemRefRegex.exec(outfitContent)) !== null) {
            const itemName = itemMatch[1];
            
            if (!clothingItems[itemName]) {
                clothingItems[itemName] = outfitRarity;
            } else {
                const currentIdx = RARITY_ORDER.indexOf(clothingItems[itemName]);
                const newIdx = RARITY_ORDER.indexOf(outfitRarity);
                if (newIdx > currentIdx) {
                    clothingItems[itemName] = outfitRarity;
                }
            }
        }
    }
    
    console.log(`  Parsed ${outfitPositions.length} outfit definitions, ${Object.keys(clothingItems).length} unique clothing items`);
    return clothingItems;
}

module.exports = {
    parseZombieWeapons,
    parseZombieClothing,
};
