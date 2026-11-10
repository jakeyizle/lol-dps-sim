# Jinx

Mechanics to verify against the current patch when the Jinx ticket starts (PLAN §1), including her R changes in 26.1.

### JINX-001: Minigun attacks ramp attack speed

- **Given** Jinx using her minigun
- **When** attacks land
- **Then** each attack adds a stack of bonus attack speed up to the Q rank's max stacks, and stacks decay per Q's values when attacks stop

### JINX-002: Rocket attacks deal bonus damage

- **Given** Jinx using her rocket launcher
- **When** a rocket attack lands
- **Then** it deals Q's bonus damage on top of the attack

### JINX-007: Rocket attacks cost mana

- **Given** Jinx using her rocket launcher
- **When** she launches a rocket attack
- **Then** her mana drops by Q's per-attack cost

### JINX-008: No rockets without mana

- **Given** Jinx using her rocket launcher with less mana than Q's per-attack cost
- **When** she would attack
- **Then** she cannot attack with rockets

### JINX-003: Switching weapons

- **Given** Jinx's rotation contains a weapon swap rule
- **When** the rule fires
- **Then** subsequent attacks use the other weapon, with its own windup (DATA-013), keeping minigun stacks per Q's values

### JINX-004: Zap deals ability damage

- **Given** Jinx casts W
- **When** its cast time ends
- **Then** the target takes W's physical damage

### JINX-009: Zap's cast time scales with attack speed

- **Given** Jinx with bonus attack speed
- **When** she casts W
- **Then** its cast time is reduced per W's values

### JINX-005: Super Mega Death Rocket scales with missing health

- **Given** Jinx casts R
- **When** it hits
- **Then** it deals R's damage plus R's percent of the target's missing health, at max damage (long-range assumption)

### JINX-006: Default rotation

- **Given** a new Jinx build
- **When** its rotation is read
- **Then** it is: R when it would kill the target (ROT-013); W after an attack when Jinx has the mana for it; auto attack with minigun otherwise
