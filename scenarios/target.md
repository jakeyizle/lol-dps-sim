# Target

The target never fights back. Defensive effects change only how much damage it takes and when.

### TGT-001: A champion target's stats come from its setup

- **Given** an enemy champion, level and items
- **When** the target's stats are calculated
- **Then** its health, armor and magic resist follow STAT-001 and STAT-002

### TGT-012: Champion targets can have runes and shards

- **Given** a champion target with stat shards and runes that grant defensive stats (e.g. health shards, Conditioning)
- **When** its stats are calculated
- **Then** their stats are added, using the comparison's game time (BUILD-013) where a rune depends on it

### TGT-002: A custom dummy uses entered stats

- **Given** a custom dummy with health, armor, magic resist and % damage reduction
- **When** it is simulated
- **Then** it uses exactly those stats

### TGT-003: Overrides replace a champion target's stats

- **Given** a champion target with an override for armor
- **When** it is simulated
- **Then** its armor is the override and its other stats come from its setup

### TGT-004: Target presets ship with the app

- **Given** a new user
- **When** they open the target editor
- **Then** Squishy, Bruiser and Tank presets are available

### TGT-005: Users can save target presets

- **Given** a configured target
- **When** the user saves it with a name
- **Then** it is listed with the presets and survives a reload

### TGT-006: Randuin's Omen reduces crit damage

- **Given** a target with Randuin's Omen
- **When** it takes a critical strike
- **Then** the crit's damage is reduced by the item's amount (expected-value mode: DMG-014)

### TGT-007: Plated Steelcaps reduce auto attack damage

- **Given** a target with Plated Steelcaps
- **When** it takes auto attack damage
- **Then** that damage is reduced by the item's percent

### TGT-008: Shield items trigger on low health

- **Given** a target with a shield item (e.g. Sterak's Gage, Maw of Malmortius)
- **When** its health first drops below the item's threshold
- **Then** it gains the item's shield, which absorbs damage per DMG-012 or DMG-015

### TGT-013: Item shields decay

- **Given** a target with a shield from an item whose shield decays
- **When** time passes
- **Then** the remaining shield shrinks per the item's decay values until it expires

### TGT-014: Maw of Malmortius blocks only magic damage

- **Given** a target with Maw of Malmortius's shield
- **When** it takes damage
- **Then** the shield absorbs magic damage only (DMG-015)

### TGT-009: Guardian Angel revives the target

- **Given** a target with Guardian Angel
- **When** its health first reaches 0
- **Then** it is untargetable for the item's revive delay, then returns with the item's health

### TGT-010: Zhonya's Hourglass makes the target untargetable

- **Given** a target with Zhonya's Hourglass set to activate at a chosen health percent
- **When** its health first drops below that percent
- **Then** it takes no damage for the item's stasis duration

### TGT-015: Timers keep running during stasis

- **Given** a target in stasis or reviving
- **When** time passes
- **Then** buffs, stacks and cooldowns on both sides keep ticking down

### TGT-011: Zhonya's can be turned off

- **Given** a target with Zhonya's Hourglass set to "never"
- **When** the fight runs
- **Then** stasis never happens
