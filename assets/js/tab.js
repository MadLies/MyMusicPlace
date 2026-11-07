// Lector del formato .tab (el mismo que usa Armonica/_Plantillas/tab2pdf.py)
// y conversor desde otras notaciones habituales: (4) = aspirar, +4 = soplar, 6b = bend.

const NOTA_RE = /-?(?:10|[1-9])['/]*/g;
const CLAVES = new Set(["titulo", "subtitulo", "armonica", "tonalidad", "forma", "frases", "autor", "fuente", "tempo", "compas"]);

// Duración opcional al final de un token: 8:2  -7:1.5  7:1/2  _:2  -2-2:2
const DUR_RE = /^(.*?)(?::(\d+(?:[.,]\d+)?(?:\/\d+)?))?$/;
export function leerDuracion(txt) {
  if (txt === undefined) return null;
  const [a, b] = txt.replace(",", ".").split("/");
  const v = b ? Number(a) / Number(b) : Number(a);
  return Number.isFinite(v) && v > 0 && v <= 32 ? v : NaN;
}

/** Lee un token de tablatura. Devuelve {tipo, notas?, dur, conDur} o {error}. */
export function leerToken(tok) {
  const m = DUR_RE.exec(tok);
  const base = m[1];
  const dur = leerDuracion(m[2]);
  if (Number.isNaN(dur)) return { error: `Duración inválida en «${tok}» (usa por ejemplo :2, :1.5 o :1/2)` };
  const conDur = dur !== null;
  if (base === "_") return { tipo: "pausa", dur: dur ?? 1, conDur };
  if (base === "|" && !conDur) return { tipo: "barra" };
  const notas = base.match(NOTA_RE) || [];
  if (!base || notas.join("") !== base) return { error: `No entiendo «${tok}» (hoyos 1 a 10, - para aspirar, ' para bend, _ pausa, | barra, :2 duración)` };
  return { tipo: "grupo", notas: notas.map(parsearNota), dur: dur ?? 1, conDur };
}

export function parsearNota(raw) {
  const m = /^(-?)(10|[1-9])(['/]*)$/.exec(raw);
  return { raw, aspira: m[1] === "-", hoyo: Number(m[2]), bends: m[3].length };
}

export function leerTab(texto) {
  const meta = {}, intro = [], secciones = [], errores = [];
  let actual = null, conRitmo = false;
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
      const t = leerToken(tok);
      if (t.error) { errores.push({ linea: num, msg: t.error }); continue; }
      if (t.conDur) conRitmo = true;
      tokens.push(t);
    }
    actual.items.push({ tipo: "tab", tokens, linea: num });
  });
  // Con ritmo escrito (duraciones o tempo:), la reproducción no añade pausas de respiración al final de cada línea.
  return { meta, intro, secciones, errores, conRitmo: conRitmo || Boolean(meta.tempo) };
}

/** true si la línea ya está escrita en formato .tab válido (para no tocarla al convertir). */
export function esLineaTab(linea) {
  const toks = linea.trim().split(/\s+/);
  return toks.length > 0 && toks.every((t) => !leerToken(t).error) && toks.some((t) => /\d/.test(t));
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
    if (/^(titulo|subtitulo|armonica|tonalidad|forma|frases|autor|fuente|tempo|compas)\s*:/i.test(l)) { salida.push(l); continue; }
    if (/:/.test(l) && esLineaTab(l)) {
      if (!haySeccion) { salida.push("[Melodía]"); haySeccion = true; secciones++; }
      salida.push(l.trim());
      continue;
    }

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
fuente: Tablatura recopilada y adaptada por madlies
tempo: 90
compas: 4

> Una nota corta sobre la canción (opcional).

# Ritmo: una nota sola dura 1 pulso; 6:2 dura 2; 5:1.5 es negra con puntillo; 44 son dos rápidas.
[Parte A]
4 4 -4 5 | 5 -5 6:2
6 -6 6 -5 | 5:1.5 -4:1/2 4:2

[Parte B | se toca 2 veces]
5 5 -5 6 6 -6 -7 7
`;
