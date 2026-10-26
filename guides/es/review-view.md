---
id: review-view
title: Revisá un spec con la vista Review
summary: Review contesta la pregunta del gate en cada documento — si los criterios se pueden planear y si el plan los cubre a todos.
track: howto
order: 3
area: specs
minutes: 4
goto: spec:plan
---

**Review** es uno de los botones de vista arriba de cada documento del spec, al lado de **Source**, **Cards** y **Edit**. Todo documento que tenga un `SHALL` abre ahí por defecto. A cada archivo le hace una pregunta distinta.

## En requirements.md

1. Abrí la etapa **Requirements** y elegí **Review**. La línea de arriba dice **Ready to plan**.
2. A la izquierda están las historias de usuario, cada una con cuántos criterios tiene. Una historia con **no criteria** es una que nada va a testear, así que Build la va a dejar caer sin avisar.
3. Hacé click en una historia para ver solo los criterios que la contestan, o en un criterio para revisarlo. Cada uno se clasifica por su forma EARS (WHEN / THEN, WHILE / SHALL, IF / THEN, WHERE / SHALL) o se marca **not EARS**, y palabras como "fast", "intuitive" o "robust" se marcan como imposibles de testear.
4. Apretá **Needs a look** para ver solo los marcados: no EARS, no testeables o sin historia.

## En plan.md

1. Abrí la pestaña `plan.md` y elegí **Review**. La línea **Coverage** cuenta los criterios confirmados, inferidos y sin cubrir.
2. Hacé click en un criterio de la izquierda. Se iluminan las secciones del plan que lo satisfacen, y la tarjeta lista sus secciones (**plan**), sus **tasks** y sus **files**. Click en un archivo para abrirlo.
3. Usá **Uncovered** para ver los criterios que ninguna tarea alcanza, e **Inferred** para ver las adivinanzas.

## Por qué importa

La cobertura solo queda *confirmada* cuando el plan escribe el id — `AC-3` en una sección o en una línea de tarea. Sin eso, Review empareja por vocabulario compartido, que es adivinar y puede salir mal. Si el plan no cita nada, **Improve with Claude** agrega las citas `AC-n` que faltan en las secciones y tareas que ya los cumplen.
