# Items

Item stats come from data (STAT-002). These scenarios cover item effects. Each item's scenario is checked against the current patch when its ticket starts (PLAN §1). The MVP item list is decided in the first item ticket by filtering the patch's items by tag and reviewing by hand. It must include items whose effects change TTK or timing: The Collector, Guinsoo's Rageblade, Navori Flickerblade, Statikk Shiv, Rapid Firecannon, Terminus, Nashor's Tooth and Wit's End (Kai'Sa). Their scenarios are added in that ticket.

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

### ITEM-004: Kraken Slayer stacks and spends

- **Given** a build with Kraken Slayer
- **When** an attack is made with the item's max stacks
- **Then** it consumes them and deals bonus physical on-hit damage, increased by the target's missing health, as set by the item's values
- **And** otherwise it adds one stack

### ITEM-011: Kraken Slayer stacks expire

- **Given** Kraken Slayer stacks
- **When** no attack is made within the item's stack duration
- **Then** the stacks are lost

### ITEM-012: Kraken Slayer timing for ranged champions

- **Given** a ranged champion with Kraken Slayer
- **When** an attack is launched
- **Then** stacks are gained and consumed at launch, and the bonus damage uses the item's ranged multiplier

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

### ITEM-008: On-hit effects apply once per landed attack

- **Given** any on-hit item effect
- **When** an attack lands
- **Then** the on-hit effect applies exactly once (crit handling: DMG-013)

## Stretch

### ITEM-009: Runaan's Hurricane bolts hit extra targets

- **Given** multiple targets in range
- **When** an attack lands with Runaan's Hurricane
- **Then** bolts hit the extra targets, as set by the item's values
