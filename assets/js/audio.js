// Sonido: sintetizador sencillo con Web Audio (sin archivos de audio).

let ctx = null, salida = null, ondaArmonica = null;

export function contexto() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    salida = ctx.createGain();
    salida.gain.value = 0.7;
    const comp = ctx.createDynamicsCompressor();
    salida.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function onda() {
  if (!ondaArmonica) {
    // Lengüeta: muchos armónicos, los impares un poco más fuertes.
    const h = [0, 1, 0.7, 0.55, 0.38, 0.3, 0.2, 0.16, 0.1, 0.07, 0.05, 0.03];
    ondaArmonica = ctx.createPeriodicWave(new Float32Array(h.length), new Float32Array(h));
  }
  return ondaArmonica;
}

export function setVolumen(v) {
  contexto();
  salida.gain.value = v;
}

/** Toca una nota. timbre: "armonica" | "piano". */
export function tocarNota(frec, duracion = 0.45, { cuando = 0, timbre = "armonica", volumen = 0.25 } = {}) {
  const c = contexto();
  const t0 = c.currentTime + cuando;
  const osc = c.createOscillator();
  const filtro = c.createBiquadFilter();
  const g = c.createGain();
  osc.frequency.value = frec;
  filtro.type = "lowpass";
  filtro.Q.value = 0.7;
  osc.connect(filtro).connect(g).connect(salida);
  g.gain.setValueAtTime(0, t0);

  if (timbre === "piano") {
    osc.type = "triangle";
    filtro.frequency.value = 2800;
    const largo = Math.max(duracion, 0.25) + 0.8;
    g.gain.linearRampToValueAtTime(volumen, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(volumen * 0.35, t0 + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + largo);
    osc.start(t0);
    osc.stop(t0 + largo + 0.05);
    return;
  }

  osc.setPeriodicWave(onda());
  filtro.frequency.value = Math.min(5000, frec * 6);
  const lfo = c.createOscillator(), prof = c.createGain();
  lfo.frequency.value = 5.2;
  prof.gain.value = frec * 0.0035;
  lfo.connect(prof).connect(osc.frequency);
  const sostener = Math.max(0.06, duracion - 0.05);
  g.gain.linearRampToValueAtTime(volumen, t0 + 0.035);
  g.gain.setValueAtTime(volumen, t0 + sostener);
  g.gain.linearRampToValueAtTime(0, t0 + sostener + 0.07);
  osc.start(t0);
  lfo.start(t0);
  osc.stop(t0 + sostener + 0.1);
  lfo.stop(t0 + sostener + 0.1);
}

/** Un "clic" corto para el metrónomo. */
export function clic(fuerte = false) {
  const c = contexto();
  const osc = c.createOscillator(), g = c.createGain();
  osc.frequency.value = fuerte ? 1600 : 1100;
  g.gain.setValueAtTime(0.2, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.05);
  osc.connect(g).connect(salida);
  osc.start();
  osc.stop(c.currentTime + 0.06);
}

/**
 * Nota continua (bordón / nota de referencia sostenida). Devuelve una función para detenerla.
 * Timbre suave tipo órgano para que no tape al instrumento.
 */
export function bordon(frec, volumen = 0.09) {
  const c = contexto();
  const t0 = c.currentTime;
  const g = c.createGain();
  const filtro = c.createBiquadFilter();
  filtro.type = "lowpass";
  filtro.frequency.value = Math.min(4000, frec * 5);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(volumen, t0 + 0.4);
  filtro.connect(g).connect(salida);
  const oscs = [[1, 1], [2, 0.35], [3, 0.15]].map(([mult, amp]) => {
    const o = c.createOscillator();
    const ga = c.createGain();
    o.type = "sine";
    o.frequency.value = frec * mult;
    ga.gain.value = amp;
    o.connect(ga).connect(filtro);
    o.start(t0);
    return o;
  });
  let parado = false;
  return () => {
    if (parado) return;
    parado = true;
    const t = c.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + 0.25);
    oscs.forEach((o) => o.stop(t + 0.3));
  };
}
