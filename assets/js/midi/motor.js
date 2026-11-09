// Motor de reproducción: convierte la canción (en ticks) en eventos con hora (en segundos) y los
// va programando poco a poco, unos 200 ms por delante del reloj de audio. Así, al parar o al salir
// de la página no queda nada sonando de fondo.
// Puede sonar con el sintetizador del navegador o mandar los mensajes a un dispositivo MIDI real.
import { contexto, clicEn } from "../audio.js";
import { Sinte } from "./sinte.js";
import { segundosDeTick, tickDeSegundos, pistasAudibles, valorEn, ticksPulso, ticksCompas } from "./modelo.js";
import { CANAL_PERCUSION } from "./gm.js";

const ADELANTO = 0.2; // segundos que se programan por delante

export class Motor {
  constructor({ alFin } = {}) {
    this.alFin = alFin;
    this.sinte = null;
    this.salida = null; // MIDIOutput o null (= sintetizador del navegador)
    this.sonando = false;
    this.metronomo = false;
    this.bucle = null; // { ini, fin } en ticks
  }

  get ctx() { return contexto(); }
  sintetizador() {
    if (!this.sinte || this.sinte.ctx !== this.ctx) this.sinte = new Sinte(this.ctx);
    return this.sinte;
  }

  /** Eventos de la canción ordenados en el tiempo (segundos desde el principio). */
  preparar(c) {
    const ev = [];
    for (const p of pistasAudibles(c)) {
      const pedal = p.ccs[64] || [];
      for (const n of p.notas) {
        let fin = n.tick + n.dur;
        // Pedal de sostenido: si está pisado cuando se suelta la nota, sigue sonando hasta que se levante.
        if (valorEn(pedal, fin, 0) >= 64) {
          const sube = pedal.find((e) => e.tick > fin && e.valor < 64);
          fin = sube ? sube.tick : fin + c.ppq * 4;
        }
        ev.push({ s: segundosDeTick(c, n.tick), fin: segundosDeTick(c, fin), tick: n.tick, tipo: "nota", p, n });
      }
      for (const [num, lista] of Object.entries(p.ccs)) {
        for (const e of lista) ev.push({ s: segundosDeTick(c, e.tick), tick: e.tick, tipo: "cc", p, num: Number(num), valor: e.valor });
      }
      for (const e of p.bend) ev.push({ s: segundosDeTick(c, e.tick), tick: e.tick, tipo: "bend", p, valor: e.valor });
    }
    return ev.sort((a, b) => a.s - b.s || (a.tipo === "nota") - (b.tipo === "nota"));
  }

  /** Estado de los controles de cada pista en un tick (al empezar a tocar desde la mitad). */
  estadoInicial(c, tick, t) {
    for (const p of c.pistas) {
      const cc = (num, def) => valorEn(p.ccs[num], tick, def);
      if (this.salida) {
        const ch = p.canal & 15, ahora = this.horaMidi(t);
        this.salida.send([0xc0 | ch, p.programa], ahora);
        for (const [num, v] of [[7, cc(7, p.volumen)], [10, cc(10, p.pan)], [11, cc(11, 127)], [64, cc(64, 0)], [1, cc(1, 0)]]) this.salida.send([0xb0 | ch, num, v], ahora);
        const b = valorEn(p.bend, tick, 0) + 8192;
        this.salida.send([0xe0 | ch, b & 0x7f, b >> 7], ahora);
        continue;
      }
      const s = this.sintetizador();
      s.control(p.id, 7, cc(7, p.volumen), t);
      s.control(p.id, 10, cc(10, p.pan), t);
      s.control(p.id, 11, cc(11, 127), t);
      s.control(p.id, 1, cc(1, 0), t);
      s.control(p.id, "bend", valorEn(p.bend, tick, 0), t);
    }
  }

  horaMidi(tAudio) { return performance.now() + (tAudio - this.ctx.currentTime) * 1000; }

  tocar(c, desdeTick = 0) {
    this.parar(false);
    this.c = c;
    this.eventos = this.preparar(c);
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.08;
    const s0 = segundosDeTick(c, desdeTick);
    this.mapas = [{ t0, s0 }];
    this.idx = this.eventos.findIndex((e) => e.s >= s0 - 1e-6);
    if (this.idx < 0) this.idx = this.eventos.length;
    this.estadoInicial(c, desdeTick, t0);
    this.pulsoSig = Math.ceil(desdeTick / ticksPulso(c));
    this.finSeg = Math.max(...this.eventos.map((e) => e.fin ?? e.s), s0) + 0.3;
    this.sonando = true;
    this.vivas = [];
    this.timer = setInterval(() => this.programar(), 25);
    this.programar();
  }

  /** Mapa vigente entre reloj de audio y segundos de la canción (cambia al dar la vuelta en un bucle). */
  mapa(t = this.ctx.currentTime) {
    let m = this.mapas[0];
    for (const x of this.mapas) if (x.t0 <= t) m = x;
    return m;
  }

  programar() {
    if (!this.sonando) return;
    const c = this.c, ctx = this.ctx;
    const horizonte = ctx.currentTime + ADELANTO;
    let m = this.mapas[this.mapas.length - 1];
    const finBucle = this.bucle ? segundosDeTick(c, this.bucle.fin) : null;
    for (;;) {
      const sHorizonte = m.s0 + (horizonte - m.t0);
      // Metrónomo: un clic en cada pulso (acento en el primero del compás).
      if (this.metronomo) {
        for (;;) {
          const tk = this.pulsoSig * ticksPulso(c);
          const s = segundosDeTick(c, tk);
          if (s > sHorizonte || (finBucle !== null && s >= finBucle - 1e-6)) break;
          if (s >= m.s0 - 1e-6) clicEn(m.t0 + (s - m.s0), tk % ticksCompas(c) === 0 ? 2 : 1, 0.8);
          this.pulsoSig++;
        }
      }
      while (this.idx < this.eventos.length) {
        const e = this.eventos[this.idx];
        if (e.s > sHorizonte || (finBucle !== null && e.s >= finBucle - 1e-6)) break;
        this.disparar(e, m.t0 + (e.s - m.s0), finBucle !== null ? m.t0 + (finBucle - m.s0) : null);
        this.idx++;
      }
      // Bucle: al llegar al final del tramo, vuelve al principio.
      if (finBucle !== null && m.s0 + (horizonte - m.t0) >= finBucle) {
        const sIni = segundosDeTick(c, this.bucle.ini);
        const tVuelta = m.t0 + (finBucle - m.s0);
        m = { t0: tVuelta, s0: sIni };
        this.mapas.push(m);
        if (this.mapas.length > 4) this.mapas.shift();
        this.idx = this.eventos.findIndex((e) => e.s >= sIni - 1e-6);
        if (this.idx < 0) this.idx = this.eventos.length;
        this.pulsoSig = Math.ceil(this.bucle.ini / ticksPulso(c));
        this.estadoInicial(c, this.bucle.ini, tVuelta);
        continue;
      }
      break;
    }
    // Al grabar no se para al final: se sigue hasta que el usuario pulse parar.
    if (finBucle === null && !this.sinFin && this.idx >= this.eventos.length && ctx.currentTime > m.t0 + (this.finSeg - m.s0)) {
      this.parar();
      this.alFin?.();
    }
  }

  disparar(e, t, tCorte) {
    const p = e.p;
    if (this.salida) {
      const ch = p.canal & 15;
      if (e.tipo === "nota") {
        let tf = t + (e.fin - e.s);
        if (tCorte !== null) tf = Math.min(tf, tCorte);
        this.salida.send([0x90 | ch, e.n.nota, e.n.vel], this.horaMidi(t));
        this.salida.send([0x80 | ch, e.n.nota, 64], this.horaMidi(tf));
      } else if (e.tipo === "cc") this.salida.send([0xb0 | ch, e.num, e.valor], this.horaMidi(t));
      else { const b = e.valor + 8192; this.salida.send([0xe0 | ch, b & 0x7f, b >> 7], this.horaMidi(t)); }
      return;
    }
    const s = this.sintetizador();
    if (e.tipo === "nota") {
      let tf = t + (e.fin - e.s);
      if (tCorte !== null) tf = Math.min(tf, tCorte + 0.02);
      s.nota({ id: p.id, programa: p.programa, canal: p.canal, nota: e.n.nota, vel: e.n.vel, t0: t, t1: tf });
    } else if (e.tipo === "cc") {
      if ([1, 7, 10, 11].includes(e.num)) s.control(p.id, e.num, e.valor, t);
    } else s.control(p.id, "bend", e.valor, t);
  }

  /** Tick que está sonando ahora. */
  tickActual() {
    if (!this.sonando) return null;
    const m = this.mapa();
    return Math.max(0, tickDeSegundos(this.c, m.s0 + (this.ctx.currentTime - m.t0)));
  }

  parar(cortar = true) {
    clearInterval(this.timer);
    this.timer = null;
    if (!this.sonando) return;
    this.sonando = false;
    if (cortar) this.silenciar();
  }

  silenciar() {
    this.sinte?.cortarTodo();
    if (this.salida) {
      // «All notes off» (CC123) y pedal suelto en los 16 canales.
      for (let ch = 0; ch < 16; ch++) { this.salida.send([0xb0 | ch, 123, 0]); this.salida.send([0xb0 | ch, 64, 0]); }
    }
  }

  /** Toca una nota suelta ahora (al dibujar o al pulsar el teclado). Devuelve la voz para soltarla. */
  probar(p, nota, vel = 100, dur = 0.35) {
    if (this.salida) {
      const ch = p.canal & 15;
      this.salida.send([0xc0 | ch, p.programa]);
      this.salida.send([0x90 | ch, nota, vel]);
      if (dur) this.salida.send([0x80 | ch, nota, 64], performance.now() + dur * 1000);
      return { soltar: () => this.salida?.send([0x80 | ch, nota, 64]) };
    }
    const s = this.sintetizador();
    const t = this.ctx.currentTime;
    if (!this.sonando) {
      s.control(p.id, 7, p.volumen, t);
      s.control(p.id, 10, p.pan, t);
    }
    return s.nota({ id: p.id, programa: p.programa, canal: p.canal, nota, vel, t0: t, t1: dur ? t + dur : null });
  }
}

export { CANAL_PERCUSION };
