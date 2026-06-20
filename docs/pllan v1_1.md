# Auto-HUB v1.1 Plan

## Version naming

- Product name: `Auto-HUB`.
- Display version: `v1.1`.
- Build label: `build 110`.
- Manifest version: `1.1.0` for UXP compatibility.
- Install folder: `merged/Auto-HUB_v1.1_build110`.

## Where names appear

- `manifest.json` `name`: shown in UXP Developer Tool and plugin metadata.
- `manifest.json` `entrypoints[].label.default`: shown as the Photoshop panel tab name.
- `index.html` `.panel-title`: shown inside the panel header.
- `index.js` `BUILD_TOKEN`: used for internal build/debug display.

## Package cleanup

- Keep the current installable package at `merged/Auto-HUB_v1.1_build110`.
- Move previous comparison/test packages and old zip files into `merged/old backup`.
- Keep root source files as the editable main version.

## v1.1 contents

- RunPlan cache and numbered output folder flow.
- 1test is a test-only save path exception: when Save Folder is set, use the Save Folder as the base; otherwise use the source/input folder.
- 1test saves into a fixed `1test` root and creates plain numbered run folders inside it, such as `1test/1`, `1test/2`, `1test/3`.
- Run saves into numbered folders when Save Folder or Save Copy is enabled.
- Duplicate output names use `_000`, `_001`, `_002`.
- PSD save failure keeps PSB fallback with the same numbering policy.
- Action modal remains action-only; post-action modal handles save and close together.
- Debug logs are off by default and only available when debug mode is enabled.

## Validation

- Run static checks after packaging:
  - `node --check index.js`
  - `node --check src/core/batchController.js`
  - `node --check src/core/fileScanner.js`
  - `node --check src/core/saveHandler.js`
  - `node --check src/core/runPlan.js`
  - `node --check src/ui/actionPresetPart.js`
  - `node --check src/ui/inputPart.js`
  - `node --check src/ui/outputPart.js`
- Confirm `manifest.json` parses as JSON.
- Add `merged/Auto-HUB_v1.1_build110` in UXP Developer Tool for install testing.
- For 1test save-path testing, set Save Folder to a folder already named `1test` and confirm output goes to `1test/1test/1`, not the source folder's existing `1test_3` style sequence.
