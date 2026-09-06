# -*- coding: utf-8 -*-
from gen_colony import *

# ---- zone 1: auth-refresh (900 x 524) ----
z1 = []
z1.append(zone_head("auth-refresh", "Build &#183; Wave 2 of 3",
                    ["done", "done", "run", "run", "wait", "wait"]))
z1.append('<svg class="tether" viewBox="0 0 900 524" preserveAspectRatio="none">'
          '<path d="M 585,352 C 460,330 300,290 165,232"></path>'
          '<path d="M 729,383 C 600,350 320,300 172,238"></path>'
          '<path d="M 729,383 C 640,350 460,300 336,262"></path>'
          '</svg>')
z1.append(mascot("work", "13%", "33%", "-0.4s",
                 bub=bubble("Editing session.ts", "+ rotate(t: RefreshToken)", dots=True),
                 tag=tag("T3 &#183; 04:12", "spec-task-executor", "t")))
z1.append(mascot("work", "31%", "39%", "-2.6s",
                 bub=bubble("Writing ReAuthBanner.tsx", "47 lines so far", dots=True),
                 tag=tag("T4 &#183; 02:47", "frontend-ui", "t")))
z1.append('<div class="spark" style="left: 25.5%; top: 41%">'
          '<i></i><i style="animation-delay:.3s"></i><i style="animation-delay:.6s"></i>'
          '<span>same wave</span></div>')
z1.append(mascot("sleep", "61%", "60%", "-1.1s", zzz=True,
                 bub=bubble("zzz &#8212; waiting on T3", None, "sleep"),
                 tag=tag("T5", "session tests", "w")))
z1.append(mascot("sleep", "77%", "67%", "-3.3s", zzz=True,
                 bub=bubble("zzz &#8212; waiting on T3, T4", None, "sleep", align="r"),
                 tag=tag("T6", "rotation docs", "w")))

# ---- zone 2: travel-display (584 x 524) ----
z2 = []
z2.append(zone_head("travel-display", "Build &#183; Wave 1 of 2",
                    ["run", "wait", "wait", "", ""]))
z2.append('<svg class="tether" viewBox="0 0 584 524" preserveAspectRatio="none">'
          '<path d="M 319,362 C 260,330 200,280 166,236"></path>'
          '<path d="M 436,393 C 350,350 220,290 172,242"></path>'
          '</svg>')
z2.append(mascot("work", "20%", "33%", "-1.8s",
                 bub=bubble("npm run typecheck", "electron + web, 2 projects", dots=True),
                 tag=tag("T7 &#183; 06:03", "electron-pro", "t")))
z2.append(mascot("sleep", "48%", "62%", "-0.9s", zzz=True,
                 bub=bubble("zzz &#8212; waiting on T7", None, "sleep"),
                 tag=tag("T8", "grid rewrite", "w")))
z2.append(mascot("sleep", "70%", "69%", "-2.7s", zzz=True,
                 bub=bubble("zzz &#8212; waiting on T8", None, "sleep", align="r"),
                 tag=tag("T9", "docs", "w")))

# ---- zone 3: billing-portal (464 x 524) ----
z3 = []
z3.append(zone_head("billing-portal", "Plan &#183; drafting", ["done", "run", ""]))
z3.append(mascot("think", "28%", "35%", "-1.4s",
                 bub=bubble("Drafting plan.md", "&#8220;Affected files&#8221;&#8230;", "think", dots=True),
                 tag=tag("00:38", "spec-architect", "t")))
z3.append('<div style="position: absolute; left: 11px; bottom: 11px; right: 11px; z-index: 3; '
          'border: 1px solid #3A2F52; background: #241E33; padding: 7px 10px">'
          '<div style="font-size: 11.5px; color: #C9A9FF; font-weight: 500">4 open decisions</div>'
          '<div style="font-size: 10.5px; color: #848484; margin-top: 2px">'
          'it will stop and ask rather than guess</div></div>')

# ---- zone 4: assistant & system (536 x 524) ----
z4 = []
z4.append(zone_head("Assistant &amp; system", "1 chat &#183; 1 hook &#183; 1 failed",
                    ["run", "run", ""]))
z4.append(mascot("work", "13%", "30%", "-3.9s",
                 bub=bubble("Answering you", "steering injection", dots=True),
                 tag=tag("00:09", "chat", "t")))
z4.append(mascot("work", "42%", "44%", "-1.6s",
                 bub=bubble("git diff --stat", "6 files, 214 ins(+)", dots=True),
                 tag=tag("01:22", "hook &#183; code-validate", "t")))
z4.append(mascot("fail", "70%", "60%", "0s",
                 bub=bubble("tasks.md has no ## Tasks", "click to see the error", "fail", align="r"),
                 tag=tag("failed", "audit &#183; spec-doctor", "f")))

# ---- recent reef ----
reef = ['<div class="reef-l">Recent</div>']
reef.append('<div class="reef-item">%s<div class="txt"><b>T2 &#8212; Add SessionStore.rotate()</b>'
            '<em class="mono">done in 3m 41s &#183; 3 files</em></div></div>'
            % mascot("done", size="small", delay="-0.5s"))
reef.append('<div class="reef-item">%s<div class="txt"><b>T1 &#8212; Extract the token helpers</b>'
            '<em class="mono">done in 1m 58s &#183; 2 files</em></div></div>'
            % mascot("done", size="small", delay="-1.9s"))
reef.append('<div class="reef-item">%s<div class="txt"><b>Explain the router precedence</b>'
            '<em class="mono">cancelled after 0m 14s</em></div></div>'
            % mascot("sleep", size="small", delay="-2.8s"))
reef.append('<div style="font-size: 11.5px; color: #848484">+ 9 earlier today &#8212; '
            '<span style="color: #A6E62E">Activity &#8250; History</span> has them all</div>')

hint = ('<div class="cap" style="margin-right: 2px">Click an octopus to open its run</div>')

body = """<div class="root">
  %s
  <div class="tank">
    <div class="zones">
      <div class="zone live">%s</div>
      <div class="zone live">%s</div>
      <div class="zone live">%s</div>
      <div class="zone">%s</div>
    </div>
    <div class="reef">%s</div>
  </div>
</div>
""" % (HEAD.replace("__EXTRA__", "").replace("__HINT__", hint),
       "".join(z1), "".join(z2), "".join(z3), "".join(z4), "".join(reef))

open("Colony.body.html", "w").write(body)
print("Colony.body.html", len(body), "bytes")
