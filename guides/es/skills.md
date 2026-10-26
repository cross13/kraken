---
id: skills
title: Usá skills, y que valgan lo que cuestan
summary: Las skills se pegan enteras en el system prompt. Sabé cuándo entra cada una y cómo sacar las que no ayudan.
track: howto
order: 3
area: library
minutes: 5
goto: library:skills
---

Una skill es un `SKILL.md` en `.claude/skills/<name>/` (o en `~/.claude/skills/`, para todos los workspaces). Cuando se elige, su cuerpo entero se antepone al system prompt. No es una etiqueta: es parte de lo que Claude lee.

1. Abrí **Library › Skills**. **Seed defaults** instala las que vienen con la app; **New skill** te arma una propia con **Name** y **Description (when it applies)**.
2. Entendé cómo entra cada una:
   - **Skill SDD** — `sdd-feature` o `sdd-bugfix`, según el tipo de spec. Se inyecta en cada run de borrador y de tarea de ese tipo.
   - **Skills de formato** — `spec-requirements-format`, `spec-plan-format`, `spec-tasks-format`, `spec-bugfix-format`. Llevan la forma exacta del documento que la app parsea y entran cada vez que se escribe ese documento. Los runs de tareas reciben la de tasks.
   - **Match de dominio** — en un run de tarea, la skill cuyo nombre y descripción mejor coinciden con el texto de la tarea, pero solo si suma al menos dos keywords. Al hacer el borrador del plan, las skills detectadas aparecen como chips al lado del botón de draft; clickeá una para dejarla afuera de ese borrador.
   - **Chat** — en el Assistant (`⌘J`), empezá el mensaje con `/nombre-de-skill` y el cuerpo de esa skill se inyecta para ese mensaje.
3. Tratá el cuerpo como un costo. Se manda en cada run que matchea. Sacá lo que Claude ya sabe y dejá lo que es propio de este proyecto.
4. Para que una skill no se inyecte sola, abrila y clickeá **Injection on** hasta que diga **Injection off**. A partir de ahí se saltea, salvo que un run la nombre explícitamente.
5. Para apagar toda la inyección automática, andá a **Library › Routing › Advanced** y desactivá **Auto-inject matching skills**. Sin las skills de formato, los borradores se alejan de la forma que la app puede leer.

## Tip

Abrí **Quick start guide** desde `⌘K` y bajá hasta **Sharpen your own skills**. Cada skill tuya (no las `sdd-` y `spec-` que vienen con la app) tiene un botón **Review & improve**: Claude la revisa contra este repositorio, la reescribe en el lugar y te avisa si conviene borrarla.
