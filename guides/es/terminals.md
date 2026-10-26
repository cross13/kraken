---
id: terminals
title: Respondele a Claude en una terminal
summary: Abrí una shell o una sesión del CLI de Claude en la app: el único lugar donde contestás sus preguntas y pedidos de permiso.
track: howto
order: 2
area: activity
minutes: 3
goto: activity:terminals
---

Todos los demás runs de Octo son de una sola vuelta: entra el prompt, sale la respuesta en streaming, y nada de lo que escribas le llega. Las terminales son la excepción: un PTY real, de ida y vuelta, en la carpeta del workspace.

1. Abrí **Activity › Terminals**, o usá ⌘K → **New terminal** o **New Claude session**.
2. Apretá **Terminal** para tu shell de login, o **Claude session** para el CLI interactivo de `claude`. Las dos arrancan en el workspace con el mismo PATH extendido que usa la app para encontrar `claude`. Si no encuentra el CLI, la sesión de Claude te deja en una shell para que lo lances vos.
3. En una sesión de Claude contestás lo que los runs de una vuelta no pueden: preguntas de `AskUserQuestion`, pedidos de permiso y slash commands de verdad, igual que en tu propia terminal.
4. Los links que imprime Claude son clickeables y se abren en Google Chrome; si no tenés Chrome, en tu navegador por defecto.
5. Pasá de una sesión a otra con las pestañas de arriba. Siguen corriendo mientras te movés por la app.
6. Pasá el mouse por una pestaña y apretá **×** para cerrarla. Cerrarla mata ese proceso.

## Tip

Usá una sesión de Claude cuando un run necesita una decisión que solo vos podés tomar: aprobar un comando, elegir entre opciones, correr un slash command. Para todo lo demás, los specs y el Assistant son más rápidos, porque lo que producen queda en la app y no perdido en el scroll.
