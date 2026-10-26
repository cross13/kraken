---
id: waves-concurrency
title: Corré waves en paralelo sin que se pisen
summary: Las tareas de una wave corren a la vez como agentes separados — mantenelas disjuntas, definí cuántas van juntas y sabé qué frena una falla.
track: howto
order: 2
area: build
minutes: 4
goto: activity:runs
---

Una wave es un grupo de tareas bajo un mismo título `## Wave n` o `### Wave n`. Sus tareas corren al mismo tiempo, hasta el límite de paralelismo que ves abajo, cada una como su propio run de Claude, y una wave recién se puede correr cuando todas las tareas de las waves anteriores están hechas.

1. Antes de correr nada, leé las waves en **Build › Task list**. Dos tareas de la misma wave que tocan el mismo archivo se van a pisar. Pasá una a la wave siguiente o juntalas en una sola tarea. Una tarea también puede esperar a otra con `(depends on T2)` en su línea.
2. Definí cuántas tareas corren a la vez: el control **parallel** − / + en el encabezado de Build, o **Max parallel agents** en **Activity › Runs**. Es el mismo ajuste, de 1 a 8, y queda guardado. Solo los runs de tareas ocupan lugar; el chat y los borradores de spec no.
3. Apretá **Run wave** en una wave, o **Run all** para correr todas las que quedan, en orden.
4. Seguí todo en **Activity › Runs**: cada run con su tiempo, **N / M slots in use**, un cancel por run y **Stop all**.

## Cuando una tarea falla

El resto de su wave sigue corriendo. Pero la wave siguiente queda bloqueada, porque la tarea fallida no está tildada, y los hooks `wave-complete` de esa wave no se disparan. **Run all** se detiene después de la tanda que falló. Arreglalo y volvé a correr; las tareas tildadas se saltean.

## Hooks bloqueantes

Entre wave y wave, **Run all** dispara los hooks `wave-complete`. Si uno está marcado **Blocking (autopilot waits for it)** en su editor — el `code-validate-improve` incluido lo está — la wave siguiente lo espera. Un aviso lo indica, con **Unblock** para cancelar el hook y seguir, y **Stop autopilot** para frenar todo.
