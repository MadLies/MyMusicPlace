// Lector del formato .tab (el mismo que usa Armonica/_Plantillas/tab2pdf.py)
// y conversor desde otras notaciones habituales: (4) = aspirar, +4 = soplar, 6b = bend.

const NOTA_RE = /-?(?:10|[1-9])['/]*/g;
const CLAVES = new Set(["titulo", "subtitulo", "armonica", "tonalidad", "forma", "frases", "autor"]);

export function parsearNota(raw) {
  const m = /^(-?)(10|[1-9])(['/]*)$/.exec(raw);
  return { raw, aspira: m[1] === "-", hoyo: Number(m[2]), bends: m[3].length };
}

export function leerTab(texto) {
  const meta = {}, intro = [], secciones = [], errores = [];
  let actual = null;
  texto.split(/\r?\n/).forEach((raw, i) => {
    const num = i + 1;
    const linea = raw.trim();
    if (!linea || linea.startsWith("#")) return;
    const m = /^(\w+)\s*:\s*(.*)$/.exec(linea);
    if (!actual && m && CLAVES.has(m[1].toLowerCase())) {
      meta[m[1].toLowerCase()] = m[2].trim();
      return;
    }
    if (linea.startsWith("[") && linea.endsWith("]")) {
      const partes = linea.slice(1, -1).split("|").map((s) => s.trim());
      actual = { titulo: partes[0], detalle: partes.slice(1).filter(Boolean), items: [] };
      secciones.push(actual);
      return;
    }
    if (linea.startsWith(">")) {
      (actual ? actual.items : intro).push({ tipo: "texto", texto: linea.slice(1).trim() });
      return;
    }
    if (!actual) {
      errores.push({ linea: num, msg: "Hay notas antes de la primera sección. Añade una línea como [Parte A] antes." });
      return;
    }
    const tokens = [];
    for (const tok of linea.split(/\s+/)) {
      if (tok === "_") { tokens.push({ tipo: "pausa" }); continue; }
      if (tok === "|") { tokens.push({ tipo: "barra" }); continue; }
      const notas = tok.match(NOTA_RE) || [];
      if (notas.join("") !== tok) {
        errores.push({ linea: num, msg: `No entiendo «${tok}» (hoyos 1 a 10, - para aspirar, ' para bend, _ pausa, | barra)` });
        continue;
      }
      tokens.push({ tipo: "grupo", notas: notas.map(parsearNota) });
    }
    actual.items.push({ tipo: "tab", tokens, linea: num });
  });
  return { meta, intro, secciones, errores };
}

// Convierte notaciones comunes al formato .tab.
//   (4) o (4)b / (4b)  → -4 / -4'      +4 → 4      6b, 6' o 6/ → bend
//   comas y espacios largos (3+) → _   ·  líneas de letra → se quitan
//   líneas cortas con texto (ej. "Parte A", "Solo") → [sección]
export function convertirNotacion(texto) {
  let quitadas = 0, secciones = 0;
  const salida = [];
  let haySeccion = false;
  const NOTA = /\(\s*(10|[1-9])\s*([bB'’/]*)\s*\)([bB'’/]*)|([+-]?)(10|[1-9])([bB'’/]*)|([,|_])/g;

  for (const raw of texto.split(/\r?\n/)) {
    const l = raw.trim();
    if (!l) { salida.push(""); continue; }
    if (/^[#>]/.test(l) || /^\[.*\]$/.test(l)) { if (l.startsWith("[")) haySeccion = true; salida.push(l); continue; }
    if (/^(titulo|subtitulo|armonica|tonalidad|forma|frases|autor)\s*:/i.test(l)) { salida.push(l); continue; }

    if (/^[\d\s()+\-'’/bB,|_.]+$/.test(l) && /\d/.test(l)) {
      const partes = [];
      let prevSimple = false;
      const linea = raw.replace(/\t/g, "    ");
      const ms = [...linea.matchAll(NOTA)];
      // Un espacio "largo" es una pausa solo si es claramente mayor que los espacios
      // normales de esa línea (hay quien separa todas las notas con 4-5 espacios).
      const huecos = ms.slice(1).map((m, i) => m.index - (ms[i].index + ms[i][0].length));
      const orden = [...huecos].sort((a, b) => a - b);
      const mediana = orden.length ? orden[Math.floor((orden.length - 1) / 2)] : 0;
      const umbral = Math.max(3, mediana * 2);
      for (let k = 0; k < ms.length; k++) {
        const m = ms[k];
        const hueco = k ? huecos[k - 1] : -1;
        let tok, simple = false;
        if (m[1]) {
          tok = "-" + m[1] + (/[bB'’/]/.test(m[2] + m[3]) ? "'".repeat(Math.max(1, (m[2] + m[3]).length)) : "");
        } else if (m[5]) {
          tok = (m[4] === "-" ? "-" : "") + m[5] + "'".repeat(m[6].length);
          simple = true;
        } else {
          tok = m[7] === "|" ? "|" : "_";
        }
        if (partes.length && hueco >= umbral && tok !== "_" && partes[partes.length - 1] !== "_") partes.push("_");
        if (partes.length && hueco === 0 && simple && prevSimple) partes[partes.length - 1] += tok;
        else partes.push(tok);
        prevSimple = simple;
      }
      while (partes[partes.length - 1] === "_") partes.pop();
      if (!haySeccion) { salida.push("[Melodía]"); haySeccion = true; secciones++; }
      salida.push(partes.join(" "));
      continue;
    }

    // Texto: etiqueta corta → sección; si no, es letra y se quita.
    const limpio = l.replace(/[:\-–—]+$/, "").trim();
    if (limpio.length <= 25) {
      salida.push(`[${limpio}]`);
      haySeccion = true;
      secciones++;
    } else {
      quitadas++;
    }
  }
  const texto2 = salida.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
  return { texto: texto2, quitadas, secciones };
}

export function estadisticas(tab) {
  const notas = [];
  for (const s of tab.secciones)
    for (const it of s.items)
      if (it.tipo === "tab")
        for (const t of it.tokens) if (t.tipo === "grupo") notas.push(...t.notas);
  if (!notas.length) return null;
  const hoyos = notas.map((n) => n.hoyo);
  let saltoMax = 0;
  for (let i = 1; i < hoyos.length; i++) saltoMax = Math.max(saltoMax, Math.abs(hoyos[i] - hoyos[i - 1]));
  const bends = notas.filter((n) => n.bends).length;
  const hoyoMin = Math.min(...hoyos), hoyoMax = Math.max(...hoyos);
  let nivel = 1 + (bends ? 1 : 0) + (bends >= 4 ? 1 : 0) + (hoyoMax - hoyoMin >= 5 || hoyoMax >= 9 ? 1 : 0) + (saltoMax >= 3 ? 1 : 0);
  return {
    notas: notas.length, bends, hoyoMin, hoyoMax, saltoMax,
    aspiradas: Math.round((100 * notas.filter((n) => n.aspira).length) / notas.length),
    nivel: Math.min(nivel, 5),
  };
}

export const PLANTILLA = `titulo: Nombre de la canción
subtitulo: Artista
armonica: C
tonalidad: Do mayor · 1ª posición

> Una nota corta sobre la canción (opcional).

[Parte A]
4 4 -4 5 | 5 -5 6 _
6 -6 6 -5 5 -4 4

[Parte B | se toca 2 veces]
5 5 -5 6 6 -6 -7 7
`;
