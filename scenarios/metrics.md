# Metrics

All metrics come from the recorded damage trace.

### METRIC-001: Time to kill

- **Given** a fight where the target dies
- **When** results are calculated
- **Then** TTK is the time of the damage instance that killed it, counting to its final death after any revive

### METRIC-002: Not killed within the max duration

- **Given** a fight that reaches the max duration
- **When** results are calculated
- **Then** TTK is reported as "not killed" with the target's remaining health

### METRIC-003: DPS windows

- **Given** DPS windows of N seconds (default 3, 6 and 10; user-editable)
- **When** results are calculated
- **Then** each is total post-mitigation damage in [0, N] ÷ N, taken from a separate DPS run (METRIC-008, METRIC-009)

### METRIC-008: In the DPS run, health goes below zero

- **Given** the DPS run
- **When** the target's health would reach 0
- **Then** it keeps falling below 0, all damage counts, and effects using missing health treat it as at most 100% of max health

### METRIC-009: In the DPS run, death-related effects are off

- **Given** the DPS run
- **When** the target would revive, enter stasis or be executed
- **Then** none of these happen
- **And** low-health shields still trigger once, as in the normal run

### METRIC-004: Cumulative damage curve

- **Given** a fight
- **When** results are calculated
- **Then** the curve gives cumulative post-mitigation damage at every damage instance's time

### METRIC-005: Damage breakdown

- **Given** a fight
- **When** results are calculated
- **Then** total damage is split by type (physical, magic, true) and by source, and each split sums to the total

### METRIC-006: Event log

- **Given** a fight
- **When** the user opens the event log
- **Then** each damage instance shows its time, source, pre- and post-mitigation damage, crit flag, and the attacker's active buffs

### METRIC-010: Event log crit flag in expected-value mode

- **Given** expected-value crit mode
- **When** a critable attack is shown in the event log
- **Then** it is marked "averaged" instead of crit or not crit

### METRIC-007: Final stats

- **Given** a build
- **When** results are shown
- **Then** it shows AD, bonus AD, attack speed, crit chance, total crit damage, % armor pen, lethality, magic pen, ability haste, health, mana and AP
