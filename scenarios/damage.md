# Damage

Every damage instance passes through the same pipeline (PLAN §6).

### DMG-001: Armor reduces physical damage

- **Given** a target with R ≥ 0 effective armor
- **When** it takes D physical damage
- **Then** it loses D × 100 / (100 + R) health

### DMG-002: Magic resist reduces magic damage

- **Given** a target with R ≥ 0 effective magic resist
- **When** it takes D magic damage
- **Then** it loses D × 100 / (100 + R) health

### DMG-003: Negative resistances increase damage

- **Given** a target with R < 0 effective armor
- **When** it takes D physical damage
- **Then** it loses D × (2 − 100 / (100 − R)) health

### DMG-004: True damage ignores resistances

- **Given** a target with armor and magic resist
- **When** it takes D true damage
- **Then** it loses D health

### DMG-005: Armor reduction and penetration apply in order

- **Given** an attacker with flat armor reduction, % armor reduction, % armor penetration and lethality
- **When** effective armor is calculated
- **Then** they apply in that order: flat reduction, % reduction, % penetration, lethality

### DMG-006: Penetration cannot take armor below zero

- **Given** a target with 10 armor
- **When** an attacker with 20 lethality hits it
- **Then** effective armor is 0

### DMG-007: Reduction can take armor below zero

- **Given** a target with 10 armor
- **When** it has 20 flat armor reduction applied
- **Then** effective armor is −10

### DMG-008: RNG crits use total crit damage

- **Given** RNG crit mode and an attacker with total crit damage T (STAT-009)
- **When** an attack crits
- **Then** its pre-mitigation damage is multiplied by T

### DMG-009: Expected-value mode averages crits

- **Given** expected-value crit mode, crit chance C and total crit damage T
- **When** a critable attack lands
- **Then** its pre-mitigation damage is multiplied by 1 + C × (T − 1)
- **And** no randomness is used

### DMG-013: On-hit damage doesn't crit

- **Given** an attack with on-hit effects
- **When** the attack crits (RNG) or is averaged (expected value)
- **Then** on-hit damage is not multiplied, unless the effect's own values say it is

### DMG-014: Crit damage reduction in expected-value mode

- **Given** expected-value crit mode, crit chance C and a target effect reducing crit damage by X%
- **When** a critable attack lands
- **Then** the reduction applies to the crit portion only: the multiplier is 1 + C × (T × (1 − X / 100) − 1)

### DMG-010: Damage amplifiers apply before resistances

- **Given** an attacker effect that increases damage by X%
- **When** a damage instance it applies to is dealt
- **Then** the damage is multiplied by (1 + X / 100) before resistances

### DMG-011: Damage is tagged by type and source

- **Given** any damage instance
- **When** it is recorded
- **Then** it has a damage type, a source (attack, ability, item, rune, passive), and flags for auto attack, on-hit, crit and ability

### DMG-012: Shields absorb damage before health

- **Given** a target with a shield of S that blocks all damage types
- **When** it takes D post-mitigation damage
- **Then** the shield absorbs min(D, S) and health loses the rest

### DMG-015: Typed shields only absorb their damage type

- **Given** a target with a shield that blocks only magic damage
- **When** it takes physical or true damage
- **Then** the shield absorbs none of it
