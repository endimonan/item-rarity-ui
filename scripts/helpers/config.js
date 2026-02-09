/**
 * Configuration constants for the rarity calculator.
 * Paths, thresholds, overrides, derived items, and static data.
 */

const fs = require('fs');
const path = require('path');

const PZ_PATH = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\ProjectZomboid';
const PROJECT_ROOT = path.join(__dirname, '..', '..');

// --- Distribution source files ---
const DISTRIBUTION_FILES = [
    path.join(PZ_PATH, 'media', 'lua', 'server', 'Items', 'ProceduralDistributions.lua'),
    path.join(PZ_PATH, 'media', 'lua', 'server', 'Items', 'Distributions.lua'),
    path.join(PZ_PATH, 'media', 'lua', 'server', 'Vehicles', 'VehicleDistributions.lua'),
];

// --- Zombie drop definition files ---
const ZOMBIE_WEAPON_DEFS = path.join(PZ_PATH, 'media', 'lua', 'shared', 'Definitions', 'AttachedWeaponDefinitions.lua');
const ZOMBIE_CLOTHING_DEFS = path.join(PZ_PATH, 'media', 'lua', 'shared', 'Definitions', 'ClothingSelectionDefinitions.lua');

// --- Foraging definition file ---
const FORAGE_DEFS = path.join(PZ_PATH, 'media', 'lua', 'shared', 'Foraging', 'forageDefinitions.lua');

// --- Version detection ---
// Priority: 1) explicit --b41/--b42 flag  2) auto-detect from game files
const VERSION_FLAG = process.argv.find(a => a === '--b41' || a === '--b42');

/**
 * Auto-detect installed game version by checking for B42-only paths.
 * B42 has media/scripts/generated/recipes/ which doesn't exist in B41.
 */
function detectGameVersion() {
    if (VERSION_FLAG === '--b41') return 'B41';
    if (VERSION_FLAG === '--b42') return 'B42';

    const b42Indicator = path.join(PZ_PATH, 'media', 'scripts', 'generated', 'recipes');
    if (fs.existsSync(b42Indicator)) {
        return 'B42';
    }
    return 'B41';
}

const DETECTED_VERSION = detectGameVersion();
const VERSION_LABEL = DETECTED_VERSION;

// --- Item registry (version-specific) ---
const ITEMS_REGISTRY_FILE = path.join(PROJECT_ROOT, `all-items-${DETECTED_VERSION.toLowerCase()}.json`);

function getOutputFile() {
    if (DETECTED_VERSION === 'B42') {
        return path.join(PROJECT_ROOT, '42', 'media', 'lua', 'shared', 'ItemRarityData.lua');
    }
    // B41: write to root
    return path.join(PROJECT_ROOT, 'media', 'lua', 'shared', 'ItemRarityData.lua');
}

const OUTPUT_FILE = getOutputFile();

// --- List importance weighting (dual-factor) ---
const LIST_SIZE_FULL_WEIGHT = 30;
const LIST_VOLUME_FULL_WEIGHT = 10;

// --- Rarity thresholds ---
const RARITY_THRESHOLDS = {
    legendary: 0.01,
    epic: 0.04,
    rare: 0.12,
    uncommon: 0.40,
    common: Infinity
};

// Rarity tier order (for comparisons)
const RARITY_ORDER = ['legendary', 'epic', 'rare', 'uncommon', 'common'];

// Minimum occurrences required for high tiers
const TIER_MIN_OCCURRENCES = {
    legendary: 3,
    epic: 2,
};

// Demotion map
const TIER_DEMOTION = {
    legendary: 'rare',
    epic: 'uncommon',
};

// Category-based max rarity cap
const CATEGORY_MAX_RARITY = {
    'Junk': 'uncommon',
    'Hidden': 'common',
    'Appearance': 'uncommon',
    'ZedDmg': 'common',
    'Corpse': 'common',
};

// --- Manual rarity overrides ---
const MANUAL_OVERRIDES = {
    'Base.Generator': 'rare',
    'Base.Chainsaw': 'rare',
    'Base.BookBlacksmith1': 'rare',
    'Base.BookBlacksmith2': 'rare',
    'Base.BookBlacksmith3': 'rare',
    'Base.BookBlacksmith4': 'rare',
    'Base.BookBlacksmith5': 'rare',
    'Base.SmithingMag1': 'rare',
    'Base.SmithingMag2': 'rare',
    'Base.SmithingMag3': 'rare',
    'Base.SmithingMag4': 'rare',
};

// --- Cooked/filled items (player-made, not loot) ---
const COOKED_AND_FILLED_ITEMS = [
    'Base.EggBoiled', 'Base.EggPoached', 'Base.GrilledCheese', 'Base.Pancakes',
    'Base.Waffles', 'Base.Guacamole', 'Base.RamenBowl', 'Base.Smore',
    'Base.DoughRolled', 'Base.ConeIcecreamMelted', 'Base.IcecreamMelted',
    'Base.ColdCuppa', 'Base.BakingTrayBread', 'Base.Cornmeal',
    'Base.ColdDrinkRed', 'Base.ColdDrinkSpiffo', 'Base.ColdDrinkWhite',
    'Base.WaterMug', 'Base.WaterBowl', 'Base.WaterPot', 'Base.WaterSaucepan',
    'Base.WaterTeacup', 'Base.WaterMugRed', 'Base.WaterMugSpiffo',
    'Base.WaterMugWhite', 'Base.WaterPopBottle', 'Base.WaterBleachBottle',
    'Base.WaterPaintbucket', 'Base.BucketWaterFull', 'Base.FullKettle',
    'Base.Mugfull', 'Base.PlasticCupWater', 'Base.GlassTumblerWater',
    'Base.GlassWineWater', 'Base.BeerWaterFull', 'Base.WhiskeyWaterFull',
    'Base.WineWaterFull', 'Base.BathTowelWet', 'Base.DishClothWet',
    'Base.PetrolBleachBottle', 'Base.PetrolPopBottle', 'Base.WhiskeyPetrol',
    'Base.WinePetrol', 'Base.WaterBottlePetrol',
    'farming.MayonnaiseWaterFull', 'farming.RemouladeWaterFull',
    'farming.WateredCanFull', 'farming.MayonnaiseHalf', 'farming.RemouladeHalf',
    'farming.MayonnaiseEmpty', 'farming.RemouladeEmpty',
    'farming.GardeningSprayFull', 'farming.GardeningSprayMilk',
    'farming.GardeningSprayCigarettes', 'farming.BaconBits', 'farming.BaconRashers',
];

// --- Derived items (box -> contents) ---
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

// --- Zombie outfit rarity tiers ---
const OUTFIT_RARITY = {
    'default': 'common',
    'constructionworker': 'uncommon',
    'securityguard': 'uncommon',
    'carpenter': 'uncommon',
    'burglar': 'uncommon',
    'generic': 'uncommon',
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

// --- Forage tier map ---
const FORAGE_TIER_MAP = {
    'normal': 'common',
    'common': 'common',
    'generic': 'common',
    'specific': 'common',
    'winter': 'uncommon',
    'poison': 'uncommon',
    'uncommon': 'uncommon',
    'unlikely': 'uncommon',
    'rare': 'rare',
    'epic': 'epic',
    'legendary': 'legendary',
};

module.exports = {
    PZ_PATH,
    PROJECT_ROOT,
    DISTRIBUTION_FILES,
    ITEMS_REGISTRY_FILE,
    ZOMBIE_WEAPON_DEFS,
    ZOMBIE_CLOTHING_DEFS,
    FORAGE_DEFS,
    VERSION_FLAG,
    DETECTED_VERSION,
    VERSION_LABEL,
    OUTPUT_FILE,
    LIST_SIZE_FULL_WEIGHT,
    LIST_VOLUME_FULL_WEIGHT,
    RARITY_THRESHOLDS,
    RARITY_ORDER,
    TIER_MIN_OCCURRENCES,
    TIER_DEMOTION,
    CATEGORY_MAX_RARITY,
    MANUAL_OVERRIDES,
    COOKED_AND_FILLED_ITEMS,
    DERIVED_ITEMS,
    OUTFIT_RARITY,
    FORAGE_TIER_MAP,
};
