#!/usr/bin/env python3
"""tab2pdf — convierte una tablatura de armónica escrita en texto (.tab) en un PDF.

Uso:
    python3 tab2pdf.py <archivo.tab> [salida.pdf]

Si el .tab está en <Cancion>/02_editable/, el PDF se guarda en
<Cancion>/03_exportados/pdf/<nombre>.pdf. Si no, junto al .tab.

Formato del .tab (ver Tablatura_en_blanco.tab):
    # comentario (no sale en el PDF)
    titulo: ...             cabecera (antes de la primera sección)
    subtitulo: ...
    armonica: C             tono de la armónica (para los nombres de las notas)
    tonalidad: ...          texto libre
    fuente: ...             de dónde sale la tablatura (puede llevar un enlace)
    forma: G7 G7 G7 G7 | C7 C7 G7 G7 | D7 C7 G7 D7   (opcional, cuadro de compases)
    frases: 1 1 1 1 | 2 2 3 3 | 4 4 5 5                (opcional, qué frase va en cada compás)
    [Nombre | detalle | acorde]   empieza una sección
    > texto                      un párrafo de explicación
    -2 -2-2 4 456 _ -3' |        una línea de tablatura
        4  = soplar el hoyo 4      -4 = aspirar el hoyo 4
        44, -2-2, 456 = notas seguidas/rápidas (sin espacio)
        ' o /  = bend (bajar medio tono), -3'' o -3// = bend de un tono
        _  = pausa / espacio       |  = barra de compás
"""
import html
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

NOMBRES = ["Do", "Do♯", "Re", "Mi♭", "Mi", "Fa", "Fa♯", "Sol", "Sol♯", "La", "Si♭", "Si"]
TONOS = {"C": 0, "C#": 1, "DB": 1, "D": 2, "D#": 3, "EB": 3, "E": 4, "F": 5, "F#": 6,
         "GB": 6, "G": 7, "G#": 8, "AB": 8, "A": 9, "A#": 10, "BB": 10, "B": 11}
# Afinación Richter (armónica diatónica de 10 hoyos): semitonos sobre la tónica
SOPLA = {1: 0, 2: 4, 3: 7, 4: 12, 5: 16, 6: 19, 7: 24, 8: 28, 9: 31, 10: 36}
ASPIRA = {1: 2, 2: 7, 3: 11, 4: 14, 5: 17, 6: 21, 7: 23, 8: 26, 9: 29, 10: 33}
CLAVES = {"titulo", "subtitulo", "armonica", "tonalidad", "forma", "frases", "autor", "fuente"}
NOTA_RE = re.compile(r"-?(?:10|[1-9])['/]*")


class ErrorTab(Exception):
    pass


def leer(path):
    meta, intro, secciones = {}, [], []
    actual = None
    for num, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        linea = raw.strip()
        if not linea or linea.startswith("#"):
            continue
        m = re.fullmatch(r"(\w+)\s*:\s*(.*)", linea)
        if actual is None and m and m.group(1).lower() in CLAVES:
            meta[m.group(1).lower()] = m.group(2).strip()
        elif linea.startswith("[") and linea.endswith("]"):
            partes = [p.strip() for p in linea[1:-1].split("|")]
            actual = {"titulo": partes[0], "detalle": partes[1:], "items": []}
            secciones.append(actual)
        elif linea.startswith(">"):
            (actual["items"] if actual else intro).append(("texto", linea[1:].strip()))
        else:
            if actual is None:
                raise ErrorTab(f"línea {num}: tablatura antes de la primera sección [..]")
            tokens = linea.split()
            for tok in tokens:
                if tok in ("_", "|"):
                    continue
                if "".join(NOTA_RE.findall(tok)) != tok:
                    raise ErrorTab(f"línea {num}: no entiendo «{tok}» (hoyos del 1 al 10, "
                                   f"- para aspirar, ' para bend, _ pausa, | barra)")
            actual["items"].append(("tab", tokens))
    return meta, intro, secciones


def chip(nota, tonica):
    m = re.fullmatch(r"(-?)(10|[1-9])(['/]*)", nota)
    aspira, hoyo, bends = m.group(1) == "-", int(m.group(2)), len(m.group(3))
    semi = (ASPIRA if aspira else SOPLA)[hoyo] - bends + tonica
    clase = "aspira" if aspira else "sopla"
    if bends:
        clase += " bend"
    texto = ("-" if aspira else "") + str(hoyo) + "ʼ" * bends
    return f'<span class="n {clase}"><b>{texto}</b><small>{NOMBRES[semi % 12]}</small></span>'


def linea_html(tokens, tonica):
    out = []
    for tok in tokens:
        if tok == "_":
            out.append('<span class="pausa"></span>')
        elif tok == "|":
            out.append('<span class="barra"></span>')
        else:
            notas = NOTA_RE.findall(tok)
            junto = " junto" if len(notas) > 1 else ""
            out.append(f'<span class="grupo{junto}">' + "".join(chip(n, tonica) for n in notas) + "</span>")
    return '<div class="linea">' + "".join(out) + "</div>"


def forma_html(forma, frases):
    filas = [f.split() for f in forma.split("|")]
    filas_fr = [f.split() for f in frases.split("|")] if frases else []
    out, compas = [], 0
    for i, fila in enumerate(filas):
        celdas = []
        for j, acorde in enumerate(fila):
            compas += 1
            fr = ""
            if i < len(filas_fr) and j < len(filas_fr[i]):
                fr = f'<em>Frase {html.escape(filas_fr[i][j])}</em>'
            celdas.append(f'<div class="c"><i>{compas}</i><strong>{html.escape(acorde)}</strong>{fr}</div>')
        out.append('<div class="fila">' + "".join(celdas) + "</div>")
    return '<section class="forma"><h2>Forma</h2>' + "".join(out) + "</section>"


CSS = """
@page { size: letter; margin: 15mm 16mm 16mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: "Open Sans", "Noto Sans", "DejaVu Sans", sans-serif;
       color: #1f2328; font-size: 10.5pt; line-height: 1.45; background: #fff;
       -webkit-print-color-adjust: exact; print-color-adjust: exact; }
header { border-bottom: 2px solid #1f2328; padding-bottom: 8px; margin-bottom: 14px; }
h1 { font-size: 22pt; margin: 0; letter-spacing: -0.01em; }
.sub { color: #57606a; margin: 2px 0 8px; font-size: 11pt; }
.meta { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 9.5pt; color: #3d444d; }
.meta b { color: #1f2328; }
.meta .fuente { flex-basis: 100%; font-size: 8.5pt; color: #57606a; }
.meta a { color: inherit; word-break: break-all; }
.intro p { margin: 0 0 6px; }
.leyenda { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 18px; border: 1px solid #d0d7de;
           border-radius: 8px; padding: 8px 12px; margin: 10px 0 14px; font-size: 9pt; color: #3d444d; }
.leyenda > span { display: inline-flex; align-items: center; gap: 6px; }
h2 { font-size: 10pt; text-transform: uppercase; letter-spacing: .06em; color: #57606a; margin: 0 0 6px; }
.forma { margin-bottom: 14px; break-inside: avoid; }
.fila { display: grid; grid-template-columns: repeat(4, 1fr); border-left: 1px solid #8c959f; }
.fila + .fila { border-top: none; }
.c { border: 1px solid #8c959f; border-left: none; padding: 4px 8px 5px; min-height: 40px; position: relative; }
.fila + .fila .c { border-top: none; }
.c i { position: absolute; top: 2px; right: 6px; font-style: normal; font-size: 7.5pt; color: #8c959f; }
.c strong { display: block; font-size: 12pt; }
.c em { font-style: normal; font-size: 8pt; color: #57606a; }
.seccion { border: 1px solid #d0d7de; border-radius: 10px; padding: 10px 14px 8px; margin-bottom: 10px;
           break-inside: auto; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
.seccion.corta, .seccion.texto { break-inside: avoid; }
.seccion h3 { break-after: avoid; }
.linea, .seccion p { break-inside: avoid; }
.seccion h3 { margin: 0 0 6px; font-size: 12.5pt; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; }
.seccion h3 .det { font-weight: 400; font-size: 9.5pt; color: #57606a; }
.seccion p { margin: 4px 0 2px; font-size: 9.5pt; color: #3d444d; }
.linea { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 6px; margin: 6px 0; }
.grupo { display: inline-flex; gap: 6px; }
.grupo.junto { gap: 2px; padding-bottom: 4px; border-bottom: 2px solid #8c959f; border-radius: 0 0 4px 4px; }
.n { display: inline-flex; flex-direction: column; align-items: center; justify-content: center;
     min-width: 36px; padding: 3px 4px 2px; border-radius: 6px; border: 1.5px solid; line-height: 1.1; }
.n b { font-size: 14pt; font-variant-numeric: tabular-nums; }
.n small { font-size: 7pt; opacity: .8; }
.sopla { color: #1849a9; background: #eaf1ff; border-color: #8fb0ee; }
.aspira { color: #a6261c; background: #fdeeed; border-color: #ec9f98; }
.bend { border-style: dashed; }
.pausa { display: inline-block; width: 22px; height: 2px; margin-bottom: 18px; border-bottom: 2px dotted #8c959f; }
.barra { display: inline-block; width: 2px; align-self: stretch; background: #57606a; margin: 0 4px; }
.texto { break-inside: avoid; }
footer { margin-top: 12px; font-size: 8pt; color: #8c959f; text-align: right; }
"""


def construir_html(meta, intro, secciones):
    letra = meta.get("armonica", "C").strip().upper().replace("♯", "#").replace("♭", "B")
    letra = letra.split()[0] if letra else "C"
    if letra not in TONOS:
        raise ErrorTab(f"armonica: no reconozco el tono «{meta.get('armonica')}» (usa C, D, G, A, Bb...)")
    tonica = TONOS[letra]
    e = html.escape
    titulo = e(meta.get("titulo", "Tablatura"))
    partes = [f'<header><h1>{titulo}</h1>']
    if meta.get("subtitulo"):
        partes.append(f'<div class="sub">{e(meta["subtitulo"])}</div>')
    info = [f'<span><b>Armónica:</b> diatónica en {NOMBRES[tonica]} ({e(letra.title())})</span>']
    if meta.get("tonalidad"):
        info.append(f'<span><b>Tonalidad:</b> {e(meta["tonalidad"])}</span>')
    if meta.get("autor"):
        info.append(f'<span><b>Autor:</b> {e(meta["autor"])}</span>')
    if meta.get("fuente"):
        fuente = re.sub(r"(https?://[^\s)]+)", r'<a href="\1">\1</a>', e(meta["fuente"]))
        info.append(f'<span class="fuente"><b>Fuente:</b> {fuente}</span>')
    partes.append('<div class="meta">' + "".join(info) + "</div></header>")
    if intro:
        partes.append('<div class="intro">' + "".join(f"<p>{e(t)}</p>" for _, t in intro) + "</div>")
    partes.append(
        '<div class="leyenda">'
        f'<span>{chip("4", tonica)} soplar</span>'
        f'<span>{chip("-4", tonica)} aspirar</span>'
        f'<span><span class="grupo junto">{chip("-2", tonica)}{chip("-2", tonica)}</span> notas seguidas, rápidas</span>'
        '<span><span class="pausa" style="margin:0"></span> pausa</span>'
        f'<span>La nota pequeña es lo que suena en una armónica en {NOMBRES[tonica]}</span>'
        "</div>")
    if meta.get("forma"):
        partes.append(forma_html(meta["forma"], meta.get("frases")))
    for s in secciones:
        tieneTab = any(k == "tab" for k, _ in s["items"])
        lineas = sum(1 for k, _ in s["items"] if k == "tab")
        clase = "seccion" if not tieneTab else ("seccion" if lineas > 4 else "seccion corta")
        if not tieneTab:
            clase = "seccion texto"
        det = " · ".join(e(d) for d in s["detalle"] if d)
        det = f'<span class="det">{det}</span>' if det else ""
        cuerpo = []
        for k, v in s["items"]:
            cuerpo.append(linea_html(v, tonica) if k == "tab" else f"<p>{e(v)}</p>")
        partes.append(f'<section class="{clase}"><h3>{e(s["titulo"])}{det}</h3>{"".join(cuerpo)}</section>')
    return (f'<!doctype html><html lang="es"><head><meta charset="utf-8"><title>{titulo}</title>'
            f'<style>{CSS}</style></head><body>{"".join(partes)}</body></html>')


def buscar_chrome():
    for nombre in ("google-chrome-stable", "google-chrome", "chromium", "chromium-browser"):
        ruta = shutil.which(nombre)
        if ruta:
            return ruta
    raise ErrorTab("no encontré Google Chrome / Chromium para generar el PDF")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    entrada = Path(sys.argv[1]).resolve()
    if len(sys.argv) > 2:
        salida = Path(sys.argv[2]).resolve()
    elif entrada.parent.name == "02_editable":
        salida = entrada.parent.parent / "03_exportados" / "pdf" / (entrada.stem + ".pdf")
    else:
        salida = entrada.with_suffix(".pdf")
    try:
        meta, intro, secciones = leer(entrada)
        documento = construir_html(meta, intro, secciones)
        chrome = buscar_chrome()
    except ErrorTab as err:
        print(f"Error en {entrada.name}: {err}", file=sys.stderr)
        return 1
    salida.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        pagina = Path(tmp) / "tab.html"
        pagina.write_text(documento, encoding="utf-8")
        subprocess.run([chrome, "--headless", "--disable-gpu", "--no-pdf-header-footer",
                        f"--print-to-pdf={salida}", pagina.as_uri()],
                       check=True, capture_output=True)
    print(f"PDF creado: {salida}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
