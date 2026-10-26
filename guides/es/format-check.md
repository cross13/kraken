---
id: format-check
title: Leé el format check antes de aprobar
summary: La tira arriba del gate lista lo que Octo no puede parsear del documento, lo separa en fixable y judgement, y no cuesta nada.
track: howto
order: 6
area: specs
minutes: 2
goto: spec:define
---

Octo parsea los documentos del spec, no solo los muestra. Un id de tarea en negrita es una tarea que el runner nunca ve; un criterio sin `SHALL` nunca llega a la vista Review. El format check los atrapa mientras trabajás.

1. Abrí un documento del spec. Si algo está mal, aparece una tira justo arriba de la barra del gate: **N formatting issues Octo can't parse**. Si no hay tira, no hay nada que reportar.
2. Hacé click para ver la lista. Cada hallazgo viene etiquetado:
   - **fixable** — hay una sola respuesta correcta. Un criterio sin id `AC-n`, una historia sin `US-n`, una línea de tarea como `- [ ] **T1**: …`, un plan sin `## Tasks` o sin el título `## Critical Decisions`, una ruta de archivo en una tabla fuera de backticks, un plan que no cita ningún `AC-n`.
   - **judgement** — lo tenés que decidir vos. Un criterio que no está en forma EARS, palabras no testeables como "fast" o "intuitive", una historia que nada testea, un criterio que no contesta ninguna historia, una tarea que depende de un id que ninguna tarea define.
3. Apretá **Fix with Claude** para pasarle la lista a Claude como una revisión puntual. Los fixable van como instrucciones para aplicar en el lugar; los de judgement van también, marcados como que requieren criterio. El botón solo aparece si hay al menos un hallazgo fixable.
4. O arreglalo vos en **Edit** (`⌘E`). La tira se actualiza mientras escribís.

## Por qué importa

No cuesta nada. Cada hallazgo sale de los mismos parsers con los que el resto de la app lee tus documentos, calculado en la ventana — sin run, sin tokens, y no puede inventar una violación. Un solo hallazgo bloquea el gate: un plan sin una sección `## Tasks` usable, porque aprobarlo dejaría Build vacío.
