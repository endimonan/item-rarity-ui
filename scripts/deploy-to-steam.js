/**
 * Deploy to Steam Workshop folder
 * 
 * Creates the Workshop upload structure at C:\Users\ems_f\Zomboid\Workshop
 * following the same layout as modTemplate:
 * 
 *   Workshop/
 *     item-rarity-ui/
 *       preview.png                  (poster.png renamed)
 *       Contents/
 *         mods/
 *           item-rarity-ui/
 *             mod.info
 *             poster.png
 *             media/lua/client/ItemRarityUI.lua
 *             media/lua/shared/ItemRarityData.lua
 * 
 * Usage: node deploy-to-steam.js
 */

const fs = require('fs');
const path = require('path');
const { MOD_ID, MOD_FILES } = require('./mod-config');

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
    console.log('Deploy to Steam Workshop');
    console.log('========================\n');

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

    // Copy all mod files to Contents/mods/item-rarity-ui/
    console.log(`\nContents/mods/${MOD_ID}/`);
    let totalSize = previewSize;

    for (const file of MOD_FILES) {
        const src = path.join(ROOT, file);
        const dest = path.join(CONTENTS_DIR, file);

        if (!fs.existsSync(src)) {
            console.error(`  MISSING: ${file}`);
            process.exit(1);
        }

        copyFile(src, dest);
        const size = fs.statSync(src).size;
        totalSize += size;

        console.log(`  ${file} (${formatSize(size)})`);
    }

    console.log(`\nDeploy complete: ${MOD_FILES.length + 1} files, ${formatSize(totalSize)}`);
    console.log(`Output: ${WORKSHOP_MOD_DIR}/`);
}

main();
