/**
 * Build script for Item Rarity UI
 * 
 * Copies mod files into builds/item-rarity-ui/ and optionally
 * deploys to Zomboid/mods for local testing with B41+B42 dual structure.
 * 
 * Usage: node build.js [--deploy]
 * 
 * --deploy   Also copy to Zomboid/mods folder for testing
 */

const fs = require('fs');
const path = require('path');
const { MOD_ID, B41_FILES, B42_DATA_FILES, TRANSLATE_FILES_B42, deployDualStructure } = require('./mod-config');

const ROOT = path.join(__dirname, '..');
const BUILD_DIR = path.join(ROOT, 'builds', MOD_ID);

// Local Zomboid mods path for testing
const ZOMBOID_MODS_DIR = path.join('C:\\Users\\ems_f\\Zomboid\\mods', MOD_ID);

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
    const deploy = process.argv.includes('--deploy');
    
    console.log('Building Item Rarity UI');
    console.log('=======================\n');

    // Clean previous build
    cleanDir(BUILD_DIR);
    console.log(`Cleaned: ${path.relative(ROOT, BUILD_DIR)}/`);

    // Copy all files needed for distribution
    const ALL_BUILD_FILES = [...B41_FILES, ...B42_DATA_FILES, ...TRANSLATE_FILES_B42];
    let totalSize = 0;
    let fileCount = 0;

    for (const file of ALL_BUILD_FILES) {
        const src = path.join(ROOT, file);
        const dest = path.join(BUILD_DIR, file);

        if (!fs.existsSync(src)) {
            console.warn(`  SKIP (not generated yet): ${file}`);
            continue;
        }

        copyFile(src, dest);
        const size = fs.statSync(src).size;
        totalSize += size;
        fileCount++;

        console.log(`  ${file} (${formatSize(size)})`);
    }

    console.log(`\nBuild complete: ${fileCount} files, ${formatSize(totalSize)}`);
    console.log(`Output: ${path.relative(ROOT, BUILD_DIR)}/`);
    
    // Deploy to Zomboid mods folder if --deploy flag
    if (deploy) {
        console.log('\n--- Deploying to Zomboid mods (B41+B42) ---\n');
        
        // Clean existing mod folder first
        cleanDir(ZOMBOID_MODS_DIR);
        console.log(`Cleaned: ${ZOMBOID_MODS_DIR}\n`);
        
        deployDualStructure(ZOMBOID_MODS_DIR, ROOT, copyFile, mkdirSafe, console.log);
        
        console.log(`\nDeployed to: ${ZOMBOID_MODS_DIR}`);
    } else {
        console.log('\nTip: use --deploy to also copy to Zomboid mods folder');
    }
}

main();
