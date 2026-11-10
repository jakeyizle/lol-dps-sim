# Builder

### BUILD-001: Create a build

- **Given** the builder
- **When** the user creates a build and picks a champion
- **Then** it has level 18, skill ranks from the champion's skill order (DATA-016), no items, a default rune page and the default rotation

### BUILD-002: Duplicate a build

- **Given** a build named "X"
- **When** the user duplicates it
- **Then** a build named "X (copy)" with identical settings is added, and later edits to either don't affect the other

### BUILD-010: Rename a build

- **Given** a build
- **When** the user renames it
- **Then** the new name is shown in the build list and in every comparison view

### BUILD-011: Delete a build

- **Given** a build
- **When** the user deletes it
- **Then** it is removed from the build list and from every comparison

### BUILD-003: Skill ranks follow the skill order by default

- **Given** a build at level L
- **When** skill ranks are not edited
- **Then** they are the ranks the champion's skill order reaches at level L

### BUILD-004: Skill ranks can be edited within limits

- **Given** a build at level L
- **When** the user edits skill ranks
- **Then** total points are at most L, no ability exceeds its max rank, and the ultimate respects its level requirements

### BUILD-005: Items keep their order

- **Given** a build
- **When** the user adds, removes or reorders items
- **Then** the item order is kept and used by the timeline (CMP-002)

### BUILD-006: Total gold

- **Given** a build with items
- **When** it is shown
- **Then** its total gold is the sum of its items' costs

### BUILD-007: Only relevant long-term stacks are offered

- **Given** a champion with a long-term stacking passive or a build with a stacking item or rune
- **When** the user edits the build
- **Then** an input for each such stack is shown, and none for short-term state

### BUILD-012: Attacker health setting

- **Given** a build
- **When** the user sets the attacker's health percent (default 100%)
- **Then** effects that depend on the attacker's health use it, and it stays constant during the fight

### BUILD-013: Game time setting

- **Given** a comparison
- **When** the user sets the game time (default 30 minutes)
- **Then** every time-scaling effect on attacker and target uses it

### BUILD-008: Stats panel updates live

- **Given** a build
- **When** any of its inputs change
- **Then** the stats panel shows the new values of the stats listed in METRIC-007

### BUILD-009: Unsupported champions are not offered

- **Given** the champion picker
- **When** it is opened
- **Then** only champions with an implemented kit are selectable as the attacker
- **And** any champion in the patch data can be picked as a target
- **And** a target champion whose defensive kit (passives, abilities) is not modelled is marked "stats only" in the picker and in the results
