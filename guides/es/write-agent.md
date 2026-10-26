---
id: write-agent
title: Sumá un agente que el router elija
summary: Escribí un agente en .claude/agents cuya descripción gane las tareas de su dominio, y solo esas.
track: howto
order: 2
area: library
minutes: 5
goto: library:agents
---

Un agente es un archivo markdown en `.claude/agents/`, en el formato propio de Claude Code: front matter y después un cuerpo que pasa a ser el system prompt. Para decidir quién corre una tarea, el routing lee exactamente dos campos: `name` y `description`.

1. Abrí **Library › Agents** y apretá **New agent**. Completá **Name** y **Description (when to use it)** y después **Create agent**. Se escribe `.claude/agents/<name>.md`:

   ```markdown
   ---
   name: api-expert
   description: Owns the backend API — REST endpoints, route handlers, middleware and auth.
   tools: Read, Write, Edit, Bash, Grep, Glob
   ---

   # api-expert
   ```

2. Escribí el cuerpo: qué le toca, qué archivos, qué convenciones. No influye en que lo elijan.
3. Escribí la descripción con el vocabulario del router. Las keywords de una tarea salen de una lista fija de dominios — frontend, backend, database, test, devops, docs, security, data — y de las palabras que los delatan (`api`, `endpoint`, `schema`, `tailwind`, …). Una palabra fuera de esa lista, como "Stripe", no suma nunca. Cada keyword que aparece por substring en `name + description` vale un punto.
4. Dejá afuera las palabras genéricas. A las keywords de todas las tareas se les suma un grupo de palabras de implementación (`build`, `code`, `feature`, `app`, `implement`, …). Con dos de esas en tu descripción, el agente supera el umbral de especialista en todas las tareas y le gana de una a `spec-task-executor`. Ojo que `app` también matchea dentro de "approved" y "apply".
5. Los agentes del proyecto ganan. Un agente del workspace tapa a uno global de `~/.claude/agents/` con el mismo nombre y suma un bonus de puntaje sobre los globales.
6. Verificalo. La página del agente muestra **Best for**: los pasos en los que se elegiría solo. Después abrí **Library › Routing**, elegí **Task execution** y escribí una tarea de tu dominio y otra de afuera. Tiene que ganar la primera y no la segunda.

## Tip

Si ya sabés qué agente necesita una tarea, salteate el puntaje: escribí `- [ ] T4 @api-expert: …` en la línea de la tarea. Un `@agent` por tarea le gana a todo lo demás.
