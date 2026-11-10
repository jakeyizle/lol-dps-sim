# Items

Item stats come from data (STAT-002). These scenarios cover item effects. Each item's scenario is checked against the current patch when its ticket starts (PLAN §1). The MVP item list (decided in T-020) is the data manifest's items: 26.22 legendary attack damage, crit, attack speed and on-hit items for the MVP champions, plus target defensive items. Items whose passives don't change damage or timing against one target (e.g. Phantom Dancer, Bloodthirster, Immortal Shieldbow) are stat-only (ITEM-001). Two readings need a Practice Tool check: Hexoptics' amp is taken as linear in distance up to its max range, with the attacker at its attack range; Fiendhunter Bolts' non-crit empowered attacks use the item's crit modifier on bonus crit damage.

### ITEM-001: Items without effects only add stats

- **Given** an item with stats and no passive or active
- **When** it is in a build
- **Then** it changes only the champion's stats

### ITEM-002: Items from the same exclusive group can't be combined

- **Given** a build (attacker or target) with an item from an exclusive group (DATA-017)
- **When** the user adds another item from that group
- **Then** it is rejected with a message naming the conflicting item

### ITEM-010: One pair of boots

- **Given** a build with boots
- **When** the user adds other boots
- **Then** they are rejected with a message naming the boots already in the build

### ITEM-003: A build holds at most 6 items

- **Given** a build with 6 items
- **When** the user adds another
- **Then** it is rejected

### ITEM-004: Kraken Slayer empowers every Nth attack

- **Given** a build with Kraken Slayer
- **When** an attack is the item's attack count in a row
- **Then** it deals bonus physical on-hit damage set by the champion's level, increased by up to the item's max amp in proportion to the target's missing health, and the count restarts

### ITEM-011: Kraken Slayer's count expires

- **Given** Kraken Slayer partway through its count
- **When** no attack is made within the item's buff duration
- **Then** the count restarts

### ITEM-012: Kraken Slayer timing for ranged champions

- **Given** a ranged champion with Kraken Slayer
- **When** an attack is launched
- **Then** it counts at launch, the empowered damage lands on hit, and the damage uses the item's ranged multiplier

### ITEM-005: Blade of the Ruined King deals current-health damage

- **Given** a build with Blade of the Ruined King
- **When** an attack lands
- **Then** it deals bonus physical on-hit damage equal to the item's percent of the target's current health

### ITEM-006: Infinity Edge increases crit damage

- **Given** a build with Infinity Edge
- **When** stats are calculated
- **Then** the item's crit damage bonus counts toward total and bonus crit damage (STAT-009, STAT-010)

### ITEM-007: Lord Dominik's Regards grants armor penetration

- **Given** a build with Lord Dominik's Regards
- **When** physical damage is dealt
- **Then** the item's % armor penetration is applied

### ITEM-013: Lord Dominik's Regards amplifies damage against tanky champions

- **Given** a build with Lord Dominik's Regards and a champion target with bonus health
- **When** damage is dealt
- **Then** it is increased by up to the item's max bonus damage, in proportion to the target's bonus health up to the item's max bonus health

### ITEM-014: The Collector executes

- **Given** a build with The Collector and a champion target
- **When** post-mitigation damage leaves the target below the item's execute threshold of max health
- **Then** the target dies (SIM-023)

### ITEM-015: Guinsoo's Rageblade on-hit and attack speed

- **Given** a build with Guinsoo's Rageblade
- **When** attacks land
- **Then** each deals the item's on-hit magic damage and adds a stack of the item's attack speed per stack, up to its max stacks, for its buff duration

### ITEM-016: Guinsoo's Rageblade Phantom Hit

- **Given** Guinsoo's Rageblade at max attack speed stacks
- **When** attacks land
- **Then** they build Phantom stacks; the attack that spends them applies on-hit effects a second time after the Phantom Hit delay, per the item's values

### ITEM-017: Navori Flickerblade reduces cooldowns

- **Given** a build with Navori Flickerblade
- **When** an attack is made
- **Then** the remaining cooldowns of Q, W and E drop by the item's percent of what remains

### ITEM-018: Energize builds from attacks

- **Given** a build with an Energized item and a stationary attacker (no movement stacks)
- **When** attacks are made
- **Then** each adds the patch's energize stacks per attack (plus any bonus from the build's items), up to the patch's max; at max, the next attack is energized and spends them

### ITEM-019: Statikk Shiv energized attacks

- **Given** a build with Statikk Shiv
- **When** an energized attack lands
- **Then** it deals the item's chain damage as magic damage to the target, and Statikk Shiv adds its bonus energize stacks to every attack

### ITEM-020: Rapid Firecannon energized attacks

- **Given** a build with Rapid Firecannon
- **When** an energized attack lands
- **Then** it deals the item's bonus magic damage on hit

### ITEM-021: Terminus

- **Given** a build with Terminus and a champion target
- **When** attacks land
- **Then** each deals the item's on-hit magic damage; attacks alternate Light and Dark, and each Dark hit adds the item's armor and magic penetration per hit, up to its max, for its debuff duration

### ITEM-022: Nashor's Tooth on-hit

- **Given** a build with Nashor's Tooth
- **When** an attack lands
- **Then** it deals the item's base value plus its AP ratio of ability power as magic on-hit damage

### ITEM-023: Wit's End on-hit

- **Given** a build with Wit's End
- **When** an attack lands
- **Then** it deals the item's on-hit magic damage

### ITEM-024: Yun Tal Wildarrows crit stacks

- **Given** a build with Yun Tal Wildarrows and a set number of stacks (SIM-010)
- **When** attacks are launched
- **Then** each adds a stack; each stack gives the item's crit chance per stack (times its ranged multiplier for ranged champions), up to the item's max crit chance

### ITEM-025: Yun Tal Wildarrows Flurry

- **Given** a build with Yun Tal Wildarrows and a champion target, with Flurry off cooldown
- **When** an attack is launched
- **Then** the attacker gains the item's attack speed for its duration and Flurry goes on cooldown; each landed attack cuts that cooldown by the item's on-hit reduction, or its crit reduction when the attack crits (in expected-value mode, weighted by crit chance)

### ITEM-026: Stormrazor energized attacks

- **Given** a build with Stormrazor
- **When** an energized attack lands (ITEM-018)
- **Then** it deals the item's proc damage as magic on-hit damage

### ITEM-027: Hexoptics C44 distance amp

- **Given** a build with Hexoptics C44, attacking from the champion's attack range
- **When** an attack deals damage
- **Then** the attack damage is increased by the item's max damage amp times the attack range over the item's max range, capped at the max amp

### ITEM-028: Fiendhunter Bolts ultimate haste

- **Given** a build with Fiendhunter Bolts
- **When** R's cooldown is calculated
- **Then** the item's ultimate haste is added to ability haste for R only

### ITEM-029: Fiendhunter Bolts Opening Barrage

- **Given** a build with Fiendhunter Bolts, off cooldown
- **When** the attacker casts R
- **Then** the item goes on cooldown and the next of the item's number of attacks within its duration gain its bonus attack speed and always crit: a would-be non-crit uses the item's crit modifier on bonus crit damage, and a crit also deals the item's bonus true damage as a percent of the attack's pre-mitigation damage (in expected-value mode, weighted by crit chance)

### ITEM-030: Essence Reaver Spellblade

- **Given** a build with Essence Reaver, with Spellblade off cooldown
- **When** the attacker casts an ability, then an attack lands
- **Then** the attack deals the item's Spellblade damage (base AD ratio plus crit chance ratio) as bonus physical on-hit damage, and Spellblade goes on its cooldown

### ITEM-008: On-hit effects apply once per landed attack

- **Given** any on-hit item effect
- **When** an attack lands
- **Then** the on-hit effect applies exactly once (crit handling: DMG-013)

## Stretch

### ITEM-009: Runaan's Hurricane bolts hit extra targets

- **Given** multiple targets in range
- **When** an attack lands with Runaan's Hurricane
- **Then** bolts hit the extra targets, as set by the item's values
