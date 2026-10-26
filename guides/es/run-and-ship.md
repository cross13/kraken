---
id: run-and-ship
title: Corré las tareas y hacé ship
summary: Corré las tareas del plan wave por wave, o todas juntas con autopilot, y después commiteá y abrí un PR desde Ship.
track: start
order: 5
area: build
minutes: 10
goto: spec:build
---

Convertís `tasks.md` en código, y después lo commiteás y abrís un pull request sin salir del spec.

1. Abrí la etapa Build en **Task list**. Las tareas están agrupadas en waves; el encabezado muestra cuántas van hechas y en qué wave estás. **tasks.md**, al lado, es la misma lista como documento editable.
2. Corré una tarea con **Start task** en su tarjeta, una wave entera con **Run wave**, o la próxima tarea que se pueda correr con **Run next**. Todas las tareas de una wave corren al mismo tiempo, cada una como su propio run de Claude, hasta el número de **parallel** del encabezado (de 1 a 8).
3. O tocá **Run all**. El autopilot corre todas las waves que quedan en orden y espera a los hooks bloqueantes entre wave y wave; el hook de code review que viene incluido es uno. **Unblock** cancela un hook que te está frenando, **Stop autopilot** para todo.
4. Cuando termina la última tarea, el spec pasa solo a `done` y se abre la pestaña **Ship**. La primera vez que llegás escribe un resumen del trabajo en `summary.md`; **Regenerate** lo vuelve a escribir.
5. Si estás en `main` o `master`, tocá primero **Create branch …**. Después **Commit all** agrega todo y commitea con un mensaje sacado del resumen. Si hay un remote `origin`, el botón dice **Commit all & push**.
6. Con `origin` y el GitHub CLI logueado, la sección de pull request arma un título y un cuerpo a partir de la rama. Editalos y tocá **Create pull request**. Octo usa tu `gh` local, así que el PR sale a nombre de quien esté logueado con `gh auth login`, y la app no guarda ningún token de GitHub.

## Tip

Que las tareas de una misma wave toquen archivos distintos. Corren a la vez, y dos agentes editando el mismo archivo se pisan. Si el plan las junta, pasá una a la wave siguiente antes de tocar **Run all**. Si más adelante el código se desvía del spec, **Reopen tasks** en Ship devuelve el spec a Build.
