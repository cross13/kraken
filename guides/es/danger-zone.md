---
id: danger-zone
title: Empezá de cero con la Danger zone
summary: Borrá de una todos los specs en disco y el historial de runs, sin tocar tu configuración, tus keys ni tu librería.
track: howto
order: 2
area: setup
minutes: 2
goto: library:settings
---

Barrés lo que produjo el loop SDD hasta ahora y te quedás con tu setup. Nada de esto se puede deshacer. Para borrar un solo spec, usá el menú `⋯` de su tarjeta en Home.

1. Abrí **Library › Settings** con el proyecto abierto y bajá hasta **Danger zone**, al final. Solo aparece si hay un proyecto abierto.
2. Elegí qué se va. Los dos switches arrancan prendidos y cada uno muestra los números reales de este proyecto:
   - **Spec files** — cada carpeta de spec bajo `.octo/specs/`, borrada del disco. Las carpetas que hayan quedado en un `.kraken/specs/` viejo entran también y se cuentan aparte.
   - **History database** — runs, eventos de fase, runs de hooks, archivos tocados y errores. Elegí **This project** o **Every project**; lo segundo borra el historial de todos los workspaces, no solo de este.
3. Primero frená lo que esté corriendo. Mientras haya un run activo, el panel te lo avisa y te manda a **Activity › Runs**, y la app rechaza el reset igual.
4. Escribí `RESET` en el campo y tocá **Delete permanently**. Una línea te confirma cuántas carpetas de spec y filas de historial se borraron.

## Lo que nunca toca

Tu configuración, tu API key, los agentes, skills, hooks y steering quedan exactamente donde estaban, porque perder eso es perder tu setup, no tu desorden. Tu código tampoco se toca: solo se borran las carpetas de los specs, así que lo que una tarea ya cambió en el repositorio se queda, esté commiteado o no.
