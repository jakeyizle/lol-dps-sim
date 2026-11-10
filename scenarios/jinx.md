# Jinx

Checked against 26.22 (game file + wiki). Minigun attacks use the basic slots (`basic`, crit `JinxCritAttack`, 17.708% windup); rocket attacks use `JinxQAttack` / `JinxQCritAttack` (16.875%). Two readings of the game values still need a Practice Tool check: W's cast time scalar (taken as 0.01 s less per `JinxWASpeedCastTimeScalarPerHundrethSecond` of bonus attack speed) and the minigun stack decay cadence (one stack per stack duration).

### JINX-001: Minigun attacks ramp attack speed

- **Given** Jinx using her minigun, with Q learned
- **When** attacks land
- **Then** each attack adds a stack of bonus attack speed up to Q's max stacks: the first stack is worth Q's first-stack weight times each later one, and all stacks together give Q's max attack speed
- **And** each new stack refreshes the duration; when it runs out, stacks are lost one at a time

### JINX-002: Rocket attacks deal bonus damage

- **Given** Jinx using her rocket launcher
- **When** a rocket attack lands
- **Then** it deals Q's rocket ratio of her total attack damage instead of her attack damage, and can crit

### JINX-010: Rockets reduce bonus attack speed

- **Given** Jinx using her rocket launcher
- **When** her stats are calculated
- **Then** her bonus attack speed is reduced by Q's rocket attack speed penalty

### JINX-007: Rocket attacks cost mana

- **Given** Jinx using her rocket launcher
- **When** she launches a rocket attack
- **Then** her mana drops by Q's per-attack cost

### JINX-008: No rockets without mana

- **Given** Jinx using her rocket launcher with less mana than Q's per-attack cost
- **When** she would attack
- **Then** she cannot attack until she has the mana

### JINX-003: Switching weapons

- **Given** Jinx's rotation contains a weapon swap rule
- **When** the rule fires
- **Then** subsequent attacks use the other weapon, with its own windup (DATA-013)
- **And** minigun stacks carry over to only the first rocket attack after the swap

### JINX-004: Zap deals ability damage

- **Given** Jinx casts W
- **When** its cast time ends
- **Then** the target takes W's physical damage (base by rank plus W's ratio of total attack damage)

### JINX-009: Zap's cast time scales with attack speed

- **Given** Jinx with bonus attack speed
- **When** she casts W
- **Then** its cast time is reduced from W's cast time toward W's low-end cast time, per W's values

### JINX-005: Super Mega Death Rocket scales with missing health

- **Given** Jinx casts R
- **When** it hits
- **Then** it deals R's max damage (long-range assumption) plus R's percent of the target's missing health

### JINX-006: Default rotation

- **Given** a new Jinx build
- **When** its rotation is read
- **Then** it is: R when it would kill the target (ROT-013); W after an attack (when she has the mana for it); auto attack with minigun otherwise
