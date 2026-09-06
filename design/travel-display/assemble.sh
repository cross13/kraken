#!/bin/bash
# Assemble <Name>.dc.html from _base.css + <Name>.css + <Name>.body.html
set -e
for name in "$@"; do
  {
    cat <<'HEAD'
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&amp;family=Space+Grotesk:wght@500;700&amp;family=JetBrains+Mono:wght@400;500&amp;display=swap">
  <style>
HEAD
    cat _base.css
    [ -f "$name.octo" ] && cat _octo.css
    [ -f "$name.css" ] && cat "$name.css"
    cat <<'MID'
  </style>
</helmet>
MID
    cat "$name.body.html"
    cat <<'TAIL'
</x-dc>
<script data-dc-script data-props='{"$preview":{"width":__W__,"height":__H__}}'>
class Component extends DCLogic {}
</script>
</body>
</html>
TAIL
  } | sed -e "s/__W__/${W:-2560}/" -e "s/__H__/${H:-720}/" > "$name.dc.html"
  echo "built $name.dc.html ($(wc -c < "$name.dc.html") bytes)"
done
