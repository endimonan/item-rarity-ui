/**
 * Analyze a specific item's presence across all distribution files
 * Usage: node scripts/analyze-item.js Katana
 */

const fs = require('fs');
const path = require('path');

const PZ = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\ProjectZomboid';
const DIST_FILES = [
    path.join(PZ, 'media/lua/server/Items/ProceduralDistributions.lua'),
    path.join(PZ, 'media/lua/server/Items/Distributions.lua'),
    path.join(PZ, 'media/lua/server/Vehicles/VehicleDistributions.lua'),
];

const targetItem = process.argv[2] || 'Katana';

for (const f of DIST_FILES) {
    const content = fs.readFileSync(f, 'utf8');
    const fname = path.basename(f);
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('"' + targetItem + '"')) {
            // Look backwards for the table/block name
            let tableName = '???';
            for (let j = i; j >= Math.max(0, i - 50); j--) {
                const m = lines[j].match(/^\s*(\w+)\s*=\s*\{/);
                if (m) { tableName = m[1]; break; }
            }
            
            // Get weight
            const weightMatch = lines[i].match(new RegExp('"' + targetItem + '"\\s*,\\s*([\\d.]+)'));
            const weight = weightMatch ? weightMatch[1] : '?';
            
            // Count total items in this block - scan forward/backward for items = { }
            // Find the items block boundaries
            let blockStart = i;
            let blockEnd = i;
            for (let j = i; j >= Math.max(0, i - 100); j--) {
                if (lines[j].match(/items\s*=\s*\{/)) { blockStart = j; break; }
            }
            for (let j = i; j < Math.min(lines.length, i + 200); j++) {
                if (lines[j].includes('}') && j > blockStart) { blockEnd = j; break; }
            }
            
            // Count items and total weight in this block
            let totalWeight = 0;
            let itemCount = 0;
            for (let j = blockStart; j <= blockEnd; j++) {
                const pairMatch = lines[j].match(/"(\w+)"\s*,\s*([\d.]+)/);
                if (pairMatch) {
                    totalWeight += parseFloat(pairMatch[2]);
                    itemCount++;
                }
            }
            
            const realChance = totalWeight > 0 ? (parseFloat(weight) / totalWeight) : 0;
            
            console.log(`${fname} -> ${tableName}: weight=${weight}, listTotal=${totalWeight.toFixed(1)}, items=${itemCount}, realChance=${realChance.toFixed(6)}`);
        }
    }
}
