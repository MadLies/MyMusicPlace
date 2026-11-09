#!/usr/bin/env python3
"""Genera data/canciones.json: el índice que usa la web.

Recorre Piano/, Violin/ y Armonica/ (sin las carpetas _Plantillas) y, por cada
canción, anota sus archivos y datos. Para las tablaturas de armónica calcula
además estadísticas (notas, bends, hoyos, nivel).

Uso (desde la carpeta raíz del repo):
    python3 herramientas/generar_indice.py

La GitHub Action lo ejecuta sola antes de publicar, así que normalmente no
hace falta correrlo a mano (solo para ver los cambios en local).
"""
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / "Armonica" / "_Plantillas"))
import tab2pdf  # noqa: E402  (reutiliza el mismo lector de .tab que genera los PDF)

INSTRUMENTOS = {"Armonica": "armonica", "Piano": "piano", "Violin": "violin"}


def rel(p):
    return p.relative_to(RAIZ).as_posix()


def primero(carpeta, patron):
    if not carpeta.is_dir():
        return None
    encontrados = sorted(carpeta.glob(patron))
    return rel(encontrados[0]) if encontrados else None


def leer_fuente(carpeta):
    """Datos de 01_referencias/fuente.txt: la primera línea libre es la fuente. Líneas opcionales:
    «nivel: N» (1-5, dificultad), «titulo: …» y «subtitulo: …» (para partituras que solo tienen PDF,
    sin MusicXML del que sacar el título y el compositor)."""
    datos = {"fuente": "", "nivel": None, "titulo": "", "subtitulo": ""}
    f = carpeta / "01_referencias" / "fuente.txt"
    if not f.is_file():
        return datos
    for linea in f.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        m = re.fullmatch(r"(nivel|titulo|subtitulo)\s*:\s*(.+)", linea, re.I)
        if m:
            clave, valor = m.group(1).lower(), m.group(2).strip()
            if clave == "nivel":
                if re.fullmatch(r"[1-5]", valor):
                    datos["nivel"] = int(valor)
            else:
                datos[clave] = valor
        elif linea and not datos["fuente"]:
            datos["fuente"] = linea
    return datos


def titulo_desde_carpeta(nombre):
    return re.sub(r"(?<=[a-z])(?=[A-Z])", " ", nombre)


def estadisticas(secciones):
    notas, saltos = [], []
    for s in secciones:
        for tipo, valor in s["items"]:
            if tipo != "tab":
                continue
            for tok in valor:
                base, _dur = tab2pdf.separar_duracion(tok)
                if base in ("_", "|"):
                    continue
                for n in tab2pdf.NOTA_RE.findall(base):
                    m = re.fullmatch(r"(-?)(10|[1-9])(['/]*)", n)
                    notas.append((m.group(1) == "-", int(m.group(2)), len(m.group(3))))
    if not notas:
        return None
    hoyos = [h for _, h, _ in notas]
    for a, b in zip(hoyos, hoyos[1:]):
        saltos.append(abs(a - b))
    bends = sum(1 for _, _, b in notas if b)
    aspiradas = sum(1 for a, _, _ in notas if a)
    salto_max = max(saltos) if saltos else 0
    nivel = 1
    nivel += 1 if bends else 0
    nivel += 1 if bends >= 4 else 0
    nivel += 1 if (max(hoyos) - min(hoyos) >= 5 or max(hoyos) >= 9) else 0
    nivel += 1 if salto_max >= 3 else 0
    return {
        "notas": len(notas),
        "bends": bends,
        "aspiradas": round(100 * aspiradas / len(notas)),
        "hoyoMin": min(hoyos),
        "hoyoMax": max(hoyos),
        "saltoMax": salto_max,
        "nivel": min(nivel, 5),
    }


def cancion_armonica(carpeta):
    tab = next(iter(sorted((carpeta / "02_editable").glob("*.tab"))), None)
    if tab is None:
        return None
    meta, _intro, secciones = tab2pdf.leer(tab)
    return {
        "id": f"armonica/{carpeta.name}",
        "instrumento": "armonica",
        "carpeta": carpeta.name,
        "titulo": meta.get("titulo") or titulo_desde_carpeta(carpeta.name),
        "subtitulo": meta.get("subtitulo", ""),
        "tono": meta.get("armonica", "C"),
        "tonalidad": meta.get("tonalidad", ""),
        "tab": rel(tab),
        "pdf": primero(carpeta / "03_exportados" / "pdf", "*.pdf"),
        "fuente": meta.get("fuente", ""),
        "secciones": [s["titulo"] for s in secciones],
        "stats": estadisticas(secciones),
    }


def cancion_partitura(carpeta, instrumento):
    xml = primero(carpeta / "03_exportados" / "musicxml", "*.musicxml") or \
        primero(carpeta / "03_exportados" / "musicxml", "*.mxl")
    pdfs = sorted((carpeta / "03_exportados" / "pdf").glob("*.pdf")) if (carpeta / "03_exportados" / "pdf").is_dir() else []
    principal = next((p for p in pdfs if p.stem == carpeta.name), pdfs[0] if pdfs else None)
    titulo, compositor = titulo_desde_carpeta(carpeta.name), ""
    if xml:
        texto = (RAIZ / xml).read_text(encoding="utf-8", errors="ignore")[:20000]
        m = re.search(r"<work-title>([^<]+)</work-title>", texto) or \
            re.search(r"<movement-title>([^<]+)</movement-title>", texto)
        if m:
            titulo = m.group(1).strip()
        m = re.search(r'<creator type="composer">([^<]+)</creator>', texto)
        if m:
            compositor = m.group(1).strip()
    if not (xml or principal):
        return None
    datos = leer_fuente(carpeta)
    fuente, nivel = datos["fuente"], datos["nivel"]
    titulo = datos["titulo"] or titulo
    compositor = datos["subtitulo"] or compositor
    return {
        "id": f"{instrumento}/{carpeta.name}",
        "instrumento": instrumento,
        "carpeta": carpeta.name,
        "titulo": titulo,
        "subtitulo": compositor,
        "musicxml": xml,
        "pdf": rel(principal) if principal else None,
        "mscz": primero(carpeta / "02_editable", "*.mscz"),
        "notas": primero(carpeta, "*.md"),
        "fuente": fuente,
        "stats": {"nivel": nivel} if nivel else None,
        "extras": [rel(p) for p in pdfs if p != principal],
    }


def main():
    canciones = []
    for nombre, instrumento in INSTRUMENTOS.items():
        base = RAIZ / nombre
        if not base.is_dir():
            continue
        for carpeta in sorted(base.iterdir()):
            if not carpeta.is_dir() or carpeta.name.startswith(("_", ".")):
                continue
            if instrumento == "armonica":
                c = cancion_armonica(carpeta)
            else:
                c = cancion_partitura(carpeta, instrumento)
            if c:
                canciones.append(c)
    salida = RAIZ / "data" / "canciones.json"
    salida.parent.mkdir(exist_ok=True)
    datos = {"generado": datetime.now(timezone.utc).isoformat(timespec="seconds"), "canciones": canciones}
    salida.write_text(json.dumps(datos, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(canciones)} canciones → {rel(salida)}")


if __name__ == "__main__":
    main()
