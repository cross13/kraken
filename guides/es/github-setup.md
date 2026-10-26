---
id: github-setup
title: Conectá GitHub y abrí un PR
summary: GitHub pasa por tu CLI local gh, sin token guardado; desde el panel Ship es rama, Commit all, Create pull request.
track: howto
order: 3
area: ship
minutes: 4
goto: spec:build
---

Todo lo que toca GitHub — pull requests, reviews, encontrar el repo — corre como `gh api …` a través de tu GitHub CLI local. Octo no guarda ningún token de GitHub y actúa con la cuenta que tenga sesión en `gh`.

1. Instalá `gh` desde cli.github.com y corré `gh auth login` en una terminal.
2. Abrí **Library › Settings** y buscá la sección **GitHub**. Tendría que decir **Connected through gh** con tu usuario. Si no, arreglá `gh` y apretá **Check again**.
3. El repo necesita un remote `origin` de github.com. Sin eso podés commitear local, pero no hay PR para abrir.
4. Terminá un spec y abrí **Ship** dentro de Build. Si estás en `main` o `master`, apretá primero **Create branch feat/…**.
5. Apretá **Commit all** — dice **Commit all & push** cuando hay origin. Agrega todo al stage, con el mensaje precargado desde el resumen.
6. En el panel **Pull request**, **Write overview** hace que Claude redacte los primeros párrafos a partir de los commits y el diff de la rama. Editá el cuerpo si querés y apretá **Create pull request**: pushea la rama y abre el PR. Después, **View pull request** lo abre.

La rama, el último commit y el link del PR quedan escritos en el spec, así el board y la sincronización con el tracker saben en qué está.

## Tip

Para lo que queda fuera de un spec — cambiar de rama, commits parciales, otros PRs — abrí el panel del repo: hacé clic en el nombre de la rama en la command bar, usá **Open repo panel →** en Ship, o elegí **Repository** desde ⌘K.
