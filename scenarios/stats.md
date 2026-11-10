# Stats

### STAT-001: Base stats grow with level

- **Given** a champion with base value B and growth G for a stat
- **When** it is level L
- **Then** the stat is B + G × (L − 1) × (0.7025 + 0.0175 × (L − 1))

### STAT-002: Item, rune and shard stats are added

- **Given** a champion with items, runes and shards that grant flat stats
- **When** its stats are calculated
- **Then** each stat is the level-based value plus the sum of every flat bonus

### STAT-003: Bonus stats are tracked separately from base stats

- **Given** a champion with items granting AD and health
- **When** its stats are calculated
- **Then** bonus AD and bonus health equal the totals from items, runes, shards and buffs, excluding level growth

### STAT-004: Attack speed uses the attack speed ratio

- **Given** a champion with base attack speed A, attack speed ratio R and bonus attack speed X% (level growth + items + runes + buffs)
- **When** its attack speed is calculated
- **Then** it is A + R × X / 100

### STAT-005: Attack speed is capped

- **Given** a champion whose attack speed would exceed the patch's attack speed cap (DATA-015)
- **When** its attack speed is calculated
- **Then** it equals the cap

### STAT-006: Effects can lift the attack speed cap

- **Given** an active effect that raises the attack speed cap
- **When** attack speed is calculated
- **Then** the effect's cap applies instead of the patch's

### STAT-007: Crit chance is capped at 100%

- **Given** items granting more than 100% crit chance in total
- **When** stats are calculated
- **Then** crit chance is 100%

### STAT-009: Total crit damage

- **Given** a champion with crit multiplier M (DATA-014) and crit damage bonuses B₁…Bₙ from items, runes and buffs
- **When** stats are calculated
- **Then** total crit damage is M + B₁ + … + Bₙ

### STAT-010: Bonus crit damage

- **Given** a champion with crit damage bonuses B₁…Bₙ
- **When** stats are calculated
- **Then** bonus crit damage is B₁ + … + Bₙ (the champion's own multiplier is excluded)

### STAT-008: Stats update when buffs change

- **Given** a buff that grants attack speed per stack
- **When** it gains or loses a stack mid-fight
- **Then** attacks after that use the new attack speed
