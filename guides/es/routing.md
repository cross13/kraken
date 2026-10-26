---
id: routing
title: Mirá qué agente va a correr un paso, y por qué
summary: Library › Routing corre el router real sobre cualquier paso o tarea, muestra el puntaje de cada candidato y te deja pinear un agente.
track: howto
order: 5
area: library
minutes: 4
goto: library:routing
---

Library › Routing es una vista previa de la decisión de routing, no una pantalla de configuración. Corre la misma lógica que un run de verdad, sin efectos secundarios, así sabés a quién le tocaría una tarea antes de gastar un run en averiguarlo.

1. Abrí **Library › Routing**. En **Simulate a step**, elegí un **Step**: **Requirements**, **Bug analysis**, **Plan**, **Task execution**, **Task refine**, **Polish**, **Audit** o **Code review**, y un **Spec kind**.
2. Para **Task execution** y **Task refine**, escribí una tarea real en **Task description**. El router puntúa a los agentes contra ese texto.
3. Leé **Resolved routing**: el agente que correría, con un badge que dice por qué (**Best specialist**, **Bundled default**, **Pinned**, **Generic Claude**, …), y las **skills injected**: la skill SDD, la de formato de ese documento y una de dominio si alguna matcheó.
4. Leé **Candidate scoring**: las keywords que salen del paso y después cada agente instalado que matcheó alguna, con las palabras que pegó, su chip de scope `project` o `global` y su puntaje. Los agentes del proyecto suman 0.5 de bonus. Si gana el agente equivocado, sus palabras te dicen cuál sacar de su descripción.
5. Si el puntaje igual elige mal para un paso, abrí **Advanced** y en **Agent pins** poné un agente en vez de **Auto-route**. Un pin le gana a todo, salvo a un `@agent` por tarea y al agente que elegiste para el chat con **Use in chat**. También podés pinear desde la página del agente, en **Pin to steps**.
6. **Auto-inject matching skills**, en la misma sección, prende o apaga toda la inyección automática de skills. Las skills que apagaste una por una aparecen listadas abajo.

## Tip

**Reset** en **Advanced** vuelve toda la configuración de routing a los valores por defecto: los pins, el switch de inyección y la lista de skills apagadas, no solo los pins.
