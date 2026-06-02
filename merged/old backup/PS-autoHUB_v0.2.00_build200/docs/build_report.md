# PS-autoHUB Build Report
## version: v0.2.00
## build: 200

generated: 2026-03-23

## summary

- Unified the test baseline into `PS-autoHUB v0.2.00 / build 200`
- Standardized version/build labels across panel, manifest, source headers, and docs
- Kept the stable processing base that preserves overwrite and validation behavior
- Included recovery/debug improvements from the later test branch

## included behavior

- PSD source overwrite exception when source is `.psd`, `Save Copy` is off, and save root equals source root
- Subfolders structure validation for cross-loading
- Action placeholder state and preserved selection behavior
- Cancel race fix and delayed Run re-enable
- PSD to PSB fallback name correction
- Safer preflight rendering
- Copy-all fallback and selectable log text
- Refresh All Actions now resets to one empty slot

## ui/version updates

- Panel tab label: `PS-autoHUB`
- Panel subtitle line: `PS-autoHUB v0.2.00 / build 200`
- Sort default display explicitly set to `name ↑`

## verification

- `node --check index.js`
- `node --check src/core/batchController.js`
- `node --check src/core/saveHandler.js`

result: passed
