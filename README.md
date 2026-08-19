# Item Rarity UI

A Project Zomboid mod that colors item names and adds a Rarity column to the inventory, based on the actual spawn chances in the game's loot tables. Works on Build 41 and Build 42.

[Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3662387304) · [Ko-fi](https://ko-fi.com/endimonan)

## What it does

Every item gets a rarity tier based on how often it actually shows up across all loot sources. The lower the weighted spawn chance, the rarer the item.

| Tier | Color | Weighted chance |
|------|-------|-----------------|
| Legendary | orange | below 0.01, needs 3+ loot lists |
| Epic | purple | 0.01 to 0.04, needs 2+ loot lists |
| Rare | blue | 0.04 to 0.12 |
| Uncommon | green | 0.12 to 0.40 |
| Common | gray | 0.40 and up |
| Crafted | cyan | not in any loot table, only craftable |

Items the mod has no data for (mostly items from other mods) show as Unknown.

Item names get colored right in the inventory. The Rarity column is sortable, resizable, and safe to add to existing saves. Client side only, so it works on any server. Translated into 20 languages. If you run CleanUI, the mod disables its own column, keeps the colored names, and adds a Rarity option to CleanUI's sort menu.

## How rarity is calculated

The rarity data is generated offline by the scripts in `scripts/`. The mod itself only reads a Lua table, there is no runtime calculation.

For every loot list in `ProceduralDistributions.lua`, `Distributions.lua` and `VehicleDistributions.lua`:

1. An item's real chance in a list is its weight divided by the sum of all weights in that list.
2. Each list gets its own weight: `min(items, 30) / 30 * min(totalWeight, 10) / 10`. So tiny lists like zombie outfit tables barely count, while real containers (lockers, shelves, gun stores) count fully. No data is thrown away.
3. The item's final score is the sum of `realChance * listWeight` over every list it appears in.

A few adjustments on top: items without enough list appearances get demoted from Legendary and Epic, junk items are capped at Uncommon, contents inherit rarity from their container (Nails from NailsBox), and items that only exist in recipe files are marked Crafted.

## Repo layout

```
media/lua/client/ItemRarityUI.lua     UI code, shared by B41 and B42
media/lua/shared/ItemRarityData.lua   B41 rarity data (generated)
42/media/lua/shared/                  B42 rarity data (generated) and translations
scripts/                              Node.js scripts that generate the data
builds/                               build output, git ignored
```

## Regenerating the data

You need Node.js and Project Zomboid installed. The scripts read the game files straight from the Steam install, so the data you generate matches whatever version Steam has on disk. To generate for both builds you have to switch the game version in Steam (Properties > Betas) between runs.

```bash
node scripts/scan-items.js              # scan game items and recipes
node scripts/calculate-rarity.js --b42  # write rarity data (--b41 for Build 41)
node scripts/verify-items.js --b42      # sanity check known items
```

Other scripts:

```bash
node scripts/analyze-item.js Katana     # show one item across all loot tables
node scripts/compare-versions.js        # diff B41 vs B42 rarity data
node scripts/build.js --deploy          # build and copy to your Zomboid mods folder
node scripts/deploy-to-steam.js         # build the Workshop upload structure
```

The data scripts read the game files from the default Steam path, hardcoded at the top of `scripts/helpers/config.js` (and repeated in `scan-items.js` and `analyze-item.js`). The deploy scripts write to `%USERPROFILE%\Zomboid`. Edit those paths if your setup differs.

## Configuration

Some knobs at the top of `media/lua/client/ItemRarityUI.lua`:

- `ItemRarityUI.colorItemNames` turns colored names on or off
- `ItemRarityUI.showRarityColumn` shows or hides the column
- `ItemRarityUI.rarityOverrides` forces specific items to a rarity
- `ItemRarityUI.rarityTiers` adjusts tier colors and display names

The actual thresholds live in `scripts/helpers/config.js`. Changing them means regenerating the data.

## Contributing

PRs are welcome. Read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) first, especially if you code with an LLM. The short of it: understand your diff, and never open a PR without testing the mod in-game.

## License

Copyright (c) 2026 endimonan. All rights reserved.

The source is public to read, learn from and contribute to. It is not open source: no reuploads, no redistribution, no bundling into other mods or modpacks, no commercial use. See [LICENSE](LICENSE) for the exact terms. The only official download is the [Steam Workshop page](https://steamcommunity.com/sharedfiles/filedetails/?id=3662387304).
