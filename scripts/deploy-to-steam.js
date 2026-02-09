/**
 * Deploy to Steam Workshop folder
 * 
 * Creates the Workshop upload structure at C:\Users\ems_f\Zomboid\Workshop
 * with B41+B42 dual compatibility:
 * 
 *   Workshop/
 *     item-rarity-ui/
 *       preview.png
 *       Contents/
 *         mods/
 *           item-rarity-ui/
 *             mod.info                              <-- B41
 *             poster.png                            <-- B41
 *             media/lua/shared/ItemRarityData.lua   <-- B41 rarity data
 *             media/lua/client/ItemRarityUI.lua     <-- shared UI code
 *             common/                               <-- B42 (mandatory, empty)
 *             42/                                   <-- B42
 *               mod.info
 *               poster.png
 *               media/lua/shared/ItemRarityData.lua <-- B42 rarity data
 *               media/lua/client/ItemRarityUI.lua
 * 
 * Usage: node deploy-to-steam.js
 */

const fs = require('fs');
const path = require('path');
const { MOD_ID, deployDualStructure } = require('./mod-config');

const ROOT = path.join(__dirname, '..');
const WORKSHOP_BASE = 'C:\\Users\\ems_f\\Zomboid\\Workshop';
const WORKSHOP_MOD_DIR = path.join(WORKSHOP_BASE, MOD_ID);
const CONTENTS_DIR = path.join(WORKSHOP_MOD_DIR, 'Contents', 'mods', MOD_ID);

/**
 * Copy a file, creating parent directories as needed
 */
function copyFile(src, dest) {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
}

/**
 * Create a directory (recursive)
 */
function mkdirSafe(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

/**
 * Remove a directory recursively
 */
function cleanDir(dir) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

function formatSize(size) {
    if (size > 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
    if (size > 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${size} B`;
}

function main() {
    console.log('Deploy to Steam Workshop (B41+B42)');
    console.log('===================================\n');

    // Clean previous Workshop folder
    cleanDir(WORKSHOP_MOD_DIR);
    console.log(`Cleaned: ${WORKSHOP_MOD_DIR}/`);

    // Copy poster.png as preview.png to Workshop root
    const posterSrc = path.join(ROOT, 'poster.png');
    const previewDest = path.join(WORKSHOP_MOD_DIR, 'preview.png');

    if (!fs.existsSync(posterSrc)) {
        console.error('  MISSING: poster.png');
        process.exit(1);
    }

    copyFile(posterSrc, previewDest);
    const previewSize = fs.statSync(posterSrc).size;
    console.log(`  preview.png (${formatSize(previewSize)})`);

    // Deploy dual structure into Contents/mods/item-rarity-ui/
    console.log(`\nContents/mods/${MOD_ID}/\n`);
    
    deployDualStructure(CONTENTS_DIR, ROOT, copyFile, mkdirSafe, console.log);

    console.log(`\nDeploy complete!`);
    console.log(`Output: ${WORKSHOP_MOD_DIR}/`);
}

main();
