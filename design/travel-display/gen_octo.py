# -*- coding: utf-8 -*-
"""The three anime octopus directions, five states each, on a 0 0 120 120 box."""

# Signal literals — the same tokens the app resolves at runtime.
PAL = {
    "work":  dict(rim="#8AD000", body="#2A2A2A", eye="#C4F06A", tint="#76B900"),
    "think": dict(rim="#B28BFF", body="#241E33", eye="#C9A9FF", tint="#9B6BFF"),
    "sleep": dict(rim="#5B4880", body="#1F1F1F", eye="#6E5A93", tint="#4E3A73"),
    "done":  dict(rim="#76B900", body="#212418", eye="#A6E62E", tint="#76B900"),
    "fail":  dict(rim="#E0533C", body="#2A1D1A", eye="#FF8A72", tint="#E0533C"),
}
STATES = ["work", "think", "sleep", "done", "fail"]
STATE_LABEL = {
    "work": "working", "think": "deciding", "sleep": "queued",
    "done": "done", "fail": "failed",
}
INK50 = "#FAFAFA"

# =========================================================================
# A — Chibi. Big head, bigger eyes, stubby curling arms.
# =========================================================================
CH_HEAD = ("M 24,80 C 24,38 40,18 60,18 C 80,18 96,38 96,80 "
           "C 96,89 84,94 60,94 C 36,94 24,89 24,80 Z")
CH_SHADE = ("M 96,80 C 96,38 80,18 60,18 C 74,27 84,46 84,80 "
            "C 84,88 76,92 62,93.6 C 84,93.4 96,89 96,80 Z")
CH_TENTS = [
    ("M 31,88 C 26,99 24,108 29,112 C 32,114 35,111 34,107", 8.0, "-0.1s"),
    ("M 43,92 C 40,102 39,111 43,115", 7.0, "-0.5s"),
    ("M 55,94 C 54,104 53,112 56,116", 6.4, "-0.9s"),
    ("M 67,94 C 68,104 69,112 66,116", 6.4, "-1.3s"),
    ("M 79,92 C 82,102 83,111 79,115", 7.0, "-1.7s"),
    ("M 91,88 C 96,99 98,108 93,112 C 90,114 87,111 88,107", 8.0, "-2.1s"),
]

def _ch_eye_open(cx, p):
    return (
        '<ellipse cx="%s" cy="56" rx="11.5" ry="13.5" fill="%s"></ellipse>'
        '<ellipse cx="%s" cy="56" rx="11.5" ry="13.5" fill="none" stroke="%s" stroke-width="2"></ellipse>'
        '<circle cx="%s" cy="50.5" r="3.9" fill="%s"></circle>'
        '<circle cx="%s" cy="61.5" r="2" fill="%s" opacity="0.75"></circle>'
    ) % (cx, p["eye"], cx, p["body"], cx - 3.6, INK50, cx + 4.2, INK50)

def _ch_eyes(state, p):
    if state in ("work", "think"):
        return _ch_eye_open(43, p) + _ch_eye_open(77, p)
    if state == "sleep":
        return (
            '<path d="M 33,60 C 38,51 48,51 53,60" fill="none" stroke="%s" stroke-width="4.5" stroke-linecap="round"></path>'
            '<path d="M 67,60 C 72,51 82,51 87,60" fill="none" stroke="%s" stroke-width="4.5" stroke-linecap="round"></path>'
        ) % (p["eye"], p["eye"])
    if state == "done":
        return (
            '<path d="M 32,63 C 38,48 48,48 54,63" fill="none" stroke="%s" stroke-width="5" stroke-linecap="round"></path>'
            '<path d="M 66,63 C 72,48 82,48 88,63" fill="none" stroke="%s" stroke-width="5" stroke-linecap="round"></path>'
        ) % (p["eye"], p["eye"])
    return (
        '<path d="M 35,47 L 51,65 M 51,47 L 35,65" fill="none" stroke="%s" stroke-width="4.5" stroke-linecap="round"></path>'
        '<path d="M 69,47 L 85,65 M 85,47 L 69,65" fill="none" stroke="%s" stroke-width="4.5" stroke-linecap="round"></path>'
    ) % (p["eye"], p["eye"])

def _ch_mouth(state, p):
    if state == "work":
        return '<path d="M 54,78 C 56.5,83 63.5,83 66,78" fill="none" stroke="%s" stroke-width="3" stroke-linecap="round"></path>' % p["eye"]
    if state == "think":
        return '<ellipse cx="60" cy="79" rx="4" ry="4.6" fill="none" stroke="%s" stroke-width="3"></ellipse>' % p["eye"]
    if state == "sleep":
        return '<ellipse cx="60" cy="79" rx="3.4" ry="4.4" fill="%s" opacity="0.85"></ellipse>' % p["eye"]
    if state == "done":
        return ('<path d="M 49,75 C 53,88 67,88 71,75 Z" fill="%s"></path>'
                '<path d="M 55,82.5 C 57,86 63,86 65,82.5 Z" fill="%s" opacity="0.55"></path>') % (p["eye"], p["body"])
    return '<path d="M 50,80 C 53,75 56,85 60,80 C 64,75 67,85 70,80" fill="none" stroke="%s" stroke-width="3" stroke-linecap="round"></path>' % p["eye"]

def chibi(state):
    p = PAL[state]
    tents = "".join(
        '<path class="tent" style="animation-delay: %s" d="%s" fill="none" stroke="%s" '
        'stroke-width="%s" stroke-linecap="round"></path>' % (d, path, p["rim"], w)
        for path, w, d in CH_TENTS)
    extra = ""
    if state == "done":
        extra = ('<path class="spark" d="M 104,26 L 106.5,33 L 113,35.5 L 106.5,38 L 104,45 '
                 'L 101.5,38 L 95,35.5 L 101.5,33 Z" fill="%s"></path>'
                 '<path class="spark" style="animation-delay:-0.7s" d="M 15,44 L 16.8,49 L 22,50.8 '
                 'L 16.8,52.6 L 15,57.6 L 13.2,52.6 L 8,50.8 L 13.2,49 Z" fill="%s"></path>'
                 ) % (p["eye"], p["eye"])
    if state == "fail":
        extra = ('<path class="drop" d="M 100,30 C 105,39 105,45 100,45 C 95,45 95,39 100,30 Z" '
                 'fill="#B4B4B4" opacity="0.8"></path>')
    if state == "sleep":
        extra = ('<text x="99" y="34" font-family="\'Space Grotesk\', sans-serif" font-size="15" '
                 'font-weight="700" fill="%s">z</text>'
                 '<text x="108" y="24" font-family="\'Space Grotesk\', sans-serif" font-size="11" '
                 'font-weight="700" fill="%s" opacity="0.7">z</text>') % (p["eye"], p["eye"])
    blush = ""
    if state in ("work", "think", "done"):
        blush = ('<g class="blush"><ellipse cx="33" cy="71" rx="6.5" ry="4" fill="%s"></ellipse>'
                 '<ellipse cx="87" cy="71" rx="6.5" ry="4" fill="%s"></ellipse></g>') % (p["tint"], p["tint"])
    return (
        '<svg class="oc" viewBox="0 0 120 122">'
        '%s'
        '<path d="%s" fill="%s" stroke="%s" stroke-width="3.5" stroke-linejoin="round"></path>'
        '<path d="%s" fill="#000000" opacity="0.24"></path>'
        '<path class="shine" d="M 37,36 C 41,27 49,22 57,21" fill="none" stroke="%s" '
        'stroke-width="5" stroke-linecap="round" opacity="0.28"></path>'
        '%s<g class="eyes">%s</g>%s%s'
        '</svg>'
    ) % (tents, CH_HEAD, p["body"], p["rim"], CH_SHADE, INK50, blush,
         _ch_eyes(state, p), _ch_mouth(state, p), extra)

# =========================================================================
# B — Visor. A mecha pilot, not a logo with a rectangle glued on: recessed
# faceplate, hard cel terminator, a crest that carries the mood, armoured
# cables. Every id is instance-scoped — five of these share one page.
# =========================================================================
VI_HEAD = ("M 24,66 C 22,34 38,13 60,11 C 82,13 98,34 96,66 L 92,78 L 86,88 "
           "L 78,82 L 71,92 L 60,84 L 49,92 L 42,82 L 34,88 L 28,78 Z")
# The lit side is upper-left, so the terminator is a hard polygon down the right.
VI_SHADE = ("M 96,66 C 98,34 82,13 60,11 C 75,23 85,42 83,66 L 80,79 L 78,82 "
            "L 71,92 L 66,88 L 71,80 L 78,82 L 86,88 L 92,78 Z")
VI_VISOR = "M 30,47 L 90,43 L 86,64 L 34,67 Z"
VI_GLASS = "M 34.5,50 L 86,46.5 L 82.5,61 L 38,63.5 Z"
VI_LIP = "M 34,67 L 86,64 L 85.3,61 L 34.6,64 Z"
VI_CREST = "M 53,19 L 60,1 L 67,19 L 60,12 Z"
VI_CABLES = [
    ("M 34,88 C 28,98 26,108 31,113", 6.5, [(29.5, 98.5, -62), (27, 106, -74)], (31, 113)),
    ("M 49,92 C 45,102 44,111 48,116", 5.5, [(46.5, 101, -70), (44.5, 109, -84)], (48, 116)),
    ("M 60,84 C 60,96 59,108 62,117", 5.5, [(60, 95, -88), (59, 106, -86)], (62, 117)),
    ("M 71,92 C 75,102 76,111 72,116", 5.5, [(73.5, 101, 70), (75.5, 109, 84)], (72, 116)),
    ("M 86,88 C 92,98 94,108 89,113", 6.5, [(90.5, 98.5, 62), (93, 106, 74)], (89, 113)),
]
VI_GLASS_FILL = {
    "work": "#0C1200", "think": "#150D24", "sleep": "#0D0D11",
    "done": "#16200A", "fail": "#200A05",
}


def _vi_slits(state, p):
    """The slit angle is the expression — a mecha face emotes with its brow."""
    g = p["eye"]
    if state == "sleep":
        return ('<rect class="standby" x="49" y="54.5" width="26" height="2.6" fill="%s"></rect>' % g)
    if state == "fail":
        return ('<path d="M 40,49 L 55,62 M 55,49 L 40,62 M 65,49 L 80,62 M 80,49 L 65,62" '
                'fill="none" stroke="%s" stroke-width="3.6" stroke-linecap="square"></path>' % g)
    if state == "done":
        return ('<g class="slit">'
                '<path d="M 39,54 L 47,60 L 57,48" fill="none" stroke="%s" stroke-width="4.2" '
                'stroke-linecap="square" stroke-linejoin="miter"></path>'
                '<path d="M 63,54 L 71,60 L 81,48" fill="none" stroke="%s" stroke-width="4.2" '
                'stroke-linecap="square" stroke-linejoin="miter"></path></g>') % (g, g)
    if state == "think":
        # Level, narrowed, with the thinking pip between them.
        return ('<g class="slit"><path d="M 39,54.5 L 56,55.5 L 56,59.5 L 39,58.5 Z" fill="%s"></path>'
                '<path d="M 81,53.5 L 64,54.8 L 64,58.8 L 81,57.5 Z" fill="%s"></path></g>'
                '<rect class="pip" x="58" y="55" width="4" height="4" fill="%s"></rect>') % (g, g, g)
    # work: slits slant down toward the centre — focused, a little angry.
    return ('<g class="slit"><path d="M 38,50.5 L 56,56 L 56,61.5 L 38,56 Z" fill="%s"></path>'
            '<path d="M 82,49.5 L 64,55.5 L 64,61 L 82,55 Z" fill="%s"></path></g>') % (g, g)


def visor(state, uid=0):
    p = PAL[state]
    glass = VI_GLASS_FILL[state]
    cid = "vg%s%s" % (state, uid)

    cables = []
    for path, w, ticks, (tx, ty) in VI_CABLES:
        cables.append('<path class="tent" d="%s" fill="none" stroke="%s" stroke-width="%s" '
                      'stroke-linecap="round"></path>' % (path, p["rim"], w))
        for (x, y, a) in ticks:
            cables.append('<rect x="%s" y="%s" width="%s" height="2" fill="#000000" opacity="0.45" '
                          'transform="rotate(%s %s %s)"></rect>'
                          % (round(x - w * 0.62, 2), round(y - 1, 2), round(w * 1.24, 2), a, x, y))
        cables.append('<rect x="%s" y="%s" width="3.4" height="3.4" fill="%s"></rect>'
                      % (round(tx - 1.7, 2), round(ty - 1.7, 2), p["eye"]))
    cables = "".join(cables)

    # The crest droops when the pilot is asleep — the one shape that emotes.
    crest_cls = "crest droop" if state == "sleep" else "crest"
    crest = ('<g class="%s"><path d="%s" fill="%s"></path>'
             '<rect class="beacon" x="58.4" y="0" width="3.2" height="3.2" fill="%s"></rect></g>'
             % (crest_cls, VI_CREST, p["rim"], p["eye"]))

    fins = ('<path d="M 27,40 L 15,35 L 26,52 Z" fill="%s" opacity="0.85"></path>'
            '<path d="M 93,40 L 105,35 L 94,52 Z" fill="%s" opacity="0.6"></path>' % (p["rim"], p["rim"]))

    gleam = ""
    if state != "sleep":
        gleam = ('<g clip-path="url(#%s)"><g class="gleam">'
                 '<path d="M 12,40 L 23,40 L 7,72 L -4,72 Z" fill="%s" opacity="0.5"></path>'
                 '<path d="M 28,40 L 32.5,40 L 16.5,72 L 12,72 Z" fill="%s" opacity="0.35"></path>'
                 '</g></g>' % (cid, INK50, INK50))

    extra = ""
    if state == "work":
        extra = ('<g class="streaks" stroke="%s" stroke-width="2.6" stroke-linecap="square" opacity="0.7">'
                 '<path d="M 4,28 L 17,25"></path><path d="M 0,46 L 15,43"></path>'
                 '<path d="M 5,64 L 16,62"></path></g>' % p["rim"])
    if state == "done":
        extra = ('<path class="burst" d="M 103,17 L 106,30 L 119,33 L 106,36 L 103,49 '
                 'L 100,36 L 87,33 L 100,30 Z" fill="%s"></path>'
                 '<path class="burst" style="animation-delay:-0.45s" d="M 14,74 L 16,81 L 23,83 '
                 'L 16,85 L 14,92 L 12,85 L 5,83 L 12,81 Z" fill="%s"></path>') % (p["eye"], p["eye"])
    if state == "fail":
        extra = ('<g class="ghost"><path d="%s" fill="none" stroke="%s" stroke-width="2.5"></path></g>'
                 '<g class="scan" clip-path="url(#%s)">'
                 '<rect x="28" y="50" width="64" height="3" fill="%s" opacity="0.7"></rect>'
                 '<rect x="28" y="59" width="64" height="2" fill="%s" opacity="0.45"></rect></g>'
                 % (VI_VISOR, p["eye"], cid, p["eye"], p["eye"]))

    return (
        '<svg class="oc" viewBox="0 0 120 122">'
        '<defs><clipPath id="%s"><path d="%s"></path></clipPath></defs>'
        '%s%s%s%s'
        '<path d="%s" fill="%s" stroke="%s" stroke-width="3.2" stroke-linejoin="round"></path>'
        '<path d="%s" fill="#000000" opacity="0.34"></path>'
        '<path d="M 60,12 L 60,44" stroke="#000000" stroke-width="1.6" opacity="0.3"></path>'
        '<path d="M 33,50 C 32,32 42,19 55,15" fill="none" stroke="%s" stroke-width="4" '
        'stroke-linecap="round" opacity="0.26"></path>'
        '<path d="M 94,58 C 96,38 88,21 74,14" fill="none" stroke="%s" stroke-width="2.4" '
        'stroke-linecap="round" opacity="0.55"></path>'
        '<path d="%s" fill="%s" stroke="%s" stroke-width="2.6" stroke-linejoin="miter"></path>'
        '<path d="%s" fill="#000000" opacity="0.5"></path>'
        '%s%s'
        '<path d="%s" fill="%s" opacity="0.75"></path>'
        '<g stroke="%s" stroke-width="2" stroke-linecap="square" opacity="0.5">'
        '<path d="M 37,73 L 46,71"></path><path d="M 38,77.5 L 47,75.5"></path>'
        '<path d="M 39,82 L 48,80"></path></g>'
        '%s</svg>'
    ) % (cid, VI_VISOR, extra if state == "work" else "", cables, fins, crest,
         VI_HEAD, p["body"], p["rim"], VI_SHADE, INK50, p["rim"],
         VI_VISOR, glass, p["rim"], VI_GLASS,
         gleam, _vi_slits(state, p), VI_LIP, p["eye"], p["rim"],
         extra if state != "work" else "")

# =========================================================================
# C — Ink. One brush line, redrawn three times a cycle so it boils.
# =========================================================================
IK_HEAD = [(25, 80), (25, 37), (41, 17), (60, 17), (79, 17), (95, 37), (95, 80),
           (95, 90), (83, 95), (60, 95), (37, 95), (25, 90), (25, 80)]
IK_TENTS = [
    [(32, 90), (27, 101), (25, 110), (31, 114)],
    [(45, 94), (42, 104), (41, 113), (46, 117)],
    [(60, 96), (59, 106), (58, 114), (61, 118)],
    [(75, 94), (78, 104), (79, 113), (74, 117)],
    [(88, 90), (93, 101), (95, 110), (89, 114)],
]

def _jit(pts, k):
    """Deterministic hand-drawn wobble — the same drawing, drawn again."""
    out = []
    for i, (x, y) in enumerate(pts):
        n = (i * 37 + k * 101) % 17
        out.append((round(x + (n % 5 - 2) * 0.75, 2), round(y + ((n // 5) % 5 - 2) * 0.75, 2)))
    return out

def _cpath(pts, close=False):
    d = "M %s,%s" % pts[0]
    i = 1
    while i + 2 < len(pts) + 1 and i + 2 <= len(pts):
        seg = pts[i:i + 3]
        if len(seg) == 3:
            d += " C %s,%s %s,%s %s,%s" % (seg[0][0], seg[0][1], seg[1][0], seg[1][1], seg[2][0], seg[2][1])
            i += 3
        else:
            break
    if close:
        d += " Z"
    return d

def _ik_face(state, p, k):
    e = p["eye"]
    if state == "sleep":
        return ('<path d="M %s,60 C 38,52 48,52 %s,60" fill="none" stroke="%s" stroke-width="4" stroke-linecap="round"></path>'
                '<path d="M %s,60 C 72,52 82,52 %s,60" fill="none" stroke="%s" stroke-width="4" stroke-linecap="round"></path>'
                % (33 + k * 0.6, 53 + k * 0.6, e, 67 - k * 0.6, 87 - k * 0.6, e))
    if state == "done":
        return ('<path d="M %s,62 C 38,49 48,49 %s,62" fill="none" stroke="%s" stroke-width="4.5" stroke-linecap="round"></path>'
                '<path d="M %s,62 C 72,49 82,49 %s,62" fill="none" stroke="%s" stroke-width="4.5" stroke-linecap="round"></path>'
                % (33 - k * 0.6, 53 - k * 0.6, e, 67 + k * 0.6, 87 + k * 0.6, e))
    if state == "fail":
        return ('<path d="M 36,%s L 50,64 M 50,48 L 36,64 M 70,48 L 84,%s M 84,48 L 70,64" '
                'fill="none" stroke="%s" stroke-width="4" stroke-linecap="round"></path>'
                % (48 + k * 0.8, 64 - k * 0.8, e))
    # Ink eyes: a heavy dot with a bitten-out highlight.
    return ('<circle cx="%s" cy="56" r="10.5" fill="%s"></circle>'
            '<circle cx="%s" cy="56" r="10.5" fill="%s"></circle>'
            '<circle cx="%s" cy="51" r="3.4" fill="#141414"></circle>'
            '<circle cx="%s" cy="51" r="3.4" fill="#141414"></circle>'
            % (43 + k * 0.5, e, 77 - k * 0.5, e, 40 + k * 0.5, 74 - k * 0.5))

def ink(state):
    p = PAL[state]
    frames = []
    for k in (0, 1, 2):
        head = _cpath(_jit(IK_HEAD, k), close=True)
        tents = "".join(
            '<path d="%s" fill="none" stroke="%s" stroke-width="%s" stroke-linecap="round"></path>'
            % (_cpath(_jit(t, k + 3)), p["rim"], 7 - abs(i - 2) * 0.7)
            for i, t in enumerate(IK_TENTS))
        speed = ""
        if state in ("work", "think"):
            speed = ('<g class="speed"><path d="M 6,%s L 20,%s M 2,%s L 14,%s M 8,%s L 24,%s" '
                     'stroke="%s" stroke-width="2.5" stroke-linecap="round" opacity="0.7"></path></g>'
                     % (42 + k, 42 + k, 58 + k, 58 + k, 74 + k, 74 + k, p["rim"]))
        frames.append(
            '<g class="boil boil-%s">%s'
            '<path d="%s" fill="%s"></path>'
            '<path d="%s" fill="none" stroke="%s" stroke-width="%s" stroke-linejoin="round"></path>'
            '%s%s</g>'
            % (k + 1, tents, head, p["body"], head, p["rim"], 4.5 - k * 0.5,
               _ik_face(state, p, k), speed))
    wash = '<path d="%s" fill="%s" opacity="0.14"></path>' % (_cpath(_jit(IK_HEAD, 0), True), p["tint"])
    return '<svg class="oc" viewBox="0 0 120 122">%s%s</svg>' % (wash, "".join(frames))

BUILD = {"chibi": chibi, "visor": visor, "ink": ink}
# Styles whose markup carries gradients, patterns or clip paths need an
# instance id: five of them share one page, and a duplicate id silently wins.
NEEDS_UID = {"visor"}

_UID = [0]


def octo(style, state, width, delay="0s", cls=""):
    """One creature, wrapped so the CSS can bob it independently of the drawing.

    Every instance gets its own id counter: a clipPath id repeated across the
    five states on one page would silently resolve to the first one.
    """
    _UID[0] += 1
    draw = BUILD[style]
    art = draw(state, _UID[0]) if style in NEEDS_UID else draw(state)
    return ('<span class="oc-w o-%s st-%s %s" style="width: %spx; animation-delay: %s">'
            '<span class="oc-b" style="display:block; animation-delay: %s">%s</span></span>'
            % (style, state, cls, width, delay, delay, art))


# =========================================================================
# D — Pixel. An actual LCD sprite: 24x24 cells, two frames, no tweening.
#     Rasterised from geometry so the five states stay in register.
# =========================================================================
PX_N, PX_CELL = 24, 5
PX_LEGS = [(3, 4), (7, 8), (14, 15), (18, 19)]
PX_LEN = {0: [5, 7, 7, 5], 1: [7, 5, 5, 7]}
PX_COL = {"o": "body", "s": "shade", "#": "rim", "e": "eye", "w": "hi"}


def _px_cells(state, frame):
    g = {}
    lift = 1 if frame else 0
    for y in range(PX_N):
        gy = y + lift
        for x in range(PX_N):
            dome = ((x + 0.5 - 11.5) / 9.6) ** 2 + ((gy + 0.5 - 9.0) / 7.6) ** 2 <= 1
            trunk = 2 <= x <= 20 and 9 <= gy <= 15
            if gy >= 14:
                trunk = 3 <= x <= 19 and gy <= 15
            if dome or trunk:
                g[(x, y)] = "o"
    for i, (x0, x1) in enumerate(PX_LEGS):
        for k in range(PX_LEN[frame][i]):
            gy = 16 + k
            y = gy - lift
            if 0 <= y < PX_N:
                for x in range(x0, x1 + 1):
                    g[(x, y)] = "o"
    # A hard cel terminator down the right, then the outline pass.
    for (x, y), v in list(g.items()):
        if v == "o" and x >= 14:
            g[(x, y)] = "s"
    for (x, y) in list(g.keys()):
        if any((x + dx, y + dy) not in g for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            g[(x, y)] = "#"

    def blk(x0, x1, y0, y1, v):
        for yy in range(y0, y1 + 1):
            for xx in range(x0, x1 + 1):
                if 0 <= xx < PX_N and 0 <= yy < PX_N:
                    g[(xx, yy)] = v

    ey = 8 - lift
    if state in ("work", "think"):
        blk(5, 7, ey, ey + 2, "e")
        blk(15, 17, ey, ey + 2, "e")
        hx = 2 if frame else 0
        blk(5 + hx, 5 + hx, ey, ey, "w")
        blk(15 + hx, 15 + hx, ey, ey, "w")
        blk(10, 12, ey + 4, ey + 4, "#")
    elif state == "sleep":
        blk(5, 7, ey + 1, ey + 1, "e")
        blk(15, 17, ey + 1, ey + 1, "e")
        blk(11, 12, ey + 4, ey + 4, "#")
        blk(21, 21, ey - 3, ey - 3, "e")
        blk(22, 22, ey - 5, ey - 5, "e")
    elif state == "done":
        blk(5, 5, ey + 1, ey + 1, "e"); blk(6, 6, ey, ey, "e"); blk(7, 7, ey + 1, ey + 1, "e")
        blk(15, 15, ey + 1, ey + 1, "e"); blk(16, 16, ey, ey, "e"); blk(17, 17, ey + 1, ey + 1, "e")
        blk(9, 13, ey + 4, ey + 4, "e")
        blk(21, 21, ey - 3, ey - 3, "e"); blk(1, 1, ey + 2, ey + 2, "e")
    else:  # fail
        for d in (0, 1, 2):
            blk(5 + d, 5 + d, ey + d, ey + d, "e")
            blk(7 - d, 7 - d, ey + d, ey + d, "e")
            blk(15 + d, 15 + d, ey + d, ey + d, "e")
            blk(17 - d, 17 - d, ey + d, ey + d, "e")
        blk(10, 10, ey + 4, ey + 4, "e"); blk(11, 11, ey + 5, ey + 5, "e")
        blk(12, 12, ey + 4, ey + 4, "e"); blk(13, 13, ey + 5, ey + 5, "e")
        blk(21, 21, ey - 2, ey - 1, "e")
    return g


def _px_rects(g, colors):
    """Merge horizontal runs — a raw cell-per-rect sprite is five times the markup."""
    out = []
    for y in range(PX_N):
        x = 0
        while x < PX_N:
            v = g.get((x, y))
            if v is None:
                x += 1
                continue
            run = 1
            while g.get((x + run, y)) == v:
                run += 1
            out.append('<rect x="%s" y="%s" width="%s" height="%s" fill="%s"></rect>'
                       % (x * PX_CELL, y * PX_CELL + 1, run * PX_CELL, PX_CELL, colors[PX_COL[v]]))
            x += run
    return "".join(out)


def pixel(state):
    p = PAL[state]
    colors = {"body": p["body"], "shade": "#141414", "rim": p["rim"], "eye": p["eye"], "hi": INK50}
    if state == "sleep":
        colors["rim"] = p["rim"]
    frames = "".join(
        '<g class="frame frame-%s">%s</g>' % (f + 1, _px_rects(_px_cells(state, f), colors))
        for f in (0, 1))
    return ('<svg class="oc" viewBox="0 0 120 122" shape-rendering="crispEdges">%s</svg>' % frames)


# =========================================================================
# E — Neon. Not an object: a tube of light. Three stacked strokes fake the
#     glow (no SVG filter), and a bright charge runs the length of it.
# =========================================================================
NE_HEAD = "M 26,74 C 22,36 40,13 60,13 C 80,13 98,36 94,74"
NE_MANTLE = "M 26,74 C 40,83 80,83 94,74"
NE_ARMS = [
    "M 27,76 C 19,90 15,104 22,115",
    "M 44,81 C 39,95 37,107 42,117",
    "M 60,83 C 61,97 59,109 63,119",
    "M 76,81 C 81,95 83,107 78,117",
    "M 93,76 C 101,90 105,104 98,115",
]


def _ne_tube(d, c, scale=1.0, cls=""):
    return (
        '<path d="%s" fill="none" stroke="%s" stroke-width="%s" stroke-linecap="round" opacity="0.14"></path>'
        '<path d="%s" fill="none" stroke="%s" stroke-width="%s" stroke-linecap="round" opacity="0.3"></path>'
        '<path class="%s" d="%s" fill="none" stroke="%s" stroke-width="%s" stroke-linecap="round"></path>'
    ) % (d, c, round(11 * scale, 1), d, c, round(5.5 * scale, 1), cls, d, INK50, round(1.8 * scale, 1))


def neon(state):
    p = PAL[state]
    c = p["rim"] if state != "work" else p["eye"]
    dim = "st-dim" if state == "sleep" else ""
    head = NE_HEAD
    if state == "fail":
        # A broken tube: the arc is cut, so the head never closes.
        head = "M 26,74 C 22,36 40,13 56,13 M 66,14 C 82,18 96,40 94,74"
    tubes = _ne_tube(head, c, 1.0, "core") + _ne_tube(NE_MANTLE, c, 0.72, "core")
    arms = "".join(_ne_tube(d, c, 0.62 + 0.06 * (i % 2), "core arm arm-%s" % (i + 1))
                   for i, d in enumerate(NE_ARMS))
    charge = ""
    if state not in ("sleep", "fail"):
        charge = ('<path class="charge" d="%s" fill="none" stroke="%s" stroke-width="3.4" '
                  'stroke-linecap="round" stroke-dasharray="26 300"></path>' % (NE_HEAD, INK50))
    if state == "done":
        charge += ('<circle class="halo" cx="60" cy="48" r="40" fill="none" stroke="%s" '
                   'stroke-width="2.5" opacity="0"></circle>' % c)
    eyes = _ne_eyes(state, p, c)
    return ('<svg class="oc %s" viewBox="0 0 120 122">%s%s%s%s</svg>'
            % (dim, arms, tubes, charge, eyes))


def _ne_eyes(state, p, c):
    e = p["eye"]
    if state == "sleep":
        return ('<path d="M 38,50 L 54,50 M 66,50 L 82,50" stroke="%s" stroke-width="3.4" '
                'stroke-linecap="round" opacity="0.75"></path>' % e)
    if state == "done":
        return ('<path d="M 38,54 L 46,46 L 54,54 M 66,54 L 74,46 L 82,54" fill="none" stroke="%s" '
                'stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"></path>' % e)
    if state == "fail":
        return ('<path d="M 39,44 L 53,58 M 53,44 L 39,58 M 67,44 L 81,58 M 81,44 L 67,58" '
                'fill="none" stroke="%s" stroke-width="3.4" stroke-linecap="round"></path>' % e)
    r = 8 if state == "work" else 6
    return ('<g class="ne-eyes">'
            '<circle cx="46" cy="50" r="%s" fill="%s" opacity="0.3"></circle>'
            '<circle cx="74" cy="50" r="%s" fill="%s" opacity="0.3"></circle>'
            '<circle cx="46" cy="50" r="%s" fill="%s"></circle>'
            '<circle cx="74" cy="50" r="%s" fill="%s"></circle>'
            '<circle cx="46" cy="50" r="2.2" fill="%s"></circle>'
            '<circle cx="74" cy="50" r="2.2" fill="%s"></circle></g>'
            ) % (r + 4, e, r + 4, e, r, e, r, e, INK50, INK50)


# =========================================================================
# F — Terminal. The creature as monospace glyphs, the way a CLI would draw
#     it. Blinking is a character swap, not a transform.
# =========================================================================
TM_FRAME = ["  ╭───────╮",
            "  │", "  │",
            "  ╰┬─┬─┬─┬╯"]
TM_FACES = {
    "work":  [("●   ●", "── ──")],
    "think": [("○   ○", " ─○─ ")],
    "sleep": [("─   ─", "  ○  ")],
    "done":  [("^   ^", "╰───╯")],
    "fail":  [("x   x", "╲───╱")],
}
TM_BLINK = "─   ─"
TM_ARMS = ["   ╰╯ │ ╰╯", "   ╰╮ │ ╭╯"]
TM_ASIDE = {"sleep": "z", "think": "?", "done": "*", "fail": "!", "work": ""}


def _tm_lines(state, blink, armset, p):
    eye, mouth = TM_FACES[state][0]
    if blink and state in ("work", "think"):
        eye = TM_BLINK
    return [
        [(TM_FRAME[0], p["rim"])],
        [("  │ ", p["rim"]), (eye, p["eye"]), (" │", p["rim"])],
        [("  │ ", p["rim"]), (mouth, p["eye"]), (" │", p["rim"])],
        [(TM_FRAME[3], p["rim"])],
        [(TM_ARMS[armset], p["rim"])],
    ]


def term(state):
    p = PAL[state]
    out = []
    for f in (0, 1):
        lines = _tm_lines(state, f == 1, f, p)
        rows = []
        for i, segs in enumerate(lines):
            spans = "".join('<tspan fill="%s">%s</tspan>' % (c, t.replace("&", "&amp;").replace("<", "&lt;"))
                            for t, c in segs)
            rows.append('<text x="6" y="%s" xml:space="preserve">%s</text>' % (28 + i * 20, spans))
        aside = TM_ASIDE[state]
        if aside:
            rows.append('<text class="aside" x="102" y="26" fill="%s">%s</text>' % (p["eye"], aside))
        out.append('<g class="frame frame-%s">%s</g>' % (f + 1, "".join(rows)))
    return ('<svg class="oc" viewBox="0 0 120 122" font-family="\'JetBrains Mono\', ui-monospace, monospace" '
            'font-size="17" font-weight="500">%s</svg>' % "".join(out))


BUILD.update({"pixel": pixel, "neon": neon, "term": term})
