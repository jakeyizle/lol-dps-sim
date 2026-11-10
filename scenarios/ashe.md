# Ashe

Mechanics to verify against the current patch when the Ashe ticket starts (PLAN §1). Her crit multiplier in game data is 1.0 by design: her crits add no damage directly.

### ASHE-001: Attacks slow the target

- **Given** Ashe attacks
- **When** an attack lands
- **Then** the target is slowed by Frost Shot for its duration

### ASHE-006: Attacks on slowed targets deal crit-scaling bonus damage

- **Given** a target slowed by Frost Shot and Ashe with crit chance
- **When** an attack lands
- **Then** it deals the passive's bonus damage, scaling with crit chance and crit damage per the passive's values

### ASHE-007: The first attack hits an unslowed target

- **Given** the fight's first attack
- **When** it lands
- **Then** it deals no Frost Shot bonus damage

### ASHE-002: Attacks build Focus

- **Given** Ashe attacks
- **When** attacks land
- **Then** she gains Focus stacks up to Q's max

### ASHE-003: Ranger's Focus grants attack speed

- **Given** Ashe at max Focus
- **When** she casts Q
- **Then** for Q's duration she gains Q's attack speed

### ASHE-008: Ranger's Focus fires a flurry

- **Given** Q is active
- **When** an attack lands
- **Then** it fires Q's number of arrows, each dealing Q's percent of attack damage

### ASHE-009: On-hit applies per Q's values during a flurry

- **Given** Q is active and Ashe has on-hit effects
- **When** a flurry lands
- **Then** on-hit effects apply as many times as Q's values say (expected: once)

### ASHE-004: Volley deals ability damage

- **Given** Ashe casts W
- **When** its cast time ends
- **Then** the target takes W's physical damage from one arrow

### ASHE-005: Default rotation

- **Given** a new Ashe build
- **When** its rotation is read
- **Then** it is: Q at max Focus; W after an attack; auto attack otherwise; R only when the user enables it
