// Diapasón del violín dibujado en SVG, para ver escalas: cuerdas en columnas (Sol Re La Mi),
// la voluta arriba y el puente abajo; cada fila es un semitono más sobre la cuerda al aire.
export const CUERDAS_VIOLIN = [
  { id: "Sol", cifra: "G", midi: 55 },
  { id: "Re", cifra: "D", midi: 62 },
  { id: "La", cifra: "A", midi: 69 },
  { id: "Mi", cifra: "E", midi: 76 },
];
// Dedo que se usa normalmente en 1ª posición para cada semitono sobre la cuerda al aire.
const DEDO = [0, 1, 1, 2, 2, 3, 3, 4];
export const ZONA = ["al aire", "1 bajo", "1", "2 bajo", "2 alto", "3", "3 alto", "4"];
export const FIN_PRIMERA = 7; // el 4º dedo, a una quinta de la cuerda al aire

/**
 * Dedos de las notas de una cuerda en 1ª posición: Map(semitono → dedo).
 * esNota(midi) dice si esa nota se toca (por ejemplo, si está en la escala).
 * Si hay dos notas seguidas a medio tono en la zona del 3er dedo, la de arriba la toma el 4º.
 */
export function dedosCuerda(cuerda, esNota) {
  const dedos = new Map();
  for (let s = 0; s <= FIN_PRIMERA; s++) {
    if (!esNota(cuerda.midi + s)) continue;
    let d = DEDO[s];
    if (s === 6 && dedos.get(5) === 3) d = 4;
    dedos.set(s, d);
  }
  return dedos;
}

/** Dónde tocar una nota en 1ª posición: la cuerda con menos semitonos (prefiere la cuerda al aire). */
export function posicionViolin(midi) {
  let mejor = null;
  for (const c of CUERDAS_VIOLIN) {
    const s = midi - c.midi;
    if (s >= 0 && s <= FIN_PRIMERA && (!mejor || s < mejor.s)) mejor = { cuerda: c, s };
  }
  return mejor;
}

/**
 * marca(midi) → { tipo: "tonica" | "escala" (+ " caract"), texto } o null (nota de fuera: solo un punto).
 * hasta: último semitono que se dibuja (7 = 1ª posición; 12 = la octava de cada cuerda).
 */
export function diapasonSVG({ marca, hasta = FIN_PRIMERA, titulo = "Diapasón del violín" }) {
  const X0 = 82, DX = 64, RH = 46, TOP = 42, NUT = 70;
  const W = X0 + 3 * DX + 46;
  const y = (s) => (s === 0 ? TOP : NUT + (s - 0.5) * RH);
  const fondo = NUT + hasta * RH + 8;
  const H = fondo + 6;
  let html = "";

  // Madera del diapasón, cejuela y líneas de semitono (el violín no tiene trastes: son guías).
  html += `<rect class="vd-madera" x="${X0 - 34}" y="${NUT}" width="${3 * DX + 68}" height="${fondo - NUT}" rx="8"></rect>`;
  for (let s = 1; s < hasta; s++) {
    const yy = NUT + s * RH;
    html += `<line class="vd-linea${s === FIN_PRIMERA ? " fin" : ""}" x1="${X0 - 34}" x2="${X0 + 3 * DX + 34}" y1="${yy}" y2="${yy}"></line>`;
  }
  html += `<rect class="vd-cejuela" x="${X0 - 36}" y="${NUT - 5}" width="${3 * DX + 72}" height="7" rx="2"></rect>`;

  // Etiquetas de la izquierda: el dedo típico de cada fila en 1ª posición.
  for (let s = 0; s <= hasta; s++) {
    const txt = s <= FIN_PRIMERA ? ZONA[s] : s === FIN_PRIMERA + 1 ? "3ª pos. ↓" : s === 12 ? "octava" : "";
    if (txt) html += `<text class="vd-zona" x="${X0 - 42}" y="${y(s) + 4}">${txt}</text>`;
  }

  CUERDAS_VIOLIN.forEach((c, i) => {
    const x = X0 + i * DX;
    html += `<text class="vd-cuerda-nombre" x="${x}" y="14">${c.id}</text>`;
    html += `<line class="vd-cuerda" x1="${x}" x2="${x}" y1="${TOP + 18}" y2="${fondo}" style="stroke-width:${2.8 - i * 0.45}"></line>`;
  });

  CUERDAS_VIOLIN.forEach((c, i) => {
    const x = X0 + i * DX;
    const dedos = dedosCuerda(c, (m) => !!marca(m));
    for (let s = 0; s <= hasta; s++) {
      const midi = c.midi + s, mk = marca(midi), yy = y(s);
      const datos = `data-midi="${midi}" data-cuerda="${i}" data-s="${s}"`;
      if (!mk) {
        html += `<g class="vd" ${datos}><circle class="vd-hit" cx="${x}" cy="${yy}" r="17"></circle><circle class="vd-punto" cx="${x}" cy="${yy}" r="3.5"></circle></g>`;
        continue;
      }
      const d = dedos.get(s);
      html += `<g class="vd on ${mk.tipo}" ${datos}>
        <circle class="vd-c" cx="${x}" cy="${yy}" r="17"></circle>
        <text class="vd-t" x="${x}" y="${yy + 4.5}">${mk.texto ?? ""}</text>
        ${d ? `<circle class="vd-dedo" cx="${x + 16}" cy="${yy - 14}" r="8"></circle><text class="vd-dedo-t" x="${x + 16}" y="${yy - 10.5}">${d}</text>` : ""}
      </g>`;
    }
  });

  return `<svg class="diapason-svg" viewBox="0 0 ${W} ${H}" role="group" aria-label="${titulo}">${html}</svg>`;
}

/** Ilumina un punto del diapasón un momento (al sonar). */
export function pulsarViolin(svg, cuerda, s, ms = 300) {
  const g = svg?.querySelector(`.vd[data-cuerda="${cuerda}"][data-s="${s}"]`);
  if (!g) return;
  g.classList.add("pulsada");
  setTimeout(() => g.classList.remove("pulsada"), ms);
}
