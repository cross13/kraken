---
id: install-connect
title: Instalá la app y conectá Claude
summary: Compilá la app desde el código y conectala a Claude, con tu Claude CLI local o con una API key de Anthropic.
track: start
order: 1
area: setup
minutes: 6
goto: library:settings
check: backend
---

Al final tenés Octo andando y hablando con Claude. Todavía no hay instaladores firmados, así que se corre desde el repositorio.

1. Instalá Node.js 20 o más nuevo, después el Claude CLI, y logueate una vez:
   `npm install -g @anthropic-ai/claude-code`, y después `claude`.
2. Cloná el repo y corré `npm install`. El postinstall recompila para Electron los dos módulos nativos (`better-sqlite3` y `node-pty`).
3. Arrancala con `npm run dev`, o armá un bundle con `npm run package:mac` (también están `package:win` y `package:linux`).
4. Abrí **Library › Settings**. En **Backend**, elegí una de las dos tarjetas:
   - **Local Claude** (la default, marcada **Best**) corre tu `claude` instalado con la carpeta abierta como directorio de trabajo. El panel de abajo tiene que decir **Claude CLI detected**. Si dice **Claude CLI not found**, instalalo y tocá **Re-detect**.
   - **Anthropic API** se paga por uso. Pegá tu key `sk-ant-…` en **Anthropic API key** y tocá **Save**. Se cifra con el llavero del sistema y solo se manda a `api.anthropic.com`.
5. Con **Local Claude**, revisá **Permissions**: **Edit & write files** tiene que estar prendido para que Claude pueda escribir los documentos del spec. **Run shell commands** suma Bash y viene apagado.

## Por qué importa

Los dos backends no son equivalentes. El de API manda un mensaje pelado, sin herramientas: Claude no puede leer tu código ni escribir archivos, así que no puede guardar un documento del spec en disco y una tarea no puede cambiar nada. Usá **Local Claude** salvo que solo quieras chatear. Una API key guardada sirve además para verificar la lista de modelos contra tu cuenta.

**Siguiente:** Abrí un repositorio e instalá los defaults
