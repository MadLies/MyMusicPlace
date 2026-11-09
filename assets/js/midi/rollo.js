// Piano roll (notas sobre una rejilla de tiempo × altura) y carriles de control, en <canvas>.
//
// ed: estado compartido del editor (canción, pista, selección, zoom, scroll, herramienta…).
// api: funciones del editor: antes() / despues(foto) para deshacer, probar(nota) para oír, refrescar().
import { esNegraMidi, cifraMidi, ticksCompas, ticksPulso } from "./modelo.js";
import { CANAL_PERCUSION, PERCUSION } from "./gm.js";

export const TECLAS = 64; // ancho de la columna del teclado (y de las etiquetas de los carriles)
export const REGLA = 24; // alto de la regla de compases

export function colores() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n) => cs.getPropertyValue(n).trim();
  const oscuro = (document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";
  return {
    oscuro,
    fondo: v("--surface"), fondo2: v("--surface-2"), linea: v("--line"), texto: v("--text"), suave: v("--muted"),
    acento: v("--accent"), blanca: v("--tecla-blanca"), negra: v("--tecla-negra"),
    compas: oscuro ? "rgba(255,255,255,.28)" : "rgba(0,0,0,.28)",
    pulso: oscuro ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.11)",
    sub: oscuro ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.045)",
    fantasma: oscuro ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.13)",
    sel: "#f2b632", cabezal: "#e5484d", bucle: "rgba(242,182,50,.18)",
  };
}

export function prepararLienzo(canvas) {
  const r = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const g = canvas.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g, w, h };
}

/** Coordenadas compartidas por el rollo y los carriles (mismo zoom y scroll horizontal). */
export const xDeTick = (ed, t) => TECLAS + (t - ed.scrollX) * ed.zx;
export const tickDeX = (ed, x) => ed.scrollX + (x - TECLAS) / ed.zx;
export const ajustar = (ed, t, modo = "round") => (ed.rejilla <= 1 ? Math.round(t) : Math[modo](t / ed.rejilla) * ed.rejilla);

/** Líneas verticales de compás, pulso y rejilla. */
function rejillaVertical(g, ed, col, w, y0, y1) {
  const c = ed.c, tc = ticksCompas(c), tp = ticksPulso(c);
  const t0 = Math.max(0, tickDeX(ed, TECLAS)), t1 = tickDeX(ed, w);
  const paso = ed.rejilla * ed.zx >= 6 ? ed.rejilla : tp * ed.zx >= 6 ? tp : tc;
  for (let t = Math.floor(t0 / paso) * paso; t <= t1; t += paso) {
    const x = Math.round(xDeTick(ed, t)) + 0.5;
    g.strokeStyle = t % tc === 0 ? col.compas : t % tp === 0 ? col.pulso : col.sub;
    g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y1); g.stroke();
  }
}

function cabezalYBucle(g, ed, col, h, y0 = 0) {
  if (ed.bucle) {
    const a = xDeTick(ed, ed.bucle.ini), b = xDeTick(ed, ed.bucle.fin);
    g.fillStyle = col.bucle;
    g.fillRect(Math.max(TECLAS, a), y0, Math.max(0, b - Math.max(TECLAS, a)), h - y0);
  }
  const x = Math.round(xDeTick(ed, ed.cabezalVivo ?? ed.cabezal)) + 0.5;
  if (x >= TECLAS) {
    g.strokeStyle = col.cabezal;
    g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(x, y0); g.lineTo(x, h); g.stroke();
    g.lineWidth = 1;
  }
}

// =====================================================================================
export class Rollo {
  constructor(canvas, ed, api) {
    this.cv = canvas;
    this.ed = ed;
    this.api = api;
    this.drag = null;
    this.punteros = new Map();
    this.teclaPulsada = null;
    canvas.addEventListener("pointerdown", (e) => this.abajo(e));
    canvas.addEventListener("pointermove", (e) => this.mover(e));
    canvas.addEventListener("pointerup", (e) => this.arriba(e));
    canvas.addEventListener("pointercancel", (e) => this.arriba(e, true));
    canvas.addEventListener("dblclick", (e) => this.doble(e));
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("wheel", (e) => this.rueda(e), { passive: false });
  }

  get p() { return this.ed.c.pistas[this.ed.pista]; }
  y(n) { return REGLA + (this.ed.scrollY - n) * this.ed.zy; }
  nota(y) { return Math.max(0, Math.min(127, Math.ceil(this.ed.scrollY - (y - REGLA) / this.ed.zy))); }
  pos(e) { const r = this.cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  /** Filas visibles. */
  filas() { const h = this.cv.clientHeight; return (h - REGLA) / this.ed.zy; }

  dibujar() {
    const { g, w, h } = prepararLienzo(this.cv);
    const ed = this.ed, col = colores(), zy = ed.zy, p = this.p;
    const perc = p?.canal === CANAL_PERCUSION;
    g.clearRect(0, 0, w, h);
    // Filas de fondo (las de las teclas negras, más oscuras).
    const nTop = Math.ceil(ed.scrollY), nBot = Math.max(0, Math.floor(ed.scrollY - (h - REGLA) / zy));
    for (let n = nTop; n >= nBot; n--) {
      const y = this.y(n);
      g.fillStyle = esNegraMidi(n) ? col.fondo2 : col.fondo;
      g.fillRect(TECLAS, y, w - TECLAS, zy);
      if (n % 12 === 0) { g.fillStyle = col.pulso; g.fillRect(TECLAS, Math.round(y + zy) - 1, w - TECLAS, 1); }
      else if (n % 12 === 5) { g.fillStyle = col.sub; g.fillRect(TECLAS, Math.round(y + zy) - 1, w - TECLAS, 1); }
    }
    rejillaVertical(g, ed, col, w, REGLA, h);

    // Notas de las otras pistas, en gris (para ver cómo encaja la tuya).
    const t0 = tickDeX(ed, TECLAS), t1 = tickDeX(ed, w);
    g.fillStyle = col.fantasma;
    ed.c.pistas.forEach((q, i) => {
      if (i === ed.pista || !ed.verOtras) return;
      for (const n of q.notas) {
        if (n.tick > t1 || n.tick + n.dur < t0 || n.nota > nTop || n.nota < nBot) continue;
        g.fillRect(xDeTick(ed, n.tick), this.y(n.nota) + 1, Math.max(2, n.dur * ed.zx), zy - 2);
      }
    });

    // Notas de la pista actual.
    if (p) {
      g.font = `600 ${Math.min(11, zy - 3)}px system-ui, sans-serif`;
      g.textBaseline = "middle";
      for (const n of p.notas) {
        if (n.tick > t1 || n.tick + n.dur < t0 || n.nota > nTop || n.nota < nBot) continue;
        const x = xDeTick(ed, n.tick), y = this.y(n.nota), ancho = Math.max(3, n.dur * ed.zx);
        g.globalAlpha = 0.45 + 0.55 * (n.vel / 127);
        g.fillStyle = p.color;
        g.fillRect(x + 0.5, y + 1, ancho - 1, zy - 2);
        g.globalAlpha = 1;
        const sel = ed.sel.has(n.id);
        g.strokeStyle = sel ? col.sel : "rgba(0,0,0,.35)";
        g.lineWidth = sel ? 2 : 1;
        g.strokeRect(x + 0.5, y + 1.5, ancho - 1, zy - 3);
        g.lineWidth = 1;
        if (ancho > 30 && zy >= 12) {
          g.fillStyle = "#fff";
          g.fillText(perc ? (PERCUSION[n.nota] || cifraMidi(n.nota)).slice(0, Math.floor(ancho / 6.5)) : cifraMidi(n.nota), x + 4, y + zy / 2 + 0.5);
        }
      }
    }

    // Rectángulo de selección.
    if (this.drag?.modo === "rect") {
      const r = this.drag.rect;
      g.fillStyle = "rgba(242,182,50,.12)";
      g.strokeStyle = col.sel;
      g.setLineDash([4, 3]);
      g.fillRect(r.x, r.y, r.w, r.h);
      g.strokeRect(r.x + 0.5, r.y + 0.5, r.w, r.h);
      g.setLineDash([]);
    }

    // Teclado de la izquierda.
    for (let n = nTop; n >= nBot; n--) {
      const y = this.y(n), negra = esNegraMidi(n);
      g.fillStyle = this.teclaPulsada === n || ed.teclasVivas?.has(n) ? col.sel : negra ? col.negra : col.blanca;
      g.fillRect(0, y, TECLAS, zy);
      g.fillStyle = col.linea;
      g.fillRect(0, Math.round(y + zy) - 1, TECLAS, 1);
      if ((n % 12 === 0 || perc) && zy >= 9) {
        g.fillStyle = negra ? col.blanca : "#555";
        g.font = `${n % 12 === 0 ? 700 : 400} ${Math.min(10.5, zy - 2)}px system-ui, sans-serif`;
        g.textBaseline = "middle";
        const txt = perc ? (PERCUSION[n] ? PERCUSION[n].slice(0, 11) : "") : cifraMidi(n);
        g.fillText(txt, 4, y + zy / 2);
      }
    }
    g.fillStyle = col.linea;
    g.fillRect(TECLAS - 1, REGLA, 1, h);

    // Regla de compases.
    g.fillStyle = col.fondo2;
    g.fillRect(0, 0, w, REGLA);
    const tc = ticksCompas(ed.c);
    const cada = Math.max(1, 2 ** Math.ceil(Math.log2(Math.max(1, 34 / (tc * ed.zx)))));
    g.font = "11px system-ui, sans-serif";
    g.textBaseline = "middle";
    for (let k = Math.floor(Math.max(0, t0) / tc); k * tc <= t1; k++) {
      const x = Math.round(xDeTick(ed, k * tc)) + 0.5;
      if (x < TECLAS) continue;
      g.fillStyle = col.compas;
      g.fillRect(x, REGLA - 8, 1, 8);
      if (k % cada === 0) { g.fillStyle = col.suave; g.fillText(String(k + 1), x + 3, REGLA / 2 - 1); }
    }
    g.fillStyle = col.linea;
    g.fillRect(0, REGLA - 1, w, 1);
    g.fillStyle = col.fondo2;
    g.fillRect(0, 0, TECLAS, REGLA);
    g.fillStyle = col.suave;
    g.fillText(perc ? "Percusión" : "Compás", 6, REGLA / 2);
    cabezalYBucle(g, ed, col, h, 0);
  }

  // ------------------------------------------------------------------ Interacción
  notaBajo(x, y) {
    const p = this.p;
    if (!p) return null;
    const n0 = this.nota(y), t = tickDeX(this.ed, x);
    let mejor = null;
    for (const n of p.notas) {
      if (n.nota !== n0 || t < n.tick || t > n.tick + n.dur) continue;
      mejor = n;
    }
    if (!mejor) return null;
    const xFin = xDeTick(this.ed, mejor.tick + mejor.dur);
    return { n: mejor, borde: xFin - x <= Math.min(7, (mejor.dur * this.ed.zx) / 3) };
  }

  abajo(e) {
    this.cv.setPointerCapture(e.pointerId);
    this.punteros.set(e.pointerId, this.pos(e));
    if (this.punteros.size === 2) {
      // Dos dedos: desplazar (se deshace lo que hubiera empezado el primer dedo).
      if (this.drag?.foto) this.api.restaurar(this.drag.foto);
      this.drag = { modo: "pan", ...this.centro(), sx: this.ed.scrollX, sy: this.ed.scrollY };
      return;
    }
    const { x, y } = this.pos(e);
    const ed = this.ed, p = this.p;
    if (e.button === 2) { this.borrarEn(x, y); return; }
    if (e.button !== 0) return;
    if (y < REGLA) {
      // Regla: mover el cabezal; con Mayúsculas, marcar el tramo del bucle.
      const t = Math.max(0, ajustar(ed, tickDeX(ed, x)));
      if (e.shiftKey) this.drag = { modo: "bucle", ini: t };
      else { this.drag = { modo: "cabezal" }; this.api.moverCabezal(t); }
      return;
    }
    if (x < TECLAS) {
      const n = this.nota(y);
      this.teclaPulsada = n;
      this.drag = { modo: "tecla", n };
      this.api.tecla(n, true);
      this.dibujar();
      return;
    }
    if (!p) return;
    const hit = this.notaBajo(x, y);
    const t = tickDeX(ed, x), nota = this.nota(y);
    if (hit) {
      if (e.shiftKey) { ed.sel.has(hit.n.id) ? ed.sel.delete(hit.n.id) : ed.sel.add(hit.n.id); }
      else if (!ed.sel.has(hit.n.id)) { ed.sel.clear(); ed.sel.add(hit.n.id); }
      const elegidas = p.notas.filter((n) => ed.sel.has(n.id));
      this.drag = {
        modo: hit.borde ? "dur" : "mover", foto: this.api.antes(), t0: t, n0: nota, base: hit.n,
        orig: new Map(elegidas.map((n) => [n.id, { tick: n.tick, dur: n.dur, nota: n.nota }])), ultimaNota: hit.n.nota,
      };
      if (!hit.borde) this.api.probar(hit.n.nota, hit.n.vel);
      this.api.seleccion();
      this.dibujar();
      return;
    }
    if (ed.herramienta === "lapiz") {
      const foto = this.api.antes();
      const tick = Math.max(0, ajustar(ed, t, "floor"));
      const n = { id: this.api.nuevoId(), tick, dur: ed.rejilla > 1 ? ed.rejilla : ed.c.ppq / 4, nota, vel: ed.ultimaVel };
      p.notas.push(n);
      ed.sel.clear(); ed.sel.add(n.id);
      this.api.probar(nota, n.vel);
      this.drag = { modo: "dur", foto, t0: t, n0: nota, base: n, orig: new Map([[n.id, { tick: n.tick, dur: n.dur, nota }]]), nueva: true };
      this.api.seleccion();
      this.dibujar();
      return;
    }
    // Herramienta de selección: rectángulo.
    if (!e.shiftKey) ed.sel.clear();
    this.drag = { modo: "rect", x0: x, y0: y, previa: new Set(ed.sel), rect: { x, y, w: 0, h: 0 } };
    this.api.seleccion();
    this.dibujar();
  }

  centro() {
    const ps = [...this.punteros.values()];
    return { cx: (ps[0].x + ps[1].x) / 2, cy: (ps[0].y + ps[1].y) / 2 };
  }

  mover(e) {
    if (this.punteros.has(e.pointerId)) this.punteros.set(e.pointerId, this.pos(e));
    const { x, y } = this.pos(e);
    const ed = this.ed, d = this.drag;
    if (!d) { this.cursor(x, y); return; }
    if (d.modo === "pan") {
      if (this.punteros.size < 2) return;
      const { cx, cy } = this.centro();
      ed.scrollX = Math.max(0, d.sx - (cx - d.cx) / ed.zx);
      ed.scrollY = Math.max(this.filas() - 1, Math.min(127.99, d.sy + (cy - d.cy) / ed.zy));
      this.api.refrescar("vista");
      return;
    }
    if (d.modo === "cabezal") { this.api.moverCabezal(Math.max(0, ajustar(ed, tickDeX(ed, x)))); return; }
    if (d.modo === "bucle") {
      const t = Math.max(0, ajustar(ed, tickDeX(ed, x)));
      ed.bucle = t === d.ini ? null : { ini: Math.min(t, d.ini), fin: Math.max(t, d.ini) };
      this.api.refrescar("bucle");
      return;
    }
    if (d.modo === "tecla") {
      const n = this.nota(y);
      if (n !== d.n) { this.api.tecla(d.n, false); d.n = n; this.teclaPulsada = n; this.api.tecla(n, true); this.dibujar(); }
      return;
    }
    if (d.modo === "rect") {
      d.rect = { x: Math.min(x, d.x0), y: Math.min(y, d.y0), w: Math.abs(x - d.x0), h: Math.abs(y - d.y0) };
      const ta = tickDeX(ed, d.rect.x), tb = tickDeX(ed, d.rect.x + d.rect.w);
      const na = this.nota(d.rect.y + d.rect.h), nb = this.nota(d.rect.y);
      ed.sel = new Set(d.previa);
      for (const n of this.p.notas) if (n.tick < tb && n.tick + n.dur > ta && n.nota >= na && n.nota <= nb) ed.sel.add(n.id);
      this.api.seleccion();
      this.dibujar();
      return;
    }
    const p = this.p;
    if (d.modo === "mover") {
      const base = d.orig.get(d.base.id);
      // El desplazamiento se ajusta a la rejilla tomando como referencia la nota que agarraste.
      const dt = Math.max(-Math.min(...[...d.orig.values()].map((o) => o.tick)), ajustar(ed, base.tick + tickDeX(ed, x) - d.t0) - base.tick);
      let dn = this.nota(y) - d.n0;
      const notas = [...d.orig.values()].map((o) => o.nota);
      dn = Math.max(-Math.min(...notas), Math.min(127 - Math.max(...notas), dn));
      for (const n of p.notas) {
        const o = d.orig.get(n.id);
        if (o) { n.tick = o.tick + dt; n.nota = o.nota + dn; }
      }
      if (d.base.nota !== d.ultimaNota) { d.ultimaNota = d.base.nota; this.api.probar(d.base.nota, d.base.vel); }
      this.api.refrescar("notas");
      return;
    }
    if (d.modo === "dur") {
      const base = d.orig.get(d.base.id);
      const fin = Math.max(base.tick + Math.max(1, Math.min(ed.rejilla, 30)), ajustar(ed, tickDeX(ed, x), "ceil"));
      const delta = fin - (base.tick + base.dur);
      for (const n of p.notas) {
        const o = d.orig.get(n.id);
        if (o) n.dur = Math.max(Math.min(ed.rejilla, 30), o.dur + delta);
      }
      this.api.refrescar("notas");
    }
  }

  arriba(e, cancelado = false) {
    this.punteros.delete(e.pointerId);
    const d = this.drag;
    if (!d) return;
    if (d.modo === "pan") { if (this.punteros.size === 0) this.drag = null; return; }
    this.drag = null;
    if (d.modo === "tecla") { this.api.tecla(d.n, false); this.teclaPulsada = null; this.dibujar(); return; }
    if (d.modo === "rect") { this.dibujar(); return; }
    if (d.foto) {
      if (cancelado) this.api.restaurar(d.foto);
      else this.api.despues(d.foto);
    }
  }

  doble(e) {
    const { x, y } = this.pos(e);
    if (y > REGLA && x > TECLAS) this.borrarEn(x, y);
  }

  borrarEn(x, y) {
    const hit = this.notaBajo(x, y);
    if (!hit) return;
    const foto = this.api.antes();
    const p = this.p;
    p.notas = p.notas.filter((n) => n !== hit.n);
    this.ed.sel.delete(hit.n.id);
    this.api.despues(foto);
  }

  cursor(x, y) {
    let c = "default";
    if (y < REGLA) c = "col-resize";
    else if (x < TECLAS) c = "pointer";
    else {
      const hit = this.notaBajo(x, y);
      c = hit ? (hit.borde ? "ew-resize" : "move") : this.ed.herramienta === "lapiz" ? "crosshair" : "default";
    }
    this.cv.style.cursor = c;
  }

  rueda(e) {
    e.preventDefault();
    const ed = this.ed;
    const { x } = this.pos(e);
    const factor = e.deltaMode === 1 ? 16 : 1;
    if (e.ctrlKey || e.metaKey) {
      // Zoom horizontal alrededor del puntero.
      const t = tickDeX(ed, x);
      ed.zx = Math.max(0.005, Math.min(1.5, ed.zx * Math.exp(-e.deltaY * factor * 0.0025)));
      ed.scrollX = Math.max(0, t - (x - TECLAS) / ed.zx);
    } else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      ed.scrollX = Math.max(0, ed.scrollX + ((e.shiftKey ? e.deltaY : e.deltaX) * factor) / ed.zx);
    } else {
      ed.scrollY = Math.max(this.filas() - 1, Math.min(127.99, ed.scrollY - (e.deltaY * factor) / ed.zy));
    }
    this.api.refrescar("vista");
  }
}

// =====================================================================================
// Carril: velocidad de las notas, un controlador (CC), el pitch bend o el tempo.
export const CARRILES = {
  vel: { nombre: "Velocidad", min: 1, max: 127 },
  1: { nombre: "Modulación", min: 0, max: 127, def: () => 0 },
  7: { nombre: "Volumen", min: 0, max: 127, def: (p) => p.volumen },
  10: { nombre: "Pan", min: 0, max: 127, def: (p) => p.pan, centro: 64 },
  11: { nombre: "Expresión", min: 0, max: 127, def: () => 127 },
  64: { nombre: "Sostenido", min: 0, max: 127, def: () => 0, pedal: true },
  bend: { nombre: "Pitch bend", min: -8192, max: 8191, def: () => 0, centro: 0 },
  tempo: { nombre: "Tempo", min: 20, max: 260, clave: "bpm" },
};

export class Carril {
  constructor(canvas, ed, api, fijo = null) {
    this.cv = canvas;
    this.ed = ed;
    this.api = api;
    this.fijo = fijo; // "tempo" en la vista de tempo
    this.drag = null;
    canvas.addEventListener("pointerdown", (e) => this.abajo(e));
    canvas.addEventListener("pointermove", (e) => this.mover(e));
    canvas.addEventListener("pointerup", () => this.arriba());
    canvas.addEventListener("pointercancel", () => this.arriba());
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("wheel", (e) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) {
        e.preventDefault();
        ed.scrollX = Math.max(0, ed.scrollX + (e.shiftKey ? e.deltaY : e.deltaX) / ed.zx);
        api.refrescar("vista");
      }
    }, { passive: false });
  }

  get tipo() { return this.fijo || String(this.ed.carril); }
  get cfg() { return CARRILES[this.tipo]; }
  get p() { return this.ed.c.pistas[this.ed.pista]; }
  lista(crear = false) {
    if (this.tipo === "tempo") return this.ed.c.tempos;
    if (this.tipo === "bend") return this.p.bend;
    if (crear) this.p.ccs[this.tipo] ||= [];
    return this.p.ccs[this.tipo] || [];
  }
  get clave() { return this.cfg.clave || "valor"; }
  yDe(v, h) { const { min, max } = this.cfg; return 6 + (1 - (v - min) / (max - min)) * (h - 12); }
  vDe(y, h) { const { min, max } = this.cfg; return Math.round(Math.max(min, Math.min(max, min + (1 - (y - 6) / (h - 12)) * (max - min)))); }
  pos(e) { const r = this.cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  dibujar() {
    const { g, w, h } = prepararLienzo(this.cv);
    const ed = this.ed, col = colores(), cfg = this.cfg, p = this.p;
    g.clearRect(0, 0, w, h);
    g.fillStyle = col.fondo;
    g.fillRect(TECLAS, 0, w - TECLAS, h);
    rejillaVertical(g, ed, col, w, 0, h);
    // Guías horizontales y escala.
    g.font = "10.5px system-ui, sans-serif";
    g.textBaseline = "middle";
    const marcas = this.tipo === "tempo" ? [60, 120, 180, 240] : this.tipo === "bend" ? [8191, 0, -8192] : cfg.pedal ? [127, 64, 0] : [127, 96, 64, 32, 0];
    for (const v of marcas) {
      const y = Math.round(this.yDe(v, h)) + 0.5;
      g.fillStyle = col.pulso;
      g.fillRect(TECLAS, y, w - TECLAS, 1);
    }
    if (!p && this.tipo !== "tempo") return;
    const t0 = tickDeX(ed, TECLAS), t1 = tickDeX(ed, w);

    if (this.tipo === "vel") {
      for (const n of p.notas) {
        if (n.tick < t0 - 1 || n.tick > t1) continue;
        const x = Math.round(xDeTick(ed, n.tick)), y = this.yDe(n.vel, h);
        const sel = ed.sel.has(n.id);
        g.fillStyle = sel ? col.sel : p.color;
        g.globalAlpha = sel || !ed.sel.size ? 1 : 0.55;
        g.fillRect(x, y, 3, h - y);
        g.fillRect(x - 2, y - 1, 7, 3);
        g.globalAlpha = 1;
      }
    } else {
      const lista = this.lista(), k = this.clave;
      const def = this.tipo === "tempo" ? null : cfg.def(p);
      g.strokeStyle = this.tipo === "tempo" ? col.acento : p.color;
      g.lineWidth = 2;
      // Antes del primer evento: el valor por defecto (línea discontinua).
      if (def !== null) {
        const fin = lista.length ? xDeTick(ed, lista[0].tick) : w;
        g.setLineDash([4, 4]);
        g.beginPath(); g.moveTo(TECLAS, this.yDe(def, h)); g.lineTo(Math.max(TECLAS, fin), this.yDe(def, h)); g.stroke();
        g.setLineDash([]);
      }
      g.beginPath();
      lista.forEach((e, i) => {
        const x = xDeTick(ed, e.tick), y = this.yDe(e[k], h);
        const xs = i + 1 < lista.length ? xDeTick(ed, lista[i + 1].tick) : w;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
        g.lineTo(xs, y);
      });
      g.stroke();
      g.lineWidth = 1;
      g.fillStyle = this.tipo === "tempo" ? col.acento : p.color;
      for (const e of lista) {
        const x = xDeTick(ed, e.tick);
        if (x < TECLAS - 4 || x > w + 4) continue;
        g.beginPath(); g.arc(x, this.yDe(e[k], h), 3.5, 0, Math.PI * 2); g.fill();
        if (this.tipo === "tempo") { g.fillStyle = col.texto; g.fillText(String(Math.round(e.bpm * 10) / 10), x + 6, this.yDe(e.bpm, h) - 9); g.fillStyle = col.acento; }
      }
    }
    // Columna de la izquierda: nombre y escala.
    g.fillStyle = col.fondo2;
    g.fillRect(0, 0, TECLAS, h);
    g.fillStyle = col.linea;
    g.fillRect(TECLAS - 1, 0, 1, h);
    g.fillStyle = col.suave;
    for (const v of marcas) {
      const y = this.yDe(v, h);
      const txt = cfg.pedal ? (v >= 64 ? (v === 127 ? "pisado" : "64") : "suelto") : this.tipo === "bend" ? (v > 0 ? "+2 st" : v < 0 ? "−2 st" : "0") : String(v);
      g.fillText(txt, 6, Math.max(7, Math.min(h - 7, y)));
    }
    cabezalYBucle(g, ed, col, h, 0);
  }

  abajo(e) {
    const { x, y } = this.pos(e);
    if (x < TECLAS) return;
    if (!this.p && this.tipo !== "tempo") return;
    this.cv.setPointerCapture(e.pointerId);
    if (e.button === 2) { this.borrar(x); return; }
    if (e.button !== 0) return;
    this.drag = { foto: this.api.antes(), xPrev: x, tPrev: null };
    this.pintar(x, y);
  }

  mover(e) {
    const { x, y } = this.pos(e);
    this.cv.style.cursor = x < TECLAS ? "default" : "crosshair";
    if (this.drag) this.pintar(x, y);
  }

  arriba() {
    if (!this.drag) return;
    const foto = this.drag.foto;
    this.drag = null;
    this.api.despues(foto);
  }

  /** Dibujar a mano alzada: fija el valor bajo el puntero (y en el tramo recorrido desde el último punto). */
  pintar(x, y) {
    const ed = this.ed, d = this.drag, h = this.cv.clientHeight;
    const v = this.vDe(y, h);
    if (this.tipo === "vel") {
      const a = Math.min(d.xPrev, x) - 4, b = Math.max(d.xPrev, x) + 4;
      const soloSel = ed.sel.size > 0;
      for (const n of this.p.notas) {
        const xn = xDeTick(ed, n.tick);
        if (xn >= a && xn <= b && (!soloSel || ed.sel.has(n.id))) n.vel = v;
      }
      ed.ultimaVel = v;
      d.xPrev = x;
      this.api.refrescar("carril");
      return;
    }
    const lista = this.lista(true), k = this.clave;
    const t = Math.max(0, ajustar(ed, tickDeX(ed, x)));
    const ta = d.tPrev ?? t;
    const [lo, hi] = [Math.min(ta, t), Math.max(ta, t)];
    // Quitar lo que había en el tramo recorrido y poner el punto nuevo.
    for (let i = lista.length - 1; i >= 0; i--) {
      const e = lista[i];
      if (e.tick === t || (e.tick > lo && e.tick < hi)) {
        if (this.tipo === "tempo" && e.tick === 0) continue;
        lista.splice(i, 1);
      }
    }
    const existente = lista.find((e) => e.tick === t);
    if (existente) existente[k] = v;
    else lista.push({ tick: t, [k]: v });
    lista.sort((a, b) => a.tick - b.tick);
    d.tPrev = t;
    this.api.refrescar("carril");
  }

  borrar(x) {
    const lista = this.lista();
    if (this.tipo === "vel" || !lista.length) return;
    let mejor = -1, dist = 9;
    lista.forEach((e, i) => { const dd = Math.abs(xDeTick(this.ed, e.tick) - x); if (dd < dist && !(this.tipo === "tempo" && e.tick === 0)) { dist = dd; mejor = i; } });
    if (mejor < 0) return;
    const foto = this.api.antes();
    lista.splice(mejor, 1);
    this.api.despues(foto);
  }
}
