// Convierte las canciones de la biblioteca en canciones MIDI para el editor:
// partituras MusicXML (piano y violín) y tablaturas de armónica (.tab).
import { cancionNueva, pistaNueva, normalizar, PPQ } from "./modelo.js";
import { leerTab } from "../tab.js";
import { midiNota } from "../notas.js";

const PASO = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const hijo = (el, sel) => el.querySelector(`:scope > ${sel}`);
const num = (el, sel, def = 0) => { const x = el && hijo(el, sel); return x ? Number(x.textContent) : def; };

/** MusicXML (texto) → canción. programa: instrumento General MIDI para las pistas. */
export function desdeMusicXML(texto, { programa = 0, titulo, fuente } = {}) {
  const doc = new DOMParser().parseFromString(texto, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("El MusicXML no se pudo leer.");
  const c = cancionNueva();
  c.nombre = titulo || doc.querySelector("work-title, movement-title")?.textContent.trim() || "Partitura";
  c.fuente = fuente || "";
  c.pistas = [];
  c.tempos = [];
  const nombresParte = {};
  doc.querySelectorAll("score-part").forEach((sp) => { nombresParte[sp.id] = sp.querySelector("part-name")?.textContent.trim() || sp.id; });

  let compasVisto = false;
  doc.querySelectorAll("part").forEach((parte) => {
    const compases = [...parte.querySelectorAll(":scope > measure")];
    const orden = desplegarRepeticiones(compases);
    const porPentagrama = new Map(); // staff → pista
    const pistaDe = (staff) => {
      if (!porPentagrama.has(staff)) {
        const p = pistaNueva(c.pistas.length, { programa });
        p.nombre = nombresParte[parte.id] || "Parte";
        p.staff = staff;
        porPentagrama.set(staff, p);
        c.pistas.push(p);
      }
      return porPentagrama.get(staff);
    };
    let divisiones = 1, pos = 0;
    const ligadas = new Map(); // "staff:nota" → nota que continúa
    for (const m of orden) {
      let finCompas = pos, anterior = pos;
      for (const el of m.children) {
        if (el.tagName === "attributes") {
          divisiones = num(el, "divisions", divisiones) || divisiones;
          const t = hijo(el, "time");
          if (t && !compasVisto) { c.compas = { num: num(t, "beats", 4), den: num(t, "beat-type", 4) }; compasVisto = true; }
        } else if (el.tagName === "direction" || el.tagName === "sound") {
          const s = el.tagName === "sound" ? el : el.querySelector("sound");
          const tempo = s?.getAttribute("tempo");
          if (tempo) c.tempos.push({ tick: Math.round(pos * PPQ / divisiones), bpm: Number(tempo) });
        } else if (el.tagName === "backup") {
          pos -= num(el, "duration");
        } else if (el.tagName === "forward") {
          pos += num(el, "duration");
          finCompas = Math.max(finCompas, pos);
        } else if (el.tagName === "note") {
          if (hijo(el, "grace") || hijo(el, "cue")) continue;
          const dur = num(el, "duration");
          const acorde = !!hijo(el, "chord");
          const ini = acorde ? anterior : pos;
          const pitch = hijo(el, "pitch");
          if (pitch) {
            const nota = 12 * (num(pitch, "octave", 4) + 1) + PASO[hijo(pitch, "step").textContent.trim()] + num(pitch, "alter", 0);
            const staff = num(el, "staff", 1);
            const p = pistaDe(staff);
            const tick = Math.round(ini * PPQ / divisiones), dt = Math.max(1, Math.round(dur * PPQ / divisiones));
            const ties = [...el.querySelectorAll(":scope > tie")].map((t) => t.getAttribute("type"));
            const clave = `${staff}:${nota}`;
            const previa = ligadas.get(clave);
            if (ties.includes("stop") && previa && Math.abs(previa.tick + previa.dur - tick) <= 2) {
              previa.dur = tick + dt - previa.tick;
              if (!ties.includes("start")) ligadas.delete(clave);
            } else {
              const n = { tick, dur: dt, nota, vel: el.getAttribute("dynamics") ? Math.round(Number(el.getAttribute("dynamics")) * 0.9) : 90 };
              p.notas.push(n);
              if (ties.includes("start")) ligadas.set(clave, n);
            }
          }
          if (!acorde) { anterior = pos; pos += dur; }
          finCompas = Math.max(finCompas, pos);
        }
      }
      pos = Math.max(finCompas, pos);
    }
  });

  // Piano con dos pentagramas: mano derecha y mano izquierda en pistas separadas.
  const partes = {};
  c.pistas.forEach((p) => { (partes[p.nombre] ||= []).push(p); });
  for (const lista of Object.values(partes)) {
    lista.sort((x, y) => x.staff - y.staff);
    if (lista.length === 2 && programa < 8) { lista[0].nombre += " · mano derecha"; lista[1].nombre += " · mano izquierda"; }
    else if (lista.length > 1) lista.forEach((p) => { p.nombre += ` · pentagrama ${p.staff}`; });
  }
  c.pistas = Object.values(partes).flat();
  c.pistas.forEach((p) => delete p.staff);
  if (!c.tempos.length) c.tempos = [{ tick: 0, bpm: 90 }];
  return normalizar(c);
}

/** Orden en que suenan los compases, desplegando las repeticiones (|: :|) y las casillas 1ª / 2ª. */
function desplegarRepeticiones(compases) {
  const orden = [];
  let inicio = 0, i = 0, vuelta = 1, saltos = 0;
  while (i < compases.length && saltos < 500) {
    const m = compases[i];
    const reps = [...m.querySelectorAll(":scope > barline repeat")];
    if (reps.some((r) => r.getAttribute("direction") === "forward") && vuelta === 1) inicio = i;
    const ending = m.querySelector(":scope > barline ending");
    const numeros = ending?.getAttribute("number")?.split(/[ ,]+/).map(Number) || null;
    if (!numeros || numeros.includes(vuelta)) orden.push(m);
    const atras = reps.find((r) => r.getAttribute("direction") === "backward");
    const veces = Number(atras?.getAttribute("times") || 2);
    if (atras && (!numeros || numeros.includes(vuelta)) && vuelta < veces) {
      vuelta++; i = inicio; saltos++;
      continue;
    }
    if (atras && vuelta >= veces) vuelta = 1;
    // Casilla final (la 2ª, tras volver): al terminarla, se sigue con normalidad.
    const finCasilla = [...m.querySelectorAll(":scope > barline ending")].some((e) => /stop|discontinue/.test(e.getAttribute("type")));
    if (!atras && numeros?.includes(vuelta) && vuelta > 1 && finCasilla) vuelta = 1;
    i++;
  }
  return orden;
}

/** Tablatura de armónica (.tab) → canción con una pista de armónica (instrumento 22). */
export function desdeTab(texto, { tono = "C", titulo, fuente } = {}) {
  const tab = leerTab(texto);
  const c = cancionNueva();
  c.nombre = titulo || tab.meta.titulo || "Tablatura";
  c.fuente = fuente || tab.meta.fuente || "";
  const t = tab.meta.armonica || tono;
  c.tempos = [{ tick: 0, bpm: Number(tab.meta.tempo) || 90 }];
  if (tab.meta.compas && /^\d+\/\d+$/.test(tab.meta.compas)) { const [a, b] = tab.meta.compas.split("/").map(Number); c.compas = { num: a, den: b }; }
  const p = c.pistas[0];
  p.nombre = `Armónica en ${t}`;
  p.programa = 22;
  let tick = 0;
  for (const s of tab.secciones) {
    for (const it of s.items) {
      if (it.tipo !== "tab") continue;
      for (const tok of it.tokens) {
        if (tok.tipo === "barra") continue;
        const dur = Math.round((tok.dur ?? 1) * PPQ);
        if (tok.tipo === "grupo") for (const n of tok.notas) p.notas.push({ tick, dur: Math.round(dur * 0.95), nota: midiNota(n, t), vel: 96 });
        tick += dur;
      }
      if (!tab.conRitmo) tick += PPQ; // sin ritmo escrito: una pausa para respirar al final de cada línea
    }
  }
  return normalizar(c);
}
