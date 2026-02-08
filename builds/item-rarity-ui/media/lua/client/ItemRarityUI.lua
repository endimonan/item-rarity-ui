--***********************************************************
--**                    ITEM RARITY UI                      **
--**           Colored item names by rarity                 **
--**           Compatible with Build 41                     **
--**                                                        **
--**  Using Weighted Real Chance calculation method:        **
--**  For each item, sum(weight/listTotal) across all lists **
--***********************************************************

require "ISUI/ISInventoryPane"

ItemRarityUI = ItemRarityUI or {}

-- Configuration
ItemRarityUI.colorItemNames = true
ItemRarityUI.showRarityColumn = true
ItemRarityUI.dataLoaded = false

-- Rarity overrides for special items (player starting items, etc.)
-- These items will be forced to a specific rarity regardless of calculated value
ItemRarityUI.rarityOverrides = {
    ["Base.KeyRing"] = "common",  -- Personal keyring (every character has one)
    ["Base.Key1"] = "common",     -- Keys that spawn with vehicles/doors
    ["Base.Key2"] = "common",
    ["Base.Key3"] = "common",
    ["Base.Key4"] = "common",
    ["Base.Key5"] = "common",
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

-- Translations for rarity names
ItemRarityUI.translations = {
    -- English (default)
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
    -- Portuguese (sem acentos para compatibilidade)
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
    PT = {
        Legendary = "Lendario",
        Epic = "Epico",
        Rare = "Raro",
        Uncommon = "Incomum",
        Common = "Comum",
        Crafted = "Fabricado",
        Unknown = "Desconhecido",
        Rarity = "Raridade"
    },
    -- Spanish
    ES = {
        Legendary = "Legendario",
        Epic = "Épico",
        Rare = "Raro",
        Uncommon = "Poco común",
        Common = "Común",
        Crafted = "Fabricado",
        Unknown = "Desconocido",
        Rarity = "Rareza"
    },
    -- French
    FR = {
        Legendary = "Légendaire",
        Epic = "Épique",
        Rare = "Rare",
        Uncommon = "Peu commun",
        Common = "Commun",
        Crafted = "Fabriqué",
        Unknown = "Inconnu",
        Rarity = "Rareté"
    },
    -- German
    DE = {
        Legendary = "Legendär",
        Epic = "Episch",
        Rare = "Selten",
        Uncommon = "Ungewöhnlich",
        Common = "Gewöhnlich",
        Crafted = "Hergestellt",
        Unknown = "Unbekannt",
        Rarity = "Seltenheit"
    },
    -- Italian
    IT = {
        Legendary = "Leggendario",
        Epic = "Epico",
        Rare = "Raro",
        Uncommon = "Non comune",
        Common = "Comune",
        Crafted = "Fabbricato",
        Unknown = "Sconosciuto",
        Rarity = "Rarità"
    },
    -- Russian
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
    -- Polish
    PL = {
        Legendary = "Legendarny",
        Epic = "Epicki",
        Rare = "Rzadki",
        Uncommon = "Niepospolity",
        Common = "Pospolity",
        Crafted = "Wytworzony",
        Unknown = "Nieznany",
        Rarity = "Rzadkość"
    },
    -- Japanese
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
    -- Korean
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
    -- Chinese Simplified
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
    CN = {
        Legendary = "传说",
        Epic = "史诗",
        Rare = "稀有",
        Uncommon = "精良",
        Common = "普通",
        Crafted = "制作",
        Unknown = "未知",
        Rarity = "稀有度"
    },
    -- Chinese Traditional
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
    -- Thai
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
    -- Turkish
    TR = {
        Legendary = "Efsanevi",
        Epic = "Destansı",
        Rare = "Nadir",
        Uncommon = "Sıradışı",
        Common = "Yaygın",
        Crafted = "El Yapımı",
        Unknown = "Bilinmeyen",
        Rarity = "Nadirlik"
    },
    -- Dutch
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
    -- Czech
    CS = {
        Legendary = "Legendární",
        Epic = "Epický",
        Rare = "Vzácný",
        Uncommon = "Neobvyklý",
        Common = "Běžný",
        Crafted = "Vyrobený",
        Unknown = "Neznámý",
        Rarity = "Vzácnost"
    },
    -- Hungarian
    HU = {
        Legendary = "Legendás",
        Epic = "Epikus",
        Rare = "Ritka",
        Uncommon = "Szokatlan",
        Common = "Közönséges",
        Crafted = "Készített",
        Unknown = "Ismeretlen",
        Rarity = "Ritkaság"
    },
    -- Arabic
    AR = {
        Legendary = "أسطوري",
        Epic = "ملحمي",
        Rare = "نادر",
        Uncommon = "غير شائع",
        Common = "شائع",
        Crafted = "مصنوع",
        Unknown = "مجهول",
        Rarity = "الندرة"
    },
    -- Norwegian
    NO = {
        Legendary = "Legendarisk",
        Epic = "Episk",
        Rare = "Sjelden",
        Uncommon = "Uvanlig",
        Common = "Vanlig",
        Crafted = "Laget",
        Unknown = "Ukjent",
        Rarity = "Sjeldenhet"
    },
    -- Danish
    DA = {
        Legendary = "Legendarisk",
        Epic = "Episk",
        Rare = "Sjælden",
        Uncommon = "Usædvanlig",
        Common = "Almindelig",
        Crafted = "Fremstillet",
        Unknown = "Ukendt",
        Rarity = "Sjældenhed"
    },
    -- Finnish
    FI = {
        Legendary = "Legendaarinen",
        Epic = "Eeppinen",
        Rare = "Harvinainen",
        Uncommon = "Epätavallinen",
        Common = "Tavallinen",
        Crafted = "Valmistettu",
        Unknown = "Tuntematon",
        Rarity = "Harvinaisuus"
    },
    -- Swedish
    SV = {
        Legendary = "Legendarisk",
        Epic = "Episk",
        Rare = "Sällsynt",
        Uncommon = "Ovanlig",
        Common = "Vanlig",
        Crafted = "Tillverkad",
        Unknown = "Okänd",
        Rarity = "Sällsynthet"
    },
    -- Ukrainian
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

-- Get current language
function ItemRarityUI.getLanguage()
    local lang = nil
    -- Safely get language - getLanguage() returns a Language object, need to call :name()
    if Translator and Translator.getLanguage then
        local langObj = Translator.getLanguage()
        if langObj and langObj.name then
            lang = langObj:name()
        end
    end
    -- Ensure we have a valid string
    if type(lang) ~= "string" or lang == "" then
        return "EN"
    end
    
    -- Convert to uppercase for matching
    local langUpper = string.upper(lang)
    
    -- Handle Portuguese variations
    if langUpper == "PT-BR" or langUpper == "PTBR" or langUpper == "PT" or lang == "Portugues" or lang == "Portuguese" then
        return "PTBR"
    end
    -- Handle Spanish variations
    if langUpper == "ES" or lang == "Espanol" or lang == "Spanish" then
        return "ES"
    end
    -- Handle French variations
    if langUpper == "FR" or lang == "Francais" or lang == "French" then
        return "FR"
    end
    -- Handle German variations
    if langUpper == "DE" or lang == "Deutsch" or lang == "German" then
        return "DE"
    end
    -- Handle Russian variations
    if langUpper == "RU" or lang == "Russian" then
        return "RU"
    end
    -- Handle other languages by uppercase code
    return langUpper
end

-- Get translated text
function ItemRarityUI.getText(key)
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
        print("[ItemRarityUI] Item Rarity UI Build 1.0")
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

--***********************************************************
--** Hook createChildren to add Rarity column header
--***********************************************************

require "ISUI/ISResizableButton"

local original_createChildren = ISInventoryPane.createChildren

function ISInventoryPane:createChildren()
    original_createChildren(self)
    
    -- Add Rarity column button after the existing columns (using ISResizableButton for resize support)
    if ItemRarityUI.showRarityColumn and ISResizableButton then
        local btnWid = ItemRarityUI.rarityColumnWidth
        local btnHgt = self.headerHgt or 16
        
        -- Create rarity header as resizable button (like the Type column)
        self.rarityHeader = ISResizableButton:new(0, 0, btnWid, btnHgt, ItemRarityUI.getText("Rarity"), self, ISInventoryPane.onSortByRarity)
        self.rarityHeader.borderColor = {r=0, g=0, b=0, a=0.2}
        self.rarityHeader.backgroundColor = {r=0, g=0, b=0, a=0.0}
        self.rarityHeader.backgroundColorMouseOver = {r=0.3, g=0.3, b=0.3, a=1.0}
        self.rarityHeader.textColor = { r = 1, g = 1, b = 1, a = 1 }
        self.rarityHeader.font = self.headerFont or UIFont.Small
        self.rarityHeader.minimumWidth = 50
        self.rarityHeader.maximumWidth = 200
        self.rarityHeader.resizeLeft = true  -- Resize from left edge
        self.rarityHeader.onresize = { ISInventoryPane.onResizeRarityColumn, self, self.rarityHeader }
        self.rarityHeader:initialise()
        self:addChild(self.rarityHeader)
        
        self.hasRarityColumn = true
    end
end

-- Handle rarity column resize
function ISInventoryPane:onResizeRarityColumn(button)
    ItemRarityUI.rarityColumnWidth = button:getWidth()
end

-- Sort by rarity functions (ascending and descending)
-- These respect the equipped/inHotbar sections like the vanilla sort functions
-- Helper to get sortable chance value (crafted/unknown items sort at the end)
local function getSortChance(data)
    if not data then return 99999 end
    if data.rarity == "crafted" then return 99998 end
    return data.chance
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
    
    local chanceA = getSortChance(dataA)
    local chanceB = getSortChance(dataB)
    
    -- Ascending: rarer items first (lower chance = rarer)
    return chanceA < chanceB
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
    
    local chanceA = getSortChance(dataA)
    local chanceB = getSortChance(dataB)
    
    -- Descending: common items first (higher chance = more common)
    return chanceA > chanceB
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
    
    -- Position rarity header
    if self.rarityHeader and self.column3 then
        local typeColWidth = self.column4 - self.column3
        local rarityX = self.column3 + typeColWidth - ItemRarityUI.rarityColumnWidth - 5
        
        self.rarityHeader:setX(rarityX)
        self.rarityHeader:setY(0)
        self.rarityHeader:setWidth(ItemRarityUI.rarityColumnWidth)
        self.rarityHeader.title = ItemRarityUI.getText("Rarity")
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
    
    -- Store original drawText
    local origDrawText = self.drawText
    local pane = self
    
    -- Temporarily override drawText to colorize item names
    self.drawText = function(selfPane, text, x, y, r, g, b, a, font)
        if ItemRarityUI.colorItemNames and text and selfPane.itemslist then
            local nameColumnX = selfPane.column2 + 8
            if math.abs(x - nameColumnX) < 20 then
                -- Find item by matching text
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
    
    -- Call original render
    local result = original_renderdetails(self, doDragged)
    
    -- Restore original drawText
    self.drawText = origDrawText
    
    -- Now draw rarity column text
    if ItemRarityUI.showRarityColumn and self.itemslist and not doDragged then
        local y = 0
        local headerHgt = self.headerHgt or 16
        local itemHgt = self.itemHgt or 18
        local yScroll = self:getYScroll()
        local height = self:getHeight()
        local textDY = (itemHgt - (self.fontHgt or 12)) / 2
        
        -- Calculate rarity column X position (same as header)
        local typeColWidth = self.column4 - self.column3
        local rarityX = self.column3 + typeColWidth - ItemRarityUI.rarityColumnWidth
        
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
    print("[ItemRarityUI] Mod initialized - Build 41 compatible")
    print("[ItemRarityUI] Using Weighted Real Chance calculation method")
end

Events.OnGameBoot.Add(onGameBoot)

print("[ItemRarityUI] Script loaded")
