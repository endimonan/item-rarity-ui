# Item Rarity UI

A Project Zomboid mod that displays item rarity in the inventory with colored names based on spawn chance.
Compatible with **Build 41** and **Build 42**.

## Features

- **Colored item names** based on rarity (RPG-style)
- **New "Rarity" column** in inventory that shows the rarity tier
- **Sortable** - click the Rarity column to sort items by rarity
- **Resizable column** - drag to resize like other columns
- **Responsive** - dynamic column width for different screen resolutions (Steam Deck compatible)
- **Crafted items** - items only obtainable via crafting get a special "Crafted" label
- **Multi-language support** - 20 languages supported
- **B41 + B42 dual data** - separate rarity lists for each game version
- **Works with existing saves** - no need to start a new game

## Rarity Tiers

| Rarity | Color | Threshold |
|--------|-------|-----------|
| Legendary | Orange/Gold | Total weighted chance < 0.01 (min 3 occurrences) |
| Epic | Purple | 0.01 - 0.04 (min 2 occurrences) |
| Rare | Blue | 0.04 - 0.12 |
| Uncommon | Green | 0.12 - 0.40 |
| Common | Gray/White | > 0.40 |
| Crafted | Cyan | Not found in loot tables, only craftable |

## How Rarity is Calculated

This mod uses the **Dual-Factor Weighted Real Chance** method:

1. Parse all loot tables from 3 game files: `ProceduralDistributions.lua`, `Distributions.lua`, `VehicleDistributions.lua`
2. For each loot list, calculate: `realChance = itemWeight / sumOfAllWeightsInList`
3. Weight each list's contribution by two factors:
   - **Size weight**: `min(items_in_list, 30) / 30` — larger lists = more important containers
   - **Volume weight**: `min(total_weight, 10) / 10` — higher total weight = more substantial loot source
   - **Combined**: `listWeight = sizeWeight × volumeWeight`
4. For each item: `weightedChance = realChance × listWeight`
5. Sum all `weightedChance` values across every list the item appears in

This dual-factor system ensures micro-lists (zombie outfit tables with 1-3 items and tiny total weights) contribute almost nothing, while real loot containers (lockers, shelves, gun stores) contribute fully. No data is discarded.

### Additional Adjustments

- **Confidence threshold**: Legendary needs 3+ list appearances, Epic needs 2+. Items below the minimum get demoted.
- **Category cap**: "Junk" items can't exceed Uncommon, "Hidden"/"ZedDmg" stay Common.
- **Derived items**: Contents inherit rarity from their container (e.g., Nails from NailsBox).
- **Crafted items**: Items not in any loot table but present in recipe files are marked as "Crafted".

---

## Project Structure

```
item-rarity-ui/
├── mod.info                                    # Mod metadata
├── poster.png                                  # Workshop poster
├── modicon.png                                 # Mod icon (B42)
├── README.md                                   # This file
├── all-items.json                              # Generated item registry (not shipped)
│
├── media/
│   └── lua/
│       ├── client/
│       │   └── ItemRarityUI.lua                # Main mod UI code (shared B41+B42)
│       └── shared/
│           └── ItemRarityData.lua              # B41 rarity data (auto-generated)
│
├── 42/
│   └── media/
│       └── lua/
│           └── shared/
│               └── ItemRarityData.lua          # B42 rarity data (auto-generated)
│
├── scripts/                                    # Build & data generation scripts (Node.js)
│   ├── mod-config.js                           # Shared config (mod ID, file lists, deploy logic)
│   ├── scan-items.js                           # Scans game files → all-items.json
│   ├── calculate-rarity.js                     # Calculates rarities → ItemRarityData.lua
│   ├── build.js                                # Builds mod + optional local deploy
│   ├── deploy-to-steam.js                      # Deploys to Steam Workshop folder
│   ├── verify-items.js                         # Verifies known items in generated data
│   ├── analyze-item.js                         # Debug: shows item across all loot tables
│   └── compare-versions.js                     # Compares B41 vs B42 rarity data
│
└── builds/                                     # Build output (git-ignored)
    └── item-rarity-ui/
```

---

## Scripts Reference

All scripts are in the `scripts/` folder and require **Node.js**. Run from the project root.

### `scan-items.js` — Scan Game Items

Parses all `media/scripts/*.txt` files from the Project Zomboid install and extracts every item definition with its DisplayCategory, Type, and craftability.

```bash
node scripts/scan-items.js
```

- **Input**: Game files at `C:\Program Files (x86)\Steam\steamapps\common\ProjectZomboid\media\scripts\`
- **Output**: `all-items.json` (complete item registry)
- **B41/B42**: Automatically detects. B41 reads `scripts/recipes.txt`, B42 reads `scripts/generated/recipes/*.txt`
- **When to run**: Before `calculate-rarity.js`. Run again if the game updates or you switch between B41/B42.

---

### `calculate-rarity.js` — Generate Rarity Data

The main script. Reads loot distribution files, calculates weighted chances, applies adjustments, and outputs `ItemRarityData.lua`.

```bash
# Generate for B41 (output: media/lua/shared/ItemRarityData.lua)
node scripts/calculate-rarity.js --b41

# Generate for B42 (output: 42/media/lua/shared/ItemRarityData.lua)
node scripts/calculate-rarity.js --b42

# Auto-detect (defaults to B41 output path)
node scripts/calculate-rarity.js
```

- **Input**: Game distribution files + `all-items.json`
- **Output**: `ItemRarityData.lua` (B41 at root, B42 at `42/`)
- **Prerequisite**: Run `scan-items.js` first
- **Important**: You must be on the correct game version in Steam. B41 files generate B41 data, B42 files generate B42 data.

---

### `build.js` — Build & Local Deploy

Copies all mod files into `builds/item-rarity-ui/`. Optionally deploys to the Zomboid mods folder for local testing.

```bash
# Build only (to builds/ folder)
node scripts/build.js

# Build + deploy to C:\Users\ems_f\Zomboid\mods\item-rarity-ui
node scripts/build.js --deploy
```

- The `--deploy` flag cleans the existing mod folder and copies files with the B41+B42 dual structure:
  - Root: `mod.info`, `poster.png`, `modicon.png`, `ItemRarityUI.lua`, B41 `ItemRarityData.lua`
  - `common/`: empty (required by B42)
  - `42/`: `mod.info`, `poster.png`, `modicon.png`, `ItemRarityUI.lua`, B42 `ItemRarityData.lua`

---

### `deploy-to-steam.js` — Steam Workshop Deploy

Creates the Steam Workshop upload structure at `C:\Users\ems_f\Zomboid\Workshop\`.

```bash
node scripts/deploy-to-steam.js
```

- Creates `Workshop/item-rarity-ui/preview.png` (from `poster.png`)
- Creates `Workshop/item-rarity-ui/Contents/mods/item-rarity-ui/` with full B41+B42 structure
- After running, use the game's Workshop upload tool or modTemplate to upload

**Workshop output structure:**
```
Workshop/item-rarity-ui/
├── preview.png
└── Contents/
    └── mods/
        └── item-rarity-ui/
            ├── mod.info, poster.png, modicon.png
            ├── media/lua/client/ItemRarityUI.lua
            ├── media/lua/shared/ItemRarityData.lua     ← B41
            ├── common/                                  ← B42 (empty)
            └── 42/
                ├── mod.info, poster.png, modicon.png
                ├── media/lua/client/ItemRarityUI.lua
                └── media/lua/shared/ItemRarityData.lua ← B42
```

---

### `mod-config.js` — Shared Configuration

Not meant to be run directly. Exports the mod ID, file lists, and the `deployDualStructure()` function used by `build.js` and `deploy-to-steam.js`.

---

### `verify-items.js` — Verify Rarity Data

Quick sanity check. Shows known items (Katana, Sledgehammer, Axe, etc.), percentile distribution, and tier counts.

```bash
# Verify B41 data (default)
node scripts/verify-items.js

# Verify B42 data
node scripts/verify-items.js --b42
```

---

### `analyze-item.js` — Debug Specific Item

Shows every loot table where a specific item appears, with its weight, list total, item count, and real chance.

```bash
# Analyze Katana across all distribution files
node scripts/analyze-item.js Katana

# Analyze any item
node scripts/analyze-item.js Sledgehammer
node scripts/analyze-item.js NailsBox
```

- Reads directly from the game files (must have PZ installed)
- Useful for debugging why an item has a specific rarity

---

### `compare-versions.js` — Compare B41 vs B42

Side-by-side comparison of both rarity data files. Shows total items, tier distribution, items unique to each version, and items that changed rarity.

```bash
node scripts/compare-versions.js
```

- **Requires**: Both `media/lua/shared/ItemRarityData.lua` (B41) and `42/media/lua/shared/ItemRarityData.lua` (B42) to exist

---

## Full Workflow: Regenerating Rarity Data

### For a single version (e.g., B42)

Make sure your game is on the correct version in Steam, then:

```bash
# 1. Scan all game items and recipes
node scripts/scan-items.js

# 2. Calculate rarities for B42
node scripts/calculate-rarity.js --b42

# 3. Verify the results
node scripts/verify-items.js --b42
```

### For both versions (B41 + B42)

You need to switch your game version in Steam between runs:

```bash
# --- While on B42 in Steam ---
node scripts/scan-items.js
node scripts/calculate-rarity.js --b42

# --- Switch to B41 in Steam (Properties > Betas) ---
node scripts/scan-items.js
node scripts/calculate-rarity.js --b41

# --- Compare ---
node scripts/compare-versions.js
```

### Build and deploy for testing

```bash
# Deploy to local Zomboid mods folder
node scripts/build.js --deploy
```

### Deploy to Steam Workshop

```bash
node scripts/deploy-to-steam.js
```

---

## Configuration

You can customize the mod by editing `media/lua/client/ItemRarityUI.lua`:

- `ItemRarityUI.colorItemNames` — Enable/disable colored names
- `ItemRarityUI.showRarityColumn` — Show/hide rarity column
- `ItemRarityUI.rarityOverrides` — Force specific items to a rarity
- `ItemRarityUI.rarityTiers` — Adjust rarity thresholds and colors

## Compatibility

- **Build 41** and **Build 42** compatible (dual folder structure)
- Works with existing saves
- Client-side only - works on servers without server-side installation
- Dynamic column width for different screen resolutions (Steam Deck)
- `pcall` wrappers for safe B42 API compatibility
- **CleanUI V2.3** - auto-disables rarity column, keeps colored names, adds "Rarity" sort option to CleanUI's sort menu

## License

MIT License - Feel free to use, modify, and distribute.
