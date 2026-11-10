# Rotation

A rotation is an ordered list of rules: `{ action, conditions }` (PLAN §6).

### ROT-001: The first usable rule is taken

- **Given** a rotation of rules in priority order
- **When** the attacker is free to act
- **Then** it takes the first rule whose action is ready and whose conditions all hold

### ROT-002: The attacker waits when nothing is usable

- **Given** no rule is currently usable
- **When** the attacker is free to act
- **Then** it waits until the earliest time a rule could become usable

### ROT-012: A rotation that can never act idles to the max duration

- **Given** a rotation in which no rule can ever become usable
- **When** the fight runs
- **Then** the attacker does nothing and the fight ends at the max duration with the target not killed

### ROT-003: Target health condition

- **Given** a rule "R when target health is below 30%"
- **When** the target is at or above 30% health
- **Then** R is not cast by that rule

### ROT-013: Would-kill condition

- **Given** a rule "R when it would kill the target"
- **When** R's expected post-mitigation damage is less than the target's current health plus shields
- **Then** R is not cast by that rule

### ROT-004: Buff stack condition

- **Given** a rule that requires at least N stacks of a buff
- **When** the attacker has fewer than N stacks
- **Then** the rule is skipped

### ROT-005: After-attack condition

- **Given** a rule that requires "after an attack"
- **When** the attacker has not completed an attack windup since its last action
- **Then** the rule is skipped

### ROT-006: Resource condition

- **Given** a rule that requires mana above an amount, or an ability whose cost exceeds current mana
- **When** the attacker has too little mana
- **Then** the rule is skipped

### ROT-007: Each champion has a default rotation

- **Given** any supported champion
- **When** a new build is created for it
- **Then** its rotation is that champion's default

### ROT-008: Users can edit a rotation

- **Given** a build's rotation
- **When** the user reorders, adds, removes or changes a rule's conditions
- **Then** later simulations of that build use the edited rotation

### ROT-009: Only supported actions and conditions are offered

- **Given** a champion
- **When** the user edits its rotation
- **Then** only that champion's actions and supported conditions can be chosen

### ROT-010: Rotations can be reset to the default

- **Given** an edited rotation
- **When** the user resets it
- **Then** it equals the champion's default

## Stretch

### ROT-011: Rotation optimizer

- **Given** a build and a target
- **When** the user runs the optimizer
- **Then** it suggests the rule order with the lowest TTK among those it tried
