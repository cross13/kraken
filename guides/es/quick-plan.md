---
id: quick-plan
title: Redactá un spec entero de una con Plan rápido
summary: Plan rápido redacta el primer documento y el plan de corrido, sin gates ni preguntas, y te deja en Build.
track: howto
order: 2
area: specs
minutes: 2
goto: home
---

Plan rápido convierte una frase en un spec listo para correr: redacta `requirements.md` (o `bugfix.md`), lo aprueba, redacta `plan.md`, lo aprueba y te deja en **Build** con `tasks.md` derivado del plan.

1. En **Home**, escribí lo que querés en el composer.
2. Apretá **Plan rápido**, o `⌘Enter` en el input. El `Enter` solo es el **Plan** normal, que crea el spec y no corre nada.
3. Seguilo en el Assistant (`⌘J`) o en **Activity › Runs**. Cada documento es un run aparte; si uno falla, la cadena se corta ahí y el spec queda en esa etapa.
4. Cuando llegue a **Build**, leé el plan antes de apretar **Run all**. Nadie más lo leyó.

## Lo que resignás

- **Los gates.** Cada documento se aprueba apenas termina su borrador. También se saltea el chequeo del gate de Plan que exige una sección `## Tasks` usable: si el plan salió sin ella, `tasks.md` cae en un template con tareas de relleno.
- **Clarify.** Un run de plan normal que se topa con una decisión que no puede tomar — una librería, la forma de los datos, una migración — escribe preguntas en Open Questions y se frena para que las contestes. Plan rápido corre sin paradas: elige un default razonable, lo deja anotado en el plan y lista lo que conviene revisar en `## Open Questions`.

## Cuándo usarlo

Cuando ya sabés las respuestas: un cambio chico, un bug bien entendido o un ticket que ya trae plan. En el tablero de Home, soltar un ticket armado en la columna **Build** hace lo mismo a partir del ticket. Si el trabajo tiene una decisión de verdad adentro, usá **Plan** y dejá que Clarify pregunte.
