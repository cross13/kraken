# -*- coding: utf-8 -*-
"""The colony at real size, wearing one of the mascot directions.

    python3 gen_main.py chibi Main
    python3 gen_main.py visor ColonyVisor
"""
import sys
import gen_octo_anime, gen_octo_samurai  # register the extra styles
from gen_colony import HEAD, bubble, tag, zone_head
from gen_octo import octo

STYLE = sys.argv[1] if len(sys.argv) > 1 else "chibi"
OUT = sys.argv[2] if len(sys.argv) > 2 else "Main"
# The visor says "asleep" with a dark glass and a drooping crest; floating zzz
# would be a second, cuter voice on top of it.
ZZZ = STYLE != "visor"


def crit(state, left, top, delay="0s", bub=None, tagm=None, zzz=False):
    out = ['<div class="m %s" style="left: %s; top: %s; --d: %s">' % (state, left, top, delay)]
    if bub:
        out.append(bub)
    if zzz and ZZZ:
        out.append('<div class="zzz"><span style="animation-delay: 0s">z</span>'
                   '<span style="animation-delay: 1.1s; left: 7px; top: -6px">z</span>'
                   '<span style="animation-delay: 2.2s; left: 14px; top: -12px">z</span></div>')
    out.append(octo(STYLE, state, 54, delay))
    if tagm:
        out.append(tagm)
    out.append('</div>')
    return "".join(out)


z1 = [zone_head("auth-refresh", "Build &#183; Wave 2 of 3",
                ["done", "done", "run", "run", "wait", "wait"]),
      '<svg class="tether" viewBox="0 0 900 524" preserveAspectRatio="none">'
      '<path d="M 585,352 C 460,330 300,290 165,232"></path>'
      '<path d="M 729,383 C 600,350 320,300 172,238"></path>'
      '<path d="M 729,383 C 640,350 460,300 336,262"></path></svg>',
      crit("work", "13%", "33%", "-0.4s",
           bubble("Editing session.ts", "+ rotate(t: RefreshToken)", dots=True),
           tag("T3 &#183; 04:12", "spec-task-executor", "t")),
      crit("work", "31%", "39%", "-2.6s",
           bubble("Writing ReAuthBanner.tsx", "47 lines so far", dots=True),
           tag("T4 &#183; 02:47", "frontend-ui", "t")),
      '<div class="spark" style="left: 25.5%; top: 41%">'
      '<i></i><i style="animation-delay:.3s"></i><i style="animation-delay:.6s"></i>'
      '<span>same wave</span></div>',
      crit("sleep", "61%", "60%", "-1.1s",
           bubble("zzz &#8212; waiting on T3", None, "sleep"),
           tag("T5", "session tests", "w"), zzz=True),
      crit("sleep", "77%", "67%", "-3.3s",
           bubble("zzz &#8212; waiting on T3, T4", None, "sleep", align="r"),
           tag("T6", "rotation docs", "w"), zzz=True)]

z2 = [zone_head("travel-display", "Build &#183; Wave 1 of 2", ["run", "wait", "wait", "", ""]),
      '<svg class="tether" viewBox="0 0 584 524" preserveAspectRatio="none">'
      '<path d="M 319,362 C 260,330 200,280 166,236"></path>'
      '<path d="M 436,393 C 350,350 220,290 172,242"></path></svg>',
      crit("work", "20%", "33%", "-1.8s",
           bubble("npm run typecheck", "electron + web, 2 projects", dots=True),
           tag("T7 &#183; 06:03", "electron-pro", "t")),
      crit("sleep", "48%", "62%", "-0.9s",
           bubble("zzz &#8212; waiting on T7", None, "sleep"),
           tag("T8", "grid rewrite", "w"), zzz=True),
      crit("sleep", "70%", "69%", "-2.7s",
           bubble("zzz &#8212; waiting on T8", None, "sleep", align="r"),
           tag("T9", "docs", "w"), zzz=True)]

z3 = [zone_head("billing-portal", "Plan &#183; drafting", ["done", "run", ""]),
      crit("think", "28%", "35%", "-1.4s",
           bubble("Drafting plan.md", "&#8220;Affected files&#8221;&#8230;", "think", dots=True),
           tag("00:38", "spec-architect", "t")),
      '<div style="position: absolute; left: 11px; bottom: 11px; right: 11px; z-index: 3; '
      'border: 1px solid #3A2F52; background: #241E33; padding: 7px 10px">'
      '<div style="font-size: 11.5px; color: #C9A9FF; font-weight: 500">4 open decisions</div>'
      '<div style="font-size: 10.5px; color: #848484; margin-top: 2px">'
      'it will stop and ask rather than guess</div></div>']

z4 = [zone_head("Assistant &amp; system", "1 chat &#183; 1 hook &#183; 1 failed", ["run", "run", ""]),
      crit("work", "13%", "30%", "-3.9s",
           bubble("Answering you", "steering injection", dots=True),
           tag("00:09", "chat", "t")),
      crit("work", "42%", "44%", "-1.6s",
           bubble("git diff --stat", "6 files, 214 ins(+)", dots=True),
           tag("01:22", "hook &#183; code-validate", "t")),
      crit("fail", "70%", "60%", "0s",
           bubble("tasks.md has no ## Tasks", "click to see the error", "fail", align="r"),
           tag("failed", "audit &#183; spec-doctor", "f"))]


def reef_item(state, delay, title, sub):
    return ('<div class="reef-item"><div class="m %s small" style="--d: %s">%s</div>'
            '<div class="txt"><b>%s</b><em class="mono">%s</em></div></div>'
            % (state, delay, octo(STYLE, state, 34, delay), title, sub))


reef = ['<div class="reef-l">Recent</div>',
        reef_item("done", "-0.5s", "T2 &#8212; Add SessionStore.rotate()", "done in 3m 41s &#183; 3 files"),
        reef_item("done", "-1.9s", "T1 &#8212; Extract the token helpers", "done in 1m 58s &#183; 2 files"),
        reef_item("sleep", "-2.8s", "Explain the router precedence", "cancelled after 0m 14s"),
        '<div style="font-size: 11.5px; color: #848484">+ 9 earlier today &#8212; '
        '<span style="color: #A6E62E">Activity &#8250; History</span> has them all</div>']

hint = '<div class="cap" style="margin-right: 2px">Click an octopus to open its run</div>'

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

open("%s.body.html" % OUT, "w").write(body)
print("%s.body.html" % OUT, len(body), "bytes")
