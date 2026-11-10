# Vayne

Mechanics to verify against the current patch when the Vayne ticket starts (PLAN §1).

### VAYNE-001: Silver Bolts every third hit

- **Given** Vayne has put points in W
- **When** she lands a third consecutive attack or ability on the target
- **Then** it deals W's true damage based on the target's max health (with W's minimum)
- **And** the counter resets

### VAYNE-002: Tumble empowers the next attack

- **Given** Vayne casts Q
- **When** her next attack lands within Q's window
- **Then** it deals Q's bonus physical damage

### VAYNE-006: Tumble resets the attack timer

- **Given** Vayne casts Q
- **When** the cast ends
- **Then** her next attack can start immediately (SIM-005)

### VAYNE-003: Final Hour grants attack damage

- **Given** Vayne casts R
- **When** it is active
- **Then** she gains R's bonus attack damage

### VAYNE-007: Final Hour shortens Tumble's cooldown

- **Given** R is active
- **When** Vayne casts Q
- **Then** Q's cooldown is reduced per R's values

### VAYNE-004: Condemn deals ability damage

- **Given** Vayne casts E
- **When** it hits
- **Then** the target takes E's physical damage and it counts toward Silver Bolts

### VAYNE-005: Default rotation

- **Given** a new Vayne build
- **When** its rotation is read
- **Then** it is: R at fight start when the user enables it; Q after an attack; auto attack otherwise
