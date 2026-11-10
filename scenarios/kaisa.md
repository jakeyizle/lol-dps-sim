# Kai'Sa

Mechanics to verify against the current patch when the Kai'Sa ticket starts (PLAN §1).

### KAISA-001: Attacks apply Plasma

- **Given** Kai'Sa attacks
- **When** attacks land
- **Then** each attack deals the passive's bonus magic damage and adds a Plasma stack

### KAISA-002: Plasma ruptures at max stacks

- **Given** the target has one stack below max Plasma
- **When** the stack that reaches max is applied
- **Then** it ruptures, dealing magic damage equal to the passive's percent of the target's missing health
- **And** the target's Plasma stacks reset to 0

### KAISA-003: Q evolves from bonus AD

- **Given** a build whose bonus AD reaches Q's evolution threshold
- **When** the fight starts
- **Then** Q is evolved

### KAISA-011: W evolves from AP

- **Given** a build whose AP reaches W's evolution threshold
- **When** the fight starts
- **Then** W is evolved

### KAISA-012: E evolves from bonus attack speed

- **Given** a build whose bonus attack speed (including level growth, per the passive) reaches E's evolution threshold
- **When** the fight starts
- **Then** E is evolved

### KAISA-004: Icathian Rain

- **Given** Kai'Sa casts Q on a single target
- **When** its missiles land
- **Then** the target takes Q's damage per missile (more missiles when evolved), with single-target reduction per Q's values

### KAISA-005: Supercharge grants attack speed

- **Given** Kai'Sa casts E
- **When** its charge ends
- **Then** she gains E's attack speed for its duration

### KAISA-008: Supercharge's charge time shortens with attack speed

- **Given** Kai'Sa with bonus attack speed
- **When** she casts E
- **Then** its charge time is reduced per E's values

### KAISA-009: Attacks reduce Supercharge's cooldown

- **Given** E is on cooldown
- **When** an attack lands
- **Then** E's remaining cooldown drops per E's values

### KAISA-006: Void Seeker

- **Given** Kai'Sa casts W
- **When** it hits
- **Then** it deals W's magic damage and applies W's Plasma stacks (more when evolved)

### KAISA-010: Void Seeker refunds cooldown on hit

- **Given** Kai'Sa's W hits the target
- **When** it lands
- **Then** W's cooldown is refunded per W's values

### KAISA-007: Default rotation

- **Given** a new Kai'Sa build
- **When** its rotation is read
- **Then** it is: E before the first attack; Q after an attack; W after an attack when the target has at least 2 Plasma stacks; auto attack otherwise
