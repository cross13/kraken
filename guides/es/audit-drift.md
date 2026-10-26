---
id: audit-drift
title: Auditá un spec contra el código
summary: Audit for drift pone a spec-doctor a comparar requirements, plan, tareas y el código real, y te dice qué dejó de coincidir.
track: howto
order: 4
area: build
minutes: 3
goto: spec:build
---

Specs y código se separan: una tarea hace un poco más de lo que decía, un criterio nunca tuvo tarea, el plan dice una cosa y `main.ts` hace otra. **Audit for drift** le pide a un agente que encuentre esos huecos y te diga qué fase conviene reabrir.

1. Abrí el spec, en cualquier etapa.
2. Abrí el menú **More actions** (`⋯`, arriba a la derecha del spec) y elegí **Audit for drift**. La pista dice `spec-doctor, read-only`.
3. Se abre el Assistant (`⌘J`) y el run se ve ahí en vivo. También aparece en **Activity › Runs** como `Audit` más el nombre del spec.
4. Leé el reporte. Cubre:
   - criterios de aceptación sin tarea o implementación que les corresponda;
   - tareas o código sin un requirement detrás — scope creep;
   - lugares donde el código contradice el spec, citando `file:line`;
   - una recomendación de qué fase reabrir, si hace falta, y qué cambiar.

   Con el `spec-doctor` incluido además compara `plan.md` contra `tasks.md`, revisa las `## Critical Decisions` del plan contra las secciones de arriba, y lista las Unchanged Behavior sin test de regresión. Bloqueantes y detalles vienen por separado.
5. Actuá. Arreglá un documento a mano o con **Revise with feedback…**; si el código necesita más trabajo, agregá las tareas a `tasks.md` — y si el spec ya está terminado, usá **Reopen tasks (re-sync)**.

## Para saber

La auditoría no cambia nada. El prompt le dice que no edite, y el `spec-doctor` incluido solo tiene `Read`, `Grep` y `Glob`. Si elegiste un agente en el chat con `@`, esa elección también aplica acá; si no, el routing prefiere `spec-doctor` y después `code-reviewer`. Si no está ninguno, instalá los defaults desde **Library › Agents**.
