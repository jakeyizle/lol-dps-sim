# Runes

Rune values come from patch data. Each rune's scenario is checked against the current patch when its ticket starts (PLAN §1). MVP runes: Lethal Tempo, Press the Attack, Hail of Blades, Conqueror; Cut Down, Coup de Grace, Last Stand, Legend: Alacrity, Gathering Storm, Absolute Focus; all stat shards. Runes with no effect on damage dealt (e.g. Fleet Footwork, Legend: Bloodline) can be picked but do nothing beyond their stats.

### RUNE-001: A rune page has one keystone and valid minor runes

- **Given** the rune editor
- **When** the user picks runes
- **Then** the page allows exactly one keystone, one rune per row of the primary tree, two rows of a different secondary tree, and three shards

### RUNE-002: Stat shards add stats

- **Given** a page with stat shards
- **When** stats are calculated
- **Then** each shard's stat is added (scaling with level where the shard says so)

### RUNE-003: Lethal Tempo stacks attack speed

- **Given** a build with Lethal Tempo
- **When** attacks land
- **Then** each attack adds a stack of attack speed up to the rune's max stacks, refreshing its duration

### RUNE-011: Lethal Tempo bolt at max stacks

- **Given** Lethal Tempo at max stacks
- **When** an attack lands
- **Then** it deals the rune's bonus adaptive on-hit damage, scaling with bonus attack speed, including attack speed above the cap

### RUNE-012: Lethal Tempo stacks decay one at a time

- **Given** Lethal Tempo stacks
- **When** the duration ends without a new attack
- **Then** stacks are lost one at a time at the rune's decay interval

### RUNE-013: Ranged values for Lethal Tempo

- **Given** a ranged champion with Lethal Tempo
- **When** it stacks or fires bolts
- **Then** the rune's ranged attack speed and damage multipliers apply

### RUNE-004: Press the Attack exposes the target

- **Given** a build with Press the Attack
- **When** the rune's required number of consecutive attacks hit the target
- **Then** it deals the rune's bonus damage and the target takes increased damage for its duration

### RUNE-005: Hail of Blades speeds up opening attacks

- **Given** a build with Hail of Blades
- **When** the fight starts
- **Then** the first attacks (the rune's count) gain the rune's bonus attack speed, and the attack speed cap is lifted for them

### RUNE-006: Conqueror stacks adaptive force

- **Given** a build with Conqueror
- **When** attacks and abilities hit
- **Then** the rune gains stacks of adaptive force up to its max, as set by its values

### RUNE-007: Cut Down amplifies damage against higher-health targets

- **Given** a build with Cut Down
- **When** the target's max health exceeds the attacker's
- **Then** damage is increased by the rune's amount for that health difference

### RUNE-008: Coup de Grace amplifies damage against low-health targets

- **Given** a build with Coup de Grace
- **When** the target is below the rune's health threshold
- **Then** damage is increased by the rune's amount

### RUNE-014: Last Stand uses the attacker's health setting

- **Given** a build with Last Stand and an attacker health percent (BUILD-012)
- **When** damage is dealt
- **Then** it is increased by the rune's amount for that health percent

### RUNE-015: Absolute Focus uses the attacker's health setting

- **Given** a build with Absolute Focus
- **When** the attacker health percent is above the rune's threshold
- **Then** the rune's adaptive bonus applies, and otherwise it doesn't

### RUNE-009: Legend stacks are long-term

- **Given** a build with a Legend rune
- **When** the user sets its stacks
- **Then** the fight starts with that many stacks and their bonus

### RUNE-010: Gathering Storm scales with game time

- **Given** a build with Gathering Storm and a game time (BUILD-013)
- **When** stats are calculated
- **Then** the rune adds the bonus for that game time
