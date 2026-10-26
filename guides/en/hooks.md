---
id: hooks
title: Run Claude automatically on app events
summary: Hooks are JSON rules in .octo/hooks/ that start a Claude run or a shell command when a spec, task or wave changes state.
track: howto
order: 4
area: library
minutes: 5
goto: library:hooks
---

A hook is a JSON file in `.octo/hooks/` (or `~/.octo/hooks/` for every workspace; the project copy wins on the same id). When its event happens, it asks Claude to do something, or runs a shell command. Claude runs show up in History like any other.

1. Open **Library › Hooks** and press **Seed defaults**. You get three:
   - **Validate & improve code** — `wave-complete`, blocking, runs `code-reviewer` to typecheck and apply safe fixes.
   - **Update CHANGELOG & docs** — `spec-done`.
   - **Audit document format on advance** — `spec-advance`, shipped disabled.
2. Pick a trigger. `spec-advance` (a spec moves to its next phase), `spec-done`, `task-complete`, `wave-complete`, `file-save-in-app` (a spec file saved in the app, with an optional **File glob**), or `manual` (only when you press **Run now**).
3. Press **New hook**, or **Generate** to describe one in plain language and let Claude write the JSON. In the editor set **Title**, **Trigger**, **Action** (**Ask Claude** or **Run command**), an optional **Agent** and the **Instructions**, then **Save**. The file looks like this:

   ```json
   {
     "id": "run-tests",
     "title": "Run the tests",
     "trigger": "wave-complete",
     "enabled": true,
     "blocking": true,
     "actionType": "run-command",
     "command": "npm test"
   }
   ```

4. Tick **Blocking (autopilot waits for it)** on a `wave-complete` hook when **Run all** should not start the next wave until the hook is done. Non-blocking hooks run in the background.
5. Toggle a hook on and off from its card, run it with the play button, or double-click to edit.

## Loops

A hook can't feed itself. `file-save-in-app` fires on saves made in the app's editor, which autosaves as you type, and hook runs write through the CLI instead, so a hook's own edits never retrigger it. On top of that, each hook has a four-second cooldown between fires.
