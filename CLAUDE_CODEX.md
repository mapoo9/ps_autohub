# PS-AutoHUB Notes

## Project Docs

- Worklog rules: `docs/WORKLOG_GUIDE.md`
- Current worklog: `docs/WORKLOG.md`
- Build/release/version rules: `docs/build-release-guide.md`
- Release report template: `docs/release-report-template.md`
- Debug Mode plan: `docs/추가작업/debug-mode-plan.md`
- Action catalog refresh plan: `docs/추가작업/action-catalog-refresh-plan.md`

## PS-autoHUB Test Panel

- Primary panel path: `/Users/kisoon/Documents/0_vibeCoding/PS-AutoHUB`
- Use the repository root as the default Photoshop UXP development test target.
- Treat `merged/*` as install/package output, not the editing source of truth.
- Before diagnosing a Photoshop panel issue, confirm whether UXP Developer Tool is loading the repository root or a `merged/Auto-HUB_*` package.
- If the loaded target is a `merged/*` package, root source changes will not appear until the package is synced.
- When testing breaks badly, restore the root panel files from the latest working commit or build instead of recreating a nested copied test folder.

## Version And Build

- Current root baseline: `Auto-HUB v1.1.1 / build 111`.
- Keep these in sync when preparing a release: `manifest.json` version, `index.js` `BUILD_TOKEN` and build fingerprint, `index.html` panel title, debug event docs, package folder name, and release report.
- Follow `docs/build-release-guide.md` before creating or updating an install package.
- New source folders, such as `src/core/debug/`, must be included in the package output or UXP initialization can fail.

## Worklog

- Add a short entry to `docs/WORKLOG.md` when a decision or runtime constraint will not be obvious from the diff.
- Especially log UXP-only behavior, package/root mismatch, manual verification gaps, and UX policy decisions for Action slots, Reset/Refresh, save flow, or Debug Mode.
- Do not turn worklog into a full diff copy; record purpose, decision, validation, and remaining work.

## Action Stop Behavior

- For Photoshop action error/popup situations, reliability of stopping is more important than raw batch speed.
- The current test-panel rule is: only move to the next file when action processing clearly succeeds.
- If an action-stage problem is detected, keep the current Photoshop document state as-is.
- Do not auto-save or auto-close documents during an action-stop situation.
- Wait for the panel `Cancel` input before finalizing the batch stop.

## Action Slot Memory

- Remember slot preset state, not just currently loaded catalog values.
- A saved preset should preserve:
- slot order
- selected action set
- selected action
- enabled/disabled state
- Refreshing the action catalog should try to preserve saved slot state whenever possible.
