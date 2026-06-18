# Auto-HUB Agent Guide

## Project Docs

- Worklog rules: `docs/WORKLOG_GUIDE.md`
- Current worklog: `docs/WORKLOG.md`
- Build/release/version rules: `docs/build-release-guide.md`
- Release report template: `docs/release-report-template.md`
- Debug Mode plan: `docs/추가작업/debug-mode-plan.md`
- Action catalog refresh plan: `docs/추가작업/action-catalog-refresh-plan.md`
- Common improvement backlog: `docs/추가작업/project-wide-improvements.md`

## Source Of Truth

- Repository root is the editing source of truth.
- `merged/*` folders are install/package outputs.
- Before diagnosing a Photoshop panel issue, confirm whether UXP Developer Tool is loading the repository root or a `merged/Auto-HUB_*` package.
- If the loaded target is a `merged/*` package, root source changes will not appear until the package is synced.

## Version And Build

- Current root baseline: `Auto-HUB v1.1.1 / build 111`.
- Keep these in sync when preparing a release:
  - `manifest.json` version
  - `index.js` `BUILD_TOKEN`
  - `index.js` build fingerprint
  - `index.html` panel title
  - debug event docs target build
  - package folder name
  - release report
- Follow `docs/build-release-guide.md` before creating or updating an install package.
- New source folders, such as `src/core/debug/`, must be included in package output or UXP initialization can fail.

## Worklog

- Add a short entry to `docs/WORKLOG.md` when a decision or runtime constraint will not be obvious from the diff.
- Especially log UXP-only behavior, package/root mismatch, manual verification gaps, and UX policy decisions for Action slots, Reset/Refresh, save flow, or Debug Mode.
- Do not turn worklog into a full diff copy; record purpose, decision, validation, and remaining work.

## Validation

- Use `node --check` for changed JavaScript files when possible.
- For release/package work, follow the checklist in `docs/build-release-guide.md`.
- UXP-specific behavior must be confirmed in Photoshop when the change affects panel rendering, action catalog, file dialogs, or execution flow.

## Safety

- Do not treat `merged/*` as the editable source unless the user explicitly asks to patch a package output.
- Do not delete user presets, settings, or package backups unless explicitly requested.
- Preserve existing user changes in the working tree.
