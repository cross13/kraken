---
id: review-pr
title: Revisá un pull request
summary: Hacé checkout de un PR abierto en un worktree privado, que lo lea el code reviewer y publicá los hallazgos como comentario.
track: howto
order: 2
area: ship
minutes: 5
goto: activity:reviews
---

Cualquier pull request abierto del repo del workspace, revisado por Claude con el código en disco, sin tocar tu propia rama.

1. Asegurate de tener `gh` instalado y logueado: corré `gh auth login` en una terminal. Octo no guarda ningún token de GitHub; si falta `gh` o no tiene sesión, la pestaña te lo dice y te ofrece **Check again**.
2. Abrí **Activity › Reviews**. El panel izquierdo lista los **Open pull requests** con autor y `head → base`. **Refresh** recarga la lista.
3. Elegí uno. Se hace checkout en un worktree privado dentro de la carpeta de datos de la app, así que la rama del workspace nunca cambia. Si el checkout falla, el encabezado dice **GitHub patches (local checkout failed)** y los archivos vienen de GitHub.
4. Leé **Files changed** como en GitHub. Si alguien pushea después de que lo abriste, aparece un aviso con **Check out again**.
5. Apretá **Review**. El reviewer corre dentro de ese worktree con herramientas de solo lectura: nunca edita, no corre comandos ni publica nada. Cada PR guarda su propio estado, así que podés cambiar de PR o de pestaña mientras uno corre.
6. En la pestaña **Review**, **Show in diff** te lleva a la línea del hallazgo en **Files changed**. **Fix with Claude** aparece solo si tu rama actual es la rama head del PR.
7. Para publicar, apretá **Post to GitHub…**. Ves el cuerpo exacto y cada comentario inline bajo "This will be posted as a comment review". **Post review** lo manda; **Cancel** no manda nada.

## Por qué importa

Publicar es escribir en el PR de otra persona, así que siempre es una review `COMMENT`. Aprobar o pedir cambios sigue siendo decisión de una persona, en GitHub.
