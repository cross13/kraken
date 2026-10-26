---
id: hooks
title: Hacé que Claude corra solo con eventos de la app
summary: Los hooks son reglas JSON en .octo/hooks/ que arrancan un run de Claude o un comando cuando cambia una spec, una tarea o un wave.
track: howto
order: 4
area: library
minutes: 5
goto: library:hooks
---

Un hook es un archivo JSON en `.octo/hooks/` (o en `~/.octo/hooks/` para todos los workspaces; con el mismo id gana el del proyecto). Cuando pasa su evento, le pide algo a Claude o corre un comando de shell. Los runs de Claude aparecen en History como cualquier otro.

1. Abrí **Library › Hooks** y apretá **Seed defaults**. Vienen tres:
   - **Validate & improve code** — `wave-complete`, bloqueante, corre `code-reviewer` para typecheckear y aplicar arreglos seguros.
   - **Update CHANGELOG & docs** — `spec-done`.
   - **Audit document format on advance** — `spec-advance`, viene desactivado.
2. Elegí un trigger. `spec-advance` (una spec pasa a la fase siguiente), `spec-done`, `task-complete`, `wave-complete`, `file-save-in-app` (se guarda un archivo de spec dentro de la app, con un **File glob** opcional) o `manual` (solo cuando apretás **Run now**).
3. Apretá **New hook**, o **Generate** para describirlo en lenguaje natural y que Claude escriba el JSON. En el editor completá **Title**, **Trigger**, **Action** (**Ask Claude** o **Run command**), un **Agent** opcional y las **Instructions**, y después **Save**. El archivo queda así:

   ```json
   {
     "id": "run-tests",
     "title": "Run the tests",
     "trigger": "wave-complete",
     "enabled": true,
     "blocking": true,
     "actionType": "run-command",
     "command": "npm test"
   }
   ```

4. Marcá **Blocking (autopilot waits for it)** en un hook `wave-complete` si **Run all** no tiene que arrancar el wave siguiente hasta que termine el hook. Los que no son bloqueantes corren en segundo plano.
5. Desde la tarjeta podés prender y apagar un hook, correrlo con el botón de play, o hacer doble click para editarlo.

## Loops

Un hook no se puede realimentar. `file-save-in-app` se dispara con lo que se guarda en el editor de la app, que hace autosave mientras escribís, y los runs de hooks escriben por el CLI, así que lo que edita un hook nunca lo vuelve a disparar. Además, cada hook tiene un cooldown de cuatro segundos entre disparos.
