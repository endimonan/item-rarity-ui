/**
 * Shared mod configuration
 * 
 * Single source of truth for mod ID and file list.
 * Used by build.js and deploy-to-steam.js
 */

const MOD_ID = 'item-rarity-ui';

// All files that make up the mod (relative to project root)
const MOD_FILES = [
    'mod.info',
    'poster.png',
    'media/lua/client/ItemRarityUI.lua',
    'media/lua/shared/ItemRarityData.lua',
];

module.exports = { MOD_ID, MOD_FILES };
