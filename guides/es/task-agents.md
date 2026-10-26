---
id: task-agents
title: Elegí qué agente corre una tarea
summary: Fijá una tarea a un agente con @agent-name en su línea, entendé cómo elige el routing si no lo hacés, y verificá qué corrió.
track: howto
order: 1
area: build
minutes: 3
goto: spec:build
---

Cada tarea corre como su propio agente. Podés nombrar ese agente en la línea de la tarea o dejar que el routing lo elija a partir del texto — y en los dos casos, verificar después qué corrió de verdad.

1. Abrí **Build**, la sub-pestaña **tasks.md**, y apretá `⌘E` para editar.
2. Poné el nombre del agente justo después del id de la tarea: `- [ ] T4 @frontend-expert: agregar el empty state al diálogo de export`. Usá el `name` exacto de un agente en `.claude/agents/` (del workspace o de `~/.claude/agents/`).
3. Volvé a **Task list** y apretá **Start task**, **Run wave** o **Run all**. Un `@agent` por tarea le gana a cualquier otra regla.

## Si no fijás ninguno

El routing va en este orden: el `@agent` de la tarea, después un `@agent` que hayas elegido en el chat, después un pin de **Library › Routing › Advanced**. Si no hay nada de eso, puntúa el nombre y la descripción de cada agente instalado contra el texto de la tarea. Un especialista con match fuerte gana; si no, la corre el `spec-task-executor` incluido; si no, cualquier agente que haya matcheado algo; si no, el primer agente local del proyecto. Claude genérico solo corre cuando no hay nada instalado. Para probar una frase antes de correrla, escribila en **Library › Routing**.

## Verificá qué corrió

Hacé click en una tarea para abrir su inspector. La sección **Agent** muestra **Name**, **Scope** (`root` para el `.claude/` del workspace, `global`, o `not installed`) y **Routing** (por qué lo eligió). **Declared**, en **Task**, muestra el `@agent` que escribiste. Arriba aparece un aviso si el agente no está instalado — `it won't load` — o si el routing cayó en genérico.

## Tip

Un typo en `@agent-name` igual gana el routing; el run simplemente no recibe ninguna instrucción de ese agente. El aviso del inspector es lo que lo detecta.
