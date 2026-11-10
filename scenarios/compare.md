# Compare

### CMP-001: Builds side by side

- **Given** several builds and one target
- **When** results are shown
- **Then** every build's TTK, DPS windows and breakdown appear in one table, with the best value per metric highlighted

### CMP-009: Shared damage chart

- **Given** several builds and one target
- **When** results are shown
- **Then** every build's damage curve is on one chart, with a line at the target's effective health

### CMP-002: Item-count timeline

- **Given** builds with ordered items
- **When** the timeline is shown
- **Then** each build is simulated with its first 1, 2, … k items (k = its item count)
- **And** each step shows the chosen metric and the step's total gold

### CMP-003: Timeline levels per step

- **Given** a timeline with a level set for each item step
- **When** it is simulated
- **Then** each step uses its own level (default: the build's level for every step)

### CMP-010: Timeline steps recompute skill ranks

- **Given** a build with edited skill ranks and a timeline step at a lower level
- **When** that step is simulated
- **Then** its skill ranks are those the champion's skill order reaches at the step's level

### CMP-004: Build × target matrix

- **Given** several builds and several targets
- **When** the matrix is shown
- **Then** each cell holds the chosen metric for that build vs. that target, coloured relative to the best in its column

### CMP-005: Matrix performance budget

- **Given** the benchmark fixture: 4 builds × 3 targets in RNG mode with 200 runs each
- **When** it is computed by the engine on a CI runner
- **Then** it finishes within the benchmark's time budget (2 s)

### CMP-011: The page stays usable while computing

- **Given** a comparison is being computed
- **When** the user edits a build
- **Then** the edit is applied immediately, without waiting for the computation

### CMP-006: Results update when inputs change

- **Given** results are shown
- **When** the user changes any build, target or setting
- **Then** results recompute without a manual refresh, and results from the old inputs are never shown as current

## Stretch

### CMP-007: Champion vs champion at equal gold

- **Given** builds for different champions
- **When** compared at a chosen gold amount
- **Then** each is simulated with the items its build can afford, in order, at that gold

### CMP-008: Gold efficiency

- **Given** builds side by side
- **When** gold efficiency is shown
- **Then** each build shows DPS per 1000 gold
