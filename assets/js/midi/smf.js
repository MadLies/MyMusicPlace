// Archivos MIDI estándar (SMF, «Standard MIDI File», extensión .mid): leer y escribir.
//
// Un .mid es una cabecera «MThd» y una o más pistas «MTrk». Cada pista es una lista de eventos y
// cada evento va precedido de su «delta»: los ticks que pasan desde el evento anterior, escritos
// como número de longitud variable (VLQ: 7 bits por byte; el bit alto en 1 significa «sigue otro byte»).
import { cancionNueva, pistaNueva, normalizar, PPQ } from "./modelo.js";
import { INSTRUMENTOS, PERCUSION, CONTROLES, CANAL_PERCUSION } from "./gm.js";

const hex = (b) => b.toString(16).toUpperCase().padStart(2, "0");
export const bytesHex = (bs) => [...bs].map(hex).join(" ");
const LETRAS = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const notaTxt = (n) => `${n} (${LETRAS[n % 12]}${Math.floor(n / 12) - 1})`;

// ---------------------------------------------------------------- Números de longitud variable
export function vlq(n) {
  n = Math.max(0, Math.round(n));
  const out = [n & 0x7f];
  while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80);
  return out;
}

/** Datos de un evento meta (FF tipo longitud datos…): lo que va después de la longitud en VLQ. */
function datosMeta(b) {
  let i = 2;
  while (b[i] & 0x80) i++;
  return b.slice(i + 1);
}

/** Explica un mensaje MIDI (sus bytes) en palabras. Sirve para el archivo y para el monitor en vivo. */
export function describirMensaje(b) {
  const st = b[0];
  if (st === 0xff) {
    const tipo = b[1];
    const datos = datosMeta(b);
    const texto = () => decodificar(datos);
    switch (tipo) {
      case 0x01: return { tipo: "Meta: texto", texto: `«${texto()}»` };
      case 0x02: return { tipo: "Meta: copyright", texto: `«${texto()}»` };
      case 0x03: return { tipo: "Meta: nombre de pista", texto: `«${texto()}»` };
      case 0x04: return { tipo: "Meta: instrumento", texto: `«${texto()}»` };
      case 0x05: return { tipo: "Meta: letra", texto: "(texto de la letra)" };
      case 0x06: return { tipo: "Meta: marcador", texto: `«${texto()}»` };
      case 0x2f: return { tipo: "Meta: fin de pista", texto: "Obligatorio al final de cada pista." };
      case 0x51: {
        const us = (datos[0] << 16) | (datos[1] << 8) | datos[2];
        return { tipo: "Meta: tempo", texto: `${us.toLocaleString("es")} µs por negra = ${(60e6 / us).toFixed(2).replace(/\.?0+$/, "")} BPM` };
      }
      case 0x58: return { tipo: "Meta: compás", texto: `${datos[0]}/${2 ** datos[1]} (el denominador va como potencia de 2: ${datos[1]} → ${2 ** datos[1]})` };
      case 0x59: {
        const sf = datos[0] > 127 ? datos[0] - 256 : datos[0];
        return { tipo: "Meta: armadura", texto: `${sf === 0 ? "sin alteraciones" : sf > 0 ? `${sf} ♯` : `${-sf} ♭`}, ${datos[1] ? "menor" : "mayor"}` };
      }
      default: return { tipo: `Meta 0x${hex(tipo)}`, texto: `${datos.length} bytes` };
    }
  }
  if (st === 0xf0 || st === 0xf7) return { tipo: "SysEx", texto: "Mensaje exclusivo del fabricante" };
  if (st === 0xf8) return { tipo: "Reloj", texto: "Pulso de sincronía (24 por negra)" };
  if (st === 0xfe) return { tipo: "Active sensing", texto: "«Sigo conectado» (el teclado lo manda cada 300 ms)" };
  if (st === 0xfa || st === 0xfb || st === 0xfc) return { tipo: st === 0xfc ? "Stop" : "Start", texto: "Transporte" };
  const tipo = st & 0xf0, canal = (st & 0x0f) + 1;
  const perc = canal - 1 === CANAL_PERCUSION;
  const ins = (n) => (perc && PERCUSION[n] ? ` · ${PERCUSION[n]}` : "");
  switch (tipo) {
    case 0x80: return { tipo: "Note Off", canal, texto: `Suelta la nota ${notaTxt(b[1])}${ins(b[1])} · velocidad de soltado ${b[2]}` };
    case 0x90: return b[2] === 0
      ? { tipo: "Note On (vel. 0)", canal, texto: `Velocidad 0 equivale a soltar la nota ${notaTxt(b[1])}` }
      : { tipo: "Note On", canal, texto: `Toca la nota ${notaTxt(b[1])}${ins(b[1])} · velocidad ${b[2]}` };
    case 0xa0: return { tipo: "Aftertouch polifónico", canal, texto: `Presión ${b[2]} sobre la nota ${notaTxt(b[1])}` };
    case 0xb0: {
      const cc = CONTROLES[b[1]];
      const extra = b[1] === 64 ? (b[2] >= 64 ? " (pisado)" : " (suelto)") : "";
      return { tipo: "Control Change", canal, texto: `Controlador ${b[1]}${cc ? ` · ${cc.corto}` : NOMBRES_CC[b[1]] ? ` · ${NOMBRES_CC[b[1]]}` : ""} = ${b[2]}${extra}` };
    }
    case 0xc0: return { tipo: "Program Change", canal, texto: perc ? `Kit de percusión ${b[1]}` : `Instrumento ${b[1]} · ${INSTRUMENTOS[b[1]]}` };
    case 0xd0: return { tipo: "Aftertouch de canal", canal, texto: `Presión ${b[1]}` };
    case 0xe0: {
      const v = ((b[2] << 7) | b[1]) - 8192;
      return { tipo: "Pitch Bend", canal, texto: `${v > 0 ? "+" : ""}${v} (de -8192 a 8191; 0 = afinado) ≈ ${(v / 8192 * 2).toFixed(2)} semitonos` };
    }
  }
  return { tipo: "¿?", texto: bytesHex(b) };
}
const NOMBRES_CC = { 0: "Banco (MSB)", 2: "Soplo", 4: "Pedal", 5: "Portamento", 6: "Data entry", 32: "Banco (LSB)", 65: "Portamento on/off", 66: "Sostenuto", 67: "Pedal suave", 71: "Resonancia", 72: "Release", 73: "Ataque", 74: "Brillo", 91: "Reverberación", 93: "Chorus", 120: "Silenciar todo", 121: "Reiniciar controladores", 123: "Soltar todas las notas" };

function decodificar(bytes) {
  const u = new Uint8Array(bytes);
  const t = new TextDecoder("utf-8").decode(u);
  return t.includes("�") ? new TextDecoder("latin1").decode(u) : t;
}
// Los textos de un .mid no tienen codificación oficial; casi todos los programas los leen como
// Latin-1, que cubre el español (á, ñ, ·…). Si hay algún carácter fuera de Latin-1, se usa UTF-8.
const codificar = (s) => ([...s].every((ch) => ch.charCodeAt(0) < 256) ? [...s].map((ch) => ch.charCodeAt(0)) : [...new TextEncoder().encode(s)]);
const meta = (tipo, datos) => [0xff, tipo, ...vlq(datos.length), ...datos];

// ---------------------------------------------------------------- Escribir
/** Eventos de la pista del director (tempo, compás, nombre): la pista 0 de un .mid de formato 1. */
export function eventosDirector(c) {
  const ev = [{ tick: 0, orden: 0, bytes: meta(0x03, codificar(c.nombre || "Sin título")) }];
  if (c.fuente) ev.push({ tick: 0, orden: 0, bytes: meta(0x01, codificar(`Fuente: ${c.fuente}`)) });
  const den = Math.round(Math.log2(c.compas.den));
  ev.push({ tick: 0, orden: 1, bytes: meta(0x58, [c.compas.num, den, 24, 8]) });
  for (const t of c.tempos) {
    const us = Math.round(60e6 / t.bpm);
    ev.push({ tick: t.tick, orden: 1, bytes: meta(0x51, [(us >> 16) & 0xff, (us >> 8) & 0xff, us & 0xff]) });
  }
  return ordenar(ev);
}

/** Eventos de una pista: nombre, instrumento, volumen y pan iniciales, controles, pitch bend y notas. */
export function eventosPista(c, p) {
  const ch = p.canal & 0x0f;
  const ev = [
    { tick: 0, orden: 0, bytes: meta(0x03, codificar(p.nombre)) },
    { tick: 0, orden: 1, bytes: [0xc0 | ch, p.programa & 0x7f] },
    { tick: 0, orden: 2, bytes: [0xb0 | ch, 7, p.volumen & 0x7f] },
    { tick: 0, orden: 2, bytes: [0xb0 | ch, 10, p.pan & 0x7f] },
  ];
  for (const [num, lista] of Object.entries(p.ccs)) {
    for (const e of lista) ev.push({ tick: e.tick, orden: 3, bytes: [0xb0 | ch, Number(num) & 0x7f, e.valor & 0x7f] });
  }
  for (const e of p.bend) {
    const v = Math.max(0, Math.min(16383, e.valor + 8192));
    ev.push({ tick: e.tick, orden: 3, bytes: [0xe0 | ch, v & 0x7f, v >> 7] });
  }
  for (const n of p.notas) {
    ev.push({ tick: n.tick, orden: 5, bytes: [0x90 | ch, n.nota & 0x7f, Math.max(1, n.vel & 0x7f)] });
    ev.push({ tick: n.tick + n.dur, orden: 4, bytes: [0x80 | ch, n.nota & 0x7f, 64] }); // las que terminan van antes que las que empiezan
  }
  return ordenar(ev);
}
function ordenar(ev) {
  ev.forEach((e, i) => { e.i = i; e.tick = Math.max(0, Math.round(e.tick)); });
  return ev.sort((a, b) => a.tick - b.tick || a.orden - b.orden || a.i - b.i);
}

/**
 * Escribe un .mid de formato 1 (una pista de director + una por cada pista).
 * Devuelve los bytes y «segmentos» que explican cada trozo (para el visor de bytes).
 */
export function escribirSMF(c) {
  const bytes = [], seg = [];
  const pon = (bs, tipo, texto, extra = {}) => { seg.push({ ini: bytes.length, fin: bytes.length + bs.length, tipo, texto, ...extra }); bytes.push(...bs); };
  const u32 = (n) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
  const u16 = (n) => [(n >> 8) & 0xff, n & 0xff];
  const pistas = [{ nombre: "Pista del director (tempo y compás)", ev: eventosDirector(c) }, ...c.pistas.map((p) => ({ nombre: p.nombre, ev: eventosPista(c, p) }))];

  pon([0x4d, 0x54, 0x68, 0x64], "chunk", "«MThd»: aquí empieza la cabecera del archivo");
  pon(u32(6), "long", "Longitud de la cabecera: 6 bytes");
  pon(u16(1), "cab", "Formato 1: varias pistas que suenan a la vez");
  pon(u16(pistas.length), "cab", `Número de pistas: ${pistas.length}`);
  pon(u16(c.ppq), "cab", `División: ${c.ppq} ticks por negra (PPQ)`);

  pistas.forEach((pi, k) => {
    const cuerpo = [], segP = [];
    let prev = 0;
    for (const e of pi.ev) {
      const delta = e.tick - prev, d = vlq(delta);
      prev = e.tick;
      segP.push({ ini: cuerpo.length, fin: cuerpo.length + d.length, tipo: "delta", texto: `Delta: ${d.length > 1 ? `${bytesHex(d)} en VLQ = ` : ""}${delta} ticks de espera (llega al tick ${e.tick})` });
      cuerpo.push(...d);
      const desc = describirMensaje(e.bytes);
      segP.push({ ini: cuerpo.length, fin: cuerpo.length + e.bytes.length, tipo: e.bytes[0] === 0xff ? "meta" : "evento", texto: `${desc.tipo}${desc.canal ? ` · canal ${desc.canal}` : ""}: ${desc.texto}`, pista: k });
      cuerpo.push(...e.bytes);
    }
    const fin = [0x00, 0xff, 0x2f, 0x00];
    segP.push({ ini: cuerpo.length, fin: cuerpo.length + 1, tipo: "delta", texto: "Delta: 0" });
    segP.push({ ini: cuerpo.length + 1, fin: cuerpo.length + 4, tipo: "meta", texto: "Meta: fin de pista (FF 2F 00)", pista: k });
    cuerpo.push(...fin);
    pon([0x4d, 0x54, 0x72, 0x6b], "chunk", `«MTrk»: empieza la pista ${k} (${pi.nombre})`, { pista: k });
    pon(u32(cuerpo.length), "long", `Longitud de la pista: ${cuerpo.length} bytes`, { pista: k });
    const base = bytes.length;
    segP.forEach((s) => seg.push({ ...s, ini: s.ini + base, fin: s.fin + base }));
    bytes.push(...cuerpo);
  });
  return { bytes: new Uint8Array(bytes), segmentos: seg };
}

// ---------------------------------------------------------------- Leer
/** Lee un .mid (ArrayBuffer) y lo convierte en una canción del editor. */
export function leerSMF(buffer) {
  const v = new DataView(buffer);
  const txt4 = (o) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (buffer.byteLength < 14 || txt4(0) !== "MThd") throw new Error("No es un archivo MIDI: falta la cabecera «MThd».");
  const lonCab = v.getUint32(4);
  const formato = v.getUint16(8), division = v.getUint16(12);
  if (division & 0x8000) throw new Error("Este archivo mide el tiempo en SMPTE (fotogramas), no en ticks por negra. No está soportado.");
  let o = 8 + lonCab;
  const pistasRaw = [];
  while (o + 8 <= buffer.byteLength) {
    const id = txt4(o), lon = v.getUint32(o + 4);
    if (id === "MTrk") pistasRaw.push(leerPista(new Uint8Array(buffer, o + 8, Math.min(lon, buffer.byteLength - o - 8))));
    o += 8 + lon;
  }

  const c = cancionNueva();
  c.ppq = division || PPQ;
  c.pistas = [];
  c.tempos = [];
  let compasVisto = false, nombreVisto = false;
  const grupos = new Map(); // "pista:canal" → pista del editor
  const nombres = [];

  pistasRaw.forEach((evs, k) => {
    let nombrePista = "";
    const abiertas = new Map(); // "canal:nota" → [{tick, vel}]
    let ultimo = 0;
    const pistaDe = (ch) => {
      const clave = `${k}:${ch}`;
      if (!grupos.has(clave)) {
        const p = pistaNueva(grupos.size, { canal: ch, programa: 0 });
        p.k = k; p.volumenFijado = false; p.panFijado = false;
        if (ch === CANAL_PERCUSION) p.nombre = "Percusión";
        grupos.set(clave, p);
      }
      return grupos.get(clave);
    };
    for (const e of evs) {
      ultimo = Math.max(ultimo, e.tick);
      const b = e.bytes;
      if (b[0] === 0xff) {
        const datos = datosMeta(b);
        if (b[1] === 0x51 && datos.length >= 3) {
          const us = (datos[0] << 16) | (datos[1] << 8) | datos[2];
          if (us > 0) c.tempos.push({ tick: e.tick, bpm: Math.round(60e6 / us * 100) / 100 });
        } else if (b[1] === 0x58 && !compasVisto && datos.length >= 2) {
          c.compas = { num: datos[0] || 4, den: 2 ** datos[1] };
          compasVisto = true;
        } else if (b[1] === 0x03) {
          nombrePista = decodificar(datos).trim();
        } else if (b[1] === 0x01) {
          const t = decodificar(datos);
          if (/^Fuente:/i.test(t)) c.fuente = t.replace(/^Fuente:\s*/i, "");
        }
        continue;
      }
      if (b[0] >= 0xf0) continue;
      const tipo = b[0] & 0xf0, ch = b[0] & 0x0f;
      if (tipo === 0x90 && b[2] > 0) {
        const clave = `${ch}:${b[1]}`;
        if (!abiertas.has(clave)) abiertas.set(clave, []);
        abiertas.get(clave).push({ tick: e.tick, vel: b[2] });
        pistaDe(ch);
      } else if (tipo === 0x80 || (tipo === 0x90 && b[2] === 0)) {
        const pila = abiertas.get(`${ch}:${b[1]}`);
        const ini = pila?.shift();
        if (ini) pistaDe(ch).notas.push({ tick: ini.tick, dur: Math.max(1, e.tick - ini.tick), nota: b[1], vel: ini.vel });
      } else if (tipo === 0xc0) {
        const p = pistaDe(ch);
        if (!p.programaFijado) { p.programa = b[1]; p.programaFijado = true; }
      } else if (tipo === 0xb0) {
        const p = pistaDe(ch);
        if (b[1] === 7 && e.tick === 0 && !p.volumenFijado) { p.volumen = b[2]; p.volumenFijado = true; continue; }
        if (b[1] === 10 && e.tick === 0 && !p.panFijado) { p.pan = b[2]; p.panFijado = true; continue; }
        if (CONTROLES[b[1]]) (p.ccs[b[1]] ||= []).push({ tick: e.tick, valor: b[2] });
      } else if (tipo === 0xe0) {
        pistaDe(ch).bend.push({ tick: e.tick, valor: ((b[2] << 7) | b[1]) - 8192 });
      }
    }
    // Notas que nunca se soltaron: terminan al final de la pista.
    for (const [clave, pila] of abiertas) {
      const [ch, nota] = clave.split(":").map(Number);
      for (const ini of pila) pistaDe(ch).notas.push({ tick: ini.tick, dur: Math.max(c.ppq / 4, ultimo - ini.tick), nota, vel: ini.vel });
    }
    nombres[k] = nombrePista;
  });

  // Nombre de la canción: el de la primera pista (en formato 1 suele ser la del director).
  const nombre0 = nombres.find(Boolean);
  if (nombre0) { c.nombre = nombre0; nombreVisto = true; }
  for (const p of grupos.values()) {
    const n = nombres[p.k];
    if (n && !(formato === 1 && p.k === 0 && nombreVisto && nombres.filter(Boolean).length > 1)) p.nombre = n;
    if (p.canal === CANAL_PERCUSION && !n) p.nombre = "Percusión";
    if (!p.notas.length && !Object.keys(p.ccs).length) continue;
    delete p.k; delete p.volumenFijado; delete p.panFijado; delete p.programaFijado;
    c.pistas.push(p);
  }
  // Nombres repetidos (p. ej. varias pistas «Piano»): numerarlas.
  const cuenta = {};
  c.pistas.forEach((p) => { cuenta[p.nombre] = (cuenta[p.nombre] || 0) + 1; });
  const vistos = {};
  c.pistas.forEach((p) => { if (cuenta[p.nombre] > 1) p.nombre = `${p.nombre} ${(vistos[p.nombre] = (vistos[p.nombre] || 0) + 1)}`; });
  c.pistas.forEach((p, i) => { for (const l of Object.values(p.ccs)) l.sort((a, b) => a.tick - b.tick); p.bend.sort((a, b) => a.tick - b.tick); p.color = pistaNueva(i).color; });
  c.formatoOriginal = formato;
  return normalizar(c);
}

function leerPista(d) {
  const evs = [];
  let i = 0, tick = 0, estado = 0;
  const leerVlq = () => { let n = 0, b; do { b = d[i++]; n = (n << 7) | (b & 0x7f); } while (b & 0x80 && i < d.length); return n; };
  while (i < d.length) {
    tick += leerVlq();
    let st = d[i];
    if (st === 0xff) {
      const ini = i; i += 2;
      const lon = leerVlq();
      i += lon;
      evs.push({ tick, bytes: [...d.slice(ini, i)] });
      if (d[ini + 1] === 0x2f) break;
      continue;
    }
    if (st === 0xf0 || st === 0xf7) { i++; i += leerVlq(); continue; }
    if (st & 0x80) { estado = st; i++; } else st = estado; // «running status»: se repite el byte de estado anterior
    if (!estado) break;
    const n = (st & 0xf0) === 0xc0 || (st & 0xf0) === 0xd0 ? 1 : 2;
    evs.push({ tick, bytes: [st, ...d.slice(i, i + n)] });
    i += n;
  }
  return evs;
}
