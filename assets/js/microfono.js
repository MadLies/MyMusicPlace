// Detección de la nota que suena por el micrófono.
// Método McLeod (NSDF): robusto frente a errores de octava y válido para casi cualquier
// instrumento o la voz, de ~50 Hz (bajo) a ~3 kHz (armónica aguda, violín agudo).
import { contexto } from "./audio.js";

// NSDF normalizada usando sumas acumuladas de cuadrados (m(t) en O(1)).
function nsdf(x, tMin, tMax, acum) {
  const n = x.length;
  const out = new Float32Array(tMax + 2);
  for (let t = tMin; t <= tMax + 1 && t < n; t++) {
    let acf = 0;
    for (let j = 0; j < n - t; j++) acf += x[j] * x[j + t];
    const m = acum[n - t] + (acum[n] - acum[t]); // Σ x_j² (j<n-t) + Σ x_j² (j≥t)
    out[t] = m > 0 ? (2 * acf) / m : 0;
  }
  return out;
}

function sumasCuadrados(x) {
  const acum = new Float64Array(x.length + 1);
  for (let i = 0; i < x.length; i++) acum[i + 1] = acum[i] + x[i] * x[i];
  return acum;
}

function interpolar(c, p) {
  const a = c[p - 1] ?? c[p], b = c[p], d = c[p + 1] ?? c[p];
  const den = a + d - 2 * b;
  return den ? p - (d - a) / (2 * den) : p;
}

/**
 * Devuelve { frec, rms, claridad }. frec es null si no hay una nota clara.
 */
export function detectarTono(buf, sr, { minFrec = 50, maxFrec = 3000, umbralRms = 0.008 } = {}) {
  const n = buf.length;
  let rms = 0;
  for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / n);
  if (rms < umbralRms) return { frec: null, rms, claridad: 0 };

  // 1) Estimación rápida sobre la señal diezmada (≈22-24 kHz).
  const f = Math.max(1, Math.round(sr / 22050));
  const m = Math.floor(n / f);
  const x = new Float32Array(m);
  for (let i = 0; i < m; i++) {
    let s = 0;
    for (let k = 0; k < f; k++) s += buf[i * f + k];
    x[i] = s / f;
  }
  const sr2 = sr / f;
  const tMax = Math.min(m - 2, Math.ceil(sr2 / minFrec));
  const tMinPico = Math.max(2, Math.floor(sr2 / maxFrec));
  const c = nsdf(x, 0, tMax, sumasCuadrados(x));

  // Máximos clave: el mayor de cada lóbulo positivo, saltando el lóbulo inicial (t≈0).
  let t = 0;
  while (t <= tMax && c[t] > 0) t++;
  const picos = [];
  while (t <= tMax) {
    while (t <= tMax && c[t] <= 0) t++;
    let mejor = -1;
    while (t <= tMax && c[t] > 0) { if (mejor < 0 || c[t] > c[mejor]) mejor = t; t++; }
    if (mejor >= tMinPico) picos.push(mejor);
  }
  if (!picos.length) return { frec: null, rms, claridad: 0 };
  const mayor = Math.max(...picos.map((p) => c[p]));
  const elegido = picos.find((p) => c[p] >= 0.9 * mayor);
  const claridad = c[elegido];
  if (claridad < 0.6) return { frec: null, rms, claridad };

  // 2) Afinado fino a resolución completa alrededor del período encontrado.
  const T = interpolar(c, elegido) * f;
  if (f === 1) return { frec: sr / T, rms, claridad };
  const lo = Math.max(1, Math.floor(T) - f - 2), hi = Math.min(n - 2, Math.ceil(T) + f + 2);
  const cf = nsdf(buf, lo - 1, hi, sumasCuadrados(buf));
  let p = lo;
  for (let i = lo; i <= hi; i++) if (cf[i] > cf[p]) p = i;
  return { frec: sr / interpolar(cf, p), rms, claridad };
}

export class Microfono {
  constructor(alDetectar, opciones = {}) {
    this.alDetectar = alDetectar;
    this.opciones = opciones;
    this.activo = false;
  }

  async iniciar() {
    if (this.activo) return;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Este navegador no permite usar el micrófono (hace falta https).");
    const c = contexto();
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    this.fuente = c.createMediaStreamSource(this.stream);
    this.analizador = c.createAnalyser();
    this.analizador.fftSize = 4096;
    this.fuente.connect(this.analizador);
    this.buf = new Float32Array(this.analizador.fftSize);
    this.activo = true;
    let impar = false;
    const bucle = () => {
      if (!this.activo) return;
      impar = !impar;
      if (impar) {
        this.analizador.getFloatTimeDomainData(this.buf);
        this.alDetectar(detectarTono(this.buf, c.sampleRate, this.opciones));
      }
      this.raf = requestAnimationFrame(bucle);
    };
    bucle();
  }

  detener() {
    this.activo = false;
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.fuente?.disconnect();
  }
}
