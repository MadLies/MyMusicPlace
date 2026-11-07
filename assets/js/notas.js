// Teoría básica de la armónica diatónica (afinación Richter, 10 hoyos).

export const NOMBRES = ["Do", "Do♯", "Re", "Mi♭", "Mi", "Fa", "Fa♯", "Sol", "Sol♯", "La", "Si♭", "Si"];
export const CIFRADO = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];

// Tonos de armónica más comunes, de la más grave (G) a la más aguda (F#).
export const TONOS_ARMONICA = ["G", "Ab", "A", "Bb", "B", "C", "Db", "D", "Eb", "E", "F", "F#"];

const ALIAS = { C: 0, "C#": 1, DB: 1, D: 2, "D#": 3, EB: 3, E: 4, F: 5, "F#": 6, GB: 6, G: 7, "G#": 8, AB: 8, A: 9, "A#": 10, BB: 10, B: 11 };

// Semitonos sobre la nota del hoyo 1 soplado.
export const SOPLA = [null, 0, 4, 7, 12, 16, 19, 24, 28, 31, 36];
export const ASPIRA = [null, 2, 7, 11, 14, 17, 21, 23, 26, 29, 33];
// Cuántos semitonos se puede bajar cada hoyo con bend (sin overblows).
export const BENDS_ASPIRA = [null, 1, 2, 3, 1, 0, 1, 0, 0, 0, 0];
export const BENDS_SOPLA = [null, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2];

export function normalizarTono(texto = "C") {
  const t = String(texto).trim().replace("♯", "#").replace("♭", "b").split(/\s+/)[0] || "C";
  const clave = t.toUpperCase();
  if (!(clave in ALIAS)) return "C";
  return TONOS_ARMONICA.find((k) => ALIAS[k.toUpperCase()] === ALIAS[clave]) || "C";
}

export const semitonoTono = (tono) => ALIAS[normalizarTono(tono).toUpperCase()];

// MIDI del hoyo 1 soplado: G..B son armónicas graves (debajo del Do central).
export function midiBase(tono) {
  const n = semitonoTono(tono);
  return n >= 7 ? 48 + n : 60 + n;
}

export function midiNota(nota, tono) {
  const tabla = nota.aspira ? ASPIRA : SOPLA;
  return midiBase(tono) + tabla[nota.hoyo] - nota.bends;
}

export const frecuencia = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const midiDeFrecuencia = (f) => 69 + 12 * Math.log2(f / 440);
export const nombreNota = (m) => NOMBRES[((Math.round(m) % 12) + 12) % 12];
export const octava = (m) => Math.floor(Math.round(m) / 12) - 1;

export function nombreTono(tono) {
  const n = semitonoTono(tono);
  return `${NOMBRES[n]} (${CIFRADO[n]})`;
}

export const textoNota = (n) => (n.aspira ? "-" : "") + n.hoyo + "ʼ".repeat(n.bends);

export function describirNota(n) {
  const accion = n.aspira ? "Aspirar" : "Soplar";
  const bend = n.bends ? ` con bend de ${n.bends === 1 ? "medio tono" : n.bends === 2 ? "un tono" : "tono y medio"}` : "";
  return `${accion} el hoyo ${n.hoyo}${bend}`;
}

// Todas las notas que da una armónica (incluye bends). Útil para el afinador.
export function notasArmonica(tono) {
  const lista = [];
  for (let h = 1; h <= 10; h++) {
    lista.push({ hoyo: h, aspira: false, bends: 0 });
    lista.push({ hoyo: h, aspira: true, bends: 0 });
    for (let b = 1; b <= BENDS_ASPIRA[h]; b++) lista.push({ hoyo: h, aspira: true, bends: b });
    for (let b = 1; b <= BENDS_SOPLA[h]; b++) lista.push({ hoyo: h, aspira: false, bends: b });
  }
  return lista.map((n) => ({ ...n, midi: midiNota(n, tono) }));
}

// Posiciones: tonalidad que sale tocando "en posición" con esta armónica.
export function posiciones(tono) {
  const n = semitonoTono(tono);
  const p = (s, modo) => `${NOMBRES[(n + s) % 12]}${modo}`;
  return [
    { num: 1, nombre: "1ª posición", tonalidad: p(0, " mayor"), uso: "Melodías alegres, canciones populares, folk.", base: "4 soplado" },
    { num: 2, nombre: "2ª posición (cross harp)", tonalidad: p(7, " (blues)"), uso: "Blues, rock y country. La más usada fuera de las melodías simples.", base: "-2 aspirado" },
    { num: 3, nombre: "3ª posición", tonalidad: p(2, " menor"), uso: "Melodías menores con sonido dórico; blues menor.", base: "-4 aspirado" },
    { num: 4, nombre: "4ª posición", tonalidad: p(9, " menor"), uso: "Menor natural (relativa): Tetris, Lambada.", base: "-6 aspirado" },
  ];
}
