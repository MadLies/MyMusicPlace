// Vista de una tablatura de armónica: escuchar, paso a paso, micrófono, bucles y progreso.
import { cargarIndice } from "../app.js";
import { leerTab, estadisticas } from "../tab.js";
import { renderTab, actualizarNombres, leyendaHTML, esc } from "../render.js";
import { Reproductor } from "../reproductor.js";
import { crearArmonica } from "../armonica.js";
import { Microfono } from "../microfono.js";
import { TONOS_ARMONICA, normalizarTono, nombreTono, midiNota, nombreNota, textoNota, describirNota, midiDeFrecuencia, notasArmonica } from "../notas.js";
import { progresoDe, actualizar, marcarSeccion, pref, setPref } from "../progreso.js";
import { icono } from "../iconos.js";
import { fuenteHTML } from "./fuentes.js";

export async function mostrar(main, [carpeta]) {
  const { canciones } = await cargarIndice();
  const c = canciones.find((x) => x.id === `armonica/${carpeta}`);
  if (!c) throw new Error(`No encontré la canción «${carpeta}».`);
  const texto = await (await fetch(c.tab, { cache: "no-cache" })).text();
  const tab = leerTab(texto);
  const st = estadisticas(tab) || {};
  const progreso = progresoDe(c.id);
  let tono = normalizarTono(pref(`tono:${c.id}`, tab.meta.armonica || c.tono || "C"));

  main.innerHTML = `
    <a class="volver" href="#/">${icono("volver")} Biblioteca</a>
    <header class="cab-cancion">
      <div>
        <h1>${esc(tab.meta.titulo || c.titulo)}</h1>
        ${tab.meta.subtitulo ? `<p class="sub">${esc(tab.meta.subtitulo)}</p>` : ""}
        <p class="etiquetas">
          <span>Armónica en ${esc(nombreTono(tab.meta.armonica || "C"))}</span>
          ${tab.meta.tonalidad ? `<span>${esc(tab.meta.tonalidad)}</span>` : ""}
          <span>Nivel ${st.nivel || 1}/5</span>
          <span>${st.notas || 0} notas</span>
          <span>${st.bends ? `${st.bends} bend${st.bends > 1 ? "s" : ""}` : "sin bends"}</span>
          <span>hoyos ${st.hoyoMin}–${st.hoyoMax}</span>
        </p>
        ${tab.meta.fuente ? `<p class="fuente-linea">Fuente: ${fuenteHTML(tab.meta.fuente)} · <a href="#/fuentes">sobre las fuentes</a></p>` : ""}
      </div>
      <div class="acciones-cab">
        ${c.pdf ? `<a class="btn" href="${esc(c.pdf)}" target="_blank" rel="noopener">${icono("pdf")}PDF</a>` : ""}
        <button type="button" class="btn" data-accion="imprimir">${icono("imprimir")}Imprimir</button>
        <button type="button" class="btn" data-accion="editar">Abrir en el editor</button>
      </div>
    </header>

    <section class="panel" aria-label="Controles de práctica">
      <div class="panel-fila">
        <div class="transporte">
          <button type="button" class="btn-icono" data-accion="anterior" title="Nota anterior (←)" aria-label="Nota anterior">${icono("ant")}</button>
          <button type="button" class="btn-play" data-accion="play" title="Reproducir / pausar (espacio)">${icono("play")}<span>Escuchar</span></button>
          <button type="button" class="btn-icono" data-accion="stop" title="Detener" aria-label="Detener">${icono("stop")}</button>
          <button type="button" class="btn-icono" data-accion="siguiente" title="Nota siguiente (→)" aria-label="Nota siguiente">${icono("sig")}</button>
        </div>
        <label class="tempo">Tempo
          <input type="range" min="40" max="180" step="5" value="${progreso.tempo || 80}" data-accion="tempo" aria-label="Tempo en pulsos por minuto">
          <output>${progreso.tempo || 80}</output>
        </label>
        <button type="button" class="btn btn-mic" data-accion="mic" aria-pressed="false" title="Toca tú: la tablatura avanza cuando el micrófono oye la nota correcta (M)">${icono("mic")}<span>Tocar con micrófono</span></button>
      </div>
      <div class="panel-fila opciones">
        <label>Mi armónica está en
          <select data-accion="tono">${TONOS_ARMONICA.map((t) => `<option value="${t}" ${t === tono ? "selected" : ""}>${t}</option>`).join("")}</select>
        </label>
        <label class="interruptor"><input type="checkbox" data-accion="nombres" ${pref("nombres", true) ? "checked" : ""}> Nombres de notas</label>
        <label class="interruptor"><input type="checkbox" data-accion="memoria"> Ocultar números (memoria)</label>
        <label class="interruptor"><input type="checkbox" data-accion="metronomo"> Metrónomo</label>
        <label class="interruptor"><input type="checkbox" data-accion="ver-armonica" ${pref("verArmonica", true) ? "checked" : ""}> Ver armónica</label>
      </div>
      <div class="estado" aria-live="polite">
        <div class="estado-nota"><span class="estado-num">—</span><span class="estado-txt">Pulsa <b>Escuchar</b>, usa las flechas para ir nota a nota, o toca una nota de la tablatura.</span></div>
        <div class="estado-mic" hidden></div>
        <div class="estado-bucle" hidden></div>
      </div>
      <div class="armonica-cont"></div>
    </section>

    ${tab.errores.length ? `<div class="aviso">La tablatura tiene ${tab.errores.length} línea(s) que no entendí: ${tab.errores.map((e) => `línea ${e.linea}: ${esc(e.msg)}`).join("; ")}</div>` : ""}
    ${leyendaHTML(tono)}
    <div class="tab" id="tab"></div>
    <p class="atajos-teclado">Teclado: <kbd>Espacio</kbd> escuchar/pausar · <kbd>←</kbd> <kbd>→</kbd> nota a nota · <kbd>M</kbd> micrófono. El ritmo de la tablatura es aproximado: cada nota dura un pulso, las notas unidas se reparten el pulso y cada línea termina con una pausa para respirar.</p>`;

  const $ = (s) => main.querySelector(s);
  const tabEl = $("#tab");
  const { eventos, rangos } = renderTab(tab, tabEl, { tono, controles: true, aprendidas: progreso.secciones });
  const armonica = crearArmonica($(".armonica-cont"), { tono });
  $(".armonica-cont").hidden = !pref("verArmonica", true);
  tabEl.classList.toggle("sin-nombres", !pref("nombres", true));

  const btnPlay = $('[data-accion="play"]');
  const estadoNum = $(".estado-num"), estadoTxt = $(".estado-txt");
  const estadoMic = $(".estado-mic"), estadoBucle = $(".estado-bucle");
  let activo = null;

  const rep = new Reproductor({
    eventos, tono,
    alPaso: (i, ev) => marcar(i, ev),
    alEstado: (sonando) => {
      btnPlay.innerHTML = sonando ? `${icono("pausa")}<span>Pausa</span>` : `${icono("play")}<span>Escuchar</span>`;
      btnPlay.classList.toggle("sonando", sonando);
    },
  });
  rep.tempo = progreso.tempo || 80;

  function marcar(i, ev) {
    activo?.classList.remove("activa");
    activo = i === null ? null : tabEl.querySelector(`[data-i="${i}"]`);
    activo?.classList.add("activa");
    if (ev?.tipo === "nota") {
      armonica.resaltar(ev.nota);
      estadoNum.textContent = textoNota(ev.nota);
      estadoNum.className = `estado-num ${ev.nota.aspira ? "aspira" : "sopla"}`;
      estadoTxt.innerHTML = `<b>${nombreNota(midiNota(ev.nota, tono))}</b> · ${describirNota(ev.nota)}`;
    } else if (i === null) {
      armonica.resaltar(null);
      estadoNum.textContent = "—";
      estadoNum.className = "estado-num";
    }
    if (activo) asegurarVisible(activo);
  }

  function asegurarVisible(el) {
    const r = el.getBoundingClientRect();
    const panel = $(".panel").getBoundingClientRect();
    const arriba = getComputedStyle($(".panel")).position === "sticky" ? panel.bottom + 8 : 8;
    if (r.top < arriba || r.bottom > innerHeight - 16) {
      window.scrollBy({ top: r.top - arriba - (innerHeight - arriba) / 3, behavior: "smooth" });
    }
  }

  // ---------- Bucles por sección ----------
  let seccionBucle = null;
  function setBucle(s) {
    seccionBucle = s;
    main.querySelectorAll('[data-accion="repetir-seccion"]').forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.s) === s)));
    if (s === null) {
      rep.rango = null;
      estadoBucle.hidden = true;
      return;
    }
    rep.rango = rangos[s];
    rep.unaVez = false;
    estadoBucle.hidden = false;
    estadoBucle.innerHTML = `${icono("repetir")} Repitiendo: <b>${esc(tab.secciones[s].titulo)}${tab.secciones[s].detalle.length ? " · " + esc(tab.secciones[s].detalle[0]) : ""}</b> <button type="button" class="btn-mini" data-accion="quitar-bucle">Quitar</button>`;
  }

  // ---------- Micrófono ----------
  let mic = null, objetivo = null, estable = 0, esperarSoltar = false, picoRms = 0, aciertos = 0;
  const harpNotas = () => notasArmonica(tono);

  function fijarObjetivo(i) {
    tabEl.querySelector(".objetivo")?.classList.remove("objetivo");
    objetivo = i;
    const el = tabEl.querySelector(`[data-i="${i}"]`);
    el?.classList.add("objetivo");
    rep.irA(i, { sonar: false });
  }

  function alOir({ frec, rms }) {
    if (objetivo === null) return;
    const ev = eventos[objetivo];
    const meta = midiNota(ev.nota, tono);
    if (!frec) {
      estadoMic.innerHTML = `${icono("mic")} Escuchando… toca <b>${textoNota(ev.nota)}</b> (${nombreNota(meta)}) · aciertos: ${aciertos}`;
      esperarSoltar = false;
      estable = 0;
      return;
    }
    const m = midiDeFrecuencia(frec);
    const r = Math.round(m);
    const cents = Math.round((m - r) * 100);
    const coincide = ((r - meta) % 12 + 12) % 12 === 0;
    const enArmonica = harpNotas().filter((n) => n.midi === r || (n.midi - r) % 12 === 0).map((n) => textoNota(n));
    estadoMic.innerHTML = `${icono("mic")} Oigo <b class="${coincide ? "ok" : "mal"}">${nombreNota(r)}</b> <small>${cents > 0 ? "+" : ""}${cents}¢${enArmonica.length ? ` · hoyo ${enArmonica.slice(0, 2).join(" o ")}` : ""}</small> · toca <b>${textoNota(ev.nota)}</b> · aciertos: ${aciertos}`;
    if (esperarSoltar) {
      // Para notas repetidas hay que "rearticular": esperar a que baje el volumen o cambie la nota.
      if (!coincide || rms < picoRms * 0.45) esperarSoltar = false;
      return;
    }
    picoRms = Math.max(picoRms * 0.97, rms);
    estable = coincide && Math.abs(cents) < 45 ? estable + 1 : 0;
    if (estable >= 3) {
      const el = tabEl.querySelector(`[data-i="${objetivo}"]`);
      el?.classList.add("acierto");
      setTimeout(() => el?.classList.remove("acierto"), 600);
      aciertos++;
      estable = 0;
      esperarSoltar = true;
      picoRms = rms;
      fijarObjetivo(rep.siguienteNota(objetivo));
    }
  }

  async function alternarMic() {
    const b = $('[data-accion="mic"]');
    if (mic?.activo) {
      mic.detener();
      mic = null;
      b.setAttribute("aria-pressed", "false");
      estadoMic.hidden = true;
      tabEl.querySelector(".objetivo")?.classList.remove("objetivo");
      objetivo = null;
      return;
    }
    rep.pausar();
    mic = new Microfono(alOir);
    try {
      await mic.iniciar();
    } catch (err) {
      estadoMic.hidden = false;
      estadoMic.textContent = `No pude usar el micrófono: ${err.message}. Revisa el permiso del navegador.`;
      mic = null;
      return;
    }
    b.setAttribute("aria-pressed", "true");
    estadoMic.hidden = false;
    aciertos = 0;
    fijarObjetivo(rep.esNota(rep.indice) ? rep.indice : rep.primeraNota());
  }

  // ---------- Eventos ----------
  function paso(dir) {
    rep.pausar();
    const desde = activo ? rep.indice : dir > 0 ? (rep.rango ? rep.rango[0] - 1 : -1) : rep.indice;
    const i = rep.siguienteNota(desde, dir);
    if (mic?.activo) fijarObjetivo(i);
    else rep.irA(i);
  }

  function alternarPlay() {
    if (mic?.activo) alternarMic();
    rep.sonando ? rep.pausar() : rep.reproducir();
  }

  main.addEventListener("click", (e) => {
    const chip = e.target.closest(".tab .n[data-i]");
    if (chip) {
      rep.pausar();
      const i = Number(chip.dataset.i);
      if (mic?.activo) fijarObjetivo(i);
      else rep.irA(i);
      return;
    }
    const b = e.target.closest("[data-accion]");
    if (!b || b.tagName === "INPUT" || b.tagName === "SELECT") return;
    const s = Number(b.dataset.s);
    switch (b.dataset.accion) {
      case "play": alternarPlay(); break;
      case "stop": rep.detener(); if (mic?.activo) alternarMic(); break;
      case "anterior": paso(-1); break;
      case "siguiente": paso(1); break;
      case "mic": alternarMic(); break;
      case "imprimir": print(); break;
      case "editar":
        try { localStorage.setItem("atril:editor:borrador", texto); } catch { /* nada */ }
        location.hash = "#/editor";
        break;
      case "tocar-seccion":
        if (mic?.activo) alternarMic();
        rep.pausar();
        setBucle(null);
        rep.rango = rangos[s];
        rep.unaVez = true;
        rep.indice = rangos[s][0];
        rep.reproducir();
        break;
      case "repetir-seccion":
        rep.pausar();
        if (seccionBucle === s) { setBucle(null); break; }
        setBucle(s);
        rep.indice = rangos[s][0];
        if (mic?.activo) fijarObjetivo(rep.primeraNota());
        else rep.reproducir();
        break;
      case "quitar-bucle": rep.pausar(); setBucle(null); break;
    }
  });

  main.addEventListener("change", (e) => {
    const t = e.target;
    switch (t.dataset.accion) {
      case "tono":
        tono = t.value;
        setPref(`tono:${c.id}`, tono);
        rep.tono = tono;
        armonica.setTono(tono);
        actualizarNombres(tabEl, eventos, tono);
        main.querySelector(".leyenda").outerHTML = leyendaHTML(tono);
        break;
      case "nombres": tabEl.classList.toggle("sin-nombres", !t.checked); setPref("nombres", t.checked); break;
      case "memoria": tabEl.classList.toggle("memoria", t.checked); break;
      case "metronomo": rep.metronomo = t.checked; break;
      case "ver-armonica": $(".armonica-cont").hidden = !t.checked; setPref("verArmonica", t.checked); break;
      case "aprendida": {
        const s = Number(t.dataset.s);
        marcarSeccion(c.id, s, t.checked);
        main.querySelector(`.seccion[data-s="${s}"]`)?.classList.toggle("hecha", t.checked);
        break;
      }
    }
  });

  const tempo = $('[data-accion="tempo"]');
  tempo.addEventListener("input", () => {
    rep.tempo = Number(tempo.value);
    tempo.nextElementSibling.textContent = tempo.value;
  });
  tempo.addEventListener("change", () => actualizar(c.id, { tempo: Number(tempo.value) }));

  function teclado(e) {
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) && e.target.type !== "checkbox" && e.target.type !== "range") return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === " ") { e.preventDefault(); if (e.type === "keydown" && !e.repeat) alternarPlay(); }
    else if (e.type !== "keydown") return;
    else if (e.key === "ArrowRight") { e.preventDefault(); paso(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); paso(-1); }
    else if (e.key.toLowerCase() === "m") alternarMic();
  }
  document.addEventListener("keydown", teclado);
  document.addEventListener("keyup", teclado);
  actualizar(c.id, { practicas: (progreso.practicas || 0) + 1 });

  return () => {
    rep.pausar();
    mic?.detener();
    document.removeEventListener("keydown", teclado);
    document.removeEventListener("keyup", teclado);
  };
}
