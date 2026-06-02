# PS-AutoHUB Notes

## PS-autoHUB Test Panel

- Primary panel path: `/Users/kisoon/Documents/0_vibeCoding/PS-AutoHUB`
- Use the repository root as the default Photoshop UXP test target.
- When testing breaks badly, restore the root panel files from the latest working commit or build instead of recreating a nested copied test folder.

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
