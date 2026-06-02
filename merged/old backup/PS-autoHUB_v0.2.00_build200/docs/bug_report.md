# PS-autoHUB Bug Report
## version: v0.2.00
## build: 200

generated: 2026-03-23

## fixed

### B-001 - Cancel race
- status: fixed
- cause: cancel flag could be cleared before the batch loop consumed it
- result: cancel state is now held until batch cleanup completes

### B-002 - Early Run re-enable
- status: fixed
- cause: recovery flow re-enabled Run before the previous batch had fully exited
- result: Run state is restored only after final cleanup

### B-003 - PSD to PSB fallback filename mismatch
- status: fixed
- cause: PSB fallback could be saved through a `.psd` target name
- result: fallback now uses a `.psb` target name

### B-004 - Relative folder creation instability
- status: fixed
- cause: missing-folder detection depended on error-message text
- result: folder creation now branches on entry lookup outcome

### B-005 - Preflight message HTML injection risk
- status: fixed
- cause: errors and warnings were rendered through `innerHTML`
- result: preflight messages now render through DOM text nodes

### B-006 - Copy all regression
- status: fixed
- cause: clipboard fallback change could break startup or fail in host runtime
- result: copy flow now prefers UXP clipboard, then navigator, then textarea fallback

### B-007 - Refresh All Actions partial reset
- status: fixed
- cause: action refresh cleared selections but kept slot count
- result: refresh now resets to one empty slot
