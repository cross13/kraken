---
id: code-review-branch
title: Revisá la rama de tu spec
summary: Que el code reviewer lea el diff de la rama antes del PR, lo contraste con los criterios del spec y arregles hallazgo por hallazgo.
track: howto
order: 1
area: ship
minutes: 4
goto: spec:build
---

Una revisión de solo lectura de todo lo commiteado en la rama del spec, contrastada con sus requirements y su plan, antes de que nadie más vea el pull request.

1. Terminá las tareas. La pestaña **Ship** dentro de Build aparece recién cuando el spec está en `done`, y eso pasa solo cuando se completa la última tarea.
2. Commiteá primero. La review lee el diff commiteado de la rama contra su base — el mismo rango que va a mostrar el PR —, así que lo que no commiteaste no entra. Si no hay nada commiteado, te dice "Nothing committed on this branch yet".
3. En el panel **Code review**, apretá **Review changes**. El run va al agente `code-reviewer` y aparece en Activity como cualquier otro. Con **Reviewing… stop** lo cancelás.
4. Leé el resumen y los hallazgos, ordenados **Blocker**, **Major**, **Minor**, **Nit**. Cada uno dice archivo y línea.
5. Usá **Open file** para leer el código, o **Fix with Claude** para mandarle ese hallazgo, y solo ese, al Assistant. El prompt le pide a Claude que lea el código primero y que avise si el hallazgo está mal.
6. Si volvés a commitear, el panel marca la review como **stale — new commits since**. Apretá **Re-review** para una nueva.

El resultado queda en `.octo/specs/<id>/review.md`, así que sobrevive a un reinicio y viaja con el spec.

## Tip

La review es orientativa. Nunca bloquea **Create pull request**: el composer del PR solo te avisa **Not reviewed yet** o cuántos blockers encontró la última. El reviewer corre con herramientas de solo lectura (Read, Glob, Grep), así que arreglar algo siempre es un paso aparte y explícito.
