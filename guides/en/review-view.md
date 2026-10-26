---
id: review-view
title: Check a spec with the Review view
summary: Review answers the gate question for each document — can these criteria be planned, and does this plan cover every one of them.
track: howto
order: 3
area: specs
minutes: 4
goto: spec:plan
---

**Review** is one of the view buttons above a spec document, beside **Source**, **Cards** and **Edit**. Any document with a `SHALL` in it opens there by default. It asks a different question of each file.

## On requirements.md

1. Open the **Requirements** stage and pick **Review**. The header line reads **Ready to plan**.
2. On the left are the user stories, each with a count of its criteria. A story showing **no criteria** is one nothing will test, so Build will quietly drop it.
3. Click a story to see only the criteria that answer it, or click a criterion to check it. Each one is classified by EARS form (WHEN / THEN, WHILE / SHALL, IF / THEN, WHERE / SHALL) or flagged **not EARS**, and wording like "fast", "intuitive" or "robust" is flagged as untestable.
4. Press **Needs a look** to list only the flagged ones: not EARS, untestable, or answering no story.

## On plan.md

1. Open the `plan.md` tab and pick **Review**. The **Coverage** line counts criteria as confirmed, inferred and uncovered.
2. Click a criterion on the left. The plan sections that satisfy it light up on the right, and the card lists its **plan** sections, **tasks** and **files**. Click a file to open it.
3. Use **Uncovered** to see criteria no task reaches, and **Inferred** to see the guesses.

## Why it matters

Coverage is only *confirmed* when the plan writes the id — `AC-3` in a section or on a task line. Without it, Review matches on shared vocabulary, which is a guess and can be wrong. If the plan cites nothing, **Improve with Claude** adds the missing `AC-n` citations to the sections and tasks that already satisfy them.
