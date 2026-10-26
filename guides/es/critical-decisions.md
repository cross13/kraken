---
id: critical-decisions
title: Leé las Critical Decisions que el build deja en el plan
summary: Cuando una tarea se tiene que desviar del plan, anota la decisión en plan.md — dónde encontrar esas entradas y qué hacer con ellas.
track: howto
order: 3
area: build
minutes: 3
goto: spec:plan
---

El plan se escribe antes que el código, y el código siempre aprende algo que el plan no sabía. En vez de dejar que se separen sin avisar, cada run de tarea tiene una instrucción: si te desviaste de `plan.md`, o tomaste una decisión que el plan no cubre, dejala escrita ahí.

## Qué escribe una tarea

Al final de `plan.md`, bajo `## Critical Decisions`, agrega una entrada así:

```
### Critical Decision — T3: Store the ledger per workspace
- **What**: keyed the version by workspace root, not globally.
- **Why**: a global key upgrades one workspace and silently skips the rest.
- **Affects**: the Affected files row for electron/main.ts.
```

Qué decidió, por qué, y qué archivos o tareas posteriores toca. Una tarea que siguió el plan no agrega nada, y ninguna tarea reescribe la sección `## Tasks` del plan. Refinar una tarea terminada con feedback sigue la misma regla.

## Cómo leerlas

1. Abrí la pestaña `plan.md` del spec y bajá hasta el final, o usá el índice **CONTENTS** de Zen (`⌘⇧Z`) para saltar a **Critical Decisions**.
2. Para cada entrada, leé la sección del plan que contradice. Si el plan ahora está mal, arreglá esa sección — a mano (`⌘E`) o con **Revise with feedback…** — así el próximo que lo lea no tiene que reconciliar las dos cosas.
3. Mirá **Affects**. La decisión que cambia una tarea posterior es la que hay que agarrar antes de que esa tarea corra.
4. Corré **Audit for drift** desde el menú **More actions** (`⋯`): `spec-doctor` marca las entradas que contradicen el plan de arriba, y las desviaciones que ve en el código y nadie anotó.

## Tip

Dejá el título `## Critical Decisions` al final del plan aunque esté vacío. El format check marca un plan que no lo tiene, y agregarlo es una de las cosas que hace **Fix with Claude**.
