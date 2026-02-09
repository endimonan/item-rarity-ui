/**
 * Compare B41 and B42 rarity data side by side
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const B41_FILE = path.join(ROOT, 'media', 'lua', 'shared', 'ItemRarityData.lua');
const B42_FILE = path.join(ROOT, '42', 'media', 'lua', 'shared', 'ItemRarityData.lua');

function parseRarityData(filePath) {
    const data = fs.readFileSync(filePath, 'utf8');
    const items = {};
    const regex = /\["([\w.]+)"\] = \{ chance = ([\d.]+), rarity = "(\w+)", occurrences = (\d+) \}/g;
    let m;
    while ((m = regex.exec(data)) !== null) {
        items[m[1]] = { chance: parseFloat(m[2]), rarity: m[3], occ: parseInt(m[4]) };
    }
    return items;
}

function countTiers(items) {
    const tiers = { legendary: 0, epic: 0, rare: 0, uncommon: 0, common: 0, crafted: 0 };
    for (const item of Object.values(items)) {
        tiers[item.rarity] = (tiers[item.rarity] || 0) + 1;
    }
    return tiers;
}

const b41 = parseRarityData(B41_FILE);
const b42 = parseRarityData(B42_FILE);

const b41Tiers = countTiers(b41);
const b42Tiers = countTiers(b42);

const b41Total = Object.keys(b41).length;
const b42Total = Object.keys(b42).length;

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║         ITEM RARITY DATA - VERSION COMPARISON           ║');
console.log('╠══════════════════════════════════════════════════════════╣');
console.log('║                                                         ║');
console.log(`║  B41: ${String(b41Total).padStart(5)} items total                               ║`);
console.log(`║  B42: ${String(b42Total).padStart(5)} items total                               ║`);
console.log('║                                                         ║');
console.log('╠═══════════════╦════════════════╦════════════════════════╣');
console.log('║  Tier         ║   B41          ║   B42                 ║');
console.log('╠═══════════════╬════════════════╬════════════════════════╣');

const tierOrder = ['legendary', 'epic', 'rare', 'uncommon', 'common', 'crafted'];
for (const tier of tierOrder) {
    const b41Count = b41Tiers[tier] || 0;
    const b42Count = b42Tiers[tier] || 0;
    const b41Pct = ((b41Count / b41Total) * 100).toFixed(1);
    const b42Pct = ((b42Count / b42Total) * 100).toFixed(1);
    const label = tier.charAt(0).toUpperCase() + tier.slice(1);
    console.log(`║  ${label.padEnd(12)} ║ ${String(b41Count).padStart(5)} (${b41Pct.padStart(5)}%) ║ ${String(b42Count).padStart(5)} (${b42Pct.padStart(5)}%)      ║`);
}

console.log('╠═══════════════╩════════════════╩════════════════════════╣');
console.log('║                                                         ║');

// Items only in B42
const b42Only = Object.keys(b42).filter(k => !b41[k]);
const b41Only = Object.keys(b41).filter(k => !b42[k]);
console.log(`║  Items only in B42: ${String(b42Only.length).padStart(5)}                            ║`);
console.log(`║  Items only in B41: ${String(b41Only.length).padStart(5)}                            ║`);
console.log(`║  Items in both:     ${String(b41Total - b41Only.length).padStart(5)}                            ║`);

console.log('║                                                         ║');
console.log('╠═════════════════════════════════════════════════════════╣');
console.log('║            KNOWN ITEMS COMPARISON                       ║');
console.log('╠═════════════════════════════════════════════════════════╣');

const known = [
    'Base.Katana', 'Base.Katana_Broken', 'Base.Sledgehammer', 'Base.Axe',
    'Base.BaseballBat', 'Base.Pistol', 'Base.Shotgun', 'Base.HuntingRifle',
    'Base.Crowbar', 'Base.KitchenKnife', 'Base.Hammer', 'Base.Screwdriver',
    'Base.Jacket_Chef', 'Base.Hat_ChefHat',
    'Base.Glasses_Cosmetic_Normal', 'Base.Glasses_Cosmetic_CatsEye',
    'Base.NailsBox', 'Base.Nails',
];

console.log('║                                                         ║');
console.log('║  Item                        B41          B42           ║');
console.log('║  ─────────────────────────── ──────────── ────────────  ║');

for (const k of known) {
    const short = k.replace('Base.', '');
    const b41Item = b41[k];
    const b42Item = b42[k];
    const b41Str = b41Item ? b41Item.rarity.padEnd(10) : '  —       ';
    const b42Str = b42Item ? b42Item.rarity.padEnd(10) : '  —       ';
    console.log(`║  ${short.padEnd(27)} ${b41Str}   ${b42Str}    ║`);
}

console.log('║                                                         ║');
console.log('╠═════════════════════════════════════════════════════════╣');

// Items that changed rarity between versions
const shared = Object.keys(b41).filter(k => b42[k]);
const changed = shared.filter(k => b41[k].rarity !== b42[k].rarity);
console.log(`║  Items that changed rarity between B41→B42: ${String(changed.length).padStart(4)}       ║`);
console.log('╠═════════════════════════════════════════════════════════╣');

// Show some interesting changes
if (changed.length > 0) {
    const tierRank = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4, crafted: 5 };
    const promoted = changed.filter(k => tierRank[b42[k].rarity] < tierRank[b41[k].rarity]);
    const demoted = changed.filter(k => tierRank[b42[k].rarity] > tierRank[b41[k].rarity]);
    
    console.log(`║  Promoted (rarer in B42): ${String(promoted.length).padStart(4)}                         ║`);
    console.log(`║  Demoted (commoner in B42): ${String(demoted.length).padStart(4)}                       ║`);
    console.log('║                                                         ║');
    
    if (promoted.length > 0) {
        console.log('║  Top promoted (became rarer in B42):                     ║');
        for (const k of promoted.slice(0, 8)) {
            const short = k.replace('Base.', '');
            console.log(`║    ${short.padEnd(25)} ${b41[k].rarity.padEnd(10)} → ${b42[k].rarity.padEnd(10)} ║`);
        }
    }
    
    if (demoted.length > 0) {
        console.log('║  Top demoted (became commoner in B42):                   ║');
        for (const k of demoted.slice(0, 8)) {
            const short = k.replace('Base.', '');
            console.log(`║    ${short.padEnd(25)} ${b41[k].rarity.padEnd(10)} → ${b42[k].rarity.padEnd(10)} ║`);
        }
    }
}

console.log('║                                                         ║');
console.log('╚═════════════════════════════════════════════════════════╝');
