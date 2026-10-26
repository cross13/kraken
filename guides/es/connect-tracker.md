---
id: connect-tracker
title: Conectá un tracker de tickets
summary: Apuntá Octo a un servidor MCP que ya tenés, iniciá sesión, elegí el proyecto y revisá qué herramienta llama cada paso.
track: howto
order: 1
area: tickets
minutes: 6
goto: library:tickets
check: tracker
---

Un tracker vinculado a este workspace, para que Home liste sus tickets abiertos y cada spec mantenga su ticket al día. Los trackers son servidores MCP: Octo los lee de `.mcp.json` y de `~/.claude.json`, incluidas las entradas por proyecto que escribe `claude mcp add`.

1. Abrí **Library › Tickets**. Cada servidor configurado aparece como una pestaña con **+**; hacé clic para agregarlo como tracker.
2. En **Connect**, elegí **What kind of tracker**: **Jira** (el MCP de Atlassian, con nombres de herramientas fijos), **Tracker** (tareas con plan y criterios de validación) o **Generic** (herramientas descubiertas, nombres de argumentos a mejor esfuerzo). **Endpoint** sale de tu config MCP; si lo editás acá, lo pisás solo en Octo.
3. Autenticate de una de dos formas. **Sign in** abre el navegador para OAuth y vuelve solo; los tokens se renuevan automáticamente. O pegá un valor en **Token, if you have one instead** y apretá **Save** — `Bearer …`, `Basic …` o el token pelado, cifrado con el llavero del sistema.
4. Apretá **Connect & read tools**. Octo lee la lista de herramientas del propio servidor y asigna una a cada paso. Si falla, **Copy report** te da el intercambio completo para pegarlo donde sirva.
5. En **Scope**, apretá **Read list** y elegí el **Atlassian site** o el **Client / project**. Sin eso no se puede listar nada. Jira además pide un **Project key**, que solo hace falta para crear issues.
6. En **Sync**, marcá **Keep tickets in step with specs**.
7. Abrí **Tool mapping** para ver cada paso — **Create ticket**, **Write plan**, **Link pull request**, **Search** y el resto — y la herramienta que va a llamar. Corregí las que estén mal o poné **— not mapped —**.

## Tip

El descubrimiento solo completa lo vacío: un mapeo que corregiste queda corregido la próxima vez que conectes. El cartel de arriba dice **Ready** cuando está todo en su lugar.
