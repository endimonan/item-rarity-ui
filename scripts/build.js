/**
 * Build script for Item Rarity UI
 * 
 * Copies mod files into builds/item-rarity-ui/ and optionally
 * deploys to the Steam Workshop folder for testing.
 * 
 * Usage: node build.js [--deploy]
 * 
 * --deploy   Also copy to Steam Workshop folder
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BUILD_DIR = path.join(ROOT, 'builds', 'item-rarity-ui');

// Steam Workshop mod install path
// Workshop folder uses lua/ directly (no media/ prefix)
const WORKSHOP_DIR = 'C:\\Program Files (x86)\\Steam\\steamapps\\workshop\\content\\108600\\3662387304\\mods\\item-rarity-ui';

// Files to include in the build (relative to project root)
// format: { src: relative path from ROOT, dest: relative path in build output }
const MOD_FILES = [
    { src: 'mod.info',                          build: 'mod.info',                          workshop: 'mod.info' },
    { src: 'poster.png',                        build: 'poster.png',                        workshop: 'poster.png' },
    { src: 'media/lua/client/ItemRarityUI.lua', build: 'media/lua/client/ItemRarityUI.lua', workshop: 'lua/client/ItemRarityUI.lua' },
    { src: 'media/lua/shared/ItemRarityData.lua', build: 'media/lua/shared/ItemRarityData.lua', workshop: 'lua/shared/ItemRarityData.lua' },
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

function formatSize(size) {
    if (size > 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
    if (size > 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${size} B`;
}

function main() {
    const deploy = process.argv.includes('--deploy');
    
    console.log('Building Item Rarity UI');
    console.log('=======================\n');

    // Clean previous build
    cleanDir(BUILD_DIR);
    console.log(`Cleaned: ${path.relative(ROOT, BUILD_DIR)}/`);

    // Copy mod files to build dir
    let totalSize = 0;

    for (const file of MOD_FILES) {
        const src = path.join(ROOT, file.src);
        const dest = path.join(BUILD_DIR, file.build);

        if (!fs.existsSync(src)) {
            console.error(`  MISSING: ${file.src}`);
            process.exit(1);
        }

        copyFile(src, dest);
        const size = fs.statSync(src).size;
        totalSize += size;

        console.log(`  ${file.src} (${formatSize(size)})`);
    }

    console.log(`\nBuild complete: ${MOD_FILES.length} files, ${formatSize(totalSize)}`);
    console.log(`Output: ${path.relative(ROOT, BUILD_DIR)}/`);
    
    // Deploy to Workshop if --deploy flag
    if (deploy) {
        console.log('\n--- Deploying to Workshop ---\n');
        
        if (!fs.existsSync(WORKSHOP_DIR)) {
            console.error(`Workshop folder not found: ${WORKSHOP_DIR}`);
            console.error('Is the mod subscribed on Steam Workshop?');
            process.exit(1);
        }
        
        for (const file of MOD_FILES) {
            const src = path.join(ROOT, file.src);
            const dest = path.join(WORKSHOP_DIR, file.workshop);
            
            copyFile(src, dest);
            console.log(`  ${file.workshop}`);
        }
        
        console.log(`\nDeployed to: ${WORKSHOP_DIR}`);
    } else {
        console.log('\nTip: use --deploy to also copy to Steam Workshop folder');
    }
}

main();
