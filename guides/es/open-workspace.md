---
id: open-workspace
title: Abrí un repositorio e instalá los defaults
summary: Apuntá Octo a tu código, instalá los agentes, skills, steering y hooks que trae, y contale qué es el proyecto.
track: start
order: 2
area: setup
minutes: 5
goto: library:steering
check: library
---

Terminás con un repositorio abierto, la librería de Octo instalada al lado de tu propio `.claude/`, y los tres docs de steering listos para completar.

1. En Home, tocá **Open folder** y elegí el repositorio donde vas a trabajar. Después podés cambiarlo desde el pill del proyecto en la barra de arriba, o con **Change directory…** en **Library › Settings**. Claude corre con esa carpeta como directorio de trabajo, así que ve tu código y tu `CLAUDE.md`. Los agentes y skills que ya tengas en `.claude/` (y en `~/.claude/`) se cargan solos.
2. Si el workspace no tiene agentes, Home muestra un aviso de una línea. Tocá **Instalar defaults** ahí, o **Seed defaults** en cualquiera de **Library › Agents**, **Skills**, **Steering** o **Hooks**. Cualquiera de esos botones instala todo el set:
   - 12 agentes y 7 skills en `.claude/agents/` y `.claude/skills/`
   - 3 scaffolds de steering (`product.md`, `tech.md`, `structure.md`) en `.octo/steering/`
   - 3 hooks en `.octo/hooks/`; dos vienen prendidos, la auditoría de formato no
3. En **Library › Agents**, la línea al lado de **Seed defaults** te dice qué pasó: cuántos se instalaron, cuántos se actualizaron y cuántos se dejaron porque los editaste.
4. Abrí **Library › Steering** y completá los tres docs. Se anteponen a cada run (chat, redacción, tareas y hooks), así que ahí va tu stack, tus comandos y tus convenciones.

## Por qué importa

Sembrar es una actualización, no solo una primera instalación. Si lo corrés de nuevo, reescribe con la versión actual cada archivo que nunca tocaste y deja en paz los que editaste. Abrir un workspace también actualiza así una librería que ya existe, y Home te avisa una vez cuando lo hizo; nunca te instala una que no pediste. Las skills de formato de esa librería son las que hacen que Claude escriba documentos que la app puede parsear.

**Siguiente:** Tu primer spec
