---
id: models
title: Choose your models
summary: Pick the model every run uses, an optional planning model for drafting, and read where each model in the list came from.
track: howto
order: 1
area: setup
minutes: 3
goto: library:settings
---

You set which Claude model runs your work, and optionally a second one for the thinking-heavy steps.

1. Open **Library › Settings** and find **Model**. The list is discovered, not hardcoded. Press the refresh icon beside the heading to detect again; discovery also reruns when you switch workspace or save or clear an API key.
2. Read the chip on each row, which says how Octo knows about that model:
   - **your account** — returned by the Anthropic Models API for your stored key.
   - **local config** — named in your Claude Code settings (`~/.claude/settings.json`, the workspace's `.claude/settings.json` or `settings.local.json`) or in `$ANTHROPIC_MODEL`. This is how aliases the catalog does not know show up.
   - **not verified** — an id from Octo's bundled catalog. It probably exists; nobody has checked that you can reach it.
3. Pick one. On **Local Claude** it is passed to the CLI as `--model`, and aliases the CLI understands, like `opus` and `sonnet`, also work.
4. Under **Planning model**, leave **Same as default** or pick a second model. It is used for drafting requirements, the plan and tasks, and for audits. Task execution always uses the model above.

## Why there is no "test this model" button

The CLI can only check a model id by starting a real run. A wrong id fails quickly and costs nothing, but a right one is a live, billable request. Probing every catalog entry would spend your credits just to fill a dropdown, so without an API key you get your local config plus the catalog, honestly marked **not verified**. A stored API key is the one way to see the list your account can actually reach.
