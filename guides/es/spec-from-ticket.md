---
id: spec-from-ticket
title: Arrancá un spec desde un ticket
summary: Elegí trabajo abierto en el panel Entrada de Home, leelo sin crear nada y mandalo a Requirements o directo a Build.
track: howto
order: 2
area: tickets
minutes: 3
goto: home
---

Un spec cuyo brief es el ticket que alguien ya escribió, vinculado a ese ticket desde el momento en que existe.

1. Primero conectá un tracker y activá su sincronización. Home muestra el panel **Entrada** solo si hay al menos un tracker habilitado.
2. Entrada tiene un carril por tracker, cada uno con su marca, con los tickets abiertos. Los que ya tienen spec van al carril **Ya con spec**, cerrado por defecto; si hacés clic en uno, abre su spec.
3. Para leer un ticket sin arrancar nada, apretá el botón del ojo a la derecha de la fila. El panel lateral muestra la descripción, el plan que ya tenga el ticket, criterios y comentarios. Leer no crea nada.
4. Para arrancar, hacé clic en la fila. Eso la arma: el encabezado del board muestra el ticket y **Cancelar (Esc)**, y se iluminan dos columnas.
   - **Requirements** → **Plan**: crea el spec, carga sus documentos desde el ticket y para en cada aprobación.
   - **Build** → **Plan rápido**: redacta requirements y plan de corrido, sin paradas, y queda listo para correr.
   La columna Plan nunca se ilumina: un spec no puede empezar por la mitad. El panel lateral tiene los mismos dos botones.
5. A medida que el spec avanza — plan aprobado, rama creada, PR abierto, tareas terminadas — el panel **Tracker**, en el costado del spec y en Ship, lista lo que se le debe al ticket. Desplegá uno para ver la llamada exacta con sus argumentos y apretá **Send to the tracker**.

## Por qué importa

No se escribe nada en un board que comparte tu equipo hasta que viste la llamada literal. Lo pendiente sale del estado del propio spec, así que cerrar la app no pierde nada y nada se manda dos veces.
