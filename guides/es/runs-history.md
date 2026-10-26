---
id: runs-history
title: Mirá, frená y revisá los runs
summary: Activity muestra cada run en curso con su botón para cancelar, el único control de concurrencia y el historial de todo lo que ya corrió.
track: howto
order: 1
area: activity
minutes: 3
goto: activity:runs
---

Un solo lugar para "qué está haciendo Claude ahora" y "qué hizo". Todo run cae acá: chat, redacción de specs, tareas, reviews, auditorías y hooks.

1. Abrí **Activity › Runs**, o hacé clic en la píldora de runs en vivo de la command bar cuando hay algo corriendo. La franja de arriba dice **Idle** o cuántos agentes están corriendo, y cuántos slots están ocupados.
2. Cada tarjeta bajo **Running** muestra el tipo (**Task**, **Spec**, **Review**…), el id de la tarea, el agente, el spec y el tiempo transcurrido. La **×** de una tarjeta cancela ese run; **Stop all** los cancela todos.
3. **Max parallel agents** (de 1 a 8) limita cuántas tareas de una wave corren a la vez. El chat y la redacción de specs no cuentan. Es el mismo control que está en el board de tareas.
4. **Recent activity** lista los runs que terminaron en esta sesión, con estado y duración. El ícono de la papelera la limpia.
5. **Activity › History** es el registro permanente de la base de historial: totales, errores, cancelados y duración promedio, con filtro **all**, **done**, **error** o **cancelled**. Hacé clic en una fila para abrir el run con su prompt y su respuesta completos.
6. **Activity › Specs** son los mismos datos por spec: runs, tasa de error y tiempo invertido, un pipeline de dónde está cada spec y, para cada uno, sus runs recientes y la línea de tiempo de avances de fase.

## Tip

Si una wave parece trabada, mirá Runs antes que nada. Una tarea esperando slot no es una tarea fallada, y subir **Max parallel agents** lo resuelve en un clic cuando el trabajo de verdad es independiente.
