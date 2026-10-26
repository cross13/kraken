"""Swap the octopus for Mochi in the design boards that show the current app.

    python3 design/mochi/apply.py [files...]

Every inline octopus SVG (the samurai's head path, or the older visored
creature's `46 26 108 146` box) is replaced by `mochi_svg`, keeping the
original element's attributes. The state comes from the surrounding markup
(`st-work`, `class="m sleep"`, ...; default `work`) and the detail from the
width it is drawn at (>= 64px full, >= 40px simple, else mark) — the same
thresholds as the app. Idempotent: a board with no octopus left is untouched
apart from the animation CSS, which is added once.

The style explorations (the `*Octo` boards, the brand directions) are history
and are deliberately left as they were.
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from mochi import MOCHI_CSS, mochi_svg  # noqa: E402

OCTO = re.compile(r'C 24,38|24 80C24 38|viewBox="46 26 108 146"')
STATE = re.compile(r'st-(work|think|sleep|done|fail)\b|class="m (done|sleep|fail|think)\b')


def detail_for(width):
    if width is None or width >= 64:
        return 'full'
    return 'simple' if width >= 40 else 'mark'


def width_near(tag, before):
    m = re.search(r'\bwidth="([\d.]+)"', tag)
    if m:
        return float(m.group(1))
    found = re.findall(r'width:\s*([\d.]+)px', before[-400:])
    return float(found[-1]) if found else None


def swap(text, name):
    out, pos, n = [], 0, 0
    for m in re.finditer(r'<svg\b[^>]*>', text):
        if m.start() < pos:
            continue
        end = text.find('</svg>', m.end())
        if end < 0:
            break
        block = text[m.start():end + 6]
        if not OCTO.search(block) or '<svg' in block[4:]:
            continue
        before = text[max(0, m.start() - 900):m.start()]
        states = STATE.findall(before)
        state = next((a or b for a, b in reversed(states)), 'work') if states else 'work'
        tag = m.group(0)
        attrs = tag[4:-1].strip()
        attrs = re.sub(r'\s*viewBox="[^"]*"', '', attrs)
        attrs = re.sub(r'\s*xmlns="[^"]*"', '', attrs)
        w = re.search(r'\bwidth="([\d.]+)"', attrs)
        if w:  # Mochi is square
            attrs = re.sub(r'\bheight="[\d.]+"', f'height="{w.group(1)}"', attrs)
        n += 1
        out.append(text[pos:m.start()])
        out.append(mochi_svg(state, detail_for(width_near(tag, before)), f'{name}{n}', attrs))
        pos = end + 6
    out.append(text[pos:])
    result = ''.join(out)
    if n and 'mochi-scan {' not in result and '</style>' in result:
        result = result.replace('</style>', MOCHI_CSS + '</style>', 1)
    return result, n


if __name__ == '__main__':
    for f in sys.argv[1:]:
        p = Path(f)
        text = p.read_text()
        new, n = swap(text, re.sub(r'\W', '', p.stem)[:12])
        if new != text:
            p.write_text(new)
        print(f'{f}: {n} replaced')
