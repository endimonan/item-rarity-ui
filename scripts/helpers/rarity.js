/**
 * Core rarity calculation and tier adjustment functions.
 */

const {
    LIST_SIZE_FULL_WEIGHT,
    LIST_VOLUME_FULL_WEIGHT,
    RARITY_THRESHOLDS,
    RARITY_ORDER,
    TIER_MIN_OCCURRENCES,
    TIER_DEMOTION,
    CATEGORY_MAX_RARITY,
} = require('./config');

/**
 * Process all distribution sources and accumulate item data.
 * 
 * Uses list-size weighting to prevent micro-lists (outfit tables, 
 * zombie-specific loot with 1-3 items) from inflating rarity values,
 * while still counting ALL loot sources proportionally.
 */
function calculateRarities(allLists) {
    const itemData = {};
    let totalProcessed = 0;
    let fullWeightCount = 0;
    
    for (const [listName, items] of Object.entries(allLists)) {
        if (!items || items.length === 0) continue;
        
        const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
        if (totalWeight === 0) continue;
        
        const sizeWeight = Math.min(items.length, LIST_SIZE_FULL_WEIGHT) / LIST_SIZE_FULL_WEIGHT;
        const volumeWeight = Math.min(totalWeight, LIST_VOLUME_FULL_WEIGHT) / LIST_VOLUME_FULL_WEIGHT;
        const listWeight = sizeWeight * volumeWeight;
        
        if (listWeight >= 0.99) fullWeightCount++;
        totalProcessed++;
        
        for (const item of items) {
            const rawRealChance = item.weight / totalWeight;
            const weightedChance = rawRealChance * listWeight;
            
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
 * Cap a rarity tier to a maximum allowed tier.
 * Returns the less rare of the two.
 */
function capRarity(currentTier, maxTier) {
    const currentIdx = RARITY_ORDER.indexOf(currentTier);
    const maxIdx = RARITY_ORDER.indexOf(maxTier);
    
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
    
    const minOccurrences = TIER_MIN_OCCURRENCES[rarity];
    if (minOccurrences && occurrences < minOccurrences) {
        const demotedTo = TIER_DEMOTION[rarity];
        if (demotedTo) {
            rarity = demotedTo;
        }
    }
    
    if (displayCategory && CATEGORY_MAX_RARITY[displayCategory]) {
        rarity = capRarity(rarity, CATEGORY_MAX_RARITY[displayCategory]);
    }
    
    return rarity;
}

module.exports = {
    calculateRarities,
    getRawRarityTier,
    capRarity,
    getAdjustedRarity,
};
