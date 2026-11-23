---
id: undo-a-run
title: Deshacé lo que hizo un run
summary: Cada run que puede escribir archivos toma primero un punto de control. Restauralo para dejar esos archivos como estaban.
track: howto
order: 5
area: build
minutes: 3
goto: side:changes
---

Antes de cualquier run que puede escribir — una tarea, un borrador, una respuesta del Assistant — Octo toma un **punto de control**: una foto del árbol de trabajo tal como está en ese momento. Cuando lo hace no se mueve nada que puedas ver; la foto queda guardada dentro de git, aparte.

1. Encontrá el run. En el **Assistant**, el punto de control es la línea bajo cada respuesta. En cualquier otro lado, abrí el run: **Run** en un grupo de **Changes**, **View run** en un diff, o una fila de la pestaña **History** del panel de abajo del editor.
2. La línea dice cuántos archivos escribieron los runs desde ese punto de control. Si dice que no se escribió nada, no hay nada que deshacer.
3. Apretá **Restore**. El recuadro lista exactamente los archivos que va a tocar.
4. Leé la lista y apretá **Restore** otra vez. Cada archivo vuelve a lo que tenía antes del run. Un archivo que creó un run se borra.
5. La línea de resultado dice qué se restauró, qué se borró, y qué se dejó como estaba y por qué.

## Qué toca y qué no

- Deshace este run **y todos los runs posteriores** para esos archivos, incluidas las ediciones que les hayas hecho a mano desde entonces.
- Solo toca archivos que escribió un run. Todo lo demás que cambiaste queda exactamente como está.
- Un archivo ignorado por git, como `.env`, nunca entra en un punto de control, así que se deja como está y se informa.
- Necesita un repositorio git y el CLI local de Claude. Los runs de solo lectura, como un code review, no toman punto de control.
- No se puede deshacer. Para deshacer un solo bloque, usá **Revert hunk** en el diff del archivo.
