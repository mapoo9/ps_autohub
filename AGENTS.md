# Auto-HUB Agent Guide

Photoshop UXP panel `Auto-HUB` project instructions for Codex and other agents. `CLAUDE.md` is maintained separately for Claude Code; when updating both files, keep the facts aligned.

## Working Principles

1. **Think Before Coding** - Do not guess. State assumptions, and when a request is ambiguous, present the possible interpretations and ask instead of silently choosing one. If a simpler path exists, say so. If something is unclear, name what is unclear and confirm it.
2. **Simplicity First** - Write only the minimum code needed to solve the problem. Do not add unrequested features, abstractions, flexibility, or speculative error handling. If 200 lines can become 50, rewrite it. Use the test: "Would a senior engineer call this too much?"
3. **Surgical Changes** - Touch only what is necessary. Do not opportunistically improve adjacent code, comments, or formatting. Follow the existing style. Do not refactor code that is not broken. Remove unused imports, variables, or functions only when your own change created them; mention pre-existing dead code but do not delete it. Every changed line should connect directly to the request.

## Project Docs

- Build/release/version rules: `docs/build-release-guide.md`
- UXP panel build format guide (`.ccx`/sideload): `../공통/docs/uxp/uxp-panel-build-guide.md`
- Release report template: `docs/release-report-template.md`
- Worklog rules: `docs/WORKLOG_GUIDE.md`
- Current worklog: `docs/WORKLOG.md`
- Debug Mode plan: `docs/추가작업/debug-mode-plan.md`
- Action catalog refresh plan: `docs/추가작업/action-catalog-refresh-plan.md`
- Common improvement backlog: `docs/추가작업/project-wide-improvements.md`

## Source Of Truth

- Repository root is the editing source of truth and the default target for Photoshop UXP development testing.
- `dist/*` folders are install/release outputs, not the editable source of truth.
- Before diagnosing a Photoshop panel issue, confirm whether UXP Developer Tool is loading the repository root or a `dist/Auto-HUB_*` package.
- If the loaded target is a `dist/*` package, root source changes will not appear in the panel until the package is synced.
- If testing breaks badly, do not create nested copied test folders. Restore root panel files from the latest known-good commit or build.

## Version And Build

- Current root baseline: `Auto-HUB v1.1.6 / build 007` (internal token `v1.1.6-build007`).
- Build outputs live under repository-root `dist/`.
- Package folders use `dist/Auto-HUB_vX.Y.Z_buildNNN`, and zip files use the same name with `.zip`.
- Keep old install packages under `dist/old backup/`.
- Current install format is sideload: folder/zip plus UXP Developer Tool `Add Plugin`.
- Do not create `.ccx` packages now. Add a `.ccx` step only if double-click installation for general users becomes necessary.
- Keep these in sync when preparing a release:
  - `manifest.json` `version`
  - `index.js` header comment, `BUILD_TOKEN`, `BUILD_FINGERPRINT.appVersion`, and `BUILD_FINGERPRINT.packageBuildId`
  - `index.html` panel title, showing the app version only
  - `docs/추가작업/debug-log-events.md` target build
  - package folder name and zip file name
  - `RELEASE_REPORT.md`
- Follow `docs/build-release-guide.md` before creating or updating an install package.
- New source folders, such as `src/core/debug/`, must be included in package output or UXP initialization can fail.

## Validation

- Use `node --check` for changed JavaScript files when possible.
- Confirm `manifest.json` still parses as JSON when it changes.
- For release/package work, follow the checklist in `docs/build-release-guide.md`.
- UXP-specific behavior must be confirmed in Photoshop when the change affects panel rendering, action catalog, file dialogs, or execution flow.

## Worklog

- Add a short entry to `docs/WORKLOG.md` when a decision or runtime constraint will not be obvious from the diff.
- Especially log UXP-only behavior, package/root mismatch, manual verification gaps, and UX policy decisions for Action slots, Reset/Refresh, save flow, or Debug Mode.
- Do not turn the worklog into a full diff copy; record purpose, decision, validation, and remaining work.

## Action Stop Behavior

- For Photoshop action errors or popup states, reliable stopping is more important than batch speed.
- Current rule: continue to the next file only when action processing clearly succeeded.
- When an action-step problem is detected, leave the current Photoshop document state intact.
- Do not auto-save or auto-close documents during action stop states.
- Wait for panel `Cancel` input before confirming batch stop.

## Action Slot Memory

- Remember slot preset state as well as the currently loaded catalog values.
- Saved presets must preserve slot order, selected action set, selected action, and enabled/disabled state.
- Preserve saved slot state as much as possible when refreshing the action catalog.

## Commits

- When one coherent work item is complete, automatically update `docs/WORKLOG.md` and create a commit without waiting for a separate instruction.
- Commit by work item, not by individual file. Do not mix unrelated purposes in one commit.
- Before committing, run available static validation such as `node --check`; if validation is skipped, record why.
- Do not push automatically. Push only when explicitly requested.
- Detailed rules: `docs/WORKLOG_GUIDE.md` and common `../공통/docs/WORKLOG_GUIDE.md`.

## Safety

- Do not treat `dist/*` as the editable source unless the user explicitly asks to patch package output.
- Do not delete user presets, settings, or package backups unless explicitly requested.
- Preserve existing user changes in the working tree.
