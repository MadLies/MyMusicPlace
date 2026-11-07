// Reproduce una lista de eventos (notas/pausas) con tempo, bucle y paso a paso.
import { tocarNota, contexto, clic } from "./audio.js";
import { frecuencia, midiNota } from "./notas.js";

export class Reproductor {
  constructor({ eventos, tono = "C", alPaso, alEstado }) {
    this.eventos = eventos;
    this.tono = tono;
    this.alPaso = alPaso;
    this.alEstado = alEstado;
    this.tempo = 80;
    this.indice = 0;
    this.rango = null; // [a, b] para repetir una parte
    this.sonando = false;
    this.metronomo = false;
    this.silencio = false; // modo "guía muda": ilumina sin sonar
    this.unaVez = false; // con rango: tocar la parte una sola vez y parar
    this.compas = 4; // pulsos por compás (acento del metrónomo)
    this.cuentaEntrada = false; // un compás de clics antes de empezar
    this.timersCuenta = [];
  }

  get pulso() { return 60 / this.tempo; }

  esNota(i) { return this.eventos[i]?.tipo === "nota"; }

  sonar(i) {
    const ev = this.eventos[i];
    if (ev?.tipo === "nota") tocarNota(frecuencia(midiNota(ev.nota, this.tono)), Math.max(0.12, ev.dur * this.pulso * 0.9));
  }

  reproducir() {
    if (this.sonando) return;
    contexto();
    if (this.rango && (this.indice < this.rango[0] || this.indice > this.rango[1])) this.indice = this.rango[0];
    if (this.indice >= this.eventos.length) this.indice = 0;
    this.sonando = true;
    this.alEstado?.(true);
    this.pulsoAcum = 0;
    if (this.cuentaEntrada) {
      // Un compás de clics; la música entra justo después.
      const p = this.pulso;
      for (let k = 0; k < this.compas; k++) clic(k === 0 ? 2 : 1, k * p);
      this.timersCuenta.push(setTimeout(() => this._paso(), this.compas * p * 1000));
      return;
    }
    this._paso();
  }

  _paso() {
    if (!this.sonando) return;
    const ev = this.eventos[this.indice];
    if (!ev) { this.detener(); return; }
    if (!this.silencio) this.sonar(this.indice);
    if (this.metronomo) {
      // Clic en cada pulso entero que cae dentro de este evento (también a mitad de una nota larga).
      const ini = this.pulsoAcum, fin = ini + ev.dur;
      for (let b = Math.ceil(ini - 1e-6); b < fin - 1e-6; b++) clic(b % this.compas === 0 ? 2 : 1, (b - ini) * this.pulso);
    }
    this.alPaso?.(this.indice, ev);
    this.timer = setTimeout(() => {
      this.pulsoAcum += ev.dur;
      let sig = this.indice + 1;
      if (this.rango && sig > this.rango[1]) {
        if (this.unaVez) { this.unaVez = false; const fin = this.rango; this.rango = null; this.detener(); this.indice = fin[0]; return; }
        sig = this.rango[0];
      }
      this.indice = sig;
      this._paso();
    }, ev.dur * this.pulso * 1000);
  }

  pausar() {
    this.sonando = false;
    clearTimeout(this.timer);
    this.timersCuenta.forEach(clearTimeout);
    this.timersCuenta = [];
    this.alEstado?.(false);
  }

  detener() {
    this.pausar();
    this.indice = this.rango ? this.rango[0] : 0;
    this.alPaso?.(null, null);
  }

  irA(i, { sonar = true } = {}) {
    this.indice = Math.max(0, Math.min(i, this.eventos.length - 1));
    if (sonar) this.sonar(this.indice);
    this.alPaso?.(this.indice, this.eventos[this.indice]);
  }

  // Paso a paso: salta pausas y respiros.
  siguienteNota(desde = this.indice, dir = 1) {
    let i = desde + dir;
    const [a, b] = this.rango || [0, this.eventos.length - 1];
    while (i >= a && i <= b && !this.esNota(i)) i += dir;
    if (i > b) { i = a; while (i <= b && !this.esNota(i)) i++; }
    if (i < a) { i = b; while (i >= a && !this.esNota(i)) i--; }
    return i;
  }

  primeraNota() {
    const a = this.rango ? this.rango[0] : 0;
    return this.esNota(a) ? a : this.siguienteNota(a);
  }
}
