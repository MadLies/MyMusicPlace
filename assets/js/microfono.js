// Detección de la nota que suena por el micrófono (autocorrelación).
import { contexto } from "./audio.js";

export function detectarTono(buf, sr) {
  let n = buf.length, rms = 0;
  for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / n);
  if (rms < 0.012) return { frec: null, rms };

  // Recorta el principio y el final hasta cruces suaves para evitar bordes.
  let r1 = 0, r2 = n - 1;
  const umbral = 0.2 * Math.max(...buf.map(Math.abs));
  for (let i = 0; i < n / 2; i++) if (Math.abs(buf[i]) < umbral) { r1 = i; break; }
  for (let i = 1; i < n / 2; i++) if (Math.abs(buf[n - i]) < umbral) { r2 = n - i; break; }
  const x = buf.subarray(r1, r2);
  n = x.length;

  const maxLag = Math.min(n - 2, Math.ceil(sr / 140)); // nada por debajo de ~140 Hz
  const c = new Float32Array(maxLag + 2);
  for (let lag = 0; lag < maxLag + 2; lag++) {
    let s = 0;
    for (let j = 0; j < n - lag; j++) s += x[j] * x[j + lag];
    c[lag] = s;
  }
  let d = 0;
  while (d < maxLag && c[d] > c[d + 1]) d++;
  let maxVal = -Infinity, pos = -1;
  for (let i = d; i <= maxLag; i++) if (c[i] > maxVal) { maxVal = c[i]; pos = i; }
  if (pos <= 0 || maxVal / c[0] < 0.55) return { frec: null, rms };
  let t0 = pos;
  const a = c[pos - 1], b = c[pos], cc = c[pos + 1];
  const p = (a + cc - 2 * b) / 2, q = (cc - a) / 2;
  if (p) t0 = pos - q / (2 * p);
  return { frec: sr / t0, rms };
}

export class Microfono {
  constructor(alDetectar) {
    this.alDetectar = alDetectar;
    this.activo = false;
  }

  async iniciar() {
    if (this.activo) return;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Este navegador no permite usar el micrófono.");
    const c = contexto();
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    this.fuente = c.createMediaStreamSource(this.stream);
    this.analizador = c.createAnalyser();
    this.analizador.fftSize = 2048;
    this.fuente.connect(this.analizador);
    this.buf = new Float32Array(this.analizador.fftSize);
    this.activo = true;
    let impar = false;
    const bucle = () => {
      if (!this.activo) return;
      impar = !impar;
      if (impar) {
        this.analizador.getFloatTimeDomainData(this.buf);
        this.alDetectar(detectarTono(this.buf, c.sampleRate));
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
