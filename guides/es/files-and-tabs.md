---
id: files-and-tabs
title: Recorré los archivos y leé un README
summary: El Explorador queda al lado de tu trabajo, los archivos abren como pestañas y cualquier markdown se lee renderizado, como código, o las dos cosas.
track: howto
order: 3
area: setup
minutes: 3
goto: side:explorer
---

La ventana está armada como un editor. La barra oscura de la izquierda tiene dos grupos de íconos: los cuatro de arriba eligen qué muestra el panel lateral — **Explorer**, **Search**, **Changes**, **Specs** — y el resto elige la página del medio: Home, Activity, Library, Learn.

1. Apretá el ícono **Explorer**, o ⌘⇧E. El panel lateral se abre al lado de tu trabajo en lugar de taparlo. Apretá el mismo ícono para cerrarlo; arrastrá su borde derecho para cambiarle el ancho.
2. Los specs que siguen en vuelo aparecen arriba del árbol de archivos. Hacé clic en uno para abrirlo.
3. Hacé clic en un archivo. Abre como **pestaña** en el medio. La primera pestaña siempre es la página en la que estabas — Home, el spec abierto, Activity — así que volvés con un clic.
4. Abrí todos los archivos que necesites. ⌘W cierra la pestaña que está en pantalla, el clic del medio cierra cualquiera, y **Close all** está al final de la tira.
5. Con un spec abierto, sus documentos — `requirements.md`, `plan.md`, `tasks.md` — son pestañas de la misma tira, antes de tus archivos. Un documento que está más allá de la aprobación actual del spec queda en gris hasta que la apruebes.
6. Abrí un markdown como `README.md`. Al pie del Explorer aparece un **Outline** con sus títulos; hacé clic en uno para saltar ahí. En su barra aparecen tres botones: **Code** muestra el código, **Preview** lo muestra renderizado y **Split** muestra los dos lado a lado. La app recuerda lo que elegiste.
7. Para buscar texto en todo el proyecto, apretá el ícono **Search** o ⌘⇧F y escribí. Los resultados se agrupan por archivo; hacé clic en uno para abrir el archivo en esa línea. Los archivos ignorados, como `node_modules`, quedan afuera, y los dos botones de la caja activan mayúsculas exactas y expresiones regulares.
8. Un archivo que difiere del último commit lleva una letra en el árbol y en su pestaña: **A** agregado, **M** modificado, **D** borrado. Una carpeta con cambios adentro muestra un punto. Apretá **Changes** en la barra del archivo para ver exactamente qué se movió.

## Tip

La barra de estado de abajo siempre dice qué está mostrando el medio, en qué rama estás y cuántos archivos tenés sin commitear. Un clic en la rama abre Changes.
