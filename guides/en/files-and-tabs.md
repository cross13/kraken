---
id: files-and-tabs
title: Browse files and read a README
summary: The Explorer sits beside your work, files open as tabs, and any markdown file can be read rendered, as source, or both.
track: howto
order: 3
area: setup
minutes: 3
goto: side:explorer
---

The window is laid out like an editor. The dark bar on the left has two groups of icons: the top four choose what the side bar shows — **Explorer**, **Search**, **Changes**, **Specs** — and the rest choose the page in the middle: Home, Activity, Library, Learn.

1. Press the **Explorer** icon, or ⌘⇧E. The side bar opens next to your work instead of covering it. Press the same icon again to close it; drag its right edge to resize it.
2. Specs that are still in flight are listed above the file tree. Click one to open it.
3. Click a file. It opens as a **tab** in the middle. The first tab is always the page you were on — Home, the open spec, Activity — so one click takes you back.
4. Open as many files as you need. ⌘W closes the tab on screen, a middle-click closes any tab, and **Close all** is at the right end of the strip.
5. While a spec is open, its documents — `requirements.md`, `plan.md`, `tasks.md` — are tabs in the same strip, before your files. A document past the spec's current gate is greyed out until that gate is approved.
6. Open a markdown file such as `README.md`. An **Outline** of its headings appears at the foot of the Explorer; click a heading to jump to it. Three buttons appear in its toolbar: **Code** shows the source, **Preview** shows it rendered, and **Split** shows both side by side. The app remembers your choice.
7. To find text anywhere in the project, press the **Search** icon or ⌘⇧F and type. Results are grouped by file; click one to open the file at that line. Ignored files such as `node_modules` are left out, and the two buttons in the box switch on match-case and regular expressions.
8. A file that differs from the last commit carries a letter in the tree and on its tab: **A** added, **M** modified, **D** deleted. A folder with changes inside shows a dot. Press **Changes** in the file's toolbar to see exactly what moved.

## Tip

The status bar along the bottom always says what the middle is showing, which branch you are on and how many files are uncommitted. Clicking the branch opens Changes.
