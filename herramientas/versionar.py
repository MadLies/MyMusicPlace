"""Marca los archivos de la web con una versión para que el navegador no use copias viejas.

GitHub Pages deja que el navegador guarde cada archivo hasta 10 minutos; si después de
publicar se mezclan archivos nuevos y viejos, la web puede fallar («No encontré esta página»).
Este script, que corre la Action antes de publicar, añade `?v=<hash del contenido>`:
  - al CSS y al app.js que carga index.html;
  - a todos los módulos de assets/js mediante un import map (así también los `import`
    entre módulos y los `import()` de las vistas piden la versión nueva).
Solo cambia la URL de los archivos cuyo contenido cambió. En local no hace falta correrlo.
"""
import hashlib
import json
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
INDEX = RAIZ / "index.html"


def huella(ruta: Path) -> str:
    return hashlib.sha256(ruta.read_bytes()).hexdigest()[:10]


def main() -> None:
    html = INDEX.read_text(encoding="utf-8")
    modulos = sorted((RAIZ / "assets" / "js").rglob("*.js"))
    mapa = {}
    for m in modulos:
        rel = "./" + m.relative_to(RAIZ).as_posix()
        mapa[rel] = f"{rel}?v={huella(m)}"
    importmap = '<script type="importmap">' + json.dumps({"imports": mapa}, ensure_ascii=False) + "</script>"

    css = RAIZ / "assets" / "css" / "estilos.css"
    app = RAIZ / "assets" / "js" / "app.js"
    html, n1 = re.subn(r'href="assets/css/estilos\.css(\?v=[^"]*)?"', f'href="assets/css/estilos.css?v={huella(css)}"', html)
    html, n2 = re.subn(r'src="assets/js/app\.js(\?v=[^"]*)?"', f'src="assets/js/app.js?v={huella(app)}"', html)
    if not (n1 and n2):
        raise SystemExit("No encontré el CSS o app.js en index.html")
    # El import map tiene que ir antes de cualquier módulo: justo antes de </head>.
    html = re.sub(r'<script type="importmap">.*?</script>\n?', "", html, flags=re.S)
    html = html.replace("</head>", f"{importmap}\n</head>", 1)
    INDEX.write_text(html, encoding="utf-8")
    print(f"Versionados {len(mapa)} módulos, el CSS y app.js.")


if __name__ == "__main__":
    main()
