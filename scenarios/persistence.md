# Persistence

### SAVE-001: Work survives a reload

- **Given** builds, targets and settings
- **When** the page is reloaded
- **Then** they are restored from localStorage

### SAVE-002: Saved data is migrated

- **Given** localStorage data saved by an older schema version
- **When** the app loads
- **Then** it is migrated to the current schema without losing builds or targets

### SAVE-003: Share link round trip

- **Given** a comparison (builds, targets, settings)
- **When** the user copies its share link and another browser opens it
- **Then** the same comparison is shown with the same results

### SAVE-004: Invalid share links don't break the app

- **Given** a malformed or tampered share link
- **When** it is opened
- **Then** an error is shown and the user's saved work is untouched

### SAVE-005: Builds remember their patch

- **Given** a build saved or shared on patch P
- **When** it is opened on a newer patch
- **Then** a notice says it was made on patch P

### SAVE-006: Removed items are dropped with a notice

- **Given** a saved build containing an item that no longer exists in the current patch
- **When** it is opened
- **Then** the item is removed and the notice names it

### SAVE-007: Opening a share link doesn't overwrite saved work

- **Given** saved builds
- **When** the user opens a share link
- **Then** the shared comparison is shown and the saved builds stay available
