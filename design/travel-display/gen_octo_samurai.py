# -*- coding: utf-8 -*-
"""A2 — the chibi as a samurai. Armour anatomy, not a helmet sticker:
kabuto bowl + kuwagata horns + fukigaeshi + shikoro, a chin plate, and a
katana whose POSE is the run's state."""
from gen_octo import PAL, INK50, BUILD, NEEDS_UID, CH_HEAD, CH_SHADE, _ch_eyes, _ch_mouth

STEEL, SPINE, LACQ = "#E8ECE0", "#8E9880", "#161616"

# The six arms. The rightmost one is the sword hand and is re-pathed per state.
SM_ARMS = [
    ("M 31,88 C 26,99 24,108 29,112 C 32,114 35,111 34,107", 8.0, "-0.1s"),
    ("M 43,92 C 40,102 39,111 43,115", 7.0, "-0.5s"),
    ("M 55,94 C 54,104 53,112 56,116", 6.4, "-0.9s"),
    ("M 67,94 C 68,104 69,112 66,116", 6.4, "-1.3s"),
    ("M 79,92 C 82,102 83,111 79,115", 7.0, "-1.7s"),
]
SM_HAND = {
    "work":  "M 91,88 C 99,86 105,82 101,75",
    "think": "M 91,88 C 98,88 103,84 100,78",
    "sleep": "M 91,88 C 97,94 100,102 95,108",
    "done":  "M 91,88 C 99,85 104,80 100,74",
    "fail":  "M 91,88 C 97,96 99,104 94,110",
}
# Where the sword sits, and how it is being held.
SM_SWORD_TF = {
    "work":  "translate(0,0) rotate(-6 100 76)",
    "think": "translate(0,0)",
    "sleep": "rotate(26 96 104)",
    "done":  "rotate(-16 100 74)",
    "fail":  "rotate(150 96 104)",
}

KABUTO = "M 25,50 C 25,29 40,15 60,15 C 80,15 95,29 95,50 Z"
BRIM = "M 19,49 L 101,49 L 96,59 L 24,59 Z"
KUWA_L = "M 51,49 C 43,37 35,25 33,10 C 39,19 50,31 56,43 Z"
KUWA_R = "M 69,49 C 77,37 85,25 87,10 C 81,19 70,31 64,43 Z"
FUKI_L = "M 25,45 L 11,41 L 9,59 L 24,59 Z"
FUKI_R = "M 95,45 L 109,41 L 111,59 L 96,59 Z"
SHIKORO = [
    ("M 23,59 L 9,62 L 7,72 L 23,70 Z", "M 97,59 L 111,62 L 113,72 L 97,70 Z"),
    ("M 23,70 L 7,73 L 6,84 L 24,81 Z", "M 97,70 L 113,73 L 114,84 L 96,81 Z"),
]
CHIN = "M 47,84 L 73,84 L 71,93 L 49,93 Z"


def _sm_sword(state, p):
    """Blade, guard and wrapped hilt, in one group the state can pose."""
    if state == "think":
        # Sheathed: only the hilt shows above the scabbard's mouth.
        return (
            '<g class="sword">'
            '<path d="M 92,80 L 100,74 L 118,96 L 110,102 Z" fill="#1C1C1C" stroke="%s" '
            'stroke-width="2" stroke-linejoin="round"></path>'
            '<path d="M 96,77 L 101,73 L 108,81 L 103,85 Z" fill="%s"></path>'
            '<path d="M 99,70 L 104,66 L 110,73 L 105,77 Z" fill="%s"></path>'
            '<path d="M 100,68 L 106,74 M 102,66 L 108,72" stroke="#0E0E0E" stroke-width="1.4"></path>'
            '</g>' % (p["rim"], p["eye"], LACQ))
    dulled = state == "fail"
    blade = "#B9BEB2" if dulled else STEEL
    return (
        '<g class="sword">'
        '<path d="M 97,79 L 103,74 L 119,20 L 113,17 Z" fill="%s" stroke="%s" '
        'stroke-width="1.4" stroke-linejoin="round"></path>'
        '<path d="M 100,76 L 115,20" stroke="%s" stroke-width="1.2" opacity="0.85"></path>'
        '<path d="M 94,80 L 104,72 L 109,78 L 99,86 Z" fill="%s"></path>'
        '<path d="M 89,88 L 97,81 L 102,87 L 94,94 Z" fill="%s"></path>'
        '<path d="M 91,88 L 96,93 M 94,85 L 99,90" stroke="%s" stroke-width="1.4" opacity="0.7"></path>'
        '</g>' % (blade, SPINE, INK50, p["eye"], LACQ, p["eye"]))


def _sm_extra(state, p):
    if state == "work":
        return ('<path class="slash" d="M 30,26 C 56,8 90,10 112,30" fill="none" stroke="%s" '
                'stroke-width="3" stroke-linecap="round" opacity="0"></path>' % INK50)
    if state == "done":
        petals = "".join(
            '<path class="petal" style="animation-delay: %ss" d="M %s,%s C %s,%s %s,%s %s,%s '
            'C %s,%s %s,%s %s,%s Z" fill="#E88AA6" opacity="0.9"></path>'
            % (-i * 0.9, x, y, x + 4, y - 3, x + 6, y + 2, x, y + 6,
               x - 6, y + 2, x - 4, y - 3, x, y)
            for i, (x, y) in enumerate([(16, 22), (104, 60), (30, 96), (96, 14)]))
        return ('<path class="chiburi" d="M 104,72 C 112,64 116,52 114,40" fill="none" stroke="%s" '
                'stroke-width="2.4" stroke-linecap="round" opacity="0"></path>%s' % (INK50, petals))
    if state == "fail":
        return ('<path class="drop" d="M 20,30 C 25,39 25,45 20,45 C 15,45 15,39 20,30 Z" '
                'fill="#B4B4B4" opacity="0.8"></path>')
    if state == "sleep":
        return ('<text class="zt" x="16" y="34" font-family="\'Space Grotesk\', sans-serif" '
                'font-size="15" font-weight="700" fill="%s">z</text>'
                '<text class="zt" style="animation-delay:-1.4s" x="7" y="24" '
                'font-family="\'Space Grotesk\', sans-serif" font-size="11" font-weight="700" '
                'fill="%s" opacity="0.7">z</text>') % (p["eye"], p["eye"])
    return ""


def samurai(state, uid=0):
    p = PAL[state]
    arms = "".join(
        '<path class="tent" style="animation-delay: %s" d="%s" fill="none" stroke="%s" '
        'stroke-width="%s" stroke-linecap="round"></path>' % (d, path, p["rim"], w)
        for path, w, d in SM_ARMS)
    hand = ('<path class="hand" d="%s" fill="none" stroke="%s" stroke-width="7.6" '
            'stroke-linecap="round"></path>' % (SM_HAND[state], p["rim"]))
    shikoro = "".join(
        '<path class="shikoro" d="%s" fill="%s" stroke="%s" stroke-width="1.6" '
        'stroke-linejoin="round"></path>'
        '<path class="shikoro" d="%s" fill="%s" stroke="%s" stroke-width="1.6" '
        'stroke-linejoin="round"></path>' % (l, LACQ, p["rim"], r, LACQ, p["rim"])
        for l, r in SHIKORO)
    lacing = ('<g class="shikoro" stroke="%s" stroke-width="1.5" stroke-linecap="round" opacity="0.9">'
              '<path d="M 12,64 L 12,69 M 17,63 L 17,68 M 11,75 L 11,80 M 16,74 L 16,79"></path>'
              '<path d="M 108,64 L 108,69 M 103,63 L 103,68 M 109,75 L 109,80 M 104,74 L 104,79"></path>'
              '</g>' % p["eye"])
    blush = ""
    if state in ("work", "think", "done"):
        blush = ('<g class="blush"><ellipse cx="31" cy="72" rx="6" ry="3.6" fill="%s"></ellipse>'
                 '<ellipse cx="89" cy="72" rx="6" ry="3.6" fill="%s"></ellipse></g>'
                 % (p["tint"], p["tint"]))
    return (
        '<svg class="oc" viewBox="0 0 120 122">'
        '%s%s'
        '<path d="%s" fill="%s" stroke="%s" stroke-width="3.5" stroke-linejoin="round"></path>'
        '<path d="%s" fill="#000000" opacity="0.24"></path>'
        '%s<g class="eyes">%s</g>%s'
        '<path d="%s" fill="%s" stroke="%s" stroke-width="1.8" stroke-linejoin="round"></path>'
        '<path d="M 55,88 L 65,88" stroke="%s" stroke-width="1.4" opacity="0.8"></path>'
        '%s%s'
        '<g class="crest">'
        '<path d="%s" fill="%s" stroke="%s" stroke-width="1.8" stroke-linejoin="round"></path>'
        '<path d="%s" fill="%s" stroke="%s" stroke-width="1.8" stroke-linejoin="round"></path>'
        '<circle cx="16" cy="50" r="3.4" fill="%s"></circle>'
        '<circle cx="104" cy="50" r="3.4" fill="%s"></circle>'
        '<path d="%s" fill="%s" stroke="%s" stroke-width="2" stroke-linejoin="round"></path>'
        '<path d="M 60,15 L 60,49" stroke="#000000" stroke-width="1.5" opacity="0.45"></path>'
        '<circle cx="60" cy="20" r="3.2" fill="%s"></circle>'
        '<g fill="%s" opacity="0.85"><circle cx="38" cy="34" r="1.5"></circle>'
        '<circle cx="47" cy="25" r="1.5"></circle><circle cx="73" cy="25" r="1.5"></circle>'
        '<circle cx="82" cy="34" r="1.5"></circle></g>'
        '<path d="%s" fill="%s" stroke="%s" stroke-width="1.8" stroke-linejoin="round"></path>'
        '<path d="%s" fill="%s"></path><path d="%s" fill="%s"></path>'
        '<circle cx="60" cy="44" r="5" fill="%s" stroke="%s" stroke-width="1.6"></circle>'
        '</g>'
        '%s%s%s'
        '</svg>'
    ) % (arms, hand,
         CH_HEAD, p["body"], p["rim"], CH_SHADE,
         blush, _ch_eyes(state, p), _ch_mouth(state, p),
         CHIN, LACQ, p["rim"], p["eye"],
         shikoro, lacing,
         FUKI_L, LACQ, p["rim"], FUKI_R, LACQ, p["rim"], p["eye"], p["eye"],
         KABUTO, LACQ, p["rim"], p["eye"], p["eye"],
         BRIM, LACQ, p["rim"], KUWA_L, p["eye"], KUWA_R, p["eye"],
         LACQ, p["eye"],
         '<g class="swordwrap" transform="%s">%s</g>' % (SM_SWORD_TF[state], _sm_sword(state, p)),
         _sm_extra(state, p), "")


BUILD["samurai"] = samurai
NEEDS_UID.add("samurai")
