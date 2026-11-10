# Caitlyn

Mechanics to verify against the current patch when the Caitlyn ticket starts (PLAN §1). Since 26.1 her headshot and R scale with bonus crit damage (STAT-010).

### CAIT-001: Headshot every Nth attack

- **Given** Caitlyn's headshot counter
- **When** she lands attacks
- **Then** every Nth attack (N from her level, per passive values) is a headshot dealing bonus physical damage that scales with crit chance and bonus crit damage per the passive's values

### CAIT-002: Traps and nets enable a headshot

- **Given** Caitlyn traps (W) or nets (E) the target
- **When** her next attack lands within the passive's window
- **Then** it is a headshot with W's/E's extra damage, without resetting the counter

### CAIT-006: Traps arm after a delay

- **Given** Caitlyn places a trap on the target
- **When** less than W's arm delay has passed
- **Then** the trap has not triggered and gives no headshot

### CAIT-003: Piltover Peacemaker deals ability damage

- **Given** Caitlyn casts Q
- **When** its cast time ends
- **Then** the target takes Q's physical damage

### CAIT-004: Ace in the Hole

- **Given** Caitlyn casts R
- **When** its channel ends
- **Then** the target takes R's physical damage, increased by crit chance and bonus crit damage per R's values

### CAIT-005: Default rotation

- **Given** a new Caitlyn build
- **When** its rotation is read
- **Then** it is: W, then E, then auto attack (headshots), Q after an attack, auto attack otherwise; R only when the user enables it
