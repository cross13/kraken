---
id: reopen-phase
title: Reabrí un spec terminado, y mirá quién corre cada paso
summary: Reopen tasks devuelve a Build un spec terminado cuando el código cambió; el panel lateral muestra qué agente y qué skills usa cada paso.
track: howto
order: 7
area: specs
minutes: 3
goto: spec:build
---

Un spec que llegó a **done** no queda congelado. Si el código se alejó de lo que dice, o aparece un pendiente, lo podés devolver a Build y correr más tareas contra los mismos documentos.

## Reabrir Build

1. Abrí el spec. Los documentos anteriores siguen accesibles desde sus pestañas en cualquier fase; su barra muestra **Continue** en vez de Approve, porque ese gate ya pasó, y lo que edites se guarda igual.
2. Decidí qué tiene que hacer Build. Agregá líneas de tarea, o destildá las que hay que rehacer, en la sub-pestaña **tasks.md** de Build. Hacelo antes: si al reabrir siguen todas tildadas, Build ve la última tarea completa y vuelve derecho a done.
3. Apretá **Reopen tasks** en **Ship**, o **Reopen tasks (re-sync)** desde el menú **More actions** (`⋯`). La fase vuelve a Build y caés en **Task list**.
4. Corré las tareas. Cuando termina la última, el spec vuelve a done y abre **Ship**. El `summary.md` anterior se mantiene; apretá **Regenerate** para que cubra lo nuevo.

Desde la app solo se reabre Build. Para revisar requirements o el plan, editalos en el lugar.

## Mirá quién corre este paso

En cualquier documento, apretá el ícono de panel de la barra (**Show who writes this**). El panel lateral muestra:

- **Who writes this** — el agente que va a elegir el router para este paso, y por qué: **Bundled default**, **Pinned**, **Chat override** o **Best specialist**. Click para abrir el archivo del agente.
- **Instructions it carries** — las skills que se inyectan en el run, etiquetadas **Stages and gates**, **Document shape** o **Domain match**.
- **How it works** — lo que hace el run de verdad, paso por paso.

Es la misma decisión que explica **Library › Routing**, mostrada donde se aplica. El panel necesita una ventana de al menos 1180px de ancho.
