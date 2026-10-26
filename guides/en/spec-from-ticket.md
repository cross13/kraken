---
id: spec-from-ticket
title: Start a spec from a ticket
summary: Pick open work from Home's Entrada pane, read it without creating anything, and send it to Requirements or straight to Build.
track: howto
order: 2
area: tickets
minutes: 3
goto: home
---

A spec whose brief is the ticket somebody already wrote, linked to that ticket from the moment it exists.

1. Connect a tracker and turn its sync on first. Home shows the **Entrada** pane only when at least one tracker is enabled.
2. Entrada has one lane per tracker, each with its own mark, listing open tickets. Tickets that already have a spec sit in the **Ya con spec** lane, collapsed by default; clicking one opens its spec.
3. To read a ticket without starting anything, press the eye button on the right of its row. The slide-over shows the description, any plan already on the ticket, criteria and comments. Reading creates nothing.
4. To start, click the row itself. That arms it: the board header shows the ticket and **Cancelar (Esc)**, and two columns light up.
   - **Requirements** → **Plan**: creates the spec, seeds its documents from the ticket and stops at every approval.
   - **Build** → **Plan rápido**: drafts requirements and plan back to back with no stops, landing ready to run.
   The Plan column never lights up — a spec cannot start in the middle. The slide-over has the same two buttons.
5. As the spec moves — plan approved, branch created, PR opened, tasks done — the **Tracker** panel in the spec's side panel and in Ship lists what the ticket is owed. Expand one to see the exact tool call and its arguments, then press **Send to the tracker**.

## Why it matters

Nothing is written to a board your team shares until you have seen the literal call. What is pending comes from the spec's own state, so closing the app loses nothing and nothing is sent twice.
