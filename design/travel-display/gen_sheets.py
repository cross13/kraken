# -*- coding: utf-8 -*-
import gen_octo_anime  # registers the three anime registers
import gen_octo_samurai  # registers A2
from gen_octo import octo, STATES, STATE_LABEL

NOTES = {
    "chibi": {
        "work": "ojos escaneando, boca decidida",
        "think": "violeta, boca en o &#8212; está resolviendo",
        "sleep": "ojos cerrados, zzz",
        "done": "ojos en arco, chispas",
        "fail": "X en los ojos, gota, tiembla",
    },
    "visor": {
        "work": "ranuras caídas al centro, líneas de acción",
        "think": "ranuras al ras y el pip parpadeando",
        "sleep": "vidrio apagado, la cresta se cae",
        "done": "ranuras en check, estrella de impacto",
        "fail": "glitch, copia fantasma, scanlines",
    },
    "pixel": {
        "work": "ojos con brillo que se mueve, patas alternando",
        "think": "violeta, mismo sprite, otro color",
        "sleep": "ojos en una línea, z de dos píxeles",
        "done": "ojos en ^, boca ancha, dos chispas",
        "fail": "X en los ojos, boca en zigzag, tiembla",
    },
    "neon": {
        "work": "tubo verde, carga corriendo el vidrio",
        "think": "violeta, mismos ojos, más lento",
        "sleep": "el tubo baja al 36% y respira",
        "done": "aro que se expande desde el centro",
        "fail": "el tubo está cortado y titila",
    },
    "term": {
        "work": "● ●, parpadeo por cambio de carácter",
        "think": "○ ○ con ? al lado",
        "sleep": "─ ─ con z, ciclo lento",
        "done": "^ ^ con boca ╰───╯ y *",
        "fail": "x x, boca ╲───╱, titila rápido",
    },
    "samurai": {
        "work": "sable desenvainado, corta y vuelve a la guardia",
        "think": "envainado, la mano tamborilea el tsuka",
        "sleep": "sable apoyado, casco cabeceando",
        "done": "chiburi &#8212; sacude la hoja, caen pétalos",
        "fail": "sable clavado, X en los ojos, gota",
    },
    "shojo": {
        "work": "iris en degradé, tres brillos, pestañas",
        "think": "mismos ojos, boca dudando",
        "sleep": "ojos cerrados con pestaña larga",
        "done": "ojos en arco, chispas rápidas",
        "fail": "lágrimas asomando, tiembla",
    },
    "shounen": {
        "work": "ojos angulares, aura, líneas de velocidad",
        "think": "mismos ojos más estrechos",
        "sleep": "ceño caído, ojos en línea",
        "done": "ojos en arco, cuadro de impacto",
        "fail": "X y rayado de tristeza en la frente",
    },
    "ova": {
        "work": "iris con radios, halación, párpado pesado",
        "think": "igual, más lento",
        "sleep": "párpados cerrados, bloom bajo",
        "done": "halación al doble de velocidad",
        "fail": "error de tracking, la imagen salta",
    },
    "ink": {
        "work": "ojos escaneando, boca decidida",
        "think": "violeta, boca en o &#8212; está resolviendo",
        "sleep": "ojos cerrados, zzz",
        "done": "ojos en arco, chispas",
        "fail": "X en los ojos, gota, tiembla",
    },
}

DIRS = {
    "ChibiOcto": dict(
        style="chibi", name="A &#8212; Chibi",
        what="Cabeza grande, ojos enormes con dos brillos, seis brazos cortos que se enroscan. "
             "<b>La cara hace todo el trabajo</b>: los cinco estados se distinguen sin leer una palabra.",
        motion="<b>Squash &amp; stretch</b> en el bob (se estira al subir, se aplasta al caer), "
               "parpadeo cada ~4 segundos, brazos que ondean desfasados y cachetes que laten. "
               "Al terminar da un saltito con chispas; al fallar tiembla y le sale una gota.",
        con="Es el que más se aleja de la marca: el logo es geometría y esto es un personaje. "
            "A 34px los ojos siguen leyendo, pero la boca se pierde.",
    ),
    "VisorOcto": dict(
        style="visor", name="B &#8212; Visor",
        what="Un piloto de mecha, no el logo con un rectángulo pegado encima: el visor está "
             "<b>hundido en la cara</b> (vidrio doble, labio iluminado abajo), hay cresta, aletas "
             "en las sienes, rejillas en el cachete, línea de panel y cables acorazados con "
             "juntas. La sombra es un <b>corte duro de cel</b> con luz de borde, no una opacidad.",
        motion="Timing <b>&#8220;on twos&#8221;</b>: todo con <code>steps()</code>, nada suaviza. "
               "El destello es doble &#8212; una franja ancha y una fina &#8212; barre en 9 cuadros "
               "y después espera dos segundos. La baliza de la cresta parpadea. "
               "Trabajando tira líneas de acción; al terminar revienta una estrella; "
               "al fallar hace glitch con copia fantasma y scanlines.",
        con="Sigue siendo el menos tierno de los tres: no da tamagotchi, da HUD. "
            "A cambio es el que mejor aguanta 34px &#8212; el visor encendido es una sola barra "
            "que se lee siempre.",
    ),
    "InkOcto": dict(
        style="ink", name="C &#8212; Tinta",
        what="Una sola línea de pincel sobre una aguada, con el grosor variando por trazo. "
             "Los ojos son dos gotas de tinta con un mordisco de brillo.",
        motion="<b>La línea hierve</b>: son tres dibujos distintos alternando a 8 cuadros por segundo, "
               "como animación tradicional a mano. Nunca está quieto ni cuando no se mueve. "
               "Líneas de velocidad detrás cuando trabaja.",
        con="El más caro de mantener &#8212; cada estado son tres dibujos, no uno. Y a 34px el hervor "
            "deja de leerse como textura y se vuelve ruido.",
    ),
    "SamuraiOcto": dict(
        style="samurai", name="A2 &#8212; Chibi samurái",
        what="El A que te gustó, con <b>anatomía de armadura de verdad</b>, no un casco de sticker: "
             "cuenco de kabuto con costura y remaches, <b>kuwagata</b> (los dos cuernos de ciervo "
             "volante), fukigaeshi con el mon en las sienes, shikoro de dos placas laqueadas con su "
             "cordón, y una placa de mentón que deja la boca libre para seguir gesticulando. "
             "Los ojos, el rubor y la boca del chibi siguen intactos.",
        motion="El squash &amp; stretch de A, más el <b>arrastre</b> que hace que la armadura pese: "
               "el casco y el shikoro llegan un cuadro después que la cabeza. "
               "Y el <b>sable es el estado</b>: trabajando corta y vuelve a la guardia con un arco "
               "blanco; decidiendo está envainado y la mano tamborilea el tsuka; en cola queda "
               "apoyado; al terminar hace <b>chiburi</b> &#8212; sacude la sangre de la hoja &#8212; "
               "y caen pétalos; al fallar está clavado en el piso.",
        con="Es la más cargada de las diez: casco, cuernos, shikoro y sable son mucho borde en "
            "54px, y a 34px el kuwagata se funde con el cuenco. Además el sable ocupa toda la "
            "diagonal superior derecha, así que la criatura pesa visualmente más ancho de lo que "
            "mide &#8212; hay que darle aire o se pisa con la vecina.",
    ),
    "ShojoOcto": dict(
        style="shojo", name="G &#8212; Shōjo",
        what="Magical girl de los 90: <b>los ojos son el diseño</b>. Iris en degradé vertical, "
             "pupila, banda de luz, tres brillos apilados, pestaña superior gruesa con dos púas "
             "en el ángulo externo. Rubor con rayado diagonal, trama de puntos en la sombra, "
             "y los brazos son pelo &#8212; cada uno con su brillo corrido encima.",
        motion="Todo lento y con gracia: flota, parpadea cada 5 segundos, los brillos laten "
               "desfasados y la banda de luz del iris sube y baja. Las estrellas titilan girando. "
               "Al fallar se le <b>asoman las lágrimas</b> y tiembla.",
        con="Es el más caro de dibujar y el que peor aguanta el tamaño chico: a 34px los tres "
            "brillos se funden en una mancha blanca. Y es el más lejos del gris neutro de la app.",
    ),
    "ShounenOcto": dict(
        style="shounen", name="H &#8212; Shōnen",
        what="Página de Jump: <b>tinta negra pesada</b> de grosor variable, una sola sombra de cel "
             "con corte duro (color oscuro, no negro encima), ojos angulares con destello, "
             "cejas gruesas. Aura dentada alrededor, líneas de velocidad convergiendo.",
        motion="<b>Aguanta la pose y golpea</b>: nada deriva. El bob se queda quieto medio ciclo y "
               "después salta con una curva seca. El aura crepita en tres cuadros. "
               "Al terminar hay <b>cuadro de impacto</b> (destello blanco de la silueta entera); "
               "al fallar le cae el rayado de tristeza en la frente.",
        con="Es el más ruidoso de los ocho: aura, líneas de velocidad y destellos en nueve "
            "criaturas a la vez es mucho. Pide el modo quieto casi siempre.",
    ),
    "OvaOcto": dict(
        style="ova", name="I &#8212; OVA 88",
        what="Cel pintado a mano de un OVA directo a video: <b>degradés aerografiados</b> en vez de "
             "cel plano, línea granate en vez de negra, paleta desaturada, halación &#8212; el bloom "
             "que dejaban las zonas claras al pasar a cinta &#8212; y grano encima de todo.",
        motion="<b>Animación limitada</b>: tres cuadros sostenidos, nunca interpolación suave. "
               "La halación respira, las scanlines derivan un par de píxeles en loop. "
               "Al fallar hay <b>error de tracking</b>: la imagen salta de costado como una "
               "cinta gastada.",
        con="Los degradés y el grano son lo primero que se pierde al achicar: a 34px queda una "
            "mancha marrón. Y la paleta desaturada pelea con el verde saturado de la marca.",
    ),
    "PixelOcto": dict(
        style="pixel", name="D &#8212; Píxel",
        what="Un sprite de LCD de verdad: rejilla de 24&#215;24 celdas, cuatro colores, "
             "sombra de cel dura a la derecha. <b>Es el tamagotchi literal</b> &#8212; la referencia "
             "con la que empezaste esto.",
        motion="Dos dibujos alternando a <b>4 cuadros por segundo</b>, sin interpolar nada: "
               "el salto es de una celda entera y las patas se alternan como un ciclo de caminata. "
               "Durmiendo baja a 1.6s por ciclo; fallando se acelera a 0.22s y vibra.",
        con="El único que no escala: a 34px la celda mide 1.4px y el sprite se hace puré. "
            "Necesitaría un segundo sprite dibujado a 16&#215;16 para el arrecife.",
    ),
    "NeonOcto": dict(
        style="neon", name="E &#8212; Neón",
        what="No es un objeto, es <b>un tubo de luz</b>. Sin relleno: tres trazos apilados "
             "(ancho y tenue, medio, y un núcleo casi blanco) hacen el glow sin filtros. "
             "La pantalla es una barra encendida en un cuarto oscuro &#8212; una criatura hecha de "
             "luz es lo que corresponde al material.",
        motion="Una <b>carga brillante recorre el vidrio</b> en loop, y los brazos ondean "
               "desfasados. En cola el tubo baja al 36% y respira. Al terminar sale un aro "
               "expandiéndose. Al fallar el tubo <b>está cortado</b> &#8212; el arco no cierra &#8212; "
               "y titila con el ritmo irregular de un neón roto.",
        con="Sin relleno no hay silueta: sobre un fondo claro se pierde. Y los estados se "
            "distinguen por color e intensidad más que por dibujo, así que en escala de grises "
            "no se leen.",
    ),
    "TermOcto": dict(
        style="term", name="F &#8212; Terminal",
        what="La criatura dibujada con caracteres monoespaciados, como la dibujaría una CLI: "
             "marco de box-drawing, ojos que son glifos. <b>Es lo más Octo de las seis</b> &#8212; "
             "la app maneja el CLI de Claude, y esto es esa misma tipografía.",
        motion="Parpadea <b>cambiando de carácter</b>, no transformando: ● pasa a ─ por un cuadro "
               "cada 3.2 segundos, y los brazos cambian de glifo con él. El signo de al lado "
               "(z, ?, *, !) late como un cursor.",
        con="Muere abajo de 40px: cinco líneas de texto en 34px son 7px por línea, ilegible. "
            "Sólo funciona si la colonia cambia &#8212; menos criaturas y más grandes. "
            "Es una opción real, pero arrastra una decisión de layout con ella.",
    ),
}

HEAD = """<div class="bar">
    <div class="mark">%s</div>
    <div>
      <div class="hd-title disp">%s</div>
      <div class="hd-sub">Mascota del Travel Display &#183; cinco estados &#183; animada</div>
    </div>
  </div>"""


def sheet(key):
    d = DIRS[key]
    s = d["style"]
    states = "".join(
        '<div class="state">%s<div class="state-label">%s</div>'
        '<div class="state-note">%s</div></div>'
        % (octo(s, st, 92, delay="-%ss" % (i * 0.7)), STATE_LABEL[st], NOTES[s][st])
        for i, st in enumerate(STATES))

    real = (
        '<div class="real-item">%s<div class="txt"><b>54px</b><em>tamaño en la colonia</em></div></div>'
        '<div class="real-item">%s<div class="txt"><b>34px</b><em>colonia comprimida y arrecife</em></div></div>'
        '<div class="real-item">%s<div class="bub2">Edit src/lib/session.ts</div></div>'
        % (octo(s, "work", 54, "-0.3s"), octo(s, "work", 34, "-1.4s"), octo(s, "work", 54, "-2.1s")))

    return """<div class="root">
  %s
  <div class="sheet">
    <div>
      <div class="h2">La criatura <i></i> a 300px</div>
      <div class="hero">
        <div class="hero-stage">%s</div>
        <div class="hero-copy">
          <div class="hero-name disp">%s</div>
          <p>%s</p>
          <p><b>Movimiento.</b> %s</p>
          <p class="con"><b>Contra.</b> %s</p>
        </div>
      </div>
    </div>
    <div>
      <div class="h2">Los cinco estados <i></i> a 92px</div>
      <div class="states">%s</div>
    </div>
    <div>
      <div class="h2">A tamaño real <i></i> la prueba que importa</div>
      <div class="real">%s</div>
    </div>
  </div>
</div>
""" % (HEAD % (octo(s, "work", 26, "-0.9s"), d["name"]),
       octo(s, "work", 210), d["name"], d["what"], d["motion"], d["con"], states, real)


for key in DIRS:
    open("%s.body.html" % key, "w").write(sheet(key))
    print("wrote %s.body.html" % key)
