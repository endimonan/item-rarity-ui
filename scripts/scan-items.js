/**
 * Item Scanner for Project Zomboid
 * 
 * Parses all media/scripts/*.txt files from the game install
 * and extracts every item definition with its DisplayCategory and Type.
 * 
 * Auto-detects game version and outputs:
 *   B41 -> all-items-b41.json
 *   B42 -> all-items-b42.json
 * 
 * Usage:
 *   node scan-items.js          Auto-detect version
 *   node scan-items.js --b41    Force B41
 *   node scan-items.js --b42    Force B42
 */

const fs = require('fs');
const path = require('path');

// Project Zomboid install path
const PZ_PATH = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\ProjectZomboid';
const SCRIPTS_PATH = path.join(PZ_PATH, 'media', 'scripts');
const PROJECT_ROOT = path.join(__dirname, '..');

// Version detection (same logic as calculate-rarity)
const VERSION_FLAG = process.argv.find(a => a === '--b41' || a === '--b42');

function detectGameVersion() {
    if (VERSION_FLAG === '--b41') return 'B41';
    if (VERSION_FLAG === '--b42') return 'B42';
    const b42Indicator = path.join(PZ_PATH, 'media', 'scripts', 'generated', 'recipes');
    return fs.existsSync(b42Indicator) ? 'B42' : 'B41';
}

const DETECTED_VERSION = detectGameVersion();
const OUTPUT_FILE = path.join(PROJECT_ROOT, `all-items-${DETECTED_VERSION.toLowerCase()}.json`);

/**
 * Find all recipe files dynamically (B41 + B42 compatible)
 * B41: scripts/recipes.txt, recipes_radio.txt, evolvedrecipes.txt
 * B42: scripts/generated/recipes/*.txt, scripts/generated/evolvedrecipes.txt
 */
function findRecipeFiles() {
    const candidates = [];

    // B42: generated/recipes/ folder
    const generatedRecipesDir = path.join(SCRIPTS_PATH, 'generated', 'recipes');
    if (fs.existsSync(generatedRecipesDir)) {
        const files = fs.readdirSync(generatedRecipesDir)
            .filter(f => f.endsWith('.txt'))
            .map(f => path.join(generatedRecipesDir, f));
        candidates.push(...files);
    }

    // B42: generated/evolvedrecipes.txt
    const evolvedB42 = path.join(SCRIPTS_PATH, 'generated', 'evolvedrecipes.txt');
    if (fs.existsSync(evolvedB42)) {
        candidates.push(evolvedB42);
    }

    // B41 fallback: scripts root
    const b41Files = ['recipes.txt', 'recipes_radio.txt', 'evolvedrecipes.txt'];
    for (const f of b41Files) {
        const fp = path.join(SCRIPTS_PATH, f);
        // Only add if not already covered by B42 paths
        if (fs.existsSync(fp) && !candidates.includes(fp)) {
            candidates.push(fp);
        }
    }

    return candidates;
}

/**
 * Recursively find all .txt files in a directory
 */
function findTxtFiles(dir) {
    const files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...findTxtFiles(fullPath));
        } else if (entry.name.endsWith('.txt')) {
            files.push(fullPath);
        }
    }
    
    return files;
}

/**
 * Parse a single script file and extract item definitions
 */
function parseScriptFile(filePath) {
    const items = [];
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Find the module name: "module ModuleName {"
    const moduleMatch = content.match(/module\s+(\w+)/);
    const moduleName = moduleMatch ? moduleMatch[1] : 'Base';
    
    // Match each item block: "item ItemName { ... }"
    // We need to handle nested braces and varied indentation
    const itemRegex = /\bitem\s+(\w+)\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
    
    let match;
    while ((match = itemRegex.exec(content)) !== null) {
        const itemName = match[1];
        const itemBody = match[2];
        
        // Extract DisplayCategory
        const categoryMatch = itemBody.match(/DisplayCategory\s*=\s*(\w+)/);
        const displayCategory = categoryMatch ? categoryMatch[1] : null;
        
        // Extract Type
        const typeMatch = itemBody.match(/\bType\s*=\s*(\w+)/);
        const type = typeMatch ? typeMatch[1] : null;
        
        // Extract DisplayName
        const nameMatch = itemBody.match(/DisplayName\s*=\s*(.+?)[\s,]*$/m);
        const displayName = nameMatch ? nameMatch[1].trim().replace(/,\s*$/, '') : itemName;
        
        items.push({
            fullName: `${moduleName}.${itemName}`,
            module: moduleName,
            name: itemName,
            displayCategory: displayCategory,
            type: type,
            displayName: displayName,
            sourceFile: path.relative(SCRIPTS_PATH, filePath)
        });
    }
    
    return items;
}

/**
 * Parse recipe files and extract all craftable item results
 * Supports both B41 and B42 recipe formats:
 *   B41: "recipe Name { Result:ItemName, ... }"
 *   B42: "craftRecipe Name { outputs { item N Module.ItemName, } }"
 */
function parseRecipeFiles() {
    const craftableItems = new Set();
    
    const recipeFiles = findRecipeFiles();
    console.log(`  Found ${recipeFiles.length} recipe files`);
    
    for (const filePath of recipeFiles) {
        if (!fs.existsSync(filePath)) continue;
        
        const content = fs.readFileSync(filePath, 'utf8');
        const fileName = path.basename(filePath);
        const before = craftableItems.size;
        
        // B42 format: "outputs { item N Base.ItemName, }" or "item N Base.ItemName flags[...],"
        const b42OutputRegex = /\boutputs\s*\{([^}]*)\}/g;
        let outputMatch;
        while ((outputMatch = b42OutputRegex.exec(content)) !== null) {
            const outputBlock = outputMatch[1];
            // Match: item <count> <Module.ItemName> or item <count> [Module.ItemName;...]
            const itemLineRegex = /item\s+\d+\s+(\w+\.\w+)/g;
            let itemMatch;
            while ((itemMatch = itemLineRegex.exec(outputBlock)) !== null) {
                craftableItems.add(itemMatch[1]);
            }
        }
        
        // B41 format: Result:ItemName or Result:ItemName=count
        const resultRegex = /Result\s*:\s*(\w[\w.]*)/g;
        let match;
        while ((match = resultRegex.exec(content)) !== null) {
            let itemName = match[1];
            if (!itemName.includes('.')) {
                itemName = 'Base.' + itemName;
            }
            craftableItems.add(itemName);
        }
        
        // B41 evolved recipes: ResultItem:ItemName
        const evolvedRegex = /ResultItem\s*:\s*(\w[\w.]*)/g;
        while ((match = evolvedRegex.exec(content)) !== null) {
            let itemName = match[1];
            if (!itemName.includes('.')) {
                itemName = 'Base.' + itemName;
            }
            craftableItems.add(itemName);
        }
        
        const added = craftableItems.size - before;
        if (added > 0) {
            console.log(`  ${fileName}: +${added} (total: ${craftableItems.size})`);
        }
    }
    
    return craftableItems;
}

/**
 * Main function
 */
function main() {
    const detectedInfo = VERSION_FLAG ? '(manual)' : '(auto-detected)';
    console.log('Item Scanner for Project Zomboid');
    console.log('================================');
    console.log(`Version: ${DETECTED_VERSION} ${detectedInfo} | Output: ${path.basename(OUTPUT_FILE)}\n`);
    
    // Check if PZ path exists
    if (!fs.existsSync(SCRIPTS_PATH)) {
        console.error(`ERROR: Project Zomboid scripts not found at: ${SCRIPTS_PATH}`);
        console.error('Update the PZ_PATH variable to your game install location.');
        process.exit(1);
    }
    
    // Find all script files
    const files = findTxtFiles(SCRIPTS_PATH);
    console.log(`Found ${files.length} script files in ${SCRIPTS_PATH}\n`);
    
    // Parse all files
    const allItems = [];
    const categoryStats = {};
    
    for (const file of files) {
        const items = parseScriptFile(file);
        if (items.length > 0) {
            const relPath = path.relative(SCRIPTS_PATH, file);
            console.log(`  ${relPath}: ${items.length} items`);
            allItems.push(...items);
        }
    }
    
    // Build category stats
    for (const item of allItems) {
        const cat = item.displayCategory || '(none)';
        categoryStats[cat] = (categoryStats[cat] || 0) + 1;
    }
    
    // Parse recipe files for craftable items
    console.log('\nParsing recipe files...');
    const craftableItems = parseRecipeFiles();
    
    // Build lookup map (fullName -> item data)
    const itemMap = {};
    for (const item of allItems) {
        itemMap[item.fullName] = {
            displayCategory: item.displayCategory,
            type: item.type,
            displayName: item.displayName,
            sourceFile: item.sourceFile,
            craftable: craftableItems.has(item.fullName)
        };
    }
    
    // Count craftable
    const craftableCount = Object.values(itemMap).filter(i => i.craftable).length;
    
    // Write output
    const output = {
        generatedAt: new Date().toISOString(),
        totalItems: allItems.length,
        craftableItems: craftableCount,
        categories: categoryStats,
        items: itemMap
    };
    
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf8');
    
    // Print stats
    console.log(`\n=== ITEM SCANNER RESULTS ===\n`);
    console.log(`Total items found: ${allItems.length}`);
    console.log('');
    console.log('Categories:');
    
    const sortedCategories = Object.entries(categoryStats)
        .sort((a, b) => b[1] - a[1]);
    
    for (const [cat, count] of sortedCategories) {
        console.log(`  ${cat}: ${count}`);
    }
    
    console.log(`\nCraftable items: ${craftableCount}`);
    console.log(`\nOutput written to: ${OUTPUT_FILE}`);
}

// Run
main();
