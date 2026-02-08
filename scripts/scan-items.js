/**
 * Item Scanner for Project Zomboid
 * 
 * Parses all media/scripts/*.txt files from the game install
 * and extracts every item definition with its DisplayCategory and Type.
 * 
 * Output: all-items.json - a complete registry of every item in the game.
 */

const fs = require('fs');
const path = require('path');

// Project Zomboid install path
const PZ_PATH = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\ProjectZomboid';
const SCRIPTS_PATH = path.join(PZ_PATH, 'media', 'scripts');
const OUTPUT_FILE = path.join(__dirname, 'all-items.json');

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
 * Main function
 */
function main() {
    console.log('Item Scanner for Project Zomboid');
    console.log('================================\n');
    
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
    
    // Build lookup map (fullName -> item data)
    const itemMap = {};
    for (const item of allItems) {
        itemMap[item.fullName] = {
            displayCategory: item.displayCategory,
            type: item.type,
            displayName: item.displayName,
            sourceFile: item.sourceFile
        };
    }
    
    // Write output
    const output = {
        generatedAt: new Date().toISOString(),
        totalItems: allItems.length,
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
    
    console.log(`\nOutput written to: ${OUTPUT_FILE}`);
}

// Run
main();
