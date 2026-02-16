/**
 * Shared mod configuration
 * 
 * Single source of truth for mod ID and file lists.
 * Used by build.js and deploy-to-steam.js
 * 
 * Project structure for version-specific data:
 *   project-root/
 *     media/lua/shared/ItemRarityData.lua               ← B41 rarity data
 *     media/lua/client/ItemRarityUI.lua                 ← shared UI code
 *     media/lua/shared/Translate/{LANG}/IG_UI_{LANG}.txt  ← B41 translation files
 *     42/media/lua/shared/ItemRarityData.lua            ← B42 rarity data
 *     42/media/lua/shared/Translate/{LANG}/IG_UI_{LANG}.txt ← B42 translations (all UTF-8)
 * 
 * Deploy structure:
 *   mod-folder/
 *     mod.info, poster.png, modicon.png     ← B41 root
 *     media/lua/client/ItemRarityUI.lua     ← B41 (shared code)
 *     media/lua/shared/ItemRarityData.lua   ← B41 data
 *     media/lua/shared/Translate/...        ← translation files (B41 encoding)
 *     common/                               ← B42 mandatory (empty)
 *     42/
 *       mod.info, poster.png, modicon.png
 *       media/lua/client/ItemRarityUI.lua   ← same UI code
 *       media/lua/shared/ItemRarityData.lua ← B42-specific data
 *       media/lua/shared/Translate/...      ← shared UTF-8 + B42 encoding overrides
 */

const MOD_ID = 'item-rarity-ui';

// Meta files (copied to both root and 42/)
const META_FILES = [
    'mod.info',
    'poster.png',
    'modicon.png',
];

// Shared code and asset files (same for B41 and B42)
const SHARED_CODE_FILES = [
    'media/lua/client/ItemRarityUI.lua',
    'media/ui/ItemRarityUI/Icon_Rarity.png',
];

// Version-specific data files
const B41_DATA_FILES = [
    'media/lua/shared/ItemRarityData.lua',       // B41 data lives at root
];

const B42_DATA_FILES = [
    '42/media/lua/shared/ItemRarityData.lua',     // B42 data lives at 42/
];

// All 20 supported languages
const ALL_LANGS = ['EN','PTBR','ES','FR','DE','IT','RU','PL','JP','KO','CN','CH','TH','TR','NL','CS','HU','AR','FI','UA'];

// Translation files - B41 root (UTF-8 for most, UTF-16LE for KO, Cp1251 for RU/UA)
const TRANSLATE_FILES_B41 = ALL_LANGS.map(lang => `media/lua/shared/Translate/${lang}/IG_UI_${lang}.txt`);

// Translation files - B42 (all UTF-8)
const TRANSLATE_FILES_B42 = ALL_LANGS.map(lang => `42/media/lua/shared/Translate/${lang}/IG_UI_${lang}.txt`);

// All B41 root files (meta + shared code + B41 data + all translations)
const B41_FILES = [...META_FILES, ...SHARED_CODE_FILES, ...B41_DATA_FILES, ...TRANSLATE_FILES_B41];

// All files that go into 42/ (meta + shared code + B42 data)
// Note: B42 data source is at 42/... in the project, but deploys to 42/... in the mod
const B42_CONTENT_FILES = [...SHARED_CODE_FILES, { src: '42/media/lua/shared/ItemRarityData.lua', dest: 'media/lua/shared/ItemRarityData.lua' }];

/**
 * Deploy mod files into a target directory with B41+B42 dual structure.
 * 
 * B41 reads from root. B42 reads from 42/ (which overrides root).
 * Each version gets its own ItemRarityData.lua with version-specific rarity data.
 */
function deployDualStructure(targetDir, rootDir, copyFileFn, mkdirFn, logFn) {
    const path = require('path');

    // B41: copy meta + shared code + B41 data to root
    logFn('  [B41] Root files:');
    for (const file of B41_FILES) {
        const src = path.join(rootDir, file);
        const dest = path.join(targetDir, file);
        copyFileFn(src, dest);
        logFn(`    ${file}`);
    }

    // B42: create common/ (mandatory, empty)
    const commonDir = path.join(targetDir, 'common');
    mkdirFn(commonDir);
    logFn('  [B42] common/ (empty)');

    // B42: copy meta files to 42/
    const b42Dir = path.join(targetDir, '42');
    logFn('  [B42] 42/ files:');
    for (const file of META_FILES) {
        const src = path.join(rootDir, file);
        const dest = path.join(b42Dir, file);
        copyFileFn(src, dest);
        logFn(`    42/${file}`);
    }

    // B42: copy shared code to 42/
    for (const file of SHARED_CODE_FILES) {
        const src = path.join(rootDir, file);
        const dest = path.join(b42Dir, file);
        copyFileFn(src, dest);
        logFn(`    42/${file}`);
    }

    // B42: copy B42-specific data (from 42/ in project to 42/ in deploy)
    const b42DataSrc = path.join(rootDir, '42', 'media', 'lua', 'shared', 'ItemRarityData.lua');
    const b42DataDest = path.join(b42Dir, 'media', 'lua', 'shared', 'ItemRarityData.lua');
    
    if (require('fs').existsSync(b42DataSrc)) {
        copyFileFn(b42DataSrc, b42DataDest);
        logFn(`    42/media/lua/shared/ItemRarityData.lua (B42 data)`);
    } else {
        // Fallback: copy B41 data if B42 data hasn't been generated yet
        const fallbackSrc = path.join(rootDir, 'media', 'lua', 'shared', 'ItemRarityData.lua');
        copyFileFn(fallbackSrc, b42DataDest);
        logFn(`    42/media/lua/shared/ItemRarityData.lua (fallback: B41 data)`);
    }

    // B42: copy all translation files (all UTF-8 in 42/)
    logFn('  [B42] 42/ translations:');
    for (const file of TRANSLATE_FILES_B42) {
        const src = path.join(rootDir, file);
        // Deploy destination: strip the leading "42/" since we're already inside b42Dir
        const relativePath = file.replace(/^42\//, '');
        const dest = path.join(b42Dir, relativePath);
        copyFileFn(src, dest);
        logFn(`    42/${relativePath}`);
    }
}

module.exports = { MOD_ID, META_FILES, SHARED_CODE_FILES, B41_FILES, B42_DATA_FILES, TRANSLATE_FILES_B42, deployDualStructure };
