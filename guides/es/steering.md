---
id: steering
title: Contale a Claude qué es este proyecto
summary: Escribí el steering una vez y cada run — chat, borradores, tareas, hooks — arranca sabiendo tu stack y tus convenciones.
track: howto
order: 1
area: library
minutes: 6
goto: library:steering
check: steering
---

Los docs de steering son archivos markdown en `.octo/steering/` que se anteponen al system prompt de cada run: chat, borradores de spec, ejecución de tareas y hooks. Tu stack, tus comandos y tus convenciones se escriben ahí una vez, no en cada prompt.

1. Abrí **Library › Steering**. Si no hay ningún doc, apretá **Seed defaults**: crea `product.md`, `tech.md` y `structure.md`, los tres en **Always**.
2. Completalos. Los scaffolds son títulos y bullets `- **Label**:` vacíos, y Quick Start no los da por hechos hasta que digan algo más que eso.
3. Para todo lo demás, apretá **New doc**, poné un **Name**, una **Description** de una línea y elegí **When it's injected**:
   - **Always** — en todos los runs. Que sean cortos: cuestan tokens en cada llamada.
   - **On matching files** — pide un **File glob** como `src/**/*.tsx`. Solo entra cuando al run le pasan rutas que coinciden, y hoy eso pasa con los hooks disparados al guardar un archivo.
   - **Manual** — solo si está pineado.
   - **Auto (menu)** — al prompt van solo el nombre y la descripción, como una línea de menú. El cuerpo no.
4. Elegí scope **Project** o **Global**. Los globales viven en `~/.octo/steering/` y aplican a todos los workspaces.
5. Para meter un doc que no es Always en todos los runs por un rato, abrilo y apretá **Pin to runs**. Los pins se guardan por workspace; **Unpin** cuando termines.
6. Abrí la pestaña **Injection preview** para ver el bloque exacto que recibiría un run. Si tenés un doc **On matching files**, escribí una ruta en el campo de simulación para probar el glob.

Tu `CLAUDE.md` y tu `AGENTS.md` de la raíz aparecen en la lista como docs de solo lectura que siempre se inyectan. Se editan con **Open file**, no acá.

## Por qué importa

Es lo único que llega a todos los runs. Un buen agente o skill solo aplica cuando lo eligen; el steering está aunque el routing haya errado, así que es la forma más barata de que Claude deje de adivinar tu comando de tests.
