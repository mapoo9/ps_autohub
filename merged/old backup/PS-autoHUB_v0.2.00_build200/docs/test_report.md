# PS-autoHUB Test Report
## version: v0.2.00
## build: 200

generated: 2026-03-23

## completed

### T-001 - PSD overwrite exception
- result: pass
- note: under same-root save conditions, duplicate rename did not occur

### T-002 - Processing flow
- result: pass
- note: single-folder processing completed across 6 files without error

### T-003 - Log copy
- result: pass
- note: `Copy all` succeeded and copied DEBUG log text

### T-004 - Refresh All Actions
- result: pass
- note: action refresh now resets to one empty slot

### T-005 - Folder/action selection
- result: pass
- note: startup interaction restored after clipboard compatibility fix

## pending

- Drag and drop folder input
- Additional script-step pipeline beyond Photoshop Actions
- Extended UI polish pass
