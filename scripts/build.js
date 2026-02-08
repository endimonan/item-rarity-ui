/**
 * Build script for Item Rarity UI
 * 
 * Copies only the mod files needed for Steam Workshop / testing
 * into builds/item-rarity-ui/
 * 
 * Usage: node build.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const BUILD_DIR = path.join(ROOT, 'builds', 'item-rarity-ui');

// Files to include in the build (relative to project root)
const MOD_FILES = [
    'mod.info',
    'poster.png',
    'media/lua/client/ItemRarityUI.lua',
    'media/lua/shared/ItemRarityData.lua',
];

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

function main() {
    console.log('Building Item Rarity UI');
    console.log('=======================\n');

    // Clean previous build
    cleanDir(BUILD_DIR);
    console.log(`Cleaned: ${path.relative(ROOT, BUILD_DIR)}/`);

    // Copy mod files
    let totalSize = 0;

    for (const file of MOD_FILES) {
        const src = path.join(ROOT, file);
        const dest = path.join(BUILD_DIR, file);

        if (!fs.existsSync(src)) {
            console.error(`  MISSING: ${file}`);
            process.exit(1);
        }

        copyFile(src, dest);
        const size = fs.statSync(src).size;
        totalSize += size;

        const sizeStr = size > 1024
            ? `${(size / 1024).toFixed(1)} KB`
            : `${size} B`;

        console.log(`  ${file} (${sizeStr})`);
    }

    const totalStr = totalSize > 1024 * 1024
        ? `${(totalSize / (1024 * 1024)).toFixed(2)} MB`
        : `${(totalSize / 1024).toFixed(1)} KB`;

    console.log(`\nBuild complete: ${MOD_FILES.length} files, ${totalStr}`);
    console.log(`Output: ${path.relative(ROOT, BUILD_DIR)}/`);
}

main();
