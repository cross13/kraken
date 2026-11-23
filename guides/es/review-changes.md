---
id: review-changes
title: Mirá qué cambió, tarea por tarea
summary: Changes lista cada archivo que difiere del último commit bajo la tarea que lo escribió, y abre cada uno como un diff en verde y rojo.
track: howto
order: 4
area: ship
minutes: 4
goto: side:changes
---

Después de un run de build la pregunta es siempre la misma: ¿qué tocó en realidad? **Changes** la contesta sin salir de la app.

1. Apretá el ícono **Changes** en la barra oscura de la izquierda — el que lleva un número. El número es cuántos archivos difieren del último commit.
2. Los archivos se agrupan **By task**: cada grupo es el run que escribió esos archivos por última vez — `T3` con la frase de la tarea y el agente que la corrió, un borrador de plan, el Assistant. Los archivos que no escribió ningún run quedan al final, en **Edited by hand**. Pasá a **By folder** para verlos en el orden del árbol.
3. Apretá **Run** en un grupo para leer el run que lo produjo: prompt, salida y los archivos que tocó.
4. Hacé clic en un archivo para abrir su **diff** contra el último commit, como pestaña. Las líneas agregadas van en verde, las quitadas en rojo, y dentro de una línea cambiada la parte que se movió va un tono más fuerte. Los números al lado de cada archivo son líneas agregadas y quitadas.
5. Elegí **Split** para ver el último commit a la izquierda y tu copia de trabajo a la derecha, o **Unified** para verlos apilados. Las flechas saltan de un cambio al siguiente.
6. La franja bajo la barra nombra el run que escribió el archivo por última vez, con **Open spec** y **View run**. **Open file** muestra el archivo entero.
7. Si el branch tiene un code review, sus hallazgos para este archivo aparecen en el diff, debajo de la línea de la que habla cada uno. Vienen del último review, así que pueden ser más viejos que el código que tienen al lado. **Fix with Claude** en un hallazgo le manda ese solo hallazgo al Assistant, que se abre al lado del diff; arranca un run enseguida, y a Claude se le pide que avise si el hallazgo está mal en lugar de cambiar algo.
8. Para deshacer un bloque de cambios, apretá **Revert hunk** en su fila gris de encabezado y después **Revert**. Solo ese bloque vuelve al último commit; el resto del archivo queda. No se puede deshacer.
9. Para commitear, tildá los archivos que quieras — el checkbox los pone en stage —, escribí un mensaje y apretá **Commit**. Sin nada tildado commitea todo. El commit es local; el push y el pull request se hacen desde el panel **Ship** del spec o desde el panel del repositorio.

## Tip

El agrupado te dice qué run tocó un archivo más recientemente, no quién escribió cada línea. Si editás un archivo después de una tarea, sigue apareciendo bajo esa tarea hasta que commitees — la verdad siempre es el diff.
