---
id: models
title: Elegí tus modelos
summary: Elegí el modelo de cada run, un modelo de planning opcional para redactar, y entendé de dónde salió cada modelo de la lista.
track: howto
order: 1
area: setup
minutes: 3
goto: library:settings
---

Definís qué modelo de Claude corre tu trabajo y, si querés, un segundo para los pasos que más piensan.

1. Abrí **Library › Settings** y buscá **Model**. La lista se descubre, no está escrita a mano. Tocá el ícono de refrescar al lado del título para volver a detectar; también se vuelve a descubrir cuando cambiás de workspace o cuando guardás o borrás una API key.
2. Mirá el chip de cada fila, que dice cómo sabe Octo de ese modelo:
   - **your account** — lo devolvió la Models API de Anthropic para tu key guardada.
   - **local config** — aparece en tu configuración de Claude Code (`~/.claude/settings.json`, el `.claude/settings.json` o `settings.local.json` del workspace) o en `$ANTHROPIC_MODEL`. Así aparecen los alias que el catálogo no conoce.
   - **not verified** — un id del catálogo que trae Octo. Probablemente exista; nadie chequeó que lo puedas usar.
3. Elegí uno. Con **Local Claude** se le pasa al CLI como `--model`, y también andan los alias que entiende el CLI, como `opus` y `sonnet`.
4. En **Planning model**, dejá **Same as default** o elegí un segundo modelo. Se usa para redactar requirements, el plan y las tareas, y para las auditorías. La ejecución de tareas siempre usa el modelo de arriba.

## Por qué no hay un botón de "probar este modelo"

El CLI solo puede validar un id de modelo arrancando un run de verdad. Un id equivocado falla rápido y no cuesta nada, pero uno correcto es un request real que se cobra. Probar cada entrada del catálogo te gastaría créditos solo para llenar un desplegable, así que sin API key ves tu config local más el catálogo, marcado honestamente como **not verified**. Una API key guardada es la única forma de ver la lista que tu cuenta puede usar de verdad.
