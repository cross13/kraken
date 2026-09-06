# -*- coding: utf-8 -*-
"""Generates the Colony bodies. Repetitive SVG, so it is generated, not typed."""

TENTS = [
    ("M 62,106 C 54,124 50,138 58,150", "-0.1s"),
    ("M 80,112 C 76,132 74,148 80,162", "-0.7s"),
    ("M 100,114 C 100,134 98,152 102,166", "-1.2s"),
    ("M 120,112 C 124,132 126,148 120,162", "-1.7s"),
    ("M 138,106 C 146,124 150,138 142,150", "-2.2s"),
]
BODY = ("M 55,112 C 46,68 62,36 100,32 C 138,36 154,68 145,112 "
        "L 134,120 L 125,108 L 112,122 L 100,112 L 88,122 L 75,108 L 66,120 Z")

EYES = {
    "open": ('<path class="eye" d="M 72,68 L 92,76 L 92,84 L 72,76 Z"></path>'
             '<path class="eye" d="M 128,68 L 108,76 L 108,84 L 128,76 Z"></path>'),
    "shut": ('<path class="eyeline" d="M 71,77 L 93,77" stroke-width="4.5" stroke-linecap="round"></path>'
             '<path class="eyeline" d="M 107,77 L 129,77" stroke-width="4.5" stroke-linecap="round"></path>'),
    "happy": ('<path class="eyeline" d="M 71,82 Q 82,68 93,82" stroke-width="4.5" stroke-linecap="round"></path>'
              '<path class="eyeline" d="M 107,82 Q 118,68 129,82" stroke-width="4.5" stroke-linecap="round"></path>'),
    "x": ('<path class="eyeline" d="M 73,69 L 91,85 M 91,69 L 73,85" stroke-width="4" stroke-linecap="round"></path>'
          '<path class="eyeline" d="M 109,69 L 127,85 M 127,69 L 109,85" stroke-width="4" stroke-linecap="round"></path>'),
}
EYE_FOR = {"work": "open", "think": "open", "sleep": "shut", "done": "happy", "fail": "x"}


def svg(state):
    tents = "".join(
        '<path class="tent rim" style="animation-delay: %s" d="%s" fill="none" '
        'stroke-width="8" stroke-linecap="round"></path>' % (d, p) for p, d in TENTS)
    return ('<svg viewBox="46 26 108 146">%s'
            '<path class="bod" d="%s" stroke-width="3" stroke-linejoin="round"></path>'
            '<g class="eyes">%s</g></svg>' % (tents, BODY, EYES[EYE_FOR[state]]))


def mascot(state, left=None, top=None, delay="0s", size="", bub=None, tag=None,
           zzz=False, extra=""):
    pos = ""
    if left is not None:
        pos = "left: %s; top: %s; " % (left, top)
    cls = ("m %s %s" % (state, size)).strip()
    out = ['<div class="%s" style="%s--d: %s">' % (cls, pos, delay)]
    if bub:
        out.append(bub)
    if zzz:
        out.append('<div class="zzz"><span style="animation-delay: 0s">z</span>'
                   '<span style="animation-delay: 1.1s; left: 7px; top: -6px">z</span>'
                   '<span style="animation-delay: 2.2s; left: 14px; top: -12px">z</span></div>')
    out.append('<div class="mb">%s</div>' % svg(state))
    if tag:
        out.append(tag)
    out.append(extra)
    out.append("</div>")
    return "".join(out)


def bubble(title, sub=None, kind="", align="mid", dots=False):
    cls = "bub"
    if align == "l":
        cls += " l"
    elif align == "r":
        cls += " r rt"
    else:
        cls += " mid"
    if kind:
        cls += " " + kind
    d = '<span class="dots"><i></i><i style="animation-delay:.2s"></i><i style="animation-delay:.4s"></i></span>' if dots else ""
    s = '<em>%s</em>' % sub if sub else ""
    return '<div class="%s"><b>%s%s</b>%s</div>' % (cls, title, d, s)


def tag(name, sub, cls=""):
    return '<div class="tag"><b class="mono %s">%s</b><em>%s</em></div>' % (cls, name, sub)


HEAD = """<div class="bar">
    <div class="mark">
      <svg viewBox="46 26 108 146" width="17" height="23" style="display:block">
        <path d="M 62,106 C 54,124 50,138 58,150" fill="none" stroke="#8AD000" stroke-width="8" stroke-linecap="round"></path>
        <path d="M 80,112 C 76,132 74,148 80,162" fill="none" stroke="#8AD000" stroke-width="8" stroke-linecap="round"></path>
        <path d="M 120,112 C 124,132 126,148 120,162" fill="none" stroke="#8AD000" stroke-width="8" stroke-linecap="round"></path>
        <path d="M 138,106 C 146,124 150,138 142,150" fill="none" stroke="#8AD000" stroke-width="8" stroke-linecap="round"></path>
        <path d="M 55,112 C 46,68 62,36 100,32 C 138,36 154,68 145,112 L 134,120 L 125,108 L 112,122 L 100,112 L 88,122 L 75,108 L 66,120 Z" fill="#2A2A2A" stroke="#8AD000" stroke-width="3" stroke-linejoin="round"></path>
        <path d="M 72,68 L 92,76 L 92,84 L 72,76 Z" fill="#C4F06A"></path>
        <path d="M 128,68 L 108,76 L 108,84 L 128,76 Z" fill="#C4F06A"></path>
      </svg>
    </div>
    <div>
      <div class="hd-title disp">6 agents running <span class="sep">&#183;</span> <span style="color: #C9A9FF; font-weight: 500">2 queued</span></div>
      <div class="hd-sub mono">kraken <span class="sep">&#183;</span> claude-opus-5</div>
    </div>
    <div style="width: 1px; height: 26px; background: #333333; margin: 0 2px"></div>
    <div style="display: flex; align-items: center; gap: 9px">
      <div class="slots"><div class="slot on"></div><div class="slot on"></div><div class="slot on"></div><div class="slot wait"></div><div class="slot wait"></div><div class="slot"></div><div class="slot"></div><div class="slot"></div></div>
      <div class="cap mono">3<span class="sep">/</span>8 task slots</div>
    </div>
    <div style="width: 1px; height: 26px; background: #333333; margin: 0 2px"></div>
    <div class="legend-dash"><i></i> waiting on</div>
    __EXTRA__
    <div class="grow"></div>
    __HINT__
    <button class="btn danger"><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style="display:block"><rect x="4" y="4" width="16" height="16"></rect></svg> Stop all</button>
    <div class="zoombox"><div>&#8722;</div><div class="mono" style="border-left: 1px solid #393939; border-right: 1px solid #393939; min-width: 44px">100%</div><div>+</div></div>
    <button class="btn" style="padding: 0 8px"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:block"><circle cx="12" cy="12" r="10"></circle><path d="M12 18a6 6 0 0 0 0-12z" fill="currentColor"></path></svg></button>
    <button class="btn" style="padding: 0 8px"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="display:block"><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"></path></svg></button>
  </div>"""


def zone_head(name, sub, segs, live=True):
    bars = "".join('<i class="%s"></i>' % s for s in segs)
    return ('<div class="zone-hd"><span class="zone-name disp">%s</span>'
            '<span class="zone-sub">%s</span><span class="grow"></span>'
            '<span class="zprog">%s</span></div>' % (name, sub, bars))
