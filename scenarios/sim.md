# Simulation

One attacker vs. one target; the target never fights back and is always in range.

### SIM-001: Attacks repeat at the attack timer

- **Given** an attacker with attack speed AS doing only auto attacks
- **When** the fight runs
- **Then** attacks start at 0, 1/AS, 2/AS, …

### SIM-002: Attack damage lands at the end of windup

- **Given** an attack slot with windup percent W and windup modifier K (DATA-011–013), and an attacker with base attack speed A₀ and current attack speed AS
- **When** it starts that attack at time t
- **Then** the attack's damage is dealt at t + B + K × (W / AS − B), where B = W / A₀

### SIM-022: Each attack uses its slot's windup

- **Given** a champion whose crit or alternate attacks have their own windup (DATA-013)
- **When** such an attack is made
- **Then** that slot's windup applies (in expected-value mode, crit slots are never chosen)

### SIM-003: Abilities can be cast between attacks

- **Given** an attacker whose rotation casts an ability after an attack
- **When** the attack's windup ends
- **Then** the ability is cast then, without waiting for the next attack timer

### SIM-004: Ability cast time delays the next action

- **Given** an ability with cast time T
- **When** it is cast at time t
- **Then** the attacker takes no other action before t + T

### SIM-005: Attack resets restart the attack timer

- **Given** an ability that resets the attack timer
- **When** it is cast
- **Then** the next attack can start as soon as the cast ends

### SIM-006: Cooldowns follow ability haste

- **Given** an ability with base cooldown C and ability haste H
- **When** it is cast at time t
- **Then** it is ready again at t + C × 100 / (100 + H)

### SIM-019: The fight starts at full mana

- **Given** an attacker with max mana M
- **When** a fight starts
- **Then** the attacker has M mana

### SIM-020: Mana regenerates

- **Given** an attacker with mana regen R per 5 seconds
- **When** time passes
- **Then** mana increases by R / 5 per second, up to max mana

### SIM-021: Abilities cost mana

- **Given** an ability with cost K
- **When** it is cast
- **Then** the attacker's mana drops by K

### SIM-007: The fight ends when the target dies

- **Given** a target with no revive effect
- **When** its health reaches 0
- **Then** the simulation stops and no later damage is recorded

### SIM-023: Executes kill the target

- **Given** an effect that executes below X% health (e.g. The Collector)
- **When** a damage instance from the attacker leaves the target below X% health
- **Then** the target dies at that moment

### SIM-008: The fight ends at the max duration

- **Given** a max duration of 20 s (the default)
- **When** the target is still alive at 20 s
- **Then** the simulation stops and reports the target as not killed

### SIM-009: Short-term state starts at zero

- **Given** any build
- **When** a fight starts
- **Then** every short-term stack, counter and ramp (e.g. attack speed ramps, every-Nth-attack counters) starts at 0

### SIM-018: Abilities start off cooldown

- **Given** any build
- **When** a fight starts
- **Then** every ability with at least one rank is ready

### SIM-010: Long-term stacks come from the build

- **Given** a build with long-term stacks set (e.g. a stacking passive)
- **When** a fight starts
- **Then** the attacker starts with those stacks

### SIM-011: Expected-value mode is deterministic

- **Given** expected-value crit mode
- **When** the same scenario is simulated twice
- **Then** both results are identical

### SIM-012: RNG mode is reproducible from its seed

- **Given** RNG crit mode and seed S
- **When** the same scenario is simulated twice with seed S
- **Then** both results are identical

### SIM-013: RNG mode aggregates many runs

- **Given** RNG crit mode and N runs (default 200)
- **When** a scenario is simulated
- **Then** results report the mean, p10, p50 and p90 of each metric across runs

### SIM-014: Damage over time ticks on schedule

- **Given** an effect that deals damage every I seconds for T seconds
- **When** it is applied at time t
- **Then** its ticks are dealt at t + I, t + 2I, … up to t + T

### SIM-015: Buffs expire on schedule

- **Given** a buff with duration T that refreshes on new stacks
- **When** it gains its last stack at time t
- **Then** it expires at t + T and its effects stop

### SIM-024: Effects run in a fixed order

- **Given** a champion kit, items and runes that react to the same event
- **When** the event happens
- **Then** their effects run in this order: champion kit, then items in build order, then runes in page order

## Stretch

### SIM-016: Skillshot hit rate

- **Given** an ability with hit rate H%
- **When** it is cast in expected-value mode
- **Then** its damage is multiplied by H / 100

### SIM-017: Kiting downtime between attacks

- **Given** a kiting setting of M seconds of movement per attack
- **When** the fight runs
- **Then** each attack starts no sooner than the later of its attack timer and the previous windup end + M
