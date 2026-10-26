---
id: revise-improve
title: Revisá, mejorá o editá a mano un documento del spec
summary: Tres formas de cambiar un borrador — pedirle un cambio a Claude, pedirle que se autocritique o escribirlo vos — y cuándo usar cada una.
track: howto
order: 5
area: specs
minutes: 3
goto: spec:define
---

Cuando un documento ya tiene borrador, la barra del gate de abajo ofrece dos acciones con Claude al lado de Approve, y el selector de vista de arriba tiene una tercera: tu teclado.

## Revise with feedback

1. Apretá **Revise with feedback…**. La barra del gate se convierte en un input.
2. Decí qué tiene que cambiar, concreto: "separá el flujo de export en su propia historia", "sacá el modo offline".
3. Apretá `Enter` o **Revise**. Claude aplica cambios puntuales y tiene la instrucción de dejar todo lo demás intacto.

Sirve cuando sabés qué está mal.

## Improve with Claude

Apretá **Improve with Claude**. Es una pasada de autorrevisión: Claude lee el documento como un revisor crítico — criterios que no se pueden testear, historias sin criterios, contradicciones, casos borde que faltan; en el plan, ids `AC-n` sin citar, orden de las waves y rutas de archivo inventadas — y edita en el lugar. Lo que solo vos podés decidir va a `## Open Questions` en vez de adivinarlo. En el chat lista lo que cambió, o dice que el documento ya está sólido.

Sirve cuando sospechás que algo no cierra pero no sabés qué. En la etapa Build, la misma idea es **Improve plan**, que revisa `tasks.md`.

Ninguno de los dos runs se frena a hacer preguntas; los dos vuelven siempre con el documento cambiado o confirmado.

## Editar a mano

Elegí **Edit** en el selector de vista, apretá `⌘E` o hacé doble click sobre el texto en la vista **Source**. `⌘E` de nuevo te devuelve a **Source**. Los cambios se guardan solos mientras escribís.

Sirve para todo lo que arreglás más rápido de lo que tardás en explicarlo: un número, un nombre, una oración. No gasta ningún run.
