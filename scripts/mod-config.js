/**
 * Shared mod configuration
 * 
 * Single source of truth for mod ID and file list.
 * Used by build.js and deploy-to-steam.js
 */

const MOD_ID = 'item-rarity-ui';

// Meta files (mod.info and poster.png get special treatment in B42 structure)
const META_FILES = [
    'mod.info',
    'poster.png',
    'modicon.png',
];

// Content files (lua, scripts, etc.)
const CONTENT_FILES = [
    'media/lua/client/ItemRarityUI.lua',
    'media/lua/shared/ItemRarityData.lua',
];

// All mod files combined (for simple builds)
const MOD_FILES = [...META_FILES, ...CONTENT_FILES];

/**
 * Deploy mod files into a target directory with B41+B42 dual structure:
 * 
 *   target/
 *     mod.info              <-- B41 (root)
 *     poster.png            <-- B41 (root)
 *     modicon.png           <-- B41 (root)
 *     media/...             <-- B41 (root)
 *     common/               <-- B42 (mandatory, empty)
 *     42/                   <-- B42
 *       mod.info
 *       poster.png
 *       modicon.png
 *       media/...
 */
function deployDualStructure(targetDir, rootDir, copyFileFn, mkdirFn, logFn) {
    const path = require('path');

    // B41: copy all files to root
    logFn('  [B41] Root files:');
    for (const file of MOD_FILES) {
        const src = path.join(rootDir, file);
        const dest = path.join(targetDir, file);
        copyFileFn(src, dest);
        logFn(`    ${file}`);
    }

    // B42: create common/ (mandatory, empty)
    const commonDir = path.join(targetDir, 'common');
    mkdirFn(commonDir);
    logFn('  [B42] common/ (empty)');

    // B42: create 42/ with all files
    const b42Dir = path.join(targetDir, '42');
    logFn('  [B42] 42/ files:');
    for (const file of MOD_FILES) {
        const src = path.join(rootDir, file);
        const dest = path.join(b42Dir, file);
        copyFileFn(src, dest);
        logFn(`    42/${file}`);
    }
}

module.exports = { MOD_ID, MOD_FILES, META_FILES, CONTENT_FILES, deployDualStructure };
