# -*- coding: utf-8 -*-
from gen_colony import *

# ---------- the opened run: T7 ----------
focus = """<div class="fpanel">
  <div class="fhead">
    <div class="fmasc">%s</div>
    <div class="grow">
      <div style="display: flex; align-items: flex-start; gap: 16px">
        <div class="grow">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px">
            <span class="chip task">Task</span>
            <span class="tid mono" style="font-size: 13px">T7</span>
            <span class="meta">Wave 1 <span class="sep">&#183;</span> travel-display <span class="sep">&#183;</span> 1 of 3</span>
          </div>
          <div class="ftitle disp">Cache the fleet snapshot so a display opened mid-run isn&#39;t empty</div>
        </div>
        <div style="text-align: right; flex: none">
          <div class="ftime mono">06:03</div>
          <div class="meta" style="margin-top: 6px">running</div>
        </div>
      </div>
      <div class="params">
        <div class="param"><b>Agent</b><span class="trunc">electron-pro</span></div>
        <div class="param"><b>Model</b><span class="trunc">claude-opus-5</span></div>
        <div class="param"><b>Backend</b><span class="trunc">cli</span></div>
        <div class="param"><b>Route</b><span class="trunc">specialist-match</span></div>
        <div class="param"><b>Scope</b><span class="trunc">global</span></div>
        <div class="param"><b>Permission</b><span class="trunc">acceptEdits</span></div>
        <div class="param"><b>Skill</b><span class="trunc">sdd-feature</span></div>
        <div class="param"><b>Blocking</b><span class="trunc">T8, T9</span></div>
        <div class="param"><b>Tools</b><span class="trunc">Read, Edit, Write, Bash</span></div>
      </div>
    </div>
  </div>
  <div class="flog log mono">
    <div class="l-tool">&#9679; Read electron/main.ts</div>
    <div class="l-res">    2540 lines</div>
    <div class="l-think">  The main window only pushes when its registry changes, so a</div>
    <div class="l-think">  display opened mid-run never receives anything.</div>
    <div class="l-tool">&#9679; Edit electron/main.ts</div>
    <div class="l-res">    + let lastFleet: FleetSnapshot = [];</div>
    <div class="l-res">    + wideWindow.webContents.on(&#39;did-finish-load&#39;, () =&gt; {</div>
    <div class="l-res">    +   wideWindow?.webContents.send(&#39;fleet:sync&#39;, lastFleet);</div>
    <div class="l-res">    + });</div>
    <div class="l-tool">&#9679; Edit electron/preload.ts</div>
    <div class="l-res">    + request: () =&gt; ipcRenderer.send(&#39;fleet:request&#39;),</div>
    <div class="l-txt">did-finish-load can beat React&#39;s first effect, so the renderer</div>
    <div class="l-txt">also pulls the cached snapshot the moment it subscribes.</div>
    <div class="l-tool">&#9679; Bash npm run typecheck</div>
    <div class="l-res">    tsc --noEmit -p tsconfig.node.json</div>
    <div class="l-res">    tsc --noEmit -p tsconfig.web.json</div>
    <div class="l-res">    clean</div>
    <div class="l-tool">&#9679; Edit docs/subsystems.md</div>
    <div class="l-think">  documenting the two-half handshake&#8230;</div>
  </div>
</div>""" % mascot("work", bub=bubble("npm run typecheck", "electron + web", dots=True),
                   delay="-1.8s", size="big")

# ---------- the compressed colony ----------
m1 = []
m1.append(zone_head("auth-refresh", "Wave 2 of 3", ["done", "done", "run", "run", "wait", "wait"]))
m1.append('<svg class="tether" viewBox="0 0 664 318" preserveAspectRatio="none">'
          '<path d="M 430,214 C 350,196 250,176 152,146"></path>'
          '<path d="M 540,232 C 440,210 250,180 158,150"></path></svg>')
m1.append(mascot("work", "17%", "36%", "-0.4s", size="small", tag=tag("T3 &#183; 04:12", "editing session.ts", "t")))
m1.append(mascot("work", "38%", "42%", "-2.6s", size="small", tag=tag("T4 &#183; 02:47", "writing banner", "t")))
m1.append(mascot("sleep", "63%", "58%", "-1.1s", size="small", zzz=True, tag=tag("T5", "on T3", "w")))
m1.append(mascot("sleep", "80%", "64%", "-3.3s", size="small", zzz=True, tag=tag("T6", "on T3, T4", "w")))

m2 = []
m2.append(zone_head("travel-display", "Wave 1 of 2", ["run", "wait", "wait"]))
m2.append('<svg class="tether" viewBox="0 0 664 318" preserveAspectRatio="none">'
          '<path d="M 400,206 C 320,186 220,160 152,144"></path>'
          '<path d="M 540,226 C 430,200 240,166 158,148"></path></svg>')
m2.append('<div class="m work small" style="left: 17%; top: 34%; --d: -1.8s; '
          'box-shadow: 0 0 0 2px rgba(118,185,0,.55); padding: 3px">'
          '<div class="mb">' + svg("work") + '</div>'
          + tag("T7 &#183; 06:03", "open &#8212; typecheck", "t") + '</div>')
m2.append(mascot("sleep", "58%", "56%", "-0.9s", size="small", zzz=True, tag=tag("T8", "on T7", "w")))
m2.append(mascot("sleep", "79%", "62%", "-2.7s", size="small", zzz=True, tag=tag("T9", "on T8", "w")))

m3 = []
m3.append(zone_head("billing-portal", "Plan &#183; drafting", ["done", "run", ""]))
m3.append(mascot("think", "22%", "38%", "-1.4s", size="small", tag=tag("00:38", "drafting plan.md", "t")))
m3.append('<div style="position: absolute; right: 9px; bottom: 9px; z-index: 3; '
          'border: 1px solid #3A2F52; background: #241E33; padding: 5px 8px; '
          'font-size: 10.5px; color: #C9A9FF">4 open decisions</div>')

m4 = []
m4.append(zone_head("Assistant &amp; system", "chat &#183; hook &#183; failed", ["run", "run", ""]))
m4.append(mascot("work", "16%", "34%", "-3.9s", size="small", tag=tag("00:09", "answering you", "t")))
m4.append(mascot("work", "45%", "46%", "-1.6s", size="small", tag=tag("01:22", "hook &#183; git diff", "t")))
m4.append(mascot("fail", "74%", "56%", "0s", size="small", tag=tag("failed", "audit", "f")))

back = ('<button class="backbtn">'
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
        'stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block">'
        '<path d="M19 12H5M12 19l-7-7 7-7"></path></svg> Back to the colony</button>')

body = """<div class="root">
  %s
  <div class="split2">
    %s
    <div class="colony-mini compact">
      <div class="zone live">%s</div>
      <div class="zone live">%s</div>
      <div class="zone live">%s</div>
      <div class="zone">%s</div>
    </div>
  </div>
</div>
""" % (HEAD.replace("__EXTRA__", "").replace("__HINT__", back),
       focus, "".join(m1), "".join(m2), "".join(m3), "".join(m4))

open("ColonyOpen.body.html", "w").write(body)
print("ColonyOpen.body.html", len(body), "bytes")
