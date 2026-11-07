// Teclado de piano dibujado en SVG, para escalas y acordes.
const NEGRAS = new Set([1, 3, 6, 8, 10]);
export const esNegra = (m) => NEGRAS.has(((m % 12) + 12) % 12);

/**
 * marcas: Map(midi → { tipo, texto, sub })
 *   tipo: "tonica" | "escala" | "fuera" (nota de fuera de la tonalidad) | "tenue" (solo un punto)
 *   texto: lo que va en la etiqueta (Do, C, ♭3…) · sub: texto pequeño encima (grado o intervalo)
 */
export function tecladoSVG({ desde = 60, hasta = 83, marcas = new Map(), mini = false, grande = false, titulo = "Teclado de piano" } = {}) {
  const W = 40, H = mini ? 120 : 180, BW = 26, BH = Math.round(H * 0.6);
  const blancas = [], negras = [];
  let x = 0;
  for (let m = desde; m <= hasta; m++) {
    if (esNegra(m)) negras.push({ m, x: x - BW / 2 });
    else { blancas.push({ m, x }); x += W; }
  }

  const etiqueta = (k, negra, mk) => {
    const cx = k.x + (negra ? BW : W) / 2;
    if (mk.tipo === "tenue") return `<circle class="punto-tenue" cx="${cx}" cy="${negra ? BH - 12 : H - 14}" r="4"></circle>`;
    if (mini) return `<circle class="punto ${mk.tipo}" cx="${cx}" cy="${negra ? BH - 14 : H - 16}" r="${negra ? 8 : 9}"></circle>`;
    const cy = negra ? BH - 18 : H - 22, r = negra ? 12.5 : 16;
    return `<g class="etq ${mk.tipo}">
      <circle cx="${cx}" cy="${cy}" r="${r}"></circle>
      <text x="${cx}" y="${cy + (negra ? 3.5 : 4.5)}" class="${negra ? "chica" : ""}">${mk.texto ?? ""}</text>
      ${mk.sub ? `<text class="etq-sub" x="${cx}" y="${cy - r - 6}">${mk.sub}</text>` : ""}
    </g>`;
  };
  const tecla = (k, negra) => {
    const mk = marcas.get(k.m);
    const cls = `tecla ${negra ? "negra" : "blanca"}${mk ? ` on ${mk.tipo}` : ""}`;
    // y negativo: así las esquinas redondeadas solo se ven abajo, como en un piano.
    return `<rect class="${cls}" data-midi="${k.m}" x="${negra ? k.x : k.x + 0.5}" y="-6" width="${negra ? BW : W - 1}" height="${(negra ? BH : H) + 6}" rx="${negra ? 3 : 5}"></rect>` +
      (mk ? etiqueta(k, negra, mk) : "");
  };
  return `<svg class="teclado${mini ? " mini" : ""}${grande ? " grande" : ""}" viewBox="0 0 ${x} ${H}" role="img" aria-label="${titulo}">
    ${blancas.map((k) => tecla(k, false)).join("")}
    ${negras.map((k) => tecla(k, true)).join("")}
  </svg>`;
}

/** Ilumina una tecla un momento (al sonar). */
export function pulsar(svg, midi, ms = 300) {
  const r = svg?.querySelector(`rect[data-midi="${midi}"]`);
  if (!r) return;
  r.classList.add("pulsada");
  setTimeout(() => r.classList.remove("pulsada"), ms);
}
