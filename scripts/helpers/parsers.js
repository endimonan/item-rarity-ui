/**
 * Distribution file parsers.
 * Extracts item/weight pairs from ProceduralDistributions, Distributions, VehicleDistributions.
 */

const fs = require('fs');
const path = require('path');

/**
 * Extract all "ItemName", weight pairs from a content string.
 * Works on any content that contains items = { "Item", weight, ... } blocks.
 */
function extractAllItemBlocks(content) {
    const blocks = [];
    const itemsBlockRegex = /items\s*=\s*\{([^}]*)\}/g;
    
    let match;
    while ((match = itemsBlockRegex.exec(content)) !== null) {
        const blockContent = match[1];
        const items = [];
        
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

module.exports = {
    extractAllItemBlocks,
    parseDistributionFile,
};
