# -*- coding: utf-8 -*-
"""Three anime registers proper — not three media. Shoujo, shounen, 80s OVA."""
from gen_octo import PAL, INK50, BUILD, NEEDS_UID

INK = "#0A0A0A"


def _mix(hexa, hexb, t):
    a = [int(hexa[i:i + 2], 16) for i in (1, 3, 5)]
    b = [int(hexb[i:i + 2], 16) for i in (1, 3, 5)]
    return "#%02X%02X%02X" % tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


# =========================================================================
# G — Shoujo. 90s magical-girl: the eyes ARE the design. Gradient irises,
#     stacked highlights, lash flicks, screentone, sparkle.
# =========================================================================
SJ_HEAD = ("M 25,74 C 22,36 39,14 60,14 C 81,14 98,36 95,74 "
           "C 95,86 81,92 60,92 C 39,92 25,86 25,74 Z")
SJ_HAIR = [
    ("M 27,80 C 19,94 15,108 23,118", "M 27,82 C 21,94 18,106 23,114", 8),
    ("M 44,88 C 39,100 37,112 43,120", "M 44,90 C 40,100 39,110 43,117", 7),
    ("M 60,91 C 60,103 58,114 63,121", "M 60,93 C 60,103 59,112 62,118", 6.5),
    ("M 76,88 C 81,100 83,112 77,120", "M 76,90 C 80,100 81,110 77,117", 7),
    ("M 93,80 C 101,94 105,108 97,118", "M 93,82 C 99,94 102,106 97,114", 8),
]


def _sj_eye(cx, p, uid, state):
    gid = "sj%s%s" % (uid, cx)
    iris_top = _mix(p["eye"], "#101018", 0.45)
    return (
        '<defs><linearGradient id="%s" x1="0" y1="0" x2="0" y2="1">'
        '<stop offset="0" stop-color="%s"></stop>'
        '<stop offset="0.55" stop-color="%s"></stop>'
        '<stop offset="1" stop-color="%s"></stop></linearGradient></defs>'
        '<ellipse cx="%s" cy="55" rx="13" ry="16.5" fill="#F4F2F6"></ellipse>'
        '<ellipse cx="%s" cy="56" rx="11" ry="14.5" fill="url(#%s)"></ellipse>'
        '<ellipse cx="%s" cy="57" rx="5" ry="7.2" fill="#14121A"></ellipse>'
        '<ellipse class="band" cx="%s" cy="63" rx="8.5" ry="2.4" fill="%s" opacity="0.4"></ellipse>'
        '<circle class="hi" cx="%s" cy="47" r="4.6" fill="%s"></circle>'
        '<circle class="hi" cx="%s" cy="65" r="2.5" fill="%s" opacity="0.9"></circle>'
        '<circle class="hi" cx="%s" cy="52" r="1.4" fill="%s" opacity="0.8"></circle>'
        '<path d="M %s,42 C %s,33 %s,33 %s,41" fill="none" stroke="%s" stroke-width="5" stroke-linecap="round"></path>'
        '<path d="M %s,41 L %s,35" stroke="%s" stroke-width="3.4" stroke-linecap="round"></path>'
        '<path d="M %s,44 L %s,38" stroke="%s" stroke-width="2.6" stroke-linecap="round"></path>'
        '<path d="M %s,70 C %s,74 %s,74 %s,70" fill="none" stroke="%s" stroke-width="1.8" '
        'stroke-linecap="round" opacity="0.75"></path>'
    ) % (gid, iris_top, p["eye"], _mix(p["eye"], "#FFFFFF", 0.35),
         cx, cx, gid, cx, cx, INK50, cx - 4.6, INK50, cx + 5, INK50, cx + 6.5, INK50,
         cx - 14, cx - 9, cx + 9, cx + 14, INK,
         cx + 13, cx + 19, INK, cx + 15, cx + 20, INK,
         cx - 8, cx - 4, cx + 4, cx + 8, INK)


def _sj_face(state, p, uid):
    if state in ("work", "think"):
        return _sj_eye(42, p, uid, state) + _sj_eye(78, p, uid, state)
    if state == "sleep":
        return ('<path d="M 29,56 C 35,68 49,68 55,56" fill="none" stroke="%s" stroke-width="4.6" stroke-linecap="round"></path>'
                '<path d="M 65,56 C 71,68 85,68 91,56" fill="none" stroke="%s" stroke-width="4.6" stroke-linecap="round"></path>'
                '<path d="M 55,56 L 61,50 M 91,56 L 97,50" stroke="%s" stroke-width="3" stroke-linecap="round"></path>'
                ) % (INK, INK, INK)
    if state == "done":
        return ('<path d="M 29,62 C 35,46 49,46 55,62" fill="none" stroke="%s" stroke-width="5" stroke-linecap="round"></path>'
                '<path d="M 65,62 C 71,46 85,46 91,62" fill="none" stroke="%s" stroke-width="5" stroke-linecap="round"></path>'
                ) % (INK, INK)
    # fail: welling tears under wide, wobbling eyes
    return (_sj_eye(42, p, uid, state) + _sj_eye(78, p, uid, state) +
            '<path class="tear" d="M 33,72 C 37,82 37,88 33,88 C 29,88 29,82 33,72 Z" fill="#BFE6F5" opacity="0.85"></path>'
            '<path class="tear" style="animation-delay:-0.8s" d="M 87,72 C 91,82 91,88 87,88 '
            'C 83,88 83,82 87,72 Z" fill="#BFE6F5" opacity="0.85"></path>')


def _sj_mouth(state, p):
    if state == "work":
        return '<path d="M 55,80 C 57,85 63,85 65,80" fill="none" stroke="%s" stroke-width="2.6" stroke-linecap="round"></path>' % INK
    if state == "think":
        return '<path d="M 54,81 C 57,78 63,84 66,80" fill="none" stroke="%s" stroke-width="2.6" stroke-linecap="round"></path>' % INK
    if state == "sleep":
        return '<ellipse cx="60" cy="80" rx="3.2" ry="4" fill="%s" opacity="0.7"></ellipse>' % INK
    if state == "done":
        return ('<path d="M 50,76 C 54,89 66,89 70,76 Z" fill="%s"></path>'
                '<path d="M 55,84 C 57,87 63,87 65,84 Z" fill="#E48AA0"></path>') % INK
    return '<path d="M 52,82 C 55,77 58,87 61,82 C 64,77 67,87 70,82" fill="none" stroke="%s" stroke-width="2.6" stroke-linecap="round"></path>' % INK


def shojo(state, uid=0):
    p = PAL[state]
    tone = "sjt%s" % uid
    hair = "".join(
        '<path class="tent" style="animation-delay: %ss" d="%s" fill="none" stroke="%s" '
        'stroke-width="%s" stroke-linecap="round"></path>'
        '<path class="tent gloss" style="animation-delay: %ss" d="%s" fill="none" stroke="%s" '
        'stroke-width="%s" stroke-linecap="round" opacity="0.5"></path>'
        % (-i * 0.6, base, p["rim"], w, -i * 0.6, gloss, _mix(p["rim"], "#FFFFFF", 0.55), w * 0.3)
        for i, (base, gloss, w) in enumerate(SJ_HAIR))
    sparks = "".join(
        '<path class="spark" style="animation-delay: %ss" d="M %s,%s L %s,%s L %s,%s L %s,%s L %s,%s '
        'L %s,%s L %s,%s L %s,%s Z" fill="%s"></path>'
        % (-i * 0.55, x, y - s, x + s * 0.28, y - s * 0.28, x + s, y, x + s * 0.28, y + s * 0.28,
           x, y + s, x - s * 0.28, y + s * 0.28, x - s, y, x - s * 0.28, y - s * 0.28,
           _mix(p["eye"], "#FFFFFF", 0.4))
        for i, (x, y, s) in enumerate([(104, 28, 9), (14, 40, 6.5), (100, 78, 5.5), (20, 84, 4.5)]))
    blush = ""
    if state != "sleep":
        blush = ('<g class="blush"><ellipse cx="30" cy="72" rx="7" ry="4.2" fill="#E0708A" opacity="0.5"></ellipse>'
                 '<ellipse cx="90" cy="72" rx="7" ry="4.2" fill="#E0708A" opacity="0.5"></ellipse>'
                 '<path d="M 27,70 L 30,75 M 31,70 L 34,75 M 87,70 L 90,75 M 91,70 L 94,75" '
                 'stroke="#E0708A" stroke-width="1.3" stroke-linecap="round" opacity="0.75"></path></g>')
    return (
        '<svg class="oc" viewBox="0 0 120 122">'
        '<defs><pattern id="%s" width="4" height="4" patternUnits="userSpaceOnUse">'
        '<circle cx="1.4" cy="1.4" r="1.1" fill="#000000" opacity="0.3"></circle></pattern></defs>'
        '%s%s'
        '<path d="%s" fill="%s" stroke="%s" stroke-width="3" stroke-linejoin="round"></path>'
        '<path d="M 95,74 C 98,36 81,14 60,14 C 76,24 87,44 84,74 C 84,84 74,90 60,91 '
        'C 81,91 95,86 95,74 Z" fill="url(#%s)"></path>'
        '<path class="rimlight" d="M 31,54 C 30,32 42,19 57,17" fill="none" stroke="%s" '
        'stroke-width="4.5" stroke-linecap="round" opacity="0.5"></path>'
        '%s<g class="eyes">%s</g>%s'
        '</svg>'
    ) % (tone, hair, sparks, SJ_HEAD, p["body"], p["rim"], tone,
         _mix(p["rim"], "#FFFFFF", 0.6), blush, _sj_face(state, p, uid), _sj_mouth(state, p))


# =========================================================================
# H — Shounen. Jump battle page: heavy varying ink, one hard cel terminator,
#     converging speed lines, an aura that crackles.
# =========================================================================
SN_HEAD = ("M 24,70 C 22,34 40,12 60,12 C 80,12 98,34 96,70 "
           "C 96,84 80,93 60,93 C 40,93 24,84 24,70 Z")
SN_SHADOW = ("M 96,70 C 98,34 80,12 60,12 C 78,24 88,44 86,70 C 86,82 76,90 60,92 "
             "C 80,93 96,84 96,70 Z")
SN_ARMS = [
    ("M 30,86 C 22,98 19,110 26,119", 9),
    ("M 46,91 C 41,102 39,113 45,121", 7.5),
    ("M 60,93 C 60,105 58,115 63,122", 7),
    ("M 74,91 C 79,102 81,113 75,121", 7.5),
    ("M 90,86 C 98,98 101,110 94,119", 9),
]
SN_AURA = ("M 60,2 L 70,12 L 86,4 L 88,20 L 106,20 L 98,34 L 116,44 L 100,52 L 112,68 "
           "L 94,70 L 100,88 L 82,82 L 80,100 L 66,90 L 60,108 L 54,90 L 40,100 L 38,82 "
           "L 20,88 L 26,70 L 8,68 L 20,52 L 4,44 L 22,34 L 14,20 L 32,20 L 34,4 L 50,12 Z")


def _sn_face(state, p):
    e = p["eye"]
    if state == "sleep":
        return ('<path d="M 32,56 L 52,56 M 68,56 L 88,56" stroke="%s" stroke-width="4.5" stroke-linecap="round"></path>'
                '<path d="M 30,44 L 52,48 M 90,44 L 68,48" stroke="%s" stroke-width="5" stroke-linecap="round"></path>'
                % (INK, INK))
    if state == "done":
        return ('<path d="M 31,60 C 38,46 48,46 55,60" fill="none" stroke="%s" stroke-width="5.5" stroke-linecap="round"></path>'
                '<path d="M 65,60 C 72,46 82,46 89,60" fill="none" stroke="%s" stroke-width="5.5" stroke-linecap="round"></path>'
                '<path d="M 28,40 L 52,44 M 92,40 L 68,44" stroke="%s" stroke-width="5" stroke-linecap="round"></path>'
                % (INK, INK, INK))
    if state == "fail":
        return ('<path d="M 33,48 L 51,64 M 51,48 L 33,64 M 69,48 L 87,64 M 87,48 L 69,64" '
                'stroke="%s" stroke-width="4.5" stroke-linecap="round"></path>'
                '<g class="gloom" stroke="%s" stroke-width="2" opacity="0.55">'
                '<path d="M 30,14 L 30,32 M 38,11 L 38,30 M 46,10 L 46,28 M 54,9 L 54,27 '
                'M 62,9 L 62,27 M 70,10 L 70,28 M 78,11 L 78,30 M 86,14 L 86,32"></path></g>'
                % (INK, INK))
    narrow = state == "think"
    top = 52 if narrow else 48
    return ('<path d="M 30,%s L 53,56 L 53,63 L 30,58 Z" fill="%s"></path>'
            '<path d="M 90,%s L 67,56 L 67,63 L 90,58 Z" fill="%s"></path>'
            '<path d="M 34,%s L 53,52 L 53,57 L 34,54 Z" fill="%s"></path>'
            '<path d="M 86,%s L 67,52 L 67,57 L 86,54 Z" fill="%s"></path>'
            '<path d="M 27,%s L 52,44 L 52,39 L 28,%s Z" fill="%s"></path>'
            '<path d="M 93,%s L 68,44 L 68,39 L 92,%s Z" fill="%s"></path>'
            '<circle class="glint" cx="36" cy="55" r="2.4" fill="%s"></circle>'
            '<circle class="glint" cx="84" cy="55" r="2.4" fill="%s"></circle>'
            ) % (top, INK, top, INK, top + 2, e, top + 2, e,
                 38 if narrow else 34, 32 if narrow else 28, INK,
                 38 if narrow else 34, 32 if narrow else 28, INK, INK50, INK50)


def shounen(state, uid=0):
    p = PAL[state]
    dark = _mix(p["body"], "#000000", 0.42)
    arms = "".join(
        '<path class="tent" style="animation-delay: %ss" d="%s" fill="none" stroke="%s" '
        'stroke-width="%s" stroke-linecap="round"></path>'
        '<path class="tent" style="animation-delay: %ss" d="%s" fill="none" stroke="%s" '
        'stroke-width="%s" stroke-linecap="round"></path>'
        % (-i * 0.4, d, INK, w + 3.5, -i * 0.4, d, p["rim"], w)
        for i, (d, w) in enumerate(SN_ARMS))
    speed = ""
    if state in ("work", "think"):
        speed = ('<g class="speed" stroke="%s" stroke-width="2.4" stroke-linecap="round" opacity="0.8">'
                 '<path d="M 2,18 L 22,26 M 0,42 L 20,45 M 1,66 L 21,64 M 4,88 L 23,82"></path></g>'
                 % p["rim"])
    aura = ""
    if state in ("work", "done"):
        aura = ('<path class="aura" d="%s" fill="none" stroke="%s" stroke-width="2.5" opacity="0.55"></path>'
                % (SN_AURA, p["eye"]))
    flash = ('<path class="flash" d="%s" fill="%s" opacity="0"></path>' % (SN_HEAD, INK50)
             if state == "done" else "")
    return (
        '<svg class="oc" viewBox="0 0 120 122">%s%s%s'
        '<path d="%s" fill="%s" stroke="%s" stroke-width="5" stroke-linejoin="round"></path>'
        '<path d="%s" fill="%s"></path>'
        '<path d="M 33,48 C 32,30 42,18 55,15" fill="none" stroke="%s" stroke-width="4" '
        'stroke-linecap="round" opacity="0.22"></path>'
        '%s%s</svg>'
    ) % (aura, speed, arms, SN_HEAD, p["body"], INK, SN_SHADOW, dark, INK50,
         _sn_face(state, p), flash)


# =========================================================================
# I — OVA. 1988 direct-to-video cel: airbrushed gradients, halation bloom
#     around anything bright, maroon line art, grain, three-frame holds.
# =========================================================================
OV_HEAD = ("M 26,74 C 23,36 40,15 60,15 C 80,15 97,36 94,74 "
           "C 94,86 80,93 60,93 C 40,93 26,86 26,74 Z")
OV_LINE = "#3A2226"
OV_ARMS = [
    ("M 30,87 C 23,99 20,110 27,118", 8),
    ("M 46,92 C 42,103 40,113 46,120", 7),
    ("M 60,93 C 60,105 59,114 63,121", 6.5),
    ("M 74,92 C 78,103 80,113 74,120", 7),
    ("M 90,87 C 97,99 100,110 93,118", 8),
]


def _ov_face(state, p, uid):
    e = _mix(p["eye"], "#8A7F6A", 0.28)
    if state == "sleep":
        return ('<path d="M 32,57 C 38,64 50,64 56,57 M 64,57 C 70,64 82,64 88,57" fill="none" '
                'stroke="%s" stroke-width="3.4" stroke-linecap="round"></path>' % OV_LINE)
    if state == "done":
        return ('<path d="M 32,60 C 38,50 50,50 56,60 M 64,60 C 70,50 82,50 88,60" fill="none" '
                'stroke="%s" stroke-width="3.4" stroke-linecap="round"></path>' % OV_LINE)
    if state == "fail":
        return ('<path d="M 34,50 L 50,63 M 50,50 L 34,63 M 70,50 L 86,63 M 86,50 L 70,63" '
                'fill="none" stroke="%s" stroke-width="3.4" stroke-linecap="round"></path>' % OV_LINE)
    gid = "ov%s" % uid
    return (
        '<defs><radialGradient id="%s" cx="0.4" cy="0.32" r="0.8">'
        '<stop offset="0" stop-color="%s"></stop>'
        '<stop offset="1" stop-color="%s"></stop></radialGradient></defs>'
        '<ellipse cx="44" cy="56" rx="11" ry="12.5" fill="#E6DED2"></ellipse>'
        '<ellipse cx="76" cy="56" rx="11" ry="12.5" fill="#E6DED2"></ellipse>'
        '<circle class="halo-e" cx="44" cy="57" r="8.5" fill="url(#%s)"></circle>'
        '<circle class="halo-e" cx="76" cy="57" r="8.5" fill="url(#%s)"></circle>'
        '<path d="M 44,57 L 44,49 M 44,57 L 51,60 M 44,57 L 38,62" stroke="%s" stroke-width="1.1" opacity="0.5"></path>'
        '<path d="M 76,57 L 76,49 M 76,57 L 83,60 M 76,57 L 70,62" stroke="%s" stroke-width="1.1" opacity="0.5"></path>'
        '<circle cx="44" cy="57" r="3.6" fill="#1A1418"></circle>'
        '<circle cx="76" cy="57" r="3.6" fill="#1A1418"></circle>'
        '<circle cx="41" cy="52" r="2.6" fill="#FFFFFF" opacity="0.95"></circle>'
        '<circle cx="73" cy="52" r="2.6" fill="#FFFFFF" opacity="0.95"></circle>'
        '<path d="M 32,46 C 38,40 50,40 56,45 M 88,46 C 82,40 70,40 64,45" fill="none" '
        'stroke="%s" stroke-width="3.6" stroke-linecap="round"></path>'
        '<path d="M 33,50 C 39,45 50,45 55,49 M 87,50 C 81,45 70,45 65,49" fill="none" '
        'stroke="#000000" stroke-width="3" opacity="0.28" stroke-linecap="round"></path>'
    ) % (gid, _mix(e, "#FFFFFF", 0.35), _mix(e, "#241A1E", 0.55), gid, gid,
         OV_LINE, OV_LINE, OV_LINE)


def ova(state, uid=0):
    p = PAL[state]
    bid, gid = "ovb%s" % uid, "ovg%s" % uid
    body_hi = _mix(p["body"], "#C8BCA8", 0.34)
    body_lo = _mix(p["body"], "#000000", 0.4)
    rim = _mix(p["rim"], "#B0A48C", 0.3)
    arms = "".join(
        '<path class="tent" style="animation-delay: %ss" d="%s" fill="none" stroke="%s" '
        'stroke-width="%s" stroke-linecap="round"></path>' % (-i * 0.55, d, rim, w)
        for i, (d, w) in enumerate(OV_ARMS))
    return (
        '<svg class="oc" viewBox="0 0 120 122">'
        '<defs>'
        '<linearGradient id="%s" x1="0.25" y1="0" x2="0.85" y2="1">'
        '<stop offset="0" stop-color="%s"></stop>'
        '<stop offset="0.55" stop-color="%s"></stop>'
        '<stop offset="1" stop-color="%s"></stop></linearGradient>'
        '<pattern id="%s" width="3" height="3" patternUnits="userSpaceOnUse">'
        '<circle cx="0.8" cy="0.8" r="0.6" fill="#FFFFFF" opacity="0.05"></circle>'
        '<circle cx="2.2" cy="2.1" r="0.5" fill="#000000" opacity="0.07"></circle></pattern>'
        '</defs>'
        '%s'
        '<path class="halation" d="%s" fill="none" stroke="%s" stroke-width="11" opacity="0.13"></path>'
        '<path d="%s" fill="url(#%s)" stroke="%s" stroke-width="2.6" stroke-linejoin="round"></path>'
        '<path d="M 36,44 C 36,28 46,19 58,18" fill="none" stroke="#FFFFFF" stroke-width="6" '
        'stroke-linecap="round" opacity="0.3"></path>'
        '%s'
        '<path d="%s" fill="url(#%s)"></path>'
        '<rect class="scanlines" x="0" y="0" width="120" height="122" fill="url(#%s)" opacity="0.9"></rect>'
        '</svg>'
    ) % (bid, body_hi, p["body"], body_lo, gid, arms,
         OV_HEAD, _mix(p["rim"], "#FFFFFF", 0.2), OV_HEAD, bid, OV_LINE,
         _ov_face(state, p, uid), OV_HEAD, gid, gid)


BUILD.update({"shojo": shojo, "shounen": shounen, "ova": ova})
NEEDS_UID.update({"shojo", "shounen", "ova"})
