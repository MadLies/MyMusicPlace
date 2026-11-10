// Partitura (piano / violín) desde MusicXML con OpenSheetMusicDisplay: ver, escuchar con cursor y leer el análisis.
import { cargarIndice } from "../app.js";
import { tocarNota, contexto } from "../audio.js";
import { frecuencia, nombreNota, octava, CIFRADO, midiDeFrecuencia, posicionViolin } from "../notas.js";
import { Microfono } from "../microfono.js";
import { clic } from "../audio.js";
import { esc } from "../render.js";
import { icono } from "../iconos.js";
import { progresoDe, actualizar, pref, setPref } from "../progreso.js";
import { fuenteHTML } from "./fuentes.js";

const OSMD_URL = "https://cdn.jsdelivr.net/npm/opensheetmusicdisplay@1.8.9/build/opensheetmusicdisplay.min.js";
const MARKED_URL = "https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js";

// Arcadas del violín: ⊓ = arco abajo (jalar, del talón a la punta); V = arco arriba (empujar, de la punta al talón).
const ARCOS = {
  abajo: { verbo: "jalar", nombre: "arco abajo", svg: '<svg class="arco-sim" viewBox="0 0 12 14" aria-hidden="true"><path d="M2 13V2.5h8V13" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M2 2.5h8" stroke="currentColor" stroke-width="3.2"/></svg>' },
  arriba: { verbo: "empujar", nombre: "arco arriba", svg: '<svg class="arco-sim" viewBox="0 0 12 14" aria-hidden="true"><path d="M2 1.5 6 13l4-11.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>' },
};
const arcoHTML = (a) => `${ARCOS[a].svg} <b>${ARCOS[a].verbo}</b> (${ARCOS[a].nombre})`;

// Arcada y dedo escritos en la partitura para una nota de OSMD.
function marcasDe(n) {
  const AE = window.opensheetmusicdisplay?.ArticulationEnum || {};
  let arco = null;
  for (const a of n.ParentVoiceEntry?.Articulations || []) {
    if (a.articulationEnum === AE.downbow) arco = "abajo";
    if (a.articulationEnum === AE.upbow) arco = "arriba";
  }
  const dedo = n.Fingering?.value ?? null;
  return { arco, dedo: dedo === null || dedo === "" ? null : String(dedo) };
}

function cargarScript(url) {
  if (document.querySelector(`script[src="${url}"]`)) return Promise.resolve();
  return new Promise((ok, mal) => {
    const s = document.createElement("script");
    s.src = url;
    s.onload = ok;
    s.onerror = () => mal(new Error(`No pude cargar ${url}. ¿Hay conexión a internet?`));
    document.head.appendChild(s);
  });
}

export async function mostrar(main, [instrumento, carpeta]) {
  const { canciones } = await cargarIndice();
  const c = canciones.find((x) => x.id === `${instrumento}/${carpeta}`);
  if (!c) throw new Error(`No encontré «${carpeta}».`);
  const timbre = instrumento === "piano" ? "piano" : instrumento === "violin" ? "violin" : "armonica";
  const esPiano = instrumento === "piano";
  const soloPdf = !c.musicxml && Boolean(c.pdf); // partituras que solo tienen PDF: se muestran incrustadas
  const progreso = progresoDe(c.id);

  main.innerHTML = `
    <a class="volver" href="#/">${icono("volver")} Biblioteca</a>
    <header class="cab-cancion">
      <div>
        <h1>${esc(c.titulo)}</h1>
        ${c.subtitulo ? `<p class="sub">${esc(c.subtitulo)}</p>` : ""}
        ${c.fuente ? `<p class="fuente-linea">Fuente: ${fuenteHTML(c.fuente)} · <a href="#/fuentes">sobre las fuentes</a></p>` : ""}
      </div>
      <div class="acciones-cab">
        ${c.pdf ? `<a class="btn" href="${esc(c.pdf)}" target="_blank" rel="noopener">${icono("pdf")}PDF</a>` : ""}
        ${c.mscz ? `<a class="btn" href="${esc(c.mscz)}" download>${icono("descargar")}MuseScore</a>` : ""}
        ${c.musicxml ? `<a class="btn" href="${esc(c.musicxml)}" download>${icono("descargar")}MusicXML</a>` : ""}
      </div>
    </header>
    <div class="pestanas" role="tablist">
      ${c.musicxml ? '<button role="tab" type="button" data-p="partitura" aria-selected="true">Partitura</button>' : ""}
      ${soloPdf ? '<button role="tab" type="button" data-p="pdf" aria-selected="true">Partitura</button>' : ""}
      ${c.notas ? `<button role="tab" type="button" data-p="analisis" aria-selected="${!c.musicxml && !soloPdf}">${esPiano ? "Análisis y plan" : "Cómo estudiarla"}</button>` : ""}
      ${c.extras?.length ? '<button role="tab" type="button" data-p="archivos" aria-selected="false">Archivos</button>' : ""}
    </div>
    <section data-panel="partitura" ${c.musicxml ? "" : "hidden"}>
      <div class="panel">
        <div class="panel-fila">
          <div class="transporte">
            <button type="button" class="btn-play" data-accion="play">${icono("play")}<span>Escuchar</span></button>
            <button type="button" class="btn-icono" data-accion="stop" title="Volver al inicio" aria-label="Detener">${icono("stop")}</button>
          </div>
          <label class="tempo">Tempo ♩=
            <input type="range" min="40" max="160" step="2" value="${progreso.tempo || 72}" data-accion="tempo">
            <output>${progreso.tempo || 72}</output>
          </label>
          ${esPiano ? "" : `<button type="button" class="btn btn-mic" data-accion="mic" aria-pressed="false" title="Toca tú: el cursor avanza cuando el micrófono oye la nota correcta">${icono("mic")}<span>Tocar con micrófono</span></button>`}
          <div class="zoom">
            <button type="button" class="btn-icono" data-accion="zoom-" aria-label="Alejar">${icono("menos")}</button>
            <button type="button" class="btn-icono" data-accion="zoom+" aria-label="Acercar">${icono("mas")}</button>
          </div>
        </div>
        <div class="panel-fila opciones">
          ${esPiano ? `<label class="interruptor"><input type="checkbox" data-accion="mano-der" checked> Mano derecha</label>
          <label class="interruptor"><input type="checkbox" data-accion="mano-izq" checked> Mano izquierda</label>` : ""}
          <label class="interruptor"><input type="checkbox" data-accion="metro"> Metrónomo</label>
          <label class="interruptor" title="Un compás de clics antes de empezar"><input type="checkbox" data-accion="cuenta" ${pref("cuentaEntrada", false) ? "checked" : ""}> Cuenta de entrada</label>
        </div>
        <p class="leyenda-arco" hidden>Arcadas: <span>${arcoHTML("abajo")}: del talón a la punta</span> <span>${arcoHTML("arriba")}: de la punta al talón</span></p>
        <div class="estado-mic" hidden></div>
        <p class="nota-texto">Pasa el mouse sobre una nota para ver cuál es; haz clic en ella para oírla. Haz clic en un espacio vacío de un compás para empezar desde ahí.${esPiano ? " La reproducción lee la partitura de corrido (sin hacer las repeticiones) para que sigas el cursor fácilmente." : " Con «Tocar con micrófono», la partitura espera a que toques cada nota."}</p>
      </div>
      <div class="partitura" id="osmd"><p class="cargando">Cargando partitura…</p></div>
      <div class="globo-nota" role="tooltip" hidden></div>
    </section>
    ${soloPdf ? `<section data-panel="pdf">
      <p class="nota-texto">Partitura en PDF. Si no se ve aquí (en algunos celulares), ábrela con el botón <b>PDF</b> de arriba.</p>
      <object class="visor-pdf" data="${esc(c.pdf)}#view=FitH" type="application/pdf" aria-label="Partitura en PDF de ${esc(c.titulo)}">
        <p><a class="btn" href="${esc(c.pdf)}" target="_blank" rel="noopener">${icono("pdf")}Abrir la partitura (PDF)</a></p>
      </object>
    </section>` : ""}
    <section data-panel="analisis" class="prosa" ${c.musicxml || soloPdf ? "hidden" : ""}><p class="cargando">Cargando…</p></section>
    <section data-panel="archivos" hidden>
      <ul class="lista-archivos">${(c.extras || []).map((p) => `<li><a href="${esc(p)}" target="_blank" rel="noopener">${icono("pdf")}${esc(p.split("/").pop())}</a></li>`).join("")}</ul>
    </section>`;

  const $ = (s) => main.querySelector(s);

  // Pestañas
  main.querySelector(".pestanas").addEventListener("click", (e) => {
    const b = e.target.closest("[data-p]");
    if (!b) return;
    main.querySelectorAll(".pestanas [data-p]").forEach((x) => x.setAttribute("aria-selected", x === b));
    main.querySelectorAll("[data-panel]").forEach((p) => (p.hidden = p.dataset.panel !== b.dataset.p));
    if (b.dataset.p === "partitura") osmd?.render();
  });

  // Análisis en Markdown
  if (c.notas) {
    (async () => {
      try {
        await cargarScript(MARKED_URL);
        const md = await (await fetch(c.notas, { cache: "no-cache" })).text();
        $('[data-panel="analisis"]').innerHTML = window.marked.parse(md);
      } catch (err) {
        $('[data-panel="analisis"]').innerHTML = `<p>${esc(err.message)}</p>`;
      }
    })();
  }

  if (!c.musicxml) return;

  let osmd = null, eventos = [], timer = null, sonando = false, pos = 0, tempo = progreso.tempo || 72, pulsosCompas = 4;
  let metronomo = false, cuentaEntrada = pref("cuentaEntrada", false), timersCuenta = [];
  const manos = { 0: true, 1: true };

  try {
    await cargarScript(OSMD_URL);
    $("#osmd").replaceChildren();
    osmd = new window.opensheetmusicdisplay.OpenSheetMusicDisplay($("#osmd"), {
      autoResize: true, backend: "svg", drawTitle: false, followCursor: true,
      cursorsOptions: [{ type: 0, color: "#2f6f5e", alpha: 0.45, follow: true }],
    });
    // Números de compás solo al inicio de cada línea: así no se confunden con los números de dedo.
    if ("RenderMeasureNumbersOnlyAtSystemStart" in osmd.EngravingRules) osmd.EngravingRules.RenderMeasureNumbersOnlyAtSystemStart = true;
    await osmd.load(c.musicxml);
    osmd.zoom = innerWidth < 700 ? 0.6 : 0.85;
    osmd.render();
    osmd.cursor.show();
    eventos = construirEventos(osmd);
    const tempoXML = Math.round(osmd.Sheet?.DefaultStartTempoInBpm || 0);
    if (!progreso.tempo && tempoXML >= 40 && tempoXML <= 160) {
      tempo = tempoXML;
      $('[data-accion="tempo"]').value = tempo;
      $('[data-accion="tempo"]').nextElementSibling.textContent = tempo;
    }
    pulsosCompas = osmd.Sheet?.SourceMeasures?.[0]?.ActiveTimeSignature?.Numerator || 4;
    $(".leyenda-arco").hidden = !eventos.some((ev) => ev.notas.some((n) => n.arco));
  } catch (err) {
    $("#osmd").innerHTML = `<p class="aviso">No pude mostrar la partitura: ${esc(err.message)}</p>`;
    return;
  }

  // ---------- Nombre de la nota al pasar el mouse ----------
  const DURACIONES = { 1: "redonda", 0.75: "blanca con puntillo", 0.5: "blanca", 0.375: "negra con puntillo", 0.25: "negra",
    0.1875: "corchea con puntillo", 0.125: "corchea", 0.09375: "semicorchea con puntillo", 0.0625: "semicorchea", 0.03125: "fusa" };
  const MANOS = ["mano derecha", "mano izquierda"];
  let mapaNotas = null; // elemento SVG de la figura → notas que contiene (un acorde tiene varias)

  function construirMapa() {
    mapaNotas = new Map();
    for (const medida of osmd.GraphicSheet.MeasureList) {
      medida.forEach((gm, pentagrama) => {
        for (const se of gm?.staffEntries || []) for (const gve of se.graphicalVoiceEntries) for (const gn of gve.notes) {
          const n = gn.sourceNote;
          if (!n || n.isRest() || n.halfTone === undefined) continue;
          let el = null;
          try { el = gn.getSVGGElement(); } catch { /* sin SVG */ }
          if (!el) continue;
          const lista = mapaNotas.get(el) || [];
          lista.push({ midi: n.halfTone + 12, dur: n.Length.RealValue, pentagrama, ...marcasDe(n) });
          mapaNotas.set(el, lista);
        }
      });
    }
  }

  function notasDe(figura) {
    if (!mapaNotas || !mapaNotas.has(figura)) construirMapa(); // la partitura se redibuja al hacer zoom o cambiar el tamaño
    return mapaNotas.get(figura) || [];
  }

  const globo = $(".globo-nota");
  let figuraActiva = null;
  function mostrarGlobo(figura, x, y) {
    const notas = [...notasDe(figura)].sort((a, b) => b.midi - a.midi);
    if (!notas.length) return ocultarGlobo();
    figuraActiva?.classList.remove("nota-encima");
    figuraActiva = figura;
    figura.classList.add("nota-encima");
    const nombres = notas.map((n) => `<b>${nombreNota(n.midi)}${octava(n.midi)}</b> <span>${CIFRADO[n.midi % 12]}${octava(n.midi)}</span>`).join("<br>");
    const d = DURACIONES[Math.round(notas[0].dur * 100000) / 100000];
    const marcas = notas.find((n) => n.arco || n.dedo) || {};
    const extra = [marcas.arco ? `<span class="globo-arco">${arcoHTML(marcas.arco)}</span>` : "", marcas.dedo ? `dedo ${esc(marcas.dedo)}` : ""].filter(Boolean).join(" · ");
    globo.innerHTML = `${nombres}<small>${[notas.length > 1 ? `acorde de ${notas.length} notas` : "", d, esPiano ? MANOS[notas[0].pentagrama] || "" : ""].filter(Boolean).join(" · ")}</small>${extra ? `<small>${extra}</small>` : ""}`;
    globo.hidden = false;
    const r = globo.getBoundingClientRect();
    globo.style.left = `${Math.min(innerWidth - r.width - 8, Math.max(8, x + 14))}px`;
    globo.style.top = `${y - r.height - 12 < 8 ? y + 18 : y - r.height - 12}px`;
  }
  function ocultarGlobo() {
    globo.hidden = true;
    figuraActiva?.classList.remove("nota-encima");
    figuraActiva = null;
  }
  const zona = $("#osmd");
  zona.addEventListener("mousemove", (e) => {
    const figura = e.target.closest(".vf-stavenote");
    if (figura) mostrarGlobo(figura, e.clientX, e.clientY);
    else if (!globo.hidden) ocultarGlobo();
  });
  zona.addEventListener("mouseleave", ocultarGlobo);
  addEventListener("scroll", ocultarGlobo, { passive: true });

  function construirEventos(o) {
    const lista = [];
    const it = o.cursor.Iterator.clone();
    while (!it.EndReached) {
      const notas = [];
      for (const ve of it.CurrentVoiceEntries) {
        const pentagrama = ve.ParentSourceStaffEntry?.ParentStaff?.idInMusicSheet ?? 0;
        for (const n of ve.Notes) {
          if (n.isRest() || n.halfTone === undefined) continue;
          if (n.NoteTie && n.NoteTie.StartNote !== n) continue; // no repetir notas ligadas
          notas.push({ midi: n.halfTone + 12, dur: n.Length.RealValue, pentagrama, ...marcasDe(n) });
        }
      }
      lista.push({ t: it.currentTimeStamp.RealValue, notas, compas: it.CurrentMeasureIndex });
      it.moveToNext();
    }
    return lista;
  }

  const btnPlay = $('[data-accion="play"]');
  const pintarPlay = () => {
    btnPlay.innerHTML = sonando ? `${icono("pausa")}<span>Pausa</span>` : `${icono("play")}<span>Escuchar</span>`;
    btnPlay.classList.toggle("sonando", sonando);
  };
  const redonda = () => (4 * 60) / tempo; // segundos de una redonda

  function irA(i) {
    osmd.cursor.reset();
    for (let k = 0; k < i; k++) osmd.cursor.next();
    pos = i;
  }

  function paso() {
    if (!sonando) return;
    const ev = eventos[pos];
    if (!ev) { detener(); return; }
    for (const n of ev.notas) if (manos[n.pentagrama] !== false) tocarNota(frecuencia(n.midi), n.dur * redonda(), { timbre });
    const sig = eventos[pos + 1];
    const espera = sig ? (sig.t - ev.t) * redonda() : 0.8;
    if (metronomo) {
      // Clic en cada pulso (negra) que empieza dentro de este evento; acento al inicio del compás.
      const ini = ev.t * 4, fin = sig ? sig.t * 4 : ini + 1;
      for (let b = Math.ceil(ini - 1e-6); b < fin - 1e-6; b++) clic(b % pulsosCompas === 0 ? 2 : 1, ((b - ini) / 4) * redonda());
    }
    timer = setTimeout(() => {
      pos++;
      if (pos < eventos.length) osmd.cursor.next();
      paso();
    }, Math.max(0, espera * 1000));
  }

  function reproducir() {
    contexto();
    if (mic?.activo) alternarMic();
    if (pos >= eventos.length) irA(0);
    sonando = true;
    pintarPlay();
    if (cuentaEntrada) {
      const p = 60 / tempo;
      for (let k = 0; k < pulsosCompas; k++) clic(k === 0 ? 2 : 1, k * p);
      timersCuenta.push(setTimeout(paso, pulsosCompas * p * 1000));
      return;
    }
    paso();
  }
  function pausar() { sonando = false; clearTimeout(timer); timersCuenta.forEach(clearTimeout); timersCuenta = []; pintarPlay(); }

  // ---------- Tocar con micrófono: el cursor espera a que suene la nota correcta ----------
  let mic = null, objetivo = null, estable = 0, esperarSoltar = false, pico = 0, aciertos = 0;
  const estadoMic = $(".estado-mic");
  const conNotas = (i) => { while (i < eventos.length && !eventos[i].notas.length) i++; return i < eventos.length ? i : null; };
  const notaMeta = (i) => Math.max(...eventos[i].notas.map((n) => n.midi));
  const describir = (m, i = null) => {
    const pv = instrumento === "violin" ? posicionViolin(m) : null;
    const nota = i === null ? null : eventos[i].notas.find((n) => n.midi === m);
    return `<b>${nombreNota(m)}${octava(m)}</b>${pv ? ` (${pv.texto})` : ""}${nota?.arco ? ` · ${arcoHTML(nota.arco)}` : ""}`;
  };
  function fijarObjetivo(i) {
    objetivo = i;
    if (i === null) {
      estadoMic.innerHTML = `${icono("check")} ¡Terminaste la pieza! Aciertos: ${aciertos}. <button type="button" class="btn-mini" data-accion="mic-otra">Otra vez</button>`;
      return;
    }
    irA(i);
    estadoMic.innerHTML = `${icono("mic")} Toca ${describir(notaMeta(i), i)} · aciertos: ${aciertos}`;
  }
  function alOir({ frec, rms }) {
    if (objetivo === null) return;
    const meta = notaMeta(objetivo);
    if (!frec) { esperarSoltar = false; estable = 0; return; }
    const m = midiDeFrecuencia(frec);
    const r = Math.round(m);
    const cents = Math.round((m - meta) * 100);
    const coincide = r === meta;
    estadoMic.innerHTML = `${icono("mic")} Toca ${describir(meta, objetivo)} · oigo <b class="${coincide ? "ok" : "mal"}">${nombreNota(r)}${octava(r)}</b>${coincide ? ` <small>${cents > 0 ? "+" : ""}${cents}¢</small>` : ""} · aciertos: ${aciertos}`;
    if (esperarSoltar) { if (!coincide || rms < pico * 0.45) esperarSoltar = false; return; }
    pico = Math.max(pico * 0.97, rms);
    estable = coincide && Math.abs(cents) < 40 ? estable + 1 : 0;
    if (estable >= 3) {
      aciertos++;
      estable = 0;
      esperarSoltar = true;
      pico = rms;
      fijarObjetivo(conNotas(objetivo + 1));
    }
  }
  async function alternarMic() {
    const b = $('[data-accion="mic"]');
    if (!b) return;
    if (mic?.activo) {
      mic.detener(); mic = null; objetivo = null;
      b.setAttribute("aria-pressed", "false");
      estadoMic.hidden = true;
      return;
    }
    pausar();
    mic = new Microfono(alOir);
    try { await mic.iniciar(); } catch (err) {
      estadoMic.hidden = false;
      estadoMic.textContent = `No pude usar el micrófono: ${err.message}`;
      mic = null;
      return;
    }
    b.setAttribute("aria-pressed", "true");
    estadoMic.hidden = false;
    aciertos = 0;
    fijarObjetivo(conNotas(pos >= eventos.length ? 0 : pos));
  }
  function detener() { pausar(); irA(0); }

  main.addEventListener("click", (e) => {
    const b = e.target.closest("[data-accion]");
    if (b && b.tagName === "BUTTON") {
      if (b.dataset.accion === "play") sonando ? pausar() : reproducir();
      if (b.dataset.accion === "stop") { detener(); if (mic?.activo) alternarMic(); }
      if (b.dataset.accion === "mic") alternarMic();
      if (b.dataset.accion === "mic-otra") { aciertos = 0; fijarObjetivo(conNotas(0)); }
      if (b.dataset.accion === "zoom+" || b.dataset.accion === "zoom-") {
        osmd.zoom = Math.max(0.4, Math.min(1.6, osmd.zoom + (b.dataset.accion === "zoom+" ? 0.1 : -0.1)));
        osmd.render();
        mapaNotas = null;
      }
      return;
    }
    // Clic en una nota → oírla (y ver su nombre, útil en pantallas táctiles).
    const figura = e.target.closest("#osmd .vf-stavenote");
    if (figura) {
      for (const n of notasDe(figura)) tocarNota(frecuencia(n.midi), n.dur * redonda(), { timbre });
      mostrarGlobo(figura, e.clientX, e.clientY);
      return;
    }
    // Clic en un compás de la partitura → empezar desde ahí.
    const svgCompas = e.target.closest("#osmd .vf-measure");
    if (svgCompas && osmd.GraphicSheet) {
      const id = svgCompas.id || "";
      const num = Number((id.match(/\d+/) || [])[0]);
      if (num) {
        const i = eventos.findIndex((ev) => ev.compas + 1 >= num);
        if (i >= 0) {
          if (mic?.activo) { fijarObjetivo(conNotas(i)); return; }
          const s = sonando; pausar(); irA(i); if (s) reproducir();
        }
      }
    }
  });
  main.addEventListener("change", (e) => {
    if (e.target.dataset.accion === "mano-der") manos[0] = e.target.checked;
    if (e.target.dataset.accion === "mano-izq") manos[1] = e.target.checked;
    if (e.target.dataset.accion === "metro") metronomo = e.target.checked;
    if (e.target.dataset.accion === "cuenta") { cuentaEntrada = e.target.checked; setPref("cuentaEntrada", cuentaEntrada); }
  });
  const tempoEl = $('[data-accion="tempo"]');
  tempoEl.addEventListener("input", () => { tempo = Number(tempoEl.value); tempoEl.nextElementSibling.textContent = tempo; });
  tempoEl.addEventListener("change", () => actualizar(c.id, { tempo }));

  return () => {
    pausar();
    mic?.detener();
    removeEventListener("scroll", ocultarGlobo);
  };
}
