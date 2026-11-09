// Modelo de una canción MIDI tal como la edita el editor.
//
// El tiempo se mide en «ticks»: cada negra se divide en `ppq` ticks (pulses per quarter note).
// Con ppq = 480, una corchea son 240 ticks y un compás de 4/4, 1920. Los segundos dependen del
// tempo (que puede cambiar a lo largo de la canción), por eso se guarda aparte, como en un .mid.
import { CANAL_PERCUSION } from "./gm.js";

export const PPQ = 480;
const COLORES = ["#2f8f73", "#3b6fd8", "#d0603a", "#9a5bd6", "#c99a16", "#d6487e", "#2b9bb3", "#6f8f2f", "#b5552f", "#5a6bd6", "#a8742b", "#3c9d5a", "#c0457a", "#4e88b8", "#8a6d3b", "#7a5ac8"];
let siguienteId = 1;
export const nuevoId = () => siguienteId++;

export function pistaNueva(i, { programa = 0, canal, nombre } = {}) {
  return {
    id: nuevoId(),
    nombre: nombre || `Pista ${i + 1}`,
    canal: canal ?? canalLibre(i),
    programa,
    volumen: 100, // CC7 inicial
    pan: 64, // CC10 inicial
    mute: false,
    solo: false,
    color: COLORES[i % COLORES.length],
    notas: [], // { id, tick, dur, nota, vel }
    ccs: {}, // número de controlador → [{ tick, valor }]
    bend: [], // [{ tick, valor }] de -8192 a 8191 (0 = sin desafinar)
  };
}
// Las pistas normales evitan el canal 10 (índice 9), reservado a la percusión.
const canalLibre = (i) => { const c = i % 15; return c >= CANAL_PERCUSION ? c + 1 : c; };

export function cancionNueva() {
  return {
    nombre: "Sin título",
    fuente: "",
    ppq: PPQ,
    tempos: [{ tick: 0, bpm: 120 }],
    compas: { num: 4, den: 4 },
    pistas: [pistaNueva(0)],
  };
}

/** Normaliza una canción leída (de localStorage o de un archivo) y reparte ids nuevos. */
export function normalizar(c) {
  c.ppq ||= PPQ;
  c.tempos = (c.tempos?.length ? c.tempos : [{ tick: 0, bpm: 120 }]).sort((a, b) => a.tick - b.tick);
  if (c.tempos[0].tick !== 0) c.tempos.unshift({ tick: 0, bpm: c.tempos[0].bpm });
  c.compas ||= { num: 4, den: 4 };
  if (!c.pistas?.length) c.pistas = [pistaNueva(0)];
  c.pistas.forEach((p, i) => {
    Object.assign(p, { ...pistaNueva(i), ...p, id: nuevoId() });
    p.notas.forEach((n) => { n.id = nuevoId(); });
    p.notas.sort((a, b) => a.tick - b.tick || a.nota - b.nota);
  });
  return c;
}

export const clonar = (x) => JSON.parse(JSON.stringify(x));

// ---------------------------------------------------------------- Tiempo
export const ticksCompas = (c) => c.ppq * 4 * c.compas.num / c.compas.den;
export const ticksPulso = (c) => c.ppq * 4 / c.compas.den;

/** Mapa de tempo: tramos con su tick y su segundo de inicio. */
function tramos(c) {
  let seg = 0;
  return c.tempos.map((t, i) => {
    if (i > 0) { const a = c.tempos[i - 1]; seg += (t.tick - a.tick) / c.ppq * 60 / a.bpm; }
    return { tick: t.tick, seg, bpm: t.bpm };
  });
}
export function segundosDeTick(c, tick) {
  const ts = tramos(c);
  let t = ts[0];
  for (const x of ts) if (x.tick <= tick) t = x; else break;
  return t.seg + (tick - t.tick) / c.ppq * 60 / t.bpm;
}
export function tickDeSegundos(c, s) {
  const ts = tramos(c);
  let t = ts[0];
  for (const x of ts) if (x.seg <= s) t = x; else break;
  return t.tick + (s - t.seg) * t.bpm / 60 * c.ppq;
}
export function bpmEn(c, tick) {
  let b = c.tempos[0].bpm;
  for (const t of c.tempos) if (t.tick <= tick) b = t.bpm; else break;
  return b;
}

/** Posición «compás:pulso:tick» (como en los secuenciadores), contando desde 1. */
export function posicion(c, tick) {
  const tc = ticksCompas(c), tp = ticksPulso(c);
  const compas = Math.floor(tick / tc);
  const resto = tick - compas * tc;
  const pulso = Math.floor(resto / tp);
  const t = Math.round(resto - pulso * tp);
  return `${String(compas + 1).padStart(3, "0")}:${String(pulso + 1).padStart(2, "0")}:${String(t).padStart(3, "0")}`;
}

/** Último tick con algo (nota, control o tempo). */
export function finCancion(c) {
  let fin = 0;
  for (const p of c.pistas) {
    for (const n of p.notas) fin = Math.max(fin, n.tick + n.dur);
    for (const l of Object.values(p.ccs)) for (const e of l) fin = Math.max(fin, e.tick);
    for (const e of p.bend) fin = Math.max(fin, e.tick);
  }
  for (const t of c.tempos) fin = Math.max(fin, t.tick);
  return fin;
}

// ---------------------------------------------------------------- Notas
const LETRAS = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const SOLFEO = ["Do", "Do♯", "Re", "Re♯", "Mi", "Fa", "Fa♯", "Sol", "Sol♯", "La", "La♯", "Si"];
export const octavaMidi = (n) => Math.floor(n / 12) - 1;
export const cifraMidi = (n) => `${LETRAS[n % 12]}${octavaMidi(n)}`;
export const nombreMidi = (n) => `${SOLFEO[n % 12]}${octavaMidi(n)}`;
export const esNegraMidi = (n) => [1, 3, 6, 8, 10].includes(n % 12);
export const frecMidi = (n) => 440 * Math.pow(2, (n - 69) / 12);

/** Valor de un control (o del pitch bend) vigente en un tick. */
export function valorEn(lista, tick, porDefecto) {
  let v = porDefecto;
  for (const e of lista || []) if (e.tick <= tick) v = e.valor; else break;
  return v;
}

/** Pistas que suenan, teniendo en cuenta mute y solo. */
export function pistasAudibles(c) {
  const hay = c.pistas.some((p) => p.solo);
  return c.pistas.filter((p) => (hay ? p.solo : !p.mute));
}
