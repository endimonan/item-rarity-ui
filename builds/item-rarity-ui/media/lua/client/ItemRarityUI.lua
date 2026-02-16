--***********************************************************
--**                    ITEM RARITY UI                      **
--**           Colored item names by rarity                 **
--**       Compatible with Build 41 and Build 42            **
--**                                                        **
--**  Using Weighted Real Chance calculation method:        **
--**  For each item, sum(weight/listTotal) across all lists **
--***********************************************************

require "ISUI/ISInventoryPane"

ItemRarityUI = ItemRarityUI or {}

-- Detect game version
ItemRarityUI.gameVersion = getCore and getCore():getVersionNumber() or "unknown"
ItemRarityUI.isB42 = false
if type(ItemRarityUI.gameVersion) == "string" then
    local major = tonumber(ItemRarityUI.gameVersion:match("^(%d+)"))
    if major and major >= 42 then
        ItemRarityUI.isB42 = true
    end
end

-- Configuration
ItemRarityUI.colorItemNames = true
ItemRarityUI.showRarityColumn = true
ItemRarityUI.dataLoaded = false

-- Rarity overrides for special items
-- These items will be forced to a specific rarity regardless of calculated value
-- Organized by category for maintainability
ItemRarityUI.rarityOverrides = {

    ----------------------------------------------------------------
    -- COMMON: Player starting items (every character has these)
    ----------------------------------------------------------------
    ["Base.KeyRing"] = "common",
    ["Base.Key1"] = "common",
    ["Base.Key2"] = "common",
    ["Base.Key3"] = "common",
    ["Base.Key4"] = "common",
    ["Base.Key5"] = "common",

    ----------------------------------------------------------------
    -- LEGENDARY: Most valuable/iconic items promoted from rare/epic
    ----------------------------------------------------------------
    ["Base.Generator"] = "legendary",         -- most valuable item in PZ, enables electricity
    ["Base.Chainsaw"] = "legendary",          -- extremely powerful tool, iconic
    ["Base.AssaultRifle"] = "legendary",      -- M16, rarest and most powerful vanilla firearm
    ["Base.Hat_NBCmask"] = "legendary",       -- NBC gas mask, extremely rare and valuable
    ["Base.HazmatSuit"] = "legendary",        -- only full contamination protection, critical in B42

    -- Hard-to-find iconic items promoted by gameplay feel
    ["Base.Hat_Spiffo"] = "legendary",          -- zombie-only near Spiffo restaurants, B41: legendary (0.46%)
    ["Base.SpiffoSuit"] = "legendary",          -- zombie-only, part of iconic Spiffo set
    ["Base.ScratchTicket_Winner"] = "legendary", -- ~1/8.8M multi-roll probability, rarest achievable item

    ----------------------------------------------------------------
    -- EPIC: Military/tactical gear and unique items promoted from rare
    ----------------------------------------------------------------
    ["Base.Ghillie_Top"] = "epic",            -- ghillie suit top, military camo
    ["Base.Ghillie_Trousers"] = "epic",       -- ghillie suit bottom
    ["Base.Jacket_Padded"] = "epic",          -- padded jacket, extremely rare
    ["Base.Vest_BulletPolice"] = "epic",      -- police bulletproof vest
    ["Base.Bag_ALICEpack"] = "epic",          -- military ALICE backpack
    ["Base.Bayonnet"] = "epic",               -- military bayonet
    ["Base.WeddingDress"] = "epic",           -- unique outfit, collector item
    ["Base.Mov_Projector"] = "epic",          -- very rare item

    -- Weapon cases: epic fits better than legendary
    ["Base.PistolCase2"] = "epic",
    ["Base.PistolCase3"] = "epic",
    ["Base.RevolverCase1"] = "epic",
    ["Base.RevolverCase2"] = "epic",
    ["Base.RevolverCase3"] = "epic",

    -- Level 5 skill books that math placed in rare (all other lv5 books are epic)
    ["Base.BookMechanic5"] = "epic",          -- master mechanics book
    ["Base.BookFarming5"] = "epic",           -- master farming book

    -- Themed leather jackets: chance 0.004, excluded by occurrence filter
    ["Base.Jacket_LeatherBarrelDogs"] = "epic",
    ["Base.Jacket_LeatherIronRodent"] = "epic",
    ["Base.Jacket_LeatherWildRacoons"] = "epic",

    -- High-value rare items promoted by gameplay perception
    ["Base.MortarPestle"] = "epic",           -- essential herbalism tool, chance 0.002
    ["Base.x8Scope"] = "epic",               -- best weapon scope in the game
    ["Base.CarBatteryCharger"] = "epic",      -- essential late-game vehicle tool
    ["Base.223Bullets"] = "epic",             -- rare rifle ammo (matches legendary AssaultRifle)
    ["Base.308Bullets"] = "epic",             -- rare rifle ammo
    ["Base.Hat_HockeyMask"] = "epic",         -- iconic collectible (Jason mask)

    -- Mold fix: Steel rarer than Iron in loot tables; B42 data had tiers flipped (occurrence filter)
    ["Base.SteelBarMold"] = "epic",           -- 0.4% chance, rarer than Iron
    ["Base.SteelIngotMold"] = "epic",
    ["Base.IronBarMold"] = "rare",            -- 1.2% chance, more common than Steel
    ["Base.IronIngotMold"] = "rare",

    -- B41 ice pick: decent melee tool but not legendary
    ["Base.IcePick"] = "epic",

    -- B42 hollow books with stashes: useful but not legendary-tier
    ["Base.HollowBook_Handgun"] = "epic",     -- hidden handgun stash
    ["Base.HollowBook_Whiskey"] = "epic",     -- hidden whiskey stash
    ["Base.HollowBook_Valuables"] = "epic",   -- hidden valuables stash

    -- B42 animal hides: valuable crafting material but not legendary
    ["Base.CowHide"] = "epic",
    ["Base.DappleDeerHide"] = "epic",
    ["Base.DeerHide"] = "epic",

    -- B42 forged tools: good tools but craftable, not legendary
    ["Base.ScytheForged"] = "epic",
    ["Base.PickAxeForged"] = "epic",
    ["Base.GardenFork_Forged"] = "epic",

    -- B42 improvised nail weapons: effective but crude, not legendary
    ["Base.BaseballBat_Broken_Nails"] = "epic",
    ["Base.Handle_Nails"] = "epic",
    ["Base.LongHandle_Broken_Nails"] = "epic",
    ["Base.BowlingPin_Nails"] = "epic",

    -- B42 misc items: useful but not legendary-tier
    ["Base.RailroadSpikeKnife"] = "epic",     -- crafted knife
    ["Base.ManPackRadio"] = "epic",           -- military radio, useful tool
    ["Base.Glasses_Prescription_Shooting"] = "epic", -- tactical shooting glasses
    ["Base.Shirt_HawaiianRed"] = "epic",      -- iconic shirt, collectible

    -- Hard-to-find items promoted by gameplay feel (zombie/foraging/event-only)
    ["Base.Hat_BaseballCap_JaysChicken"] = "epic",         -- chance=0, foraging-only in trailer parks
    ["Base.Hat_BaseballCap_JaysChicken_Reverse"] = "epic", -- chance=0, foraging-only variant
    ["Base.Hat_GoldStar"] = "epic",             -- chance=0, foraging-only boppers
    ["Base.WeddingJacket"] = "epic",            -- rare (8.3%, 5 occ), church events only, part of wedding set
    ["Base.Hat_BunnyEarsBlack"] = "epic",       -- rare (5.6%, 4 occ), strip club / lingerie only
    ["Base.Hat_BunnyEarsWhite"] = "epic",       -- rare (5.6%, 4 occ), strip club / lingerie only
    ["Base.HomeAlarm"] = "epic",                -- rare (8.1%, 4 occ), extremely specific spawn locations

    -- Uncommon items promoted by gameplay feel / B41 consistency
    ["Base.Generator_Blue"] = "epic",           -- colored generator, 1 occ (1.9%), base Generator is legendary
    ["Base.Generator_Yellow"] = "epic",         -- colored generator, 1 occ (1.9%), base Generator is legendary
    ["Base.Bag_ALICEpack_DesertCamo"] = "epic", -- desert camo ALICE, 1 occ (1.2%), regular ALICE already epic
    ["Base.Bag_ALICEpack_Army"] = "epic",       -- B42: rare (4.7%, 10 occ), military ALICE variant
    ["Base.Bag_ALICE_BeltSus"] = "epic",        -- B42: rare (0.7%, 1 occ), ALICE belt/suspenders
    ["Base.Bag_ALICE_BeltSus_Camo"] = "epic",   -- B42: rare (4.2%, 15 occ), camo ALICE belt
    ["Base.Bag_ALICE_BeltSus_Green"] = "epic",  -- B42: rare (4.2%, 15 occ), green ALICE belt
    ["Base.Hat_SPHhelmet"] = "epic",            -- military pilot helmet, B42: epic (2.2%), B41: uncommon (1.6%, 1 occ)
    ["Base.Mov_ConcreteMixer"] = "epic",        -- concrete mixer, B42: epic (1.6%), B41: uncommon (1.4%, 1 occ)

    ----------------------------------------------------------------
    -- RARE: Demoted from epic (clothing that math put in epic)
    ----------------------------------------------------------------

    -- Bunny set: strip club only, 1 occurrence each
    ["Base.BunnySuitBlack"] = "rare",           -- uncommon (2.8%, 1 occ), strip club only
    ["Base.BunnySuitPink"] = "rare",            -- uncommon (2.8%, 1 occ), strip club only
    ["Base.BunnyTail"] = "rare",                -- uncommon (3.6%, 1 occ), strip club only

    -- Umbrellas: not epic-worthy
    ["Base.ClosedUmbrellaBlack"] = "rare",
    ["Base.ClosedUmbrellaBlue"] = "rare",
    ["Base.ClosedUmbrellaRed"] = "rare",
    ["Base.ClosedUmbrellaWhite"] = "rare",

    -- Neckties
    ["Base.Tie_BowTieFull"] = "rare",
    ["Base.Tie_BowTieWorn"] = "rare",
    ["Base.Tie_Full"] = "rare",
    ["Base.Tie_Worn"] = "rare",

    -- Bowling shirts
    ["Base.Shirt_Bowling_Blue"] = "rare",
    ["Base.Shirt_Bowling_Brown"] = "rare",
    ["Base.Shirt_Bowling_Green"] = "rare",
    ["Base.Shirt_Bowling_LimeGreen"] = "rare",
    ["Base.Shirt_Bowling_Pink"] = "rare",
    ["Base.Shirt_Bowling_White"] = "rare",

    -- Misc clothing demoted from epic
    ["Base.Corset_Medical"] = "rare",
    ["Base.Dress_long_Straps"] = "rare",
    ["Base.Shorts_ShortDenim"] = "rare",

    -- Underwear should not be epic
    ["Base.Boxers_Silk_Black"] = "rare",
    ["Base.Boxers_Silk_Red"] = "rare",
    ["Base.Briefs_SmallTrunks_Black"] = "rare",
    ["Base.Briefs_SmallTrunks_Blue"] = "rare",
    ["Base.Briefs_SmallTrunks_Red"] = "rare",
    ["Base.Briefs_SmallTrunks_WhiteTINT"] = "rare",

    -- Misc items demoted from epic
    ["Base.Lollipop"] = "rare",
    ["Base.PetrolCan"] = "rare",
    ["Base.BoxOfJars"] = "rare",
    ["Base.Hat_EarMuffs"] = "rare",
    ["Base.ModernCarMuffler3"] = "rare",
    ["Base.Mov_SatelliteDish"] = "rare",
    ["Base.Mov_DegreeDoctor"] = "rare",
    ["Base.Mov_DegreeSurgeon"] = "rare",
    ["Base.LetterOpener"] = "rare",
    ["Radio.CDPlayer"] = "rare",
    ["Base.BookTailoring4"] = "rare",         -- level 4 book: rare (level 5 stays epic)

    -- Colored light bulbs: decorative/utility, not legendary
    ["Base.LightBulbPink"] = "rare",
    ["Base.LightBulbPurple"] = "rare",
    ["Base.LightBulbOrange"] = "rare",
    ["Base.LightBulbBlue"] = "rare",
    ["Base.LightBulbMagenta"] = "rare",
    ["Base.LightBulbCyan"] = "rare",
    ["Base.LightBulbYellow"] = "rare",

    -- Clothing: low spawn but not legendary-worthy
    ["Base.Skirt_Short"] = "rare",
    ["Base.LongCoat_Bathrobe"] = "rare",
    ["Base.Hat_HardHat_Miner"] = "rare",

    -- Food/containers: not legendary
    ["Base.PizzaWhole"] = "rare",
    ["Base.Lunchbox2"] = "rare",

    -- GunLight: chance 0, occurrences 0
    ["Base.GunLight"] = "rare",

    -- B42 canned food boxes: bulk food containers, not legendary
    ["Base.CannedMilk_Box"] = "rare",
    ["Base.CannedBolognese_Box"] = "rare",
    ["Base.CannedChili_Box"] = "rare",
    ["Base.CannedCornedBeef_Box"] = "rare",
    ["Base.CannedMushroomSoup_Box"] = "rare",
    ["Base.CannedSardines_Box"] = "rare",
    ["Base.TinnedBeans_Box"] = "rare",
    ["Base.TinnedSoup_Box"] = "rare",
    ["Base.CannedCarrots_Box"] = "rare",
    ["Base.CannedCorn_Box"] = "rare",
    ["Base.CannedPeaches_Box"] = "rare",
    ["Base.CannedPeas_Box"] = "rare",
    ["Base.CannedPineapple_Box"] = "rare",
    ["Base.CannedPotato_Box"] = "rare",
    ["Base.CannedTomato_Box"] = "rare",
    ["Base.CannedFruitBeverage_Box"] = "rare",
    ["Base.CannedFruitCocktail_Box"] = "rare",

    -- B42 decorative/moveable items: no gameplay value
    ["Base.Mov_RedRotaryPhone"] = "rare",
    ["Base.Mov_WhiteRotaryPhone"] = "rare",
    ["Base.Mov_BeigeRotaryPhone"] = "rare",
    ["Base.Mov_BlackRotaryPhone"] = "rare",
    ["Base.OujaBoard"] = "rare",
    ["Base.Humidor"] = "rare",
    ["Base.Pillow_Heart"] = "rare",
    ["Base.PhotoAlbum_Old"] = "rare",
    -- Character pictures: rare override for B41 compat (B41 has chance=0, common)
    ["Base.BobPic"] = "rare",
    ["Base.CaseyPic"] = "rare",
    ["Base.ChrisPic"] = "rare",
    ["Base.HankPic"] = "rare",
    ["Base.JamesPic"] = "rare",
    ["Base.KatePic"] = "rare",
    ["Base.MariannePic"] = "rare",
    ["Base.CortmanPic"] = "rare",
    ["Base.CookieJar_Bear"] = "rare",
    ["Base.HalloweenCandyBucket"] = "rare",
    ["Base.AdhesiveTapeBox"] = "rare",
    ["Base.JewelleryBox_Fancy"] = "rare",

    -- B42 cosmetic glasses: no protection value
    ["Base.Glasses_Cosmetic_70s_Gold"] = "rare",
    ["Base.Glasses_Cosmetic_CatsEye"] = "rare",
    ["Base.Glasses_Cosmetic_HalfMoon"] = "rare",
    ["Base.Glasses_Cosmetic_MonocleLeft"] = "rare",
    ["Base.Glasses_Cosmetic_Normal_HornRimmed"] = "rare",
    ["Base.Glasses_Cosmetic_Round_Normal"] = "rare",

    -- B42 gold cutlery: decorative, no combat value
    ["Base.ButterKnife_Gold"] = "rare",
    ["Base.Fork_Gold"] = "rare",
    ["Base.Spoon_Gold"] = "rare",

    -- B42 keyrings: cosmetic accessories
    ["Base.KeyRing_WestMaple"] = "rare",
    ["Base.KeyRing_Clover"] = "rare",

    -- B42 clothing: low spawn but no protection/utility value
    ["Base.Shirt_Jockey04"] = "rare",
    ["Base.Shirt_Priest"] = "rare",
    ["Base.Shirt_Sheriff"] = "rare",
    ["Base.Trousers_Sheriff"] = "rare",
    ["Base.Tshirt_Profession_RangerGreen"] = "rare",
    ["Base.Tshirt_Sheriff"] = "rare",
    ["Base.Vest_Trucker"] = "rare",
    ["Base.Hat_PeakedCapYacht"] = "rare",
    ["Base.Hat_Pilgrim"] = "rare",
    ["Base.Hat_Stovepipe"] = "rare",
    ["Base.Hat_Stovepipe_UncleSam"] = "rare",
    ["Base.Hat_FishermanRainHat"] = "rare",
    ["Base.Hat_RidingHelmet"] = "rare",
    ["Base.Hat_CrashHelmet_Stars"] = "rare",
    -- Hat_HalloweenMaskPumpkin: REMOVED override, B42 data correctly classifies as legendary (0.62%)
    ["Base.Bag_Schoolbag_Patches"] = "rare",

    -- B42 hollow books (containers): useful stash, but not legendary
    ["Base.HollowBook"] = "rare",
    ["Base.HollowBook_Kids"] = "rare",

    -- B42 scarves/winter accessories: no real protection
    ["Base.Scarf_StripeBlueWhite"] = "rare",
    ["Base.Scarf_StripeRedWhite"] = "rare",
    ["Base.Scarf_White"] = "rare",
    ["Base.Hat_WinterHat"] = "rare",

    -- B42 hats: cosmetic/seasonal
    ["Base.Hat_SummerFlowerHat"] = "rare",
    ["Base.Hat_WeddingVeil"] = "epic",            -- B42: epic (3.7%), event item, part of wedding set
    ["Base.Hat_Antlers"] = "epic",                -- B42: epic (3.2%), rare seasonal headwear
    ["Base.Hat_FastFood"] = "rare",
    ["Base.Hat_SantaHat"] = "epic",               -- B42: epic (3.2%), seasonal, sought-after
    ["Base.Hat_SantaHatGreen"] = "epic",           -- B42: epic (3.2%), seasonal, sought-after
    ["Base.Hat_Raccoon"] = "epic",                -- B42: epic (3.2%), iconic coonskin cap
    ["Base.Hat_BicycleHelmet"] = "rare",

    -- B42 eyewear: cosmetic
    ["Base.Glasses_JackieO"] = "rare",
    ["Base.Glasses_Eyepatch_Left"] = "rare",

    -- B42 clothing: no utility
    ["Base.Shorts_FootballPants"] = "rare",

    -- B42 underwear: (already listed above in "Underwear should not be epic" section)

    -- B42 decorative/moveable: no gameplay value
    ["Base.Mov_PalletEmpty"] = "rare",
    ["Base.Mov_Espresso"] = "rare",
    ["Base.Mov_SignOutOfGas_Fossoil"] = "rare",
    ["Base.Mov_PaintingElisa"] = "rare",
    ["Base.Mov_PosterDroids"] = "rare",
    ["Base.Mov_PosterElement"] = "rare",
    ["Base.Mov_PosterOmega"] = "rare",
    ["Base.Mov_PosterPaws"] = "rare",

    -- B42 food/consumables: not epic-worthy
    ["Base.WatermelonSliced"] = "rare",
    ["Base.TortillaChipsBaked"] = "rare",
    ["Base.GroceryBagGourmet"] = "rare",
    ["Base.PizzaRecipe"] = "rare",
    ["Base.PopBottleRareEmpty"] = "rare",

    -- B42 dried herbs: foraging items, not epic
    ["Base.BlackSageDried"] = "rare",
    ["Base.ComfreyDried"] = "rare",
    ["Base.CommonMallowDried"] = "rare",
    ["Base.Ginseng"] = "rare",
    ["Base.PlantainDried"] = "rare",
    ["Base.WildGarlicDried"] = "rare",

    -- B42 specimen jars: collectible but no utility
    ["Base.Specimen_Beetles"] = "rare",
    ["Base.Specimen_Butterflies"] = "rare",
    ["Base.Specimen_Centipedes"] = "rare",
    ["Base.Specimen_Insects"] = "rare",

    -- B42 bones/fossils: no gameplay value
    ["Base.LargeAnimalBone"] = "rare",
    ["Base.Hominid_Skull_Fragment"] = "rare",

    -- B42 misc items: not epic-worthy
    ["Base.TableLeg_Broken"] = "rare",
    ["Base.FlintNodule"] = "rare",
    ["Base.Paperback_Quackery"] = "rare",
    ["Base.KeyRing_Kitty"] = "rare",
    ["Base.KeyRing_EightBall"] = "rare",
    ["Base.BucketLargeWood"] = "rare",

    -- Promoted to rare by gameplay perception (players perceive these as harder to find)
    ["Base.Vest_BulletCivilian"] = "rare",      -- uncommon (23.7%), civilian bulletproof vest, high protection
    ["Base.MotionSensor"] = "rare",             -- uncommon (16.8%), useful electronics, was rare in B41
    ["Radio.ScannerModule"] = "rare",           -- uncommon (19.4%), useful radio scanner, was rare in B41
    ["Base.MugSpiffo"] = "rare",                -- uncommon (16.7%), Spiffo collectible, cult item
    ["Base.Hat_PartyHat_Stars"] = "rare",       -- uncommon (2.7%, 1 occ), seasonal, single location
    ["Base.Hat_PartyHat_TINT"] = "rare",        -- uncommon (2.7%, 1 occ), seasonal, single location

    -- Leather jackets: good protection, players perceive as valuable finds
    ["Base.Jacket_Leather"] = "rare",           -- uncommon (17.1%), iconic protective jacket
    ["Base.Jacket_LeatherBlack"] = "rare",      -- chance=0, uncommon, zombie-only variant

    -- Doctor bag: B41 common with only 1 occurrence, B42 already rare
    ["Base.Bag_DoctorBag"] = "rare",            -- B41: common (42%, 1 occ!), B42: rare (10.9%, 4 occ)

    -- Leather trousers: consistency with Jacket_Leather (already rare)
    ["Base.Trousers_LeatherBlack"] = "rare",    -- uncommon (17.3%, 12 occ), matches leather jacket override

    -- Spiffo fast food hat: collectible, B41 only 1 occurrence
    ["Base.Hat_FastFood_Spiffo"] = "rare",      -- B41: uncommon (2.9%, 1 occ), B42: uncommon (23.2%, 9 occ)

    ----------------------------------------------------------------
    -- UNCOMMON: Demoted from rare (mundane items math classified as rare)
    ----------------------------------------------------------------

    -- Furniture / Moveables: chairs, tables, sinks, etc.
    ["Base.Mov_BluePlasticChair"] = "uncommon",
    ["Base.Mov_BrownLowTable"] = "uncommon",
    ["Base.Mov_ChromeSink"] = "uncommon",
    ["Base.Mov_DarkBlueChair"] = "uncommon",
    ["Base.Mov_DarkWoodenChair"] = "uncommon",
    ["Base.Mov_FancyBlackChair"] = "uncommon",
    ["Base.Mov_FancyDarkTable"] = "uncommon",
    ["Base.Mov_FancyLowTable"] = "uncommon",
    ["Base.Mov_FancyToilet"] = "uncommon",
    ["Base.Mov_FancyWhiteChair"] = "uncommon",
    ["Base.Mov_FoldingChair"] = "uncommon",
    ["Base.Mov_GreenChair"] = "uncommon",
    ["Base.Mov_GreyChair"] = "uncommon",
    ["Base.Mov_IndustrialSink"] = "uncommon",
    ["Base.Mov_LongTable"] = "uncommon",
    ["Base.Mov_MannequinFemale"] = "uncommon",
    ["Base.Mov_MapUSA"] = "uncommon",
    ["Base.Mov_MetalLocker"] = "uncommon",
    ["Base.Mov_OfficeChair"] = "uncommon",
    ["Base.Mov_PlasticChair"] = "uncommon",
    ["Base.Mov_PlasticLowTable"] = "uncommon",
    ["Base.Mov_PurpleWoodenChair"] = "uncommon",
    ["Base.Mov_RedChair"] = "uncommon",
    ["Base.Mov_RedWoodenChair"] = "uncommon",
    ["Base.Mov_SmallTable"] = "uncommon",
    ["Base.Mov_WhiteSimpleChair"] = "uncommon",
    ["Base.Mov_WhiteSink"] = "uncommon",
    ["Base.Mov_WhiteWoodenChair"] = "uncommon",
    ["Base.Mov_WoodenChair"] = "uncommon",
    ["Base.Mov_WoodenStool"] = "uncommon",

    -- Other moveables: lamps, posters, signs, misc
    ["Base.Mov_Lamp1"] = "uncommon",
    ["Base.Mov_Lamp2"] = "uncommon",
    ["Base.Mov_Lamp3"] = "uncommon",
    ["Base.Mov_Lamp4"] = "uncommon",
    ["Base.Mov_Lamp5"] = "uncommon",
    ["Base.Mov_Lamp6"] = "uncommon",
    -- Mov_PaintingElisa, PosterDroids/Element/Omega/Paws, PalletEmpty: moved to rare section above
    ["Base.Mov_SignArmy"] = "uncommon",
    ["Base.Mov_SignRestricted"] = "uncommon",
    ["Base.Mov_SignWarning"] = "uncommon",
    ["Base.Mov_Microphone"] = "uncommon",
    ["Base.Mov_DesktopComputer"] = "uncommon",
    ["Base.Mov_Microwave"] = "uncommon",
    ["Base.Mov_Microwave2"] = "uncommon",
    ["Base.Mov_RoadCone"] = "uncommon",
    ["Base.Mov_RoadCone2"] = "uncommon",
    ["Base.Mov_RoadBarrier"] = "uncommon",
    ["Base.Mov_LightConstruction"] = "uncommon",
    ["Base.Mov_TVCamera"] = "uncommon",

    -- Paint cans
    ["Base.PaintBlack"] = "uncommon",
    ["Base.PaintBlue"] = "uncommon",
    ["Base.PaintBrown"] = "uncommon",
    ["Base.PaintCyan"] = "uncommon",
    ["Base.PaintGreen"] = "uncommon",
    ["Base.PaintGrey"] = "uncommon",
    ["Base.PaintLightBlue"] = "uncommon",
    ["Base.PaintLightBrown"] = "uncommon",
    ["Base.PaintOrange"] = "uncommon",
    ["Base.PaintPink"] = "uncommon",
    ["Base.PaintPurple"] = "uncommon",
    ["Base.PaintRed"] = "uncommon",
    ["Base.PaintTurquoise"] = "uncommon",
    ["Base.PaintWhite"] = "uncommon",
    ["Base.PaintYellow"] = "uncommon",

    -- Dead animals
    ["Base.DeadRat"] = "uncommon",
    ["Base.DeadMouse"] = "uncommon",
    ["Base.DeadBird"] = "uncommon",
    ["Base.DeadRabbit"] = "uncommon",
    ["Base.DeadSquirrel"] = "uncommon",

    -- Food/cooking intermediates
    ["Base.BreadDough"] = "uncommon",
    ["Base.CakeBatter"] = "uncommon",
    ["Base.Icing"] = "uncommon",
    ["Base.PieDough"] = "uncommon",
    ["Base.TVDinner"] = "uncommon",
    ["Base.Tortilla"] = "uncommon",
    ["Base.FishRoe"] = "uncommon",

    -- Basic materials/crafting
    ["Base.WoodenStick"] = "uncommon",
    ["Base.DenimStrips"] = "uncommon",
    ["Base.SheetRope"] = "uncommon",
    ["Base.BandageDirty"] = "uncommon",
    ["Base.SmashedBottle"] = "uncommon",

    -- Snacks/candies
    ["Base.ChocoCakes"] = "uncommon",
    ["Base.HiHis"] = "uncommon",
    ["Base.Plonkies"] = "uncommon",
    ["Base.QuaggaCakes"] = "uncommon",
    ["Base.SnoGlobes"] = "uncommon",
    ["Base.ChocolateCoveredCoffeeBeans"] = "uncommon",
    ["Base.HardCandies"] = "uncommon",
    ["Base.MintCandy"] = "uncommon",
    ["Base.Modjeska"] = "uncommon",
    ["Base.Peppermint"] = "uncommon",
    ["Base.RockCandy"] = "uncommon",
    ["Base.CandyFruitSlices"] = "uncommon",
    ["Base.Coldpack"] = "uncommon",

    -- Misc mundane items
    ["Base.GroceryBag2"] = "uncommon",
    ["Base.GroceryBag3"] = "uncommon",
    ["Base.GroceryBag4"] = "uncommon",
    ["Base.GroceryBag5"] = "uncommon",
    ["Base.CompostBag"] = "uncommon",
    ["Base.Lightbulb"] = "uncommon",
    ["Base.TinOpener"] = "uncommon",
    ["Base.Broom"] = "uncommon",
    ["Base.Mop"] = "uncommon",

    -- 0-chance mundane items that should not be rare
    ["Base.TableLeg"] = "uncommon",
    ["Base.Football2"] = "uncommon",
    ["Base.FertilizerEmpty"] = "uncommon",
    ["Base.Pipe"] = "uncommon",
}

-- Rarity tiers configuration (based on Weighted Real Chance)
-- Thresholds are sum of (weight/listTotal) across all lists
-- More strict thresholds based on percentile distribution
ItemRarityUI.rarityTiers = {
    legendary = {
        name = "Legendary",
        maxChance = 0.02,  -- top ~5% of items
        color = { r = 1.0, g = 0.5, b = 0.0 }  -- Orange
    },
    epic = {
        name = "Epic",
        maxChance = 0.06,  -- next ~10%
        color = { r = 0.7, g = 0.3, b = 0.9 }  -- Purple
    },
    rare = {
        name = "Rare",
        maxChance = 0.15,  -- next ~15%
        color = { r = 0.4, g = 0.6, b = 1.0 }  -- Blue
    },
    uncommon = {
        name = "Uncommon",
        maxChance = 0.50,  -- next ~20%
        color = { r = 0.3, g = 0.9, b = 0.3 }  -- Green
    },
    common = {
        name = "Common",
        maxChance = 999999,  -- remaining ~50%
        color = { r = 0.7, g = 0.7, b = 0.7 }  -- White/Gray
    },
    -- For items only obtainable via crafting (not found in loot tables)
    crafted = {
        name = "Crafted",
        maxChance = -1,
        color = { r = 0.5, g = 0.85, b = 0.85 }  -- Teal/Cyan
    },
    -- For items not in loot tables and not craftable
    unknown = {
        name = "Unknown",
        maxChance = -1,
        color = { r = 0.5, g = 0.5, b = 0.5 }  -- Dark Gray
    }
}

-- Translations for rarity names (top 20 PZ languages)
-- Latin-alphabet languages use ASCII only (no diacritics) for compatibility
ItemRarityUI.translations = {
    -- 1. English (default)
    EN = {
        Legendary = "Legendary",
        Epic = "Epic",
        Rare = "Rare",
        Uncommon = "Uncommon",
        Common = "Common",
        Crafted = "Crafted",
        Unknown = "Unknown",
        Rarity = "Rarity"
    },
    -- 2. Portuguese (BR)
    PTBR = {
        Legendary = "Lendario",
        Epic = "Epico",
        Rare = "Raro",
        Uncommon = "Incomum",
        Common = "Comum",
        Crafted = "Fabricado",
        Unknown = "Desconhecido",
        Rarity = "Raridade"
    },
    -- 3. Spanish
    ES = {
        Legendary = "Legendario",
        Epic = "Epico",
        Rare = "Raro",
        Uncommon = "Poco comun",
        Common = "Comun",
        Crafted = "Fabricado",
        Unknown = "Desconocido",
        Rarity = "Rareza"
    },
    -- 4. French
    FR = {
        Legendary = "Legendaire",
        Epic = "Epique",
        Rare = "Rare",
        Uncommon = "Peu commun",
        Common = "Commun",
        Crafted = "Fabrique",
        Unknown = "Inconnu",
        Rarity = "Rarete"
    },
    -- 5. German
    DE = {
        Legendary = "Legendar",
        Epic = "Episch",
        Rare = "Selten",
        Uncommon = "Ungewohnlich",
        Common = "Gewohnlich",
        Crafted = "Hergestellt",
        Unknown = "Unbekannt",
        Rarity = "Seltenheit"
    },
    -- 6. Italian
    IT = {
        Legendary = "Leggendario",
        Epic = "Epico",
        Rare = "Raro",
        Uncommon = "Non comune",
        Common = "Comune",
        Crafted = "Fabbricato",
        Unknown = "Sconosciuto",
        Rarity = "Rarita"
    },
    -- 7. Russian
    RU = {
        Legendary = "Легендарный",
        Epic = "Эпический",
        Rare = "Редкий",
        Uncommon = "Необычный",
        Common = "Обычный",
        Crafted = "Создано",
        Unknown = "Неизвестно",
        Rarity = "Редкость"
    },
    -- 8. Polish
    PL = {
        Legendary = "Legendarny",
        Epic = "Epicki",
        Rare = "Rzadki",
        Uncommon = "Niepospolity",
        Common = "Pospolity",
        Crafted = "Wytworzony",
        Unknown = "Nieznany",
        Rarity = "Rzadkosc"
    },
    -- 9. Japanese
    JP = {
        Legendary = "伝説",
        Epic = "エピック",
        Rare = "レア",
        Uncommon = "アンコモン",
        Common = "コモン",
        Crafted = "クラフト",
        Unknown = "不明",
        Rarity = "レアリティ"
    },
    -- 10. Korean
    KO = {
        Legendary = "전설",
        Epic = "에픽",
        Rare = "희귀",
        Uncommon = "고급",
        Common = "일반",
        Crafted = "제작",
        Unknown = "미확인",
        Rarity = "희귀도"
    },
    -- 11. Chinese Simplified
    CH = {
        Legendary = "传说",
        Epic = "史诗",
        Rare = "稀有",
        Uncommon = "精良",
        Common = "普通",
        Crafted = "制作",
        Unknown = "未知",
        Rarity = "稀有度"
    },
    -- 12. Chinese Traditional
    TW = {
        Legendary = "傳說",
        Epic = "史詩",
        Rare = "稀有",
        Uncommon = "精良",
        Common = "普通",
        Crafted = "製作",
        Unknown = "未知",
        Rarity = "稀有度"
    },
    -- 13. Thai
    TH = {
        Legendary = "ตำนาน",
        Epic = "มหากาพย์",
        Rare = "หายาก",
        Uncommon = "ไม่ธรรมดา",
        Common = "ธรรมดา",
        Crafted = "ประดิษฐ์",
        Unknown = "ไม่ทราบ",
        Rarity = "ความหายาก"
    },
    -- 14. Turkish
    TR = {
        Legendary = "Efsanevi",
        Epic = "Destansi",
        Rare = "Nadir",
        Uncommon = "Siradisi",
        Common = "Yaygin",
        Crafted = "El Yapimi",
        Unknown = "Bilinmeyen",
        Rarity = "Nadirlik"
    },
    -- 15. Dutch
    NL = {
        Legendary = "Legendarisch",
        Epic = "Episch",
        Rare = "Zeldzaam",
        Uncommon = "Ongewoon",
        Common = "Gewoon",
        Crafted = "Vervaardigd",
        Unknown = "Onbekend",
        Rarity = "Zeldzaamheid"
    },
    -- 16. Czech
    CS = {
        Legendary = "Legendarni",
        Epic = "Epicky",
        Rare = "Vzacny",
        Uncommon = "Neobvykly",
        Common = "Bezny",
        Crafted = "Vyrobeny",
        Unknown = "Neznamy",
        Rarity = "Vzacnost"
    },
    -- 17. Hungarian
    HU = {
        Legendary = "Legendas",
        Epic = "Epikus",
        Rare = "Ritka",
        Uncommon = "Szokatlan",
        Common = "Kozoenseges",
        Crafted = "Keszitett",
        Unknown = "Ismeretlen",
        Rarity = "Ritkasag"
    },
    -- 18. Spanish (Argentina)
    AR = {
        Legendary = "Legendario",
        Epic = "Epico",
        Rare = "Raro",
        Uncommon = "Poco comun",
        Common = "Comun",
        Crafted = "Fabricado",
        Unknown = "Desconocido",
        Rarity = "Rareza"
    },
    -- 19. Finnish
    FI = {
        Legendary = "Legendaarinen",
        Epic = "Eeppinen",
        Rare = "Harvinainen",
        Uncommon = "Epatavallinen",
        Common = "Tavallinen",
        Crafted = "Valmistettu",
        Unknown = "Tuntematon",
        Rarity = "Harvinaisuus"
    },
    -- 20. Ukrainian
    UA = {
        Legendary = "Легендарний",
        Epic = "Епічний",
        Rare = "Рідкісний",
        Uncommon = "Незвичайний",
        Common = "Звичайний",
        Crafted = "Створено",
        Unknown = "Невідомо",
        Rarity = "Рідкісність"
    }
}

-- Aliases for language codes that PZ may return
ItemRarityUI.translations.PT = ItemRarityUI.translations.PTBR
ItemRarityUI.translations.CN = ItemRarityUI.translations.CH

-- Language aliases: maps PZ language names/codes to our translation keys
ItemRarityUI.languageAliases = {
    ["PT-BR"] = "PTBR", ["Portugues"] = "PTBR", ["Portuguese"] = "PTBR",
    ["Espanol"] = "ES",  ["Spanish"] = "ES",
    ["Francais"] = "FR", ["French"] = "FR",
    ["Deutsch"] = "DE",  ["German"] = "DE",
    ["Russian"] = "RU",
}

-- Get current language key for translations
function ItemRarityUI.getLanguage()
    local lang = nil
    if Translator and Translator.getLanguage then
        local langObj = Translator.getLanguage()
        if langObj and langObj.name then
            lang = langObj:name()
        end
    end
    if type(lang) ~= "string" or lang == "" then
        return "EN"
    end

    -- Check alias table first (handles full names and special codes)
    local alias = ItemRarityUI.languageAliases[lang]
    if alias then return alias end

    -- Try uppercase code directly (covers EN, ES, FR, DE, RU, JP, KO, etc.)
    local upper = string.upper(lang)
    if ItemRarityUI.translations[upper] then
        return upper
    end

    -- Fallback
    return "EN"
end

-- Get translated text
-- Strategy: try PZ native getText() first (loaded from Translate/*.txt files with correct encoding),
-- then fall back to inline translations table (works for ASCII/latin languages).
-- This ensures non-ASCII languages (KO, RU, UA, JP, TH, CH, TW, AR) render correctly
-- because PZ handles file encoding natively, avoiding inline Lua UTF-8 issues.
function ItemRarityUI.getText(key)
    -- 1) Try PZ native translation system (external .txt files with proper encoding)
    local nativeKey = "IGUI_ItemRarityUI_" .. key
    if getText then
        local nativeResult = getText(nativeKey)
        -- getText() returns the key itself if no translation is found
        if nativeResult and nativeResult ~= nativeKey then
            return nativeResult
        end
    end

    -- 2) Fallback to inline translations table (safe for ASCII/latin languages)
    local lang = ItemRarityUI.getLanguage()
    local translations = ItemRarityUI.translations[lang] or ItemRarityUI.translations["EN"]
    return translations[key] or ItemRarityUI.translations["EN"][key] or key
end

--***********************************************************
--** Load pre-calculated rarity data
--***********************************************************

function ItemRarityUI.loadRarityData()
    if ItemRarityUI.dataLoaded then
        return true
    end
    
    print("[ItemRarityUI] Loading pre-calculated rarity data...")
    
    -- Try to load the pre-calculated data
    local success, data = pcall(function()
        return require("ItemRarityData")
    end)
    
    if success and data then
        ItemRarityUI.itemRarities = {}
        local count = 0
        
        -- Convert loaded data to internal format with colors
        for itemName, itemData in pairs(data) do
            local tierData = ItemRarityUI.rarityTiers[itemData.rarity]
            if tierData then
                ItemRarityUI.itemRarities[itemName] = {
                    chance = itemData.chance,
                    rarity = itemData.rarity,
                    occurrences = itemData.occurrences,
                    color = tierData.color
                }
                count = count + 1
            end
        end
        
        ItemRarityUI.dataLoaded = true
        print("[ItemRarityUI] Item Rarity UI Build 1.01")
        print("[ItemRarityUI] Loaded rarity data for " .. count .. " items")
        return true
    else
        print("[ItemRarityUI] Failed to load ItemRarityData: " .. tostring(data))
        return false
    end
end

-- Get color for an item
function ItemRarityUI.getColor(fullType)
    -- Use getRarityData to apply overrides
    local data = ItemRarityUI.getRarityData(fullType)
    if data then
        return data.color
    end
    -- Items not in loot tables get "unknown" color
    return ItemRarityUI.rarityTiers.unknown.color
end

-- Get rarity data for an item
function ItemRarityUI.getRarityData(fullType)
    if not ItemRarityUI.dataLoaded then
        ItemRarityUI.loadRarityData()
    end
    
    local data = ItemRarityUI.itemRarities[fullType]
    
    -- Check for rarity override (works even if item has no loot data)
    local override = ItemRarityUI.rarityOverrides[fullType]
    if override then
        local tierData = ItemRarityUI.rarityTiers[override]
        if tierData then
            return {
                chance = data and data.chance or 0,
                rarity = override,
                occurrences = data and data.occurrences or 0,
                color = tierData.color
            }
        end
    end
    
    return data
end

-- Get rarity tier name for an item
function ItemRarityUI.getRarityTierName(fullType)
    local data = ItemRarityUI.getRarityData(fullType)
    if data then
        return data.rarity
    end
    return "unknown"
end

-- Get translated rarity display string
function ItemRarityUI.getRarityString(fullType)
    local tierName = ItemRarityUI.getRarityTierName(fullType)
    -- Capitalize first letter for translation key
    local key = tierName:sub(1,1):upper() .. tierName:sub(2)
    return ItemRarityUI.getText(key)
end

--***********************************************************
--** Rarity Column Width Configuration
--***********************************************************

ItemRarityUI.rarityColumnWidth = 200  -- Default width (maximum)

-- Calculate effective column width based on available space
-- Limits rarity column to 50% of the Type column to avoid overlap on small screens
function ItemRarityUI.getEffectiveColumnWidth(typeColWidth)
    local maxWidth = math.floor(typeColWidth * 0.5)
    return math.min(ItemRarityUI.rarityColumnWidth, maxWidth)
end

--***********************************************************
--** Mod compatibility detection
--***********************************************************

-- Known UI mods that may conflict with the rarity column
ItemRarityUI.knownConflicts = {
    {
        name = "CleanUI",
        patterns = { "CleanUI" },
        workshopIds = {
            ["3437629766"] = "[B42] CleanUI V2.2",
            ["3575895484"] = "[B42] CleanUI Hotfix",
        },
    },
}

-- Detect conflicting/compatible UI mods by name or Steam Workshop ID
-- Note: PZ's Java-to-Lua string conversion adds a hidden trailing byte,
-- so we use Lua string.find() instead of Java's ArrayList:contains()
function ItemRarityUI.detectConflictingMods()
    local activeMods = getActivatedMods and getActivatedMods()
    if not activeMods then return end

    for i = 0, activeMods:size() - 1 do
        local rawId = tostring(activeMods:get(i))
        local modId = rawId:match("^%s*(.-)%s*$") or rawId

        for _, conflict in ipairs(ItemRarityUI.knownConflicts) do
            local detected = false
            local detectedBy = nil

            -- 1) Check by mod name pattern
            for _, pattern in ipairs(conflict.patterns) do
                if modId:find(pattern, 1, true) then
                    detected = true
                    detectedBy = "mod ID: " .. modId
                    break
                end
            end

            -- 2) Check by Steam Workshop ID if available
            if not detected then
                pcall(function()
                    local info = getModInfoByID(rawId)
                    if info and info.getWorkshopID then
                        local wsId = tostring(info:getWorkshopID())
                        if conflict.workshopIds[wsId] then
                            detected = true
                            detectedBy = "Workshop ID: " .. wsId .. " (" .. conflict.workshopIds[wsId] .. ")"
                        end
                    end
                end)
            end

            if detected then
                print("[ItemRarityUI] " .. conflict.name .. " detected [" .. detectedBy .. "]")
                if conflict.name == "CleanUI" then
                    ItemRarityUI.cleanUIDetected = true
                    ItemRarityUI.showRarityColumn = false
                    print("[ItemRarityUI] Rarity column disabled (CleanUI compatibility) - colors remain active")
                    ItemRarityUI.patchCleanUISortMenu()
                end
            end
        end
    end
end

-- Patch CleanUI's sort menu to add a Rarity sort option
-- Only called when CleanUI is detected; monkey-patches ISInventoryCommonHandler_SortMenu:perform()
function ItemRarityUI.patchCleanUISortMenu()
    if not ISInventoryCommonHandler_SortMenu then return end

    local originalPerform = ISInventoryCommonHandler_SortMenu.perform
    if not originalPerform then return end

    ISInventoryCommonHandler_SortMenu.perform = function(self)
        -- Temporarily intercept ISContextMenu.get to capture the menu reference
        -- (calling ISContextMenu.get a second time creates a NEW menu, losing the original options)
        local capturedContext = nil
        local origGet = ISContextMenu.get
        ISContextMenu.get = function(...)
            capturedContext = origGet(...)
            return capturedContext
        end

        -- Call CleanUI's original perform (creates menu with Name/Category/Weight)
        originalPerform(self)

        -- Always restore the original ISContextMenu.get
        ISContextMenu.get = origGet

        -- Add Rarity option to the same menu that CleanUI created
        if capturedContext then
            local ok, err = pcall(function()
                local rarityOption = capturedContext:addOption(
                    ItemRarityUI.getText("Rarity"),
                    self,
                    function(handler)
                        local window = handler:getWindow()
                        if not window or not window.inventoryPane then return end
                        local pane = window.inventoryPane
                        if pane.itemSortFunc == ISInventoryPane.itemSortByRarityInc then
                            pane.itemSortFunc = ISInventoryPane.itemSortByRarityDesc
                        else
                            pane.itemSortFunc = ISInventoryPane.itemSortByRarityInc
                        end
                        pane:refreshContainer()
                    end
                )
                -- Use our own icon (matches CleanUI's visual style)
                local rarityIcon = getTexture("media/ui/ItemRarityUI/Icon_Rarity.png")
                if rarityIcon and rarityOption then
                    rarityOption.iconTexture = rarityIcon
                end
            end)
            if not ok then
                print("[ItemRarityUI] WARNING: CleanUI sort patch failed: " .. tostring(err))
            end
        end
    end

    print("[ItemRarityUI] CleanUI sort menu patched - Rarity option added")
end

--***********************************************************
--** Hook createChildren to add Rarity column header
--***********************************************************

pcall(require, "ISUI/ISResizableButton")

local original_createChildren = ISInventoryPane.createChildren

function ISInventoryPane:createChildren()
    original_createChildren(self)

    -- Run mod conflict detection once (getActivatedMods is available at this point)
    if not ItemRarityUI._conflictsChecked then
        ItemRarityUI._conflictsChecked = true
        ItemRarityUI.detectConflictingMods()
    end
    
    -- Add Rarity column button after the existing columns (using ISResizableButton for resize support)
    -- Always created (unless CleanUI); visibility is toggled in prerender via ModOptions
    -- Wrapped in pcall for B42 compatibility
    local ok, err = pcall(function()
        if not ItemRarityUI.cleanUIDetected and ISResizableButton then
            local btnWid = ItemRarityUI.rarityColumnWidth
            local btnHgt = self.headerHgt or 16
            
            -- Create rarity header as resizable button (like the Type column)
            self.rarityHeader = ISResizableButton:new(0, 0, btnWid, btnHgt, ItemRarityUI.getText("Rarity"), self, ISInventoryPane.onSortByRarity)
            self.rarityHeader.borderColor = {r=0, g=0, b=0, a=0.2}
            self.rarityHeader.backgroundColor = {r=0, g=0, b=0, a=0.0}
            self.rarityHeader.backgroundColorMouseOver = {r=0.3, g=0.3, b=0.3, a=1.0}
            self.rarityHeader.textColor = { r = 1, g = 1, b = 1, a = 1 }
            self.rarityHeader.font = self.headerFont or UIFont.Small
            self.rarityHeader.minimumWidth = 30
            self.rarityHeader.maximumWidth = 200
            self.rarityHeader.resizeLeft = true  -- Resize from left edge
            self.rarityHeader.onresize = { ISInventoryPane.onResizeRarityColumn, self, self.rarityHeader }
            self.rarityHeader:initialise()
            self:addChild(self.rarityHeader)
            
            self.hasRarityColumn = true
        end
    end)
    if not ok then
        print("[ItemRarityUI] WARNING: createChildren hook failed: " .. tostring(err))
        print("[ItemRarityUI] Rarity column disabled - UI may have changed in this game version")
    end
end

-- Handle rarity column resize
function ISInventoryPane:onResizeRarityColumn(button)
    ItemRarityUI.rarityColumnWidth = button:getWidth()
end

-- Sort by rarity functions (ascending and descending)
-- These respect the equipped/inHotbar sections like the vanilla sort functions
-- Sorts by TIER first (legendary > epic > rare > uncommon > common > crafted > unknown),
-- then by chance within the same tier for consistent visual grouping.

-- Tier weight: lower = rarer. Items are grouped by tier, not scattered by raw chance.
local tierWeight = {
    legendary = 1,
    epic      = 2,
    rare      = 3,
    uncommon  = 4,
    common    = 5,
    crafted   = 6,
}

local function getSortWeight(data)
    if not data then return 7 end  -- unknown / no data
    return tierWeight[data.rarity] or 7
end

local function getSortChance(data)
    if not data then return 99999 end
    return data.chance or 99999
end

ISInventoryPane.itemSortByRarityInc = function(a, b)
    -- Keep equipped items in their own section (at the end)
    if a.equipped and not b.equipped then return false end
    if b.equipped and not a.equipped then return true end
    -- Keep hotbar items in their own section
    if a.inHotbar and not b.inHotbar then return true end
    if b.inHotbar and not a.inHotbar then return false end
    
    -- Sort by rarity within each section
    local itemA = a.items and a.items[1]
    local itemB = b.items and b.items[1]
    if not itemA or not itemB then return false end
    
    local dataA = ItemRarityUI.getRarityData(itemA:getFullType())
    local dataB = ItemRarityUI.getRarityData(itemB:getFullType())
    
    -- Primary: sort by tier (legendary first)
    local weightA = getSortWeight(dataA)
    local weightB = getSortWeight(dataB)
    if weightA ~= weightB then return weightA < weightB end
    
    -- Secondary: within same tier, rarer items first (lower chance)
    return getSortChance(dataA) < getSortChance(dataB)
end

ISInventoryPane.itemSortByRarityDesc = function(a, b)
    -- Keep equipped items in their own section (at the end)
    if a.equipped and not b.equipped then return false end
    if b.equipped and not a.equipped then return true end
    -- Keep hotbar items in their own section
    if a.inHotbar and not b.inHotbar then return true end
    if b.inHotbar and not a.inHotbar then return false end
    
    -- Sort by rarity within each section
    local itemA = a.items and a.items[1]
    local itemB = b.items and b.items[1]
    if not itemA or not itemB then return false end
    
    local dataA = ItemRarityUI.getRarityData(itemA:getFullType())
    local dataB = ItemRarityUI.getRarityData(itemB:getFullType())
    
    -- Primary: sort by tier (common first)
    local weightA = getSortWeight(dataA)
    local weightB = getSortWeight(dataB)
    if weightA ~= weightB then return weightA > weightB end
    
    -- Secondary: within same tier, more common items first (higher chance)
    return getSortChance(dataA) > getSortChance(dataB)
end

-- Sort by rarity function (uses the vanilla itemSortFunc pattern)
function ISInventoryPane:onSortByRarity()
    -- Toggle sort direction using the vanilla pattern
    if self.itemSortFunc == ISInventoryPane.itemSortByRarityInc then
        self.itemSortFunc = ISInventoryPane.itemSortByRarityDesc
    else
        self.itemSortFunc = ISInventoryPane.itemSortByRarityInc
    end
    -- Refresh container to apply the new sort
    self:refreshContainer()
end

--***********************************************************
--** Hook prerender to position rarity column
--***********************************************************

local original_prerender = ISInventoryPane.prerender

function ISInventoryPane:prerender()
    if not ItemRarityUI.dataLoaded then
        ItemRarityUI.loadRarityData()
    end
    
    -- Toggle rarity header visibility and position (pcall for B42 safety)
    if self.rarityHeader and self.column3 then
        -- Immediately reflect ModOptions toggle
        self.rarityHeader:setVisible(ItemRarityUI.showRarityColumn)
        
        if ItemRarityUI.showRarityColumn then
            local ok, err = pcall(function()
                local typeColWidth = self.column4 - self.column3
                local effectiveWidth = ItemRarityUI.getEffectiveColumnWidth(typeColWidth)
                local rarityX = self.column3 + typeColWidth - effectiveWidth - 5
                
                self.rarityHeader:setX(rarityX)
                self.rarityHeader:setY(0)
                self.rarityHeader:setWidth(effectiveWidth)
                self.rarityHeader.maximumWidth = math.floor(typeColWidth * 0.5)
                self.rarityHeader.title = ItemRarityUI.getText("Rarity")
            end)
            if not ok and not ItemRarityUI._prerenderWarned then
                print("[ItemRarityUI] WARNING: prerender hook failed: " .. tostring(err))
                ItemRarityUI._prerenderWarned = true
            end
        end
    end
    
    return original_prerender(self)
end

--***********************************************************
--** Hook renderdetails to add colors and rarity text
--***********************************************************

local original_renderdetails = ISInventoryPane.renderdetails

function ISInventoryPane:renderdetails(doDragged)
    if not ItemRarityUI.dataLoaded then
        ItemRarityUI.loadRarityData()
    end
    
    -- Colorize item names via drawText override (pcall for B42 safety)
    local origDrawText = self.drawText
    local colorizeOk, colorizeErr = pcall(function()
        self.drawText = function(selfPane, text, x, y, r, g, b, a, font)
            if ItemRarityUI.colorItemNames and text and selfPane.itemslist then
                local nameColumnX = selfPane.column2 + 8
                if math.abs(x - nameColumnX) < 20 then
                    for _, v in ipairs(selfPane.itemslist) do
                        if v.items and v.items[1] then
                            local item = v.items[1]
                            local itemName = item:getName()
                            if text == itemName or string.sub(text, 1, #itemName) == itemName then
                                local fullType = item:getFullType()
                                local color = ItemRarityUI.getColor(fullType)
                                r, g, b = color.r, color.g, color.b
                                break
                            end
                        end
                    end
                end
            end
            return origDrawText(selfPane, text, x, y, r, g, b, a, font)
        end
    end)
    if not colorizeOk then
        self.drawText = origDrawText
        if not ItemRarityUI._colorizeWarned then
            print("[ItemRarityUI] WARNING: colorize hook failed: " .. tostring(colorizeErr))
            ItemRarityUI._colorizeWarned = true
            ItemRarityUI.colorItemNames = false
        end
    end
    
    -- Call original render
    local result = original_renderdetails(self, doDragged)
    
    -- Restore original drawText
    self.drawText = origDrawText
    
    -- Now draw rarity column text (only if columns exist)
    if ItemRarityUI.showRarityColumn and self.itemslist and not doDragged and self.column3 and self.column4 then
        local y = 0
        local headerHgt = self.headerHgt or 16
        local itemHgt = self.itemHgt or 18
        local yScroll = self:getYScroll()
        local height = self:getHeight()
        local textDY = (itemHgt - (self.fontHgt or 12)) / 2
        
        -- Calculate rarity column X position (same as header)
        local typeColWidth = self.column4 - self.column3
        local effectiveWidth = ItemRarityUI.getEffectiveColumnWidth(typeColWidth)
        local rarityX = self.column3 + typeColWidth - effectiveWidth
        
        for _, v in ipairs(self.itemslist) do
            if v.items then
                local count = 0
                for idx, item in ipairs(v.items) do
                    count = count + 1
                    local topOfItem = y * itemHgt + yScroll
                    
                    -- Only draw if visible
                    if topOfItem + itemHgt >= 0 and topOfItem <= height then
                        -- Only draw for first item (main row)
                        if idx == 1 then
                            local fullType = item:getFullType()
                            local rarityData = ItemRarityUI.getRarityData(fullType)
                            local color
                            local displayText
                            
                            if rarityData then
                                color = rarityData.color
                                local tierName = rarityData.rarity
                                local key = tierName:sub(1,1):upper() .. tierName:sub(2)
                                displayText = ItemRarityUI.getText(key)
                            else
                                -- Item not in loot tables
                                color = ItemRarityUI.rarityTiers.unknown.color
                                displayText = ItemRarityUI.getText("Unknown")
                            end
                            
                            -- Draw tier name with color
                            self:drawText(displayText, rarityX, (y * itemHgt) + headerHgt + textDY, color.r, color.g, color.b, 0.9, self.font)
                        end
                    end
                    
                    y = y + 1
                    
                    if idx == 1 and self.collapsed and v.name and self.collapsed[v.name] then
                        break
                    end
                    if count > ISInventoryPane.MAX_ITEMS_IN_STACK_TO_RENDER then
                        break
                    end
                end
            end
        end
    end
    
    -- Draw resize highlight line for rarity column (like the game does for Name/Type columns)
    if self.rarityHeader then
        local rarityResize = self.rarityHeader.resizing or self.rarityHeader.mouseOverResize
        if rarityResize then
            local lineX = self.rarityHeader:getX()
            self:drawRectStatic(lineX - 1, 0, 2, self.height, 0.5, 1, 1, 1)
        end
    end
    
    return result
end

--***********************************************************
--** ModOptions: Show/Hide Rarity Column (B41 and B42)
--***********************************************************
-- Applies the "Show Rarity Column" setting. When CleanUI is detected,
-- the column is forced off (CleanUI provides its own sort menu with Rarity).
local function applyColumnSetting(val)
    if ItemRarityUI.cleanUIDetected then
        ItemRarityUI.showRarityColumn = false
    else
        ItemRarityUI.showRarityColumn = val
    end
end

-- B42: native ModOptions API
if PZAPI and PZAPI.ModOptions then
    local options = PZAPI.ModOptions:create("ItemRarityUI", "Item Rarity UI")
    options:addDescription(getText("IGUI_ItemRarityUI_ModDescription"))
    local tickColumn = options:addTickBox(
        "showRarityColumn",
        getText("IGUI_ItemRarityUI_ShowRarityColumn"),
        true,
        getText("IGUI_ItemRarityUI_ShowRarityColumnTooltip")
    )
    options.apply = function(self)
        applyColumnSetting(tickColumn:getValue())
    end
    -- Sync saved option on game start (main menu -> load game)
    Events.OnGameStart.Add(function()
        applyColumnSetting(tickColumn:getValue())
    end)
    print("[ItemRarityUI] ModOptions registered (B42 native)")

-- B41: "Mod Options" by Star (Workshop 2169435993)
elseif ModOptions and ModOptions.getInstance then
    local OPTIONS = { showRarityColumn = true }
    local settings = ModOptions:getInstance(OPTIONS, "ItemRarityUI", "Item Rarity UI")
    ModOptions:loadFile()
    applyColumnSetting(OPTIONS.showRarityColumn)
    local opt = settings:getData("showRarityColumn")
    opt.name = getText("IGUI_ItemRarityUI_ShowRarityColumn")
    opt.tooltip = getText("IGUI_ItemRarityUI_ShowRarityColumnTooltip")
    function opt:OnApplyInGame(val)
        applyColumnSetting(val)
    end
    function opt:OnApply(val)
        applyColumnSetting(val)
    end
    print("[ItemRarityUI] ModOptions registered (B41 Mod Options framework)")
end

--***********************************************************
--** Initialize on various events to cover all cases
--***********************************************************

local function onGameStart()
    print("[ItemRarityUI] OnGameStart triggered")
    ItemRarityUI.loadRarityData()
end

local function onLoad()
    print("[ItemRarityUI] OnLoad triggered")
    ItemRarityUI.loadRarityData()
end

Events.OnGameStart.Add(onGameStart)
Events.OnLoad.Add(onLoad)

local function onGameBoot()
    local buildStr = ItemRarityUI.isB42 and "Build 42" or "Build 41"
    print("[ItemRarityUI] Mod initialized - " .. buildStr .. " detected (version: " .. tostring(ItemRarityUI.gameVersion) .. ")")
    print("[ItemRarityUI] Using Weighted Real Chance calculation method")
end

Events.OnGameBoot.Add(onGameBoot)

print("[ItemRarityUI] Script loaded")
