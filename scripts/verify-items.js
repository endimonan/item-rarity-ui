/**
 * Quick verify of known items in the generated rarity data
 */
const fs = require('fs');
const data = fs.readFileSync('media/lua/shared/ItemRarityData.lua', 'utf8');

const known = [
    'Base.Katana', 'Base.Katana_Broken', 'Base.Sledgehammer', 'Base.Axe',
    'Base.BaseballBat', 'Base.Pistol', 'Base.Shotgun', 'Base.HuntingRifle',
    'Base.DoubleBarrelShotgun', 'Base.Crowbar', 'Base.KitchenKnife',
    'Base.Hammer', 'Base.Screwdriver', 'Base.Jacket_Chef', 'Base.Hat_ChefHat',
    'Base.Glasses_Cosmetic_Normal', 'Base.Glasses_Cosmetic_CatsEye',
    'Base.Chainmail_SleeveFull_R', 'Base.NailsBox', 'Base.Paperwork',
    'Base.Nails', 'Base.WaterBottleFull',
];

console.log('=== KNOWN ITEMS ===\n');
for (const k of known) {
    const escaped = k.replace('.', '\\.');
    const re = new RegExp('\\["' + escaped + '"\\] = \\{ chance = ([\\d.]+), rarity = "(\\w+)", occurrences = (\\d+)');
    const m = data.match(re);
    if (m) {
        console.log(`${k.padEnd(42)} chance=${parseFloat(m[1]).toFixed(6).padStart(10)}  ${m[2].padEnd(10)}  occ=${m[3]}`);
    } else {
        console.log(`${k.padEnd(42)} NOT FOUND`);
    }
}

// Percentile distribution
console.log('\n=== PERCENTILE DISTRIBUTION ===\n');
const regex = /chance = ([\d.]+), rarity = "(\w+)", occurrences = (\d+)/g;
let mm;
const allChances = [];
while ((mm = regex.exec(data)) !== null) {
    const c = parseFloat(mm[1]);
    if (c > 0) allChances.push(c);
}
allChances.sort((a, b) => a - b);

const pcts = [1, 5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 75, 80, 85, 90, 95, 99];
for (const p of pcts) {
    const idx = Math.floor(allChances.length * p / 100);
    console.log(`P${String(p).padStart(2)}: ${allChances[idx].toFixed(6)}`);
}

// Tier counts
const tiers = {};
const tierRegex = /rarity = "(\w+)"/g;
while ((mm = tierRegex.exec(data)) !== null) {
    tiers[mm[1]] = (tiers[mm[1]] || 0) + 1;
}
console.log('\n=== TIER COUNTS ===\n');
for (const [t, c] of Object.entries(tiers).sort((a, b) => b[1] - a[1])) {
    const pct = (c / Object.values(tiers).reduce((s, v) => s + v, 0) * 100).toFixed(1);
    console.log(`${t.padEnd(12)} ${String(c).padStart(5)} items (${pct}%)`);
}
