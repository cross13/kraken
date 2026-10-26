---
id: bugfix-spec
title: Arrancá un spec de bugfix en vez de una feature
summary: Describí un bug en Home y Octo abre un spec de bugfix — bugfix.md en lugar de requirements.md, con guardas de regresión incluidas.
track: howto
order: 1
area: specs
minutes: 3
goto: spec:define
---

Un spec de bugfix recorre las mismas tres etapas que una feature, pero su primer documento es `bugfix.md`: una reproducción y un defecto para acotar, no historias para relevar. La etapa se llama **Bug analysis** en vez de **Requirements**.

1. En **Home**, describí el bug en el composer. Octo decide el tipo por las palabras que usás: `bug`, `fix`, `crash`, `error`, `broken`, `regression`, `fail` (o `fails`, `failing`, `failed`), `doesn't work` y `not working` lo vuelven bugfix. Cualquier otra cosa es una feature.
2. Mirá el chip al lado del input antes de apretar nada. Dice **bugfix** con un ícono de bicho, o **feature**. No hay un selector: si adivinó mal, reescribí el texto.
3. Apretá **Plan**. El spec se abre en **Bug analysis** con `bugfix.md` como primera pestaña, y todavía no corrió nada.
4. Apretá **Draft bug analysis with Claude**. El run va al agente `bug-analyzer` si lo tenés instalado, lleva la skill `sdd-bugfix` (reproducir, causa raíz, fix mínimo) más `spec-bugfix-format`, y escribe cinco secciones: Reproduction, Current Behavior, Expected Behavior, Unchanged Behavior y Environment.
5. Leé con atención **Unchanged Behavior**. Esas líneas `WHEN … THEN … SHALL CONTINUE TO` son las guardas de regresión, y `sdd-bugfix` le pide al plan que las haga explícitas en `## Verification`.
6. Apretá **Approve bug analysis**. De ahí en más es el loop de siempre: Clarify, `plan.md`, Build.

## Tip

Las palabras que detectan el bug son en inglés: "no anda el logout" sale como feature, "logout is broken" sale como bugfix. La vista Review y el format check también funcionan sobre `bugfix.md`; sin historias de usuario para agrupar, Review agrupa los criterios por sección y igual marca lo que no está en EARS o usa palabras que no se pueden testear.
