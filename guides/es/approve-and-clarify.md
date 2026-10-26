---
id: approve-and-clarify
title: Revisá los requirements y aclará el plan
summary: Leé los requirements, corregí lo que marca el chequeo de formato, aprobá, contestá las preguntas del plan y aprobalo.
track: start
order: 4
area: specs
minutes: 8
goto: spec:plan
check: spec
---

Pasás de un `requirements.md` redactado a un `plan.md` aprobado y un `tasks.md` derivado de él, decidiendo vos lo abierto en vez de dejar que Claude adivine.

1. Leé los requirements. El control de la barra de herramientas alterna entre **Source** (el markdown con números de línea), **Cards** (una tarjeta por sección), **Review** y **Edit**; `⌘E` entra y sale de la edición. **Review** agrupa cada criterio bajo la user story que responde y marca los que no están en forma EARS o no se pueden testear.
2. Si arriba de la barra de aprobación aparece una franja con **formatting issues Octo can't parse**, abrila. Lo marcado `fixable` tiene una sola respuesta correcta, y **Fix with Claude** se lo pasa como revisión; lo marcado `judgement` lo decidís vos.
3. Usá la barra de aprobación. **Revise with feedback…** toma una oración y vuelve a redactar; **Improve with Claude** hace una revisión crítica y mejora el documento en el lugar; **Approve requirements → Plan** avanza la fase.
4. Caés en la pestaña **Clarify** de la etapa Plan. Si está vacía, tocá **Find open decisions**. Cada pregunta es una tarjeta con opciones: hacé clic en una, apretá `1`–`9` para contestar la primera pregunta sin respuesta, usá **Other…** para escribir la tuya, o **Ask Claude** para que te recomiende.
5. Tocá **Apply N decisions → Plan** (N es cuántas contestaste). Las respuestas se escriben en los requirements como `## Resolved Decisions`, y si `plan.md` sigue vacío se redacta el plan. **Skip to plan** te lleva directo al documento.
6. Revisá `plan.md` en **Review**: cada criterio de aceptación aparece al lado de las partes del plan que lo cumplen. Después tocá **Approve plan → Build**.

## Por qué importa

Aprobar el plan escribe `tasks.md` a partir de su sección `## Tasks`. Un plan sin esa sección no se puede aprobar, y la barra te lo dice; **Improve with Claude** le agrega las waves. Si un plan redactado desde otro lado se topa con una decisión sin resolver, escribe sus preguntas y frena, y eso te manda de vuelta a **Clarify**.

**Siguiente:** Corré las tareas y hacé ship
