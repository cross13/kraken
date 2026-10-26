---
id: first-spec
title: Tu primer spec
summary: Describí el trabajo en Home y obtené un spec con requirements para revisar antes de que se escriba una línea de código.
track: start
order: 3
area: specs
minutes: 4
goto: home
check: spec
---

Escribís una oración en Home y te queda una carpeta de spec en `.octo/specs/<id>/` con un primer documento para leer y aprobar antes de que nada toque tu código.

1. Andá a Home (o ⌘K → **New spec…**, que te pone el foco en el composer) y describí el trabajo en el composer de arriba. Sé concreto con el comportamiento que querés, no con los archivos.
2. Mirá el chip que aparece adentro del composer. Dice `feature` o `bugfix`, adivinado por tus palabras: "bug", "fix", "crash", "error", "broken", "not working" y parecidas lo vuelven bugfix. Una feature arranca con `requirements.md`; un bugfix arranca con `bugfix.md` y su primera etapa es **Bug analysis** en vez de **Requirements**.
3. Elegí hasta dónde llegar:
   - **Plan** (o `Enter`) crea el spec y lo abre en su primera etapa. No arranca ningún run de Claude. Tu texto queda guardado como brief del spec, y la barra de aprobación te ofrece **Draft requirements with Claude** cuando quieras gastar un run.
   - **Plan rápido** (o `⌘Enter`) redacta los requirements y después el plan de corrido, sin paradas de aprobación, y te deja en Build con `tasks.md` ya derivado. Usalo cuando ya sabés las respuestas.
4. Si lo que escribiste termina en `?`, no se crea ningún spec. El texto va al Assistant (⌘J) como pregunta.
5. Mientras corre un borrador, una franja arriba del documento avisa que Claude lo está redactando. El documento se recarga desde disco cuando termina el run; el run en sí lo podés seguir en el Assistant.

## Tip

En tus primeros specs, preferí **Plan**. Deja que la etapa de Plan frene y te haga preguntas, cosa que **Plan rápido** se saltea a propósito, y te muestra cada una de las compuertas alrededor de las que está armado el loop.

**Siguiente:** Revisá los requirements y aclará el plan
