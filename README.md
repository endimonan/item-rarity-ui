# Item Rarity UI

A Project Zomboid mod that displays item rarity in the inventory with colored names based on spawn chance.

## Features

- **Colored item names** based on rarity (RPG-style)
- **New "Rarity" column** in inventory that shows the rarity tier
- **Sortable** - click the Rarity column to sort items by rarity
- **Resizable column** - drag to resize like other columns
- **Multi-language support** - 22+ languages supported
- **Works with existing saves** - no need to start a new game

## Rarity Colors

| Rarity | Color | Description |
|--------|-------|-------------|
| Legendary | Orange | Top ~5% rarest items |
| Epic | Purple | Next ~10% |
| Rare | Blue | Next ~15% |
| Uncommon | Green | Next ~20% |
| Common | Gray/White | Remaining ~50% |

## How Rarity is Calculated

This mod uses the **Weighted Real Chance** method:
- For each loot list, calculate the sum of all item weights
- For each item: `realChance = itemWeight / sumOfListWeights`
- Sum all `realChance` values for each item across all loot lists

Items that appear in more loot lists with higher weights are more common.

## Installation

1. Download or clone this repository
2. Copy the `item-rarity-ui` folder to your `Zomboid/mods/` directory
3. Enable the mod in-game

## Updating Rarity Data

If the game updates and adds new items, you can regenerate the rarity data:

1. Copy the new `ProceduralDistributions.lua` from the game files to `test.lua`
2. Run `node calculate-rarity.js`
3. The new `ItemRarityData.lua` will be generated

## Files

```
item-rarity-ui/
├── calculate-rarity.js      # Node.js script to calculate rarities
├── test.lua                  # Copy of ProceduralDistributions.lua
├── mod.info                  # Mod metadata
├── media/
│   └── lua/
│       ├── client/
│       │   └── ItemRarityUI.lua    # Main mod code
│       └── shared/
│           └── ItemRarityData.lua  # Pre-calculated rarity data
```

## Configuration

You can customize the mod by editing `ItemRarityUI.lua`:

- `ItemRarityUI.colorItemNames` - Enable/disable colored names
- `ItemRarityUI.showRarityColumn` - Show/hide rarity column
- `ItemRarityUI.rarityOverrides` - Force specific items to a rarity
- `ItemRarityUI.rarityTiers` - Adjust rarity thresholds and colors

## Compatibility

- **Build 41** compatible
- Works with existing saves
- Should be compatible with most other mods

## License

MIT License - Feel free to use, modify, and distribute.
