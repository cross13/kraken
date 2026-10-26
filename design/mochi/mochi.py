"""Mochi as static SVG for the design boards.

Mirrors the app's `src/components/wide/OctoMascot.tsx` (itself a port of the
sibling Cross app's `Sources/CrossKit/Mascot.swift`): the same 200 x 200 box,
the same five states and three levels of detail. Colours are Signal's literals,
because a design board has no theme variables: the body is always Mochi's own
lavender / cyan / magenta, and the light behind the visor is the state's token.

Animation hooks are plain class names (`mochi-scan`, `mochi-led`, ...); a board
that wants motion includes MOCHI_CSS once.
"""

LIGHT = {
    'work': '#C4F06A',   # --accent-num
    'think': '#C9A9FF',  # --agent-text
    'sleep': 'rgba(155,107,255,0.8)',  # --agent / 0.8
    'done': '#A6E62E',   # --accent-text
    'fail': '#FF8A72',   # --danger-text
}
CYAN, MAGENTA, TRACE = '#3EF0FF', '#FF3EA5', '#2FD6E8'
INK, GLASS, MOUTH = '#2E2850', '#120F22', '#4A3F6B'
BODY = 'M 30,150 C 30,96 60,62 100,62 C 140,62 170,96 170,150 C 170,168 150,173 100,173 C 50,173 30,168 30,150 Z'

MOCHI_CSS = """
/* Mochi (design/mochi/mochi.py) */
@keyframes mochi-scan { from { transform: translateX(-20px); } to { transform: translateX(104px); } }
@keyframes mochi-look { 0%, 100% { transform: translateX(-2px); } 50% { transform: translateX(4px); } }
@keyframes mochi-led { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
@keyframes mochi-flow { to { stroke-dashoffset: -16; } }
@keyframes mochi-thought { 0%, 100% { opacity: 0.25; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-3px); } }
@keyframes mochi-blink { 0%, 91%, 100% { transform: scaleY(1); } 93.5% { transform: scaleY(0.06); } 96% { transform: scaleY(1); } }
@keyframes mochi-spark { 0%, 100% { opacity: 0.25; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } }
.mochi-scan { animation: mochi-scan 1.1s linear infinite; }
.mochi-look { animation: mochi-look 3s ease-in-out infinite; }
.mochi-led { animation: mochi-led 1.8s ease-in-out infinite; }
.mochi-led.fast { animation-duration: 0.5s; }
.mochi-flow { animation: mochi-flow 1.4s linear infinite; }
.mochi-thought { animation: mochi-thought 1.2s ease-in-out infinite; }
.mochi-eyes { transform-box: view-box; transform-origin: 100px 109px; animation: mochi-blink 4.4s infinite; }
.mochi-spark { transform-box: fill-box; transform-origin: 50% 50%; animation: mochi-spark 1.1s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .mochi-scan, .mochi-look, .mochi-led, .mochi-flow, .mochi-thought, .mochi-eyes, .mochi-spark { animation: none; }
}
"""


def _eyes(state, light, mark):
    both = lambda f: f(0) + f(40)
    if state == 'work' and not mark:
        return (f'<rect class="mochi-scan" x="50" y="90" width="16" height="38" fill="{light}" opacity="0.35"/>'
                + both(lambda dx: f'<rect x="{73 + dx}" y="104" width="14" height="9" rx="3" fill="{light}"/>'))
    if state == 'think':
        return ('<g class="mochi-look">'
                + both(lambda dx: f'<rect x="{70 + dx}" y="97" width="11" height="13" rx="5" fill="{light}"/>') + '</g>')
    if state == 'sleep':
        return both(lambda dx: f'<path d="M {73 + dx},110 Q {80 + dx},115 {87 + dx},110" fill="none" stroke="{light}" '
                               'stroke-width="3.5" stroke-linecap="round" opacity="0.8"/>')
    if state == 'done':
        return both(lambda dx: f'<path d="M {72 + dx},113 L {80 + dx},104 L {88 + dx},113" fill="none" stroke="{light}" '
                               'stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>')
    if state == 'fail':
        return both(lambda dx: f'<path d="M {74 + dx},103 L {86 + dx},115 M {86 + dx},103 L {74 + dx},115" fill="none" '
                               f'stroke="{light}" stroke-width="4" stroke-linecap="round"/>')
    return ('<g class="mochi-eyes">'
            + both(lambda dx: f'<rect x="{74 + dx}" y="100" width="12" height="18" rx="5" fill="{light}"/>') + '</g>')


def _mouth(state):
    if state == 'think':
        return f'<ellipse cx="100" cy="142" rx="3.6" ry="4.2" fill="{MOUTH}"/>'
    if state == 'sleep':
        return f'<ellipse cx="100" cy="142" rx="2.6" ry="2" fill="{MOUTH}"/>'
    if state == 'done':
        return f'<path d="M 91,138 Q 100,151 109,138 Z" fill="{MOUTH}"/>'
    if state == 'fail':
        return (f'<path d="M 89,143 L 93,140 L 97,143 L 101,140 L 105,143 L 109,140" fill="none" stroke="{MOUTH}" '
                'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>')
    return (f'<path d="M 92,140 Q 96,144 100,140 Q 104,144 108,140" fill="none" stroke="{MOUTH}" '
            'stroke-width="2.6" stroke-linecap="round"/>')


def mochi_svg(state='work', detail='full', uid='m', attrs='style="display:block;width:100%;height:auto;overflow:visible"'):
    """One Mochi. `uid` must be unique within the document (gradient/clip/filter ids)."""
    light = LIGHT[state]
    full, mark = detail == 'full', detail == 'mark'
    i = lambda n: f'{n}-{uid}'
    out = [f'<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" {attrs}>',
           '<defs>',
           f'<linearGradient id="{i("skin")}" x1="100" y1="62" x2="100" y2="173" gradientUnits="userSpaceOnUse">'
           '<stop offset="0" stop-color="#FFFBFF"/><stop offset="0.6" stop-color="#EDE4FF"/><stop offset="1" stop-color="#C4B3EE"/></linearGradient>',
           f'<linearGradient id="{i("rim")}" x1="30" y1="110" x2="170" y2="110" gradientUnits="userSpaceOnUse">'
           f'<stop offset="0" stop-color="{CYAN}" stop-opacity="0.9"/><stop offset="1" stop-color="{MAGENTA}" stop-opacity="0.9"/></linearGradient>',
           f'<clipPath id="{i("visor")}"><rect x="50" y="90" width="100" height="38" rx="19"/></clipPath>',
           f'<filter id="{i("glow")}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter>',
           f'<filter id="{i("halo")}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>',
           '</defs>']
    if full:
        out.append(f'<ellipse cx="100" cy="128" rx="64" ry="46" fill="{light}" opacity="0.3" filter="url(#{i("halo")})"/>')
    out.append(f'<ellipse cx="100" cy="177" rx="62" ry="6" fill="{light}" opacity="0.4"/>')
    out.append(f'<path d="M 110,64 C 112,52 116,46 124,40" fill="none" stroke="{INK}" stroke-width="{6 if mark else 3.2}" stroke-linecap="round"/>')
    led_cls = 'mochi-led fast' if state in ('work', 'fail') else ('' if state == 'sleep' else 'mochi-led')
    led_op = ' opacity="0.25"' if state == 'sleep' else ''
    out.append(f'<g class="{led_cls}"{led_op}>' + ('' if mark else f'<circle cx="125" cy="39" r="9" fill="{light}" opacity="0.28"/>')
               + f'<circle cx="125" cy="39" r="{8 if mark else 4.6}" fill="{light}"/></g>')
    out.append(f'<path d="{BODY}" fill="url(#{i("skin")})" stroke="url(#{i("rim")})" stroke-width="{6 if mark else 2.6}"/>')
    if not mark:
        out.append('<ellipse cx="68" cy="82" rx="13" ry="5.5" fill="#fff" opacity="0.9" transform="rotate(-30 68 82)"/>')
        flow = '' if state == 'sleep' else ' class="mochi-flow"'
        out.append(f'<path{flow} d="M 38,152 L 52,152 L 60,160 L 72,160 M 162,152 L 148,152 L 140,160 L 128,160" fill="none" '
                   f'stroke="{TRACE}" stroke-width="1.7" stroke-dasharray="5 3" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>')
        out.append(f'<circle cx="72" cy="160" r="2.4" fill="{TRACE}"/><circle cx="128" cy="160" r="2.4" fill="{TRACE}"/>'
                   f'<rect x="164" y="122" width="9" height="17" rx="2.5" fill="{INK}"/>'
                   f'<rect x="166" y="125" width="5" height="3" rx="1" fill="{CYAN}"/><rect x="166" y="131" width="5" height="3" rx="1" fill="{MAGENTA}"/>'
                   f'<rect x="55" y="134" width="15" height="5" rx="2.5" fill="{MAGENTA}" opacity="0.6"/>'
                   f'<rect x="130" y="134" width="15" height="5" rx="2.5" fill="{MAGENTA}" opacity="0.6"/>')
    out.append(f'<rect x="50" y="90" width="100" height="38" rx="19" fill="{GLASS}" stroke="{INK}" stroke-width="{3 if mark else 2}"/>')
    eyes = _eyes(state, light, mark)
    out.append(f'<g clip-path="url(#{i("visor")})">' + ('' if mark else f'<g filter="url(#{i("glow")})">{eyes}</g>') + eyes + '</g>')
    if not mark:
        out.append('<path d="M 62,96 L 82,96" fill="none" stroke="#fff" stroke-opacity="0.22" stroke-width="2" stroke-linecap="round"/>')
        out.append(_mouth(state))
    if full and state == 'think':
        for cx, cy, r, d in ((66, 54, 3, 0), (55, 44, 4, 0.15), (42, 31, 5, 0.3)):
            out.append(f'<circle class="mochi-thought" cx="{cx}" cy="{cy}" r="{r}" fill="{light}" style="animation-delay:{d}s"/>')
    if full and state == 'done':
        for x, y, r, c, d in ((34, 74, 8, light, 0), (166, 62, 8, MAGENTA, 0.5), (176, 112, 6, CYAN, 1)):
            k = r * 0.28
            out.append(f'<path class="mochi-spark" fill="{c}" style="animation-delay:{d}s" d="M {x},{y - r} L {x + k},{y - k} L {x + r},{y} '
                       f'L {x + k},{y + k} L {x},{y + r} L {x - k},{y + k} L {x - r},{y} L {x - k},{y - k} Z"/>')
    out.append('</svg>')
    return ''.join(out)
