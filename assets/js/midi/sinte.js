// Sintetizador General MIDI sencillo (Web Audio, sin muestras): un timbre por familia de
// instrumentos y un kit de percusión sintetizado para el canal 10.
// Cada pista tiene su «tira de canal»: volumen (CC7) × expresión (CC11) → panorama (CC10),
// y dos señales que desafinan sus notas: pitch bend y modulación (vibrato, CC1).
import { familiaDe, CANAL_PERCUSION } from "./gm.js";
import { frecMidi } from "./modelo.js";

const RANGO_BEND = 200; // centésimas: ±2 semitonos, lo estándar en General MIDI

export class Sinte {
  /** ctx: AudioContext u OfflineAudioContext. */
  constructor(ctx) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.tiras = new Map();
    this.voces = new Set();
    this.ondas = {};
    // Ruido blanco para la percusión.
    const n = ctx.sampleRate;
    this.ruido = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = this.ruido.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }

  onda(nombre, armonicos) {
    if (!this.ondas[nombre]) this.ondas[nombre] = this.ctx.createPeriodicWave(new Float32Array(armonicos.length), new Float32Array(armonicos), { disableNormalization: false });
    return this.ondas[nombre];
  }

  /** Tira de canal de una pista (se crea la primera vez). */
  tira(id) {
    if (this.tiras.has(id)) return this.tiras.get(id);
    const c = this.ctx;
    const vol = c.createGain(), expr = c.createGain(), pan = c.createStereoPanner();
    vol.connect(expr).connect(pan).connect(this.master);
    const bend = c.createConstantSource();
    bend.offset.value = 0;
    bend.start();
    const lfo = c.createOscillator(), mod = c.createGain();
    lfo.frequency.value = 5.6;
    mod.gain.value = 0;
    lfo.connect(mod);
    lfo.start();
    const t = { vol, expr, pan, bend, mod, lfo };
    this.tiras.set(id, t);
    return t;
  }

  /** Fija el estado de los controles de una pista en el instante t (segundos del reloj de audio). */
  control(id, tipo, valor, t = this.ctx.currentTime) {
    const tr = this.tira(id);
    const at = (param, v) => { param.cancelScheduledValues(t); param.setValueAtTime(v, t); };
    if (tipo === 7) at(tr.vol.gain, (valor / 127) ** 2);
    else if (tipo === 11) at(tr.expr.gain, (valor / 127) ** 2);
    else if (tipo === 10) at(tr.pan.pan, Math.max(-1, Math.min(1, (valor - 64) / 63)));
    else if (tipo === 1) at(tr.mod.gain, (valor / 127) * 60);
    else if (tipo === "bend") at(tr.bend.offset, (valor / 8192) * RANGO_BEND);
  }

  /**
   * Toca una nota. t1 = cuándo se suelta (o null: suena hasta llamar a soltar()).
   * Devuelve { soltar(t) }.
   */
  nota({ id, programa = 0, canal = 0, nota, vel = 100, t0 = this.ctx.currentTime, t1 = null }) {
    if (canal === CANAL_PERCUSION) return this.tambor(id, nota, vel, t0);
    const c = this.ctx, tr = this.tira(id);
    const f = frecMidi(nota);
    const tb = timbre(programa, nota);
    const pico = 0.28 * (vel / 127) ** 1.5 * tb.vol;
    const env = c.createGain();
    env.gain.value = 0;
    const filtro = c.createBiquadFilter();
    filtro.type = "lowpass";
    filtro.Q.value = tb.q ?? 0.7;
    const fCorte = Math.min(16000, f * tb.brillo);
    filtro.frequency.value = fCorte;
    filtro.connect(env).connect(tr.vol);

    const oscs = tb.osc.map(([tipo, mult, amp, detune = 0]) => {
      const o = c.createOscillator();
      if (Array.isArray(tipo)) o.setPeriodicWave(this.onda(tipo.join(","), tipo)); else o.type = tipo;
      o.frequency.value = f * mult;
      o.detune.value = detune;
      tr.bend.connect(o.detune);
      tr.mod.connect(o.detune);
      const g = c.createGain();
      g.gain.value = amp;
      o.connect(g).connect(filtro);
      o.start(t0);
      return o;
    });

    // Envolvente: ataque, caída hacia el nivel sostenido (o hacia el silencio en los instrumentos que se apagan solos).
    const atk = t1 ? Math.min(tb.ataque, Math.max(0.003, (t1 - t0) * 0.5)) : tb.ataque;
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(pico, t0 + atk);
    env.gain.setTargetAtTime(pico * tb.sostenido, t0 + atk, tb.caida * (nota < 48 ? 1.4 : nota > 84 ? 0.6 : 1));
    if (tb.filtroEnv) {
      filtro.frequency.setValueAtTime(fCorte * tb.filtroEnv, t0);
      filtro.frequency.setTargetAtTime(fCorte, t0, tb.filtroTau ?? 0.15);
    }
    let soltada = false;
    const voz = {
      soltar: (t = c.currentTime) => {
        if (soltada) return;
        soltada = true;
        t = Math.max(t, t0 + atk);
        env.gain.cancelScheduledValues(t);
        env.gain.setTargetAtTime(0, t, tb.release / 3);
        oscs.forEach((o) => { try { o.stop(t + tb.release * 1.6 + 0.05); } catch { /* ya parado */ } });
        setTimeout(() => this.voces.delete(voz), Math.max(0, (t - c.currentTime + tb.release * 2) * 1000));
      },
      cortar: () => {
        const t = c.currentTime;
        env.gain.cancelScheduledValues(t);
        env.gain.setTargetAtTime(0, t, 0.01);
        oscs.forEach((o) => { try { o.stop(t + 0.06); } catch { /* ya parado */ } });
        this.voces.delete(voz);
      },
    };
    this.voces.add(voz);
    if (t1 !== null) {
      // En los instrumentos que se apagan solos, no hace falta mantener la voz más allá de su caída.
      const tope = tb.sostenido < 0.01 ? Math.min(t1, t0 + atk + tb.caida * 6) : t1;
      voz.soltar(Math.max(t0 + 0.01, tope));
    }
    return voz;
  }

  /** Percusión del canal 10: cada nota es un instrumento distinto. */
  tambor(id, nota, vel, t0) {
    const c = this.ctx, tr = this.tira(id);
    const v = 0.5 * (vel / 127) ** 1.3;
    const salida = c.createGain();
    salida.gain.value = v;
    salida.connect(tr.vol);
    const nodos = [];
    const tono = (f0, f1, dur, amp = 1, tipo = "sine") => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = tipo;
      o.frequency.setValueAtTime(f0, t0);
      o.frequency.exponentialRampToValueAtTime(f1, t0 + dur * 0.7);
      g.gain.setValueAtTime(amp, t0);
      g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
      o.connect(g).connect(salida);
      o.start(t0); o.stop(t0 + dur + 0.02);
      nodos.push(o);
    };
    const ruido = (dur, tipoFiltro, fq, amp = 1, q = 0.8, retardo = 0) => {
      const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.ruido;
      fl.type = tipoFiltro; fl.frequency.value = fq; fl.Q.value = q;
      const ti = t0 + retardo;
      g.gain.setValueAtTime(0, t0);
      g.gain.setValueAtTime(amp, ti);
      g.gain.exponentialRampToValueAtTime(0.0008, ti + dur);
      s.connect(fl).connect(g).connect(salida);
      s.start(t0, Math.random() * 0.5); s.stop(ti + dur + 0.02);
      nodos.push(s);
    };
    if (nota === 35 || nota === 36) { tono(150, 45, 0.45, 1.2); ruido(0.02, "lowpass", 3000, 0.3); }
    else if (nota === 38 || nota === 40) { tono(220, 160, 0.12, 0.6, "triangle"); ruido(0.22, "highpass", 1800, 0.8); }
    else if (nota === 37) { ruido(0.05, "bandpass", 2500, 0.9, 2); }
    else if (nota === 39) { [0, 0.012, 0.024].forEach((r) => ruido(0.1, "bandpass", 1300, 0.7, 1.5, r)); }
    else if (nota === 42 || nota === 44) { ruido(nota === 44 ? 0.07 : 0.05, "highpass", 8000, 0.55); }
    else if (nota === 46) { ruido(0.4, "highpass", 7500, 0.5); }
    else if ([41, 43, 45, 47, 48, 50].includes(nota)) { const f = { 41: 82, 43: 98, 45: 110, 47: 131, 48: 147, 50: 175 }[nota]; tono(f * 1.6, f, 0.4, 0.9); }
    else if ([49, 52, 55, 57].includes(nota)) { ruido(1.4, "highpass", 5000, 0.5); ruido(0.6, "bandpass", 9000, 0.3, 1); }
    else if ([51, 53, 59].includes(nota)) { ruido(0.8, "bandpass", 9500, 0.35, 3); tono(nota === 53 ? 1800 : 3200, nota === 53 ? 1780 : 3150, 0.5, 0.08, "square"); }
    else if (nota === 54 || nota === 69 || nota === 70) { ruido(nota === 54 ? 0.18 : 0.08, "highpass", 6500, 0.5, 1.2); }
    else if (nota === 56) { tono(800, 790, 0.25, 0.3, "square"); tono(540, 535, 0.25, 0.3, "square"); }
    else if (nota >= 60 && nota <= 68) { const f = { 60: 400, 61: 300, 62: 330, 63: 290, 64: 220, 65: 520, 66: 380, 67: 900, 68: 700 }[nota]; tono(f * 1.3, f, 0.18, 0.8); }
    else if (nota === 75 || nota === 76 || nota === 77) { tono(nota === 77 ? 1600 : 2500, nota === 77 ? 1500 : 2400, 0.07, 0.8); }
    else if (nota === 80 || nota === 81) { tono(4200, 4200, nota === 81 ? 1.2 : 0.15, 0.25); }
    else { ruido(0.1, "bandpass", 1500 + (nota % 12) * 300, 0.6, 1.5); }
    const voz = { soltar() {}, cortar: () => nodos.forEach((n) => { try { n.stop(); } catch { /* ya parado */ } }) };
    return voz;
  }

  /** Silencio inmediato (al parar). */
  cortarTodo() {
    for (const v of [...this.voces]) v.cortar();
    this.voces.clear();
  }
}

// ---------------------------------------------------------------- Timbres por familia
const PIANO = [0, 1, 0.55, 0.3, 0.18, 0.11, 0.07, 0.04, 0.025];
const ORGANO = [0, 1, 0.8, 0.6, 0.5, 0, 0.35, 0, 0.3];
const LENGUETA = [0, 1, 0.7, 0.55, 0.38, 0.3, 0.2, 0.16, 0.1, 0.07, 0.05];
const CLARINETE = [0, 1, 0.05, 0.6, 0.04, 0.35, 0.03, 0.2, 0.02, 0.1];
const OBOE = [0, 0.6, 1, 0.8, 0.5, 0.35, 0.25, 0.15];
const CAMPANA = [0, 1, 0, 0.35, 0, 0.15, 0, 0, 0.08];
const FLAUTA = [0, 1, 0.2, 0.06, 0.02];
const VOZ = [0, 1, 0.5, 0.25, 0.4, 0.15, 0.06];

/** Parámetros del timbre según el instrumento General MIDI. */
export function timbre(p) {
  const fam = familiaDe(p);
  const base = { osc: [["triangle", 1, 1]], brillo: 8, ataque: 0.01, caida: 1, sostenido: 1, release: 0.15, vol: 1 };
  const decae = (caida, extra = {}) => ({ ...base, ataque: 0.004, caida, sostenido: 0, release: 0.12, ...extra });
  switch (fam) {
    case 0:
      if (p === 4 || p === 5) return decae(1.3, { osc: [["sine", 1, 1], ["sine", 2, 0.2], ["sine", 7, 0.03]] });
      if (p === 6 || p === 7) return decae(0.55, { osc: [["sawtooth", 1, 0.7]], brillo: 10 });
      return decae(0.9, { osc: [[PIANO, 1, 1], ["sine", 1, 0.3, 3]], brillo: 9, filtroEnv: 1.8, filtroTau: 0.3 });
    case 1:
      if (p === 12 || p === 13) return decae(0.22, { osc: [["sine", 1, 1], ["sine", 4, 0.25]] });
      return decae(0.8, { osc: [[CAMPANA, 1, 1], ["sine", 2.76, 0.15]], brillo: 14 });
    case 2:
      if (p >= 20) return { ...base, osc: [[LENGUETA, 1, 1]], ataque: 0.03, release: 0.08, brillo: 10, vol: 0.85 };
      return { ...base, osc: [[ORGANO, 1, 1]], ataque: 0.012, release: 0.06, brillo: 12, vol: 0.75 };
    case 3:
      if (p === 29 || p === 30) return { ...base, osc: [["square", 1, 0.6], ["sawtooth", 1.005, 0.5]], brillo: 6, ataque: 0.005, caida: 1.5, sostenido: 0.55, vol: 0.7, q: 2 };
      return decae(p === 24 ? 0.7 : 1, { osc: [["sawtooth", 1, 0.8]], brillo: p === 24 ? 3.5 : 5, filtroEnv: 2.5, filtroTau: 0.12 });
    case 4: return decae(1.1, { osc: [["triangle", 1, 1], ["sawtooth", 1, 0.25]], brillo: 5, sostenido: 0.35, ataque: 0.006, release: 0.1 });
    case 5:
      if (p === 45) return decae(0.25, { osc: [["sawtooth", 1, 0.7]], brillo: 4 });
      if (p === 46) return decae(0.9, { osc: [["triangle", 1, 1], ["sine", 2, 0.2]] });
      if (p === 47) return decae(0.6, { osc: [["sine", 1, 1]] });
      return { ...base, osc: [["sawtooth", 1, 0.7], ["sawtooth", 1, 0.3, 6]], brillo: 5, ataque: 0.07, release: 0.18, vol: 0.8 };
    case 6:
      if (p >= 52 && p <= 54) return { ...base, osc: [[VOZ, 1, 1], [VOZ, 1, 0.5, 8]], brillo: 6, ataque: 0.2, release: 0.35, vol: 0.85 };
      if (p === 55) return decae(0.4, { osc: [["sawtooth", 1, 1], ["sawtooth", 2, 0.5]] });
      return { ...base, osc: [["sawtooth", 1, 0.5, -7], ["sawtooth", 1, 0.5, 7]], brillo: 4.5, ataque: 0.25, release: 0.4, vol: 0.75 };
    case 7: return { ...base, osc: [["sawtooth", 1, 0.8]], brillo: 3, filtroEnv: 2.2, filtroTau: 0.08, ataque: 0.04, sostenido: 0.85, caida: 0.5, release: 0.12, vol: 0.75 };
    case 8:
      if (p === 71) return { ...base, osc: [[CLARINETE, 1, 1]], ataque: 0.04, brillo: 8, release: 0.08 };
      if (p >= 68) return { ...base, osc: [[OBOE, 1, 1]], ataque: 0.04, brillo: 8, release: 0.08, vol: 0.85 };
      return { ...base, osc: [[LENGUETA, 1, 1]], ataque: 0.04, brillo: 6, release: 0.1, vol: 0.85 };
    case 9: return { ...base, osc: [[FLAUTA, 1, 1]], ataque: 0.05, brillo: 10, release: 0.1 };
    case 10: return { ...base, osc: [[p === 80 ? "square" : "sawtooth", 1, 0.6]], brillo: 8, ataque: 0.008, release: 0.08, vol: 0.7 };
    case 11: return { ...base, osc: [["sawtooth", 1, 0.45, -9], ["sawtooth", 1, 0.45, 9], ["triangle", 0.5, 0.4]], brillo: 3, ataque: 0.45, release: 0.8, vol: 0.75 };
    case 12: return { ...base, osc: [["triangle", 1, 0.8], ["sine", 2, 0.3]], ataque: 0.3, release: 0.6 };
    case 13:
      if (p === 109) return { ...base, osc: [[LENGUETA, 1, 1]], ataque: 0.03, brillo: 7, vol: 0.8 };
      if (p === 110) return timbre(40);
      if (p === 108) return decae(0.35, { osc: [["sine", 1, 1], ["sine", 3, 0.2]] });
      return decae(0.7, { osc: [["sawtooth", 1, 0.8]], brillo: 6, filtroEnv: 2, filtroTau: 0.1 });
    case 14: return decae(0.3, { osc: [["sine", 1, 1], ["triangle", 1.5, 0.3]] });
    default: return decae(0.4, { osc: [["triangle", 1, 1]] });
  }
}
