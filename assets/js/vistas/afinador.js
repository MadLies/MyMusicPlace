// Afinador: cromático (cualquier instrumento o voz), armónica (hoyos y bends) y violín
// (cuerdas al aire, entonación por dedos en 1ª posición, estabilidad del arco y bordón).
import { Microfono } from "../microfono.js";
import { crearArmonica } from "../armonica.js";
import { TONOS_ARMONICA, notasArmonica, nombreNota, octava, textoNota, midiNota, CIFRADO } from "../notas.js";
import { tocarNota, bordon } from "../audio.js";
import { pref, setPref } from "../progreso.js";
import { icono } from "../iconos.js";
import { chipHTML } from "../render.js";

const MODOS = [
  ["cromatico", "Cromático"],
  ["armonica", "Armónica"],
  ["violin", "Violín"],
];

const mediana = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const nombreCompleto = (m) => `${nombreNota(m)}${octava(m)}`;
const cifrado = (m) => `${CIFRADO[((Math.round(m) % 12) + 12) % 12]}${octava(m)}`;
const signo = (c) => (c > 0 ? `+${c}` : `${c}`);

export async function mostrar(main, [modoRuta]) {
  let modoId = modoRuta || pref("modoAfinador", "cromatico");
  let refLa = Number(pref("refLa", 440)) || 440;
  const frecDe = (m) => refLa * 2 ** ((m - 69) / 12);
  const midiDe = (f) => 69 + 12 * Math.log2(f / refLa);

  main.innerHTML = `
    <h1>Afinador</h1>
    <p class="sub">Detecta la nota que tocas o cantas y cuánto te desvías. Elige el modo según tu instrumento.</p>
    <div class="segmentos modos" role="tablist" aria-label="Modo del afinador">
      ${MODOS.map(([id, t]) => `<button type="button" role="tab" data-modo="${id}" aria-selected="${id === modoId}">${t}</button>`).join("")}
    </div>
    <div class="afinador">
      <div class="panel afinador-panel">
        <div class="panel-fila">
          <button type="button" class="btn-play" data-accion="mic">${icono("mic")}<span>Activar micrófono</span></button>
          <label class="ref-la" title="Frecuencia de referencia del La central. 440 Hz es lo estándar; algunas orquestas y armónicas usan 442.">La4 =
            <input type="number" min="415" max="466" step="1" value="${refLa}" data-accion="ref" aria-label="Frecuencia del La de referencia"> Hz</label>
        </div>
        <div class="lectura">
          <div class="lectura-nota" aria-live="polite"><span id="nota">—</span><sub id="oct"></sub></div>
          <div class="lectura-detalle" id="detalle">Activa el micrófono y toca o canta una nota</div>
          <div class="medidor" aria-hidden="true">
            <div class="medidor-escala"><span>−50¢ bajo</span><span>0</span><span>alto +50¢</span></div>
            <div class="aguja" id="aguja"></div>
          </div>
          <div class="lectura-consejo" id="consejo"></div>
        </div>
        <canvas id="traza" height="160" aria-label="Gráfica de la nota en el tiempo"></canvas>
        <div class="estabilidad" title="Cuánto varía la afinación mientras sostienes una nota (desviación típica, en cents).">
          <span>Estabilidad del sonido</span>
          <div class="est-barra"><div id="est-barra"></div></div>
          <span id="est-txt">—</span>
        </div>
      </div>
      <div id="modo-cont" class="modo-cont"></div>
    </div>`;

  const $ = (s) => main.querySelector(s);
  const canvas = $("#traza");
  const g = canvas.getContext("2d");
  const historia = []; // [tiempo, midi | null]
  const suavizado = [];
  let mic = null;
  let modo = null;
  let ignorarHasta = 0; // para no "oír" la nota de referencia que suena por el parlante

  // ---------------- Lectura común ----------------
  function dibujar() {
    const dpr = devicePixelRatio || 1;
    const w = (canvas.width = canvas.clientWidth * dpr);
    const h = (canvas.height = 160 * dpr);
    const css = getComputedStyle(document.documentElement);
    g.clearRect(0, 0, w, h);
    const ahora = performance.now();
    const ultimos = historia.filter(([t]) => ahora - t < 6000);
    const objetivo = modo?.objetivo?.() ?? null;
    const ultimoValido = [...ultimos].reverse().find(([, m]) => m !== null)?.[1];
    const centro = objetivo ?? (ultimoValido !== undefined ? Math.round(ultimoValido) : 69);
    const rango = 3;
    const y = (m) => h / 2 - ((m - centro) / rango) * (h / 2);
    g.lineWidth = dpr;
    g.font = `${11 * dpr}px system-ui`;
    for (let k = Math.ceil(centro - rango); k <= centro + rango; k++) {
      g.strokeStyle = css.getPropertyValue("--line");
      g.beginPath(); g.moveTo(0, y(k)); g.lineTo(w, y(k)); g.stroke();
      g.fillStyle = css.getPropertyValue("--muted");
      g.fillText(nombreCompleto(k), 4 * dpr, y(k) - 3 * dpr);
    }
    if (objetivo !== null) {
      const tol = (modo?.tolerancia?.() ?? 15) / 100;
      g.fillStyle = "rgba(26,127,55,0.2)";
      g.fillRect(0, y(objetivo + tol), w, y(objetivo - tol) - y(objetivo + tol));
    }
    g.strokeStyle = css.getPropertyValue("--accent");
    g.lineWidth = 2.5 * dpr;
    g.beginPath();
    let antes = null;
    for (const [t, m] of ultimos) {
      const x = w - ((ahora - t) / 6000) * w;
      if (m === null) { antes = null; continue; }
      if (antes === null) g.moveTo(x, y(m)); else g.lineTo(x, y(m));
      antes = m;
    }
    g.stroke();
  }

  function estabilidad(ms) {
    const ahora = performance.now();
    const v = historia.filter(([t, m]) => m !== null && ahora - t < 1500 && Math.abs(m - ms) < 0.5).map(([, m]) => m * 100);
    if (v.length < 12) return null;
    const media = v.reduce((a, b) => a + b, 0) / v.length;
    return Math.sqrt(v.reduce((a, b) => a + (b - media) ** 2, 0) / v.length);
  }

  function alOir({ frec }) {
    const ahora = performance.now();
    if (ahora < ignorarHasta) return;
    if (!frec) {
      historia.push([ahora, null]);
      suavizado.length = 0;
      while (historia.length && ahora - historia[0][0] > 6500) historia.shift();
      dibujar();
      modo?.alSilencio?.();
      return;
    }
    const m = midiDe(frec);
    if (suavizado.length && Math.abs(m - mediana(suavizado)) > 0.6) suavizado.length = 0;
    suavizado.push(m);
    if (suavizado.length > 5) suavizado.shift();
    const ms = mediana(suavizado);
    historia.push([ahora, ms]);
    while (historia.length && ahora - historia[0][0] > 6500) historia.shift();

    const transp = modo?.transposicion?.() ?? 0;
    const r = Math.round(ms);
    const escrita = r + transp;
    const objetivo = modo?.objetivo?.() ?? null;
    const base = objetivo !== null && Math.abs(ms - objetivo) < 0.5 ? objetivo : r;
    const cents = Math.round((ms - base) * 100);
    const tol = modo?.tolerancia?.() ?? 5;

    $("#nota").textContent = nombreNota(escrita);
    $("#oct").textContent = octava(escrita);
    $("#detalle").innerHTML = `${cifrado(escrita)} · ${frec.toFixed(1)} Hz` + (transp ? ` · <span title="Nota real que suena">suena ${nombreCompleto(r)} (concierto)</span>` : "") + (modo?.detalle?.(ms) || "");
    const aguja = $("#aguja");
    aguja.style.left = `${50 + Math.max(-50, Math.min(50, cents))}%`;
    const enObjetivo = objetivo === null || base === objetivo; // si tocas otra nota, la aguja queda neutra
    aguja.classList.toggle("afinado", enObjetivo && Math.abs(cents) <= tol);
    aguja.classList.toggle("cerca", enObjetivo && Math.abs(cents) > tol && Math.abs(cents) <= 15);

    let consejo;
    if (objetivo !== null && Math.abs(ms - objetivo) >= 0.5) consejo = modo.lejos?.(ms) || `Oigo ${nombreCompleto(r)}; buscas ${nombreCompleto(objetivo)}`;
    else if (Math.abs(cents) <= tol) consejo = "Afinado ✓";
    else consejo = (modo?.consejo?.(cents) || (cents < 0 ? "Un poco bajo: sube" : "Un poco alto: baja")) + ` (${signo(cents)}¢)`;
    const c = $("#consejo");
    c.textContent = consejo;
    c.className = `lectura-consejo ${Math.abs(cents) <= tol && (objetivo === null || base === objetivo) ? "ok" : ""}`;

    const est = estabilidad(ms);
    $("#est-barra").style.width = est === null ? "0%" : `${Math.max(5, 100 - est * 6)}%`;
    $("#est-barra").className = est === null ? "" : est < 4 ? "muy" : est < 9 ? "bien" : "poco";
    $("#est-txt").textContent = est === null ? "sostén una nota…" : `±${est.toFixed(1)}¢ · ${est < 4 ? "muy estable" : est < 9 ? "estable" : "inestable"}`;

    modo?.alOir?.(ms, ahora);
    dibujar();
  }

  async function alternarMic() {
    const b = $('[data-accion="mic"]');
    if (mic?.activo) {
      mic.detener();
      mic = null;
      b.innerHTML = `${icono("mic")}<span>Activar micrófono</span>`;
      b.classList.remove("sonando");
      return;
    }
    mic = new Microfono(alOir);
    try {
      await mic.iniciar();
      b.innerHTML = `${icono("mic")}<span>Detener micrófono</span>`;
      b.classList.add("sonando");
    } catch (err) {
      $("#detalle").textContent = `No pude usar el micrófono: ${err.message}`;
      mic = null;
    }
  }

  // Nota de referencia corta (el micrófono la ignora mientras suena).
  function referencia(midi, dur = 1.4) {
    ignorarHasta = performance.now() + dur * 1000 + 250;
    tocarNota(frecDe(midi), dur, { timbre: "armonica", volumen: 0.22 });
  }

  // ---------------- Modos ----------------
  const ctx = { $, frecDe, referencia, dibujar, main };
  const fabricas = { cromatico: modoCromatico, armonica: modoArmonica, violin: modoViolin };

  function cambiarModo(id) {
    modo?.desmontar?.();
    modoId = id;
    setPref("modoAfinador", id);
    main.querySelectorAll("[data-modo]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.modo === id)));
    history.replaceState(null, "", `#/afinador/${id}`);
    const cont = $("#modo-cont");
    cont.replaceChildren();
    modo = fabricas[id](cont, ctx);
    suavizado.length = 0;
    dibujar();
  }

  main.querySelector(".modos").addEventListener("click", (e) => {
    const b = e.target.closest("[data-modo]");
    if (b && b.dataset.modo !== modoId) cambiarModo(b.dataset.modo);
  });
  $('[data-accion="mic"]').addEventListener("click", alternarMic);
  $('[data-accion="ref"]').addEventListener("change", (e) => {
    const v = Math.min(466, Math.max(415, Number(e.target.value) || 440));
    e.target.value = v;
    refLa = v;
    setPref("refLa", v);
    suavizado.length = 0;
  });

  cambiarModo(fabricas[modoId] ? modoId : "cromatico");
  return () => {
    mic?.detener();
    modo?.desmontar?.();
  };
}

// =====================================================================
// Modo cromático
// =====================================================================
function modoCromatico(cont, { frecDe, referencia }) {
  let transp = Number(pref("transposicion", 0));
  let pararBordon = null;
  const INSTRUMENTOS = [
    [0, "En Do (concierto): piano, guitarra, violín, flauta, voz…"],
    [2, "En Si♭: clarinete, trompeta, saxo tenor y soprano"],
    [9, "En Mi♭: saxo alto y barítono"],
    [7, "En Fa: corno francés"],
  ];
  cont.innerHTML = `
    <h2>Afinador cromático</h2>
    <p class="nota-texto">Para cualquier instrumento o la voz: reconoce notas desde unos 50 Hz (cuerda grave de un bajo) hasta 3 kHz. La aguja marca cuántos cents (centésimas de semitono) te alejas de la nota más cercana.</p>
    <label class="campo">Mi instrumento está
      <select data-accion="transp">${INSTRUMENTOS.map(([v, t]) => `<option value="${v}" ${v === transp ? "selected" : ""}>${t}</option>`).join("")}</select>
    </label>
    <p class="nota-texto">Si tu instrumento transpone, el afinador muestra la nota <b>escrita</b> en tu partitura y, al lado, la que suena realmente.</p>
    <h2>Nota de referencia</h2>
    <p class="nota-texto">Pulsa una nota para oírla. Con «Sostener» queda sonando; si el micrófono está activo, usa audífonos para que no la confunda contigo.</p>
    <div class="teclas" role="group" aria-label="Notas de referencia">
      ${[0, 2, 4, 5, 7, 9, 11, 1, 3, 6, 8, 10].map((s) => `<button type="button" class="tecla${[1, 3, 6, 8, 10].includes(s) ? " negra" : ""}" data-s="${s}">${nombreNota(s)}</button>`).join("")}
    </div>
    <div class="panel-fila opciones">
      <label class="campo">Octava <select data-accion="oct">${[2, 3, 4, 5, 6].map((o) => `<option ${o === 4 ? "selected" : ""}>${o}</option>`).join("")}</select></label>
      <label class="interruptor"><input type="checkbox" data-accion="sostener"> Sostener</label>
    </div>`;

  cont.addEventListener("change", (e) => {
    if (e.target.dataset.accion === "transp") { transp = Number(e.target.value); setPref("transposicion", transp); }
    if (e.target.dataset.accion === "sostener" && !e.target.checked) { pararBordon?.(); pararBordon = null; marcarTecla(null); }
  });
  function marcarTecla(b) { cont.querySelectorAll(".tecla").forEach((x) => x.classList.toggle("sonando", x === b)); }
  cont.addEventListener("click", (e) => {
    const b = e.target.closest(".tecla");
    if (!b) return;
    const oct = Number(cont.querySelector('[data-accion="oct"]').value);
    const midi = (oct + 1) * 12 + Number(b.dataset.s);
    if (cont.querySelector('[data-accion="sostener"]').checked) {
      pararBordon?.();
      pararBordon = bordon(frecDe(midi), 0.12);
      marcarTecla(b);
    } else {
      referencia(midi);
    }
  });

  return {
    transposicion: () => transp,
    tolerancia: () => 5,
    desmontar: () => pararBordon?.(),
  };
}

// =====================================================================
// Modo armónica: qué hoyo es y entrenador de bends
// =====================================================================
function modoArmonica(cont, { referencia }) {
  let tono = pref("tonoGuia", "C");
  let objetivo = null, enObjetivoDesde = 0, logros = 0;
  cont.innerHTML = `
    <h2>Afinador de armónica</h2>
    <label class="campo">Mi armónica está en
      <select data-accion="tono">${TONOS_ARMONICA.map((t) => `<option ${t === tono ? "selected" : ""}>${t}</option>`).join("")}</select>
    </label>
    <p class="nota-texto">Debajo de la nota verás en qué hoyo de tu armónica está. Para entrenar un bend, elígelo: suena como referencia, la franja verde de la gráfica marca el objetivo y debes aguantar en ella.</p>
    <div class="objetivo-info" id="obj-info">Sin objetivo: el afinador muestra cualquier nota.</div>
    <div class="bends" id="bends"></div>
    <h2>Tu armónica</h2>
    <div class="armonica-cont"></div>`;
  const armonica = crearArmonica(cont.querySelector(".armonica-cont"), { tono, compacta: true });
  const info = cont.querySelector("#obj-info");

  function pintarBends() {
    const lista = notasArmonica(tono).filter((n) => n.bends);
    cont.querySelector("#bends").innerHTML = lista
      .map((n, i) => `<button type="button" class="bend-btn${objetivo && objetivo.hoyo === n.hoyo && objetivo.bends === n.bends && objetivo.aspira === n.aspira ? " elegido" : ""}" data-i="${i}">${chipHTML(n, tono).replace('<button type="button"', "<span").replace(/<\/button>$/, "</span>")}<span>${n.aspira ? "aspirado" : "soplado"} −${n.bends === 1 ? "½" : n.bends === 2 ? "1" : "1½"} tono</span></button>`)
      .join("") + `<button type="button" class="bend-btn" data-i="-1"><span>Quitar objetivo</span></button>`;
    cont.querySelector("#bends").onclick = (e) => {
      const b = e.target.closest(".bend-btn");
      if (!b) return;
      const i = Number(b.dataset.i);
      objetivo = i < 0 ? null : { ...lista[i], midi: midiNota(lista[i], tono) };
      if (objetivo) {
        referencia(objetivo.midi, 1);
        armonica.resaltar(objetivo);
        const sinBend = { ...objetivo, bends: 0 };
        info.innerHTML = `Objetivo: <b>${textoNota(objetivo)}</b> = <b>${nombreNota(objetivo.midi)}</b>. Empieza en ${textoNota(sinBend)} (${nombreNota(midiNota(sinBend, tono))}) y baja ${objetivo.bends === 1 ? "medio tono" : objetivo.bends === 2 ? "un tono" : "tono y medio"}. Logrados: <b id="logros">${logros}</b>`;
      } else {
        armonica.resaltar(null);
        info.textContent = "Sin objetivo: el afinador muestra cualquier nota.";
      }
      pintarBends();
    };
  }
  pintarBends();

  cont.addEventListener("change", (e) => {
    if (e.target.dataset.accion !== "tono") return;
    tono = e.target.value;
    setPref("tonoGuia", tono);
    armonica.setTono(tono);
    objetivo = null;
    info.textContent = "Sin objetivo: el afinador muestra cualquier nota.";
    pintarBends();
  });

  return {
    objetivo: () => objetivo?.midi ?? null,
    tolerancia: () => 20,
    detalle(ms) {
      const r = Math.round(ms);
      const hoyos = notasArmonica(tono).filter((n) => n.midi === r);
      if (!objetivo && hoyos.length) armonica.resaltar(hoyos[0]);
      return hoyos.length
        ? `<br>En tu armónica: ${hoyos.map((n) => `<b>${textoNota(n)}</b>`).join(" o ")}`
        : `<br>Esta nota no está en una armónica en ${tono}`;
    },
    lejos: (ms) => `Oigo ${nombreCompleto(Math.round(ms))}; el bend debe llegar a ${nombreCompleto(objetivo.midi)}`,
    consejo: (c) => (c < 0 ? "Te pasaste: suelta un poco el bend" : "Baja un poco más"),
    alOir(ms, ahora) {
      if (!objetivo) return;
      if (Math.abs(ms - objetivo.midi) < 0.2) {
        if (!enObjetivoDesde) enObjetivoDesde = ahora;
        if (enObjetivoDesde > 0 && ahora - enObjetivoDesde > 400) {
          logros++;
          enObjetivoDesde = -1;
          const l = cont.querySelector("#logros");
          if (l) l.textContent = logros;
          info.classList.add("logrado");
          setTimeout(() => info.classList.remove("logrado"), 900);
        }
      } else if (enObjetivoDesde !== 0) enObjetivoDesde = 0;
    },
  };
}

// =====================================================================
// Modo violín
// =====================================================================
const CUERDAS = [
  { id: "Sol", midi: 55 },
  { id: "Re", midi: 62 },
  { id: "La", midi: 69 },
  { id: "Mi", midi: 76 },
];
const n = (midi, cuerda, dedo, tipo = "") => ({ midi, cuerda, dedo, tipo });
const EJERCICIOS = [
  { id: "re", nombre: "Escala de Re mayor (1 octava)", tonica: 50, notas: [n(62, "Re", 0), n(64, "Re", 1), n(66, "Re", 2, "alto"), n(67, "Re", 3), n(69, "La", 0), n(71, "La", 1), n(73, "La", 2, "alto"), n(74, "La", 3)] },
  { id: "la", nombre: "Escala de La mayor (1 octava)", tonica: 57, notas: [n(69, "La", 0), n(71, "La", 1), n(73, "La", 2, "alto"), n(74, "La", 3), n(76, "Mi", 0), n(78, "Mi", 1), n(80, "Mi", 2, "alto"), n(81, "Mi", 3)] },
  { id: "sol", nombre: "Escala de Sol mayor (2 octavas)", tonica: 43, notas: [n(55, "Sol", 0), n(57, "Sol", 1), n(59, "Sol", 2, "alto"), n(60, "Sol", 3), n(62, "Re", 0), n(64, "Re", 1), n(66, "Re", 2, "alto"), n(67, "Re", 3), n(69, "La", 0), n(71, "La", 1), n(72, "La", 2, "bajo"), n(74, "La", 3), n(76, "Mi", 0), n(78, "Mi", 1), n(79, "Mi", 2, "bajo")] },
  { id: "do", nombre: "Escala de Do mayor (1 octava)", tonica: 48, notas: [n(60, "Sol", 3), n(62, "Re", 0), n(64, "Re", 1), n(65, "Re", 2, "bajo"), n(67, "Re", 3), n(69, "La", 0), n(71, "La", 1), n(72, "La", 2, "bajo")] },
  { id: "cuarto", nombre: "4º dedo contra la cuerda al aire", tonica: null, notas: [n(62, "Sol", 4), n(62, "Re", 0), n(69, "Re", 4), n(69, "La", 0), n(76, "La", 4), n(76, "Mi", 0)] },
  { id: "cuerda-la", nombre: "Los dedos en la cuerda La", tonica: 57, notas: [n(69, "La", 0), n(71, "La", 1), n(73, "La", 2, "alto"), n(74, "La", 3), n(76, "La", 4)] },
];
const TOLERANCIAS = [[25, "Principiante (±25¢)"], [15, "Intermedio (±15¢)"], [8, "Exigente (±8¢)"]];
const DEDO = (d) => (d === 0 ? "cuerda al aire" : `${d}º dedo`);
const UMBRAL_INFORME = 10; // el informe siempre juzga con ±10¢, aunque para avanzar se permita más

function modoViolin(cont, { referencia, frecDe }) {
  let ejercicio = EJERCICIOS.find((e) => e.id === pref("ejercicioViolin", "re")) || EJERCICIOS[0];
  let tol = Number(pref("tolViolin", 15));
  let idaVuelta = pref("idaVueltaViolin", false);
  let lista = [], idx = -1, desde = 0, resultados = [], intento = null;
  let pararBordon = null;

  cont.innerHTML = `
    <h2>Cuerdas al aire</h2>
    <p class="nota-texto">Toca una cuerda al aire: el afinador reconoce cuál es y te dice si está alta o baja. Pulsa una para oír su nota.</p>
    <div class="cuerdas" id="cuerdas">
      ${CUERDAS.map((c) => `<button type="button" class="cuerda" data-midi="${c.midi}"><b>${c.id}</b><small>${cifrado(c.midi)}</small><span class="cuerda-estado">—</span></button>`).join("")}
    </div>

    <h2>Entonación en 1ª posición</h2>
    <p class="nota-texto">Toca cada nota y sostenla dentro de la franja verde medio segundo para pasar a la siguiente. Al final verás qué dedos tienden a quedar altos o bajos: casi siempre es cuestión de la posición de la mano.</p>
    <div class="panel-fila opciones">
      <label class="campo">Ejercicio <select data-accion="ejercicio">${EJERCICIOS.map((e) => `<option value="${e.id}" ${e === ejercicio ? "selected" : ""}>${e.nombre}</option>`).join("")}</select></label>
      <label class="campo">Exigencia <select data-accion="tol">${TOLERANCIAS.map(([v, t]) => `<option value="${v}" ${v === tol ? "selected" : ""}>${t}</option>`).join("")}</select></label>
      <label class="interruptor"><input type="checkbox" data-accion="idavuelta" ${idaVuelta ? "checked" : ""}> Subir y bajar</label>
    </div>
    <div class="vi-objetivo" id="vi-obj">
      <p>Elige un ejercicio, activa el micrófono y pulsa <b>Empezar</b>.</p>
      <button type="button" class="btn-play" data-accion="empezar">${icono("play")}<span>Empezar</span></button>
    </div>
    <div class="vi-puntos" id="vi-puntos" aria-hidden="true"></div>
    <div class="diapason" id="diapason" aria-label="Diapasón: dónde va cada nota del ejercicio"></div>
    <div id="vi-informe"></div>

    <h2>Bordón</h2>
    <label class="interruptor"><input type="checkbox" data-accion="bordon"> Tocar un bordón en <b id="bordon-nota"></b></label>
    <p class="nota-texto">Una nota grave continua de la tonalidad del ejercicio: compara tu afinación con ella y escucha cuándo «encaja». Con el micrófono activo, usa audífonos.</p>

    <h2>Postura y afinación</h2>
    <ul class="consejos">
      <li><b>Pulgar suelto</b> frente al 1º o 2º dedo, sin apretar el mástil; la palma no toca el mástil.</li>
      <li><b>Dedos curvos</b>, pisando con la yema y cayendo desde arriba; deja puestos los que ya usaste al subir la escala.</li>
      <li><b>Si una nota queda alta</b>, el dedo está demasiado cerca del puente: retrocédelo hacia la voluta. Si queda baja, adelántalo hacia el puente.</li>
      <li><b>2 alto y 2 bajo</b>: el 2º dedo cambia de sitio según la tonalidad (pegado al 3º en Re y La mayor, pegado al 1º en Do mayor). Es el dedo que más se desafina.</li>
      <li><b>Comprueba con las cuerdas al aire</b>: el 4º dedo en una cuerda debe sonar igual que la cuerda al aire siguiente; cuando aciertas, la cuerda al aire vibra sola por resonancia.</li>
      <li><b>Arco parejo</b>: mira la barra de estabilidad mientras sostienes una nota larga; si oscila, revisa el peso y la velocidad del arco.</li>
    </ul>`;

  const $c = (s) => cont.querySelector(s);

  function construirLista() {
    lista = ejercicio.notas.map((x) => ({ ...x }));
    if (idaVuelta) lista = lista.concat(ejercicio.notas.slice(0, -1).reverse().map((x) => ({ ...x })));
  }

  const umbral = () => Math.min(tol, UMBRAL_INFORME);
  const clase = (media) => (Math.abs(media) <= umbral() ? "ok" : media > 0 ? "alto" : "bajo");

  function pintarDiapason() {
    const celdas = {};
    lista.forEach((x, i) => {
      const k = `${x.cuerda}-${x.dedo}`;
      (celdas[k] ||= { nota: x, indices: [] }).indices.push(i);
    });
    let html = '<div class="dia-cab"></div>' + CUERDAS.map((c) => `<div class="dia-cab">${c.id}</div>`).join("");
    for (let d = 0; d <= 4; d++) {
      html += `<div class="dia-dedo">${d === 0 ? "al aire" : `${d}º`}</div>`;
      for (const c of CUERDAS) {
        const celda = celdas[`${c.id}-${d}`];
        if (!celda) { html += '<div class="dia-celda vacia"></div>'; continue; }
        const r = celda.indices.map((i) => resultados[i]).filter(Boolean).pop();
        const estado = r ? clase(r.media) : "";
        const actual = celda.indices.includes(idx) ? " actual" : "";
        html += `<div class="dia-celda ${estado}${actual}" title="${nombreCompleto(celda.nota.midi)} · cuerda ${c.id}, ${DEDO(d)}${celda.nota.tipo ? ` (${celda.nota.tipo})` : ""}">
          <b>${nombreNota(celda.nota.midi)}</b>${celda.nota.tipo ? `<small>${celda.nota.tipo}</small>` : ""}</div>`;
      }
    }
    $c("#diapason").innerHTML = html;
  }

  function pintarPuntos() {
    $c("#vi-puntos").innerHTML = lista.map((_, i) => {
      const r = resultados[i];
      const cls = i === idx ? "actual" : r ? clase(r.media) : "";
      return `<i class="${cls}"></i>`;
    }).join("");
  }

  function pintarObjetivo() {
    const box = $c("#vi-obj");
    if (idx < 0 || idx >= lista.length) return;
    const x = lista[idx];
    box.innerHTML = `
      <div class="vi-meta">
        <div><span class="vi-paso">Nota ${idx + 1} de ${lista.length}</span>
          <div class="vi-nota">${nombreCompleto(x.midi)} <small>${cifrado(x.midi)}</small></div>
          <div class="vi-donde">Cuerda <b>${x.cuerda}</b> · <b>${DEDO(x.dedo)}</b>${x.tipo ? ` <span class="etq-${x.tipo}">${x.tipo}</span>` : ""}</div>
        </div>
        <div class="vi-acciones">
          <button type="button" class="btn" data-accion="oir">Oír la nota</button>
          <button type="button" class="btn" data-accion="saltar">Saltar</button>
          <button type="button" class="btn" data-accion="parar">Terminar</button>
        </div>
      </div>
      <div class="vi-estado" id="vi-estado">Toca la nota y sostenla…</div>`;
  }

  function empezar() {
    construirLista();
    idx = 0; desde = 0; resultados = []; intento = { suma: 0, n: 0 };
    $c("#vi-informe").innerHTML = "";
    pintarObjetivo(); pintarPuntos(); pintarDiapason();
  }

  function siguiente(saltada = false) {
    resultados[idx] = intento.n ? { media: Math.round(intento.suma / intento.n), saltada } : saltada ? null : { media: 0 };
    idx++;
    desde = 0;
    intento = { suma: 0, n: 0 };
    if (idx >= lista.length) return terminar();
    pintarObjetivo(); pintarPuntos(); pintarDiapason();
  }

  function terminar() {
    idx = -1;
    pintarPuntos(); pintarDiapason();
    const filas = lista.map((x, i) => ({ ...x, r: resultados[i] })).filter((x) => x.r);
    const porDedo = {};
    for (const x of filas) (porDedo[x.dedo] ||= []).push(x.r.media);
    const tiposDedo2 = new Set(filas.filter((x) => x.dedo === 2).map((x) => x.tipo));
    const extra = (d, alto) => {
      if (d === 4) return alto ? "" : "; estira el dedo sin mover la mano";
      if (d !== 2) return "";
      if (tiposDedo2.has("alto") && !tiposDedo2.has("bajo")) return alto ? "; en el 2 alto va cerca del 3º, pero sin pegarse" : "; en el 2 alto, pégalo más al 3º dedo";
      if (tiposDedo2.has("bajo") && !tiposDedo2.has("alto")) return alto ? "; en el 2 bajo, pégalo más al 1º dedo" : "; en el 2 bajo, sepáralo un poco del 1º";
      return "";
    };
    const consejos = Object.entries(porDedo).map(([d, v]) => {
      const media = Math.round(v.reduce((a, b) => a + b, 0) / v.length);
      d = Number(d);
      if (d === 0) return Math.abs(media) <= umbral()
        ? `<li class="ok"><b>Cuerdas al aire</b>: bien afinadas (${signo(media)}¢ de media).</li>`
        : `<li><b>Cuerdas al aire</b>: se desvían ${signo(media)}¢ de media. Afina el violín antes de seguir (arriba, «Cuerdas al aire»).</li>`;
      if (Math.abs(media) <= umbral()) return `<li class="ok"><b>${DEDO(d)}</b>: bien colocado (${signo(media)}¢ de media).</li>`;
      return media > 0
        ? `<li class="alto"><b>${DEDO(d)}</b>: tiende a quedar <b>alto</b> (${signo(media)}¢). Colócalo un poco más atrás, hacia la voluta${extra(d, true)}.</li>`
        : `<li class="bajo"><b>${DEDO(d)}</b>: tiende a quedar <b>bajo</b> (${signo(media)}¢). Adelántalo un poco hacia el puente${extra(d, false)}.</li>`;
    });
    const total = filas.length;
    const bien = filas.filter((x) => Math.abs(x.r.media) <= umbral()).length;
    $c("#vi-obj").innerHTML = `<p><b>¡Ejercicio terminado!</b> ${bien} de ${total} notas afinadas (±${umbral()}¢ de media).${tol > umbral() ? ` Para avanzar bastaba ±${tol}¢, pero el informe mide con ±${umbral()}¢: es lo que el oído nota.` : ""}</p>
      <button type="button" class="btn-play" data-accion="empezar">${icono("repetir")}<span>Repetir</span></button>`;
    $c("#vi-informe").innerHTML = `
      <h3>Cómo te fue</h3>
      <ul class="consejos informe">${consejos.join("")}</ul>
      <div class="tabla-fuentes"><table>
        <thead><tr><th>Nota</th><th>Cuerda</th><th>Dedo</th><th>Desviación media</th></tr></thead>
        <tbody>${filas.map((x) => `<tr><td>${nombreCompleto(x.midi)}</td><td>${x.cuerda}</td><td>${DEDO(x.dedo)}${x.tipo ? ` (${x.tipo})` : ""}</td>
          <td class="${clase(x.r.media)}">${signo(x.r.media)}¢${{ ok: " ✓", alto: " alto", bajo: " bajo" }[clase(x.r.media)]}${x.r.saltada ? " (saltada)" : ""}</td></tr>`).join("")}</tbody>
      </table></div>`;
  }

  function actualizarBordon() {
    const t = ejercicio.tonica;
    $c("#bordon-nota").textContent = t ? nombreCompleto(t) : "— (este ejercicio no tiene tonalidad)";
    const chk = $c('[data-accion="bordon"]');
    chk.disabled = !t;
    if (pararBordon) { pararBordon(); pararBordon = t && chk.checked ? bordon(frecDe(t)) : null; }
    if (!t) chk.checked = false;
  }

  cont.addEventListener("change", (e) => {
    const a = e.target.dataset.accion;
    if (a === "ejercicio") { ejercicio = EJERCICIOS.find((x) => x.id === e.target.value); setPref("ejercicioViolin", ejercicio.id); idx = -1; construirLista(); resultados = []; pintarDiapason(); pintarPuntos(); actualizarBordon(); restaurarInicio(); }
    if (a === "tol") { tol = Number(e.target.value); setPref("tolViolin", tol); }
    if (a === "idavuelta") { idaVuelta = e.target.checked; setPref("idaVueltaViolin", idaVuelta); if (idx < 0) { construirLista(); pintarDiapason(); pintarPuntos(); } }
    if (a === "bordon") {
      pararBordon?.();
      pararBordon = e.target.checked && ejercicio.tonica ? bordon(frecDe(ejercicio.tonica)) : null;
    }
  });

  function restaurarInicio() {
    $c("#vi-obj").innerHTML = `<p>Elige un ejercicio, activa el micrófono y pulsa <b>Empezar</b>.</p>
      <button type="button" class="btn-play" data-accion="empezar">${icono("play")}<span>Empezar</span></button>`;
    $c("#vi-informe").innerHTML = "";
  }

  cont.addEventListener("click", (e) => {
    const cuerda = e.target.closest(".cuerda");
    if (cuerda) { referencia(Number(cuerda.dataset.midi), 2); return; }
    const b = e.target.closest("[data-accion]");
    if (!b || b.tagName !== "BUTTON") return;
    if (b.dataset.accion === "empezar") empezar();
    if (b.dataset.accion === "oir" && idx >= 0) referencia(lista[idx].midi);
    if (b.dataset.accion === "saltar" && idx >= 0) siguiente(true);
    if (b.dataset.accion === "parar" && idx >= 0) terminar();
  });

  construirLista();
  pintarDiapason();
  pintarPuntos();
  actualizarBordon();

  // Cuerda al aire más cercana (si la nota está cerca de alguna).
  function cuerdaCercana(ms) {
    let mejor = null;
    for (const c of CUERDAS) if (Math.abs(ms - c.midi) < 2.5 && (!mejor || Math.abs(ms - c.midi) < Math.abs(ms - mejor.midi))) mejor = c;
    return mejor;
  }
  let ultimaCuerda = null;

  return {
    tolerancia: () => (idx >= 0 ? tol : 5),
    objetivo: () => (idx >= 0 ? lista[idx].midi : ultimaCuerda?.midi ?? null),
    detalle(ms) {
      if (idx >= 0) return "";
      const c = cuerdaCercana(ms);
      return c ? `<br>Cuerda al aire más cercana: <b>${c.id}</b>` : "";
    },
    lejos: (ms) => (idx >= 0
      ? `Oigo ${nombreCompleto(Math.round(ms))}; busca ${nombreCompleto(lista[idx].midi)} (cuerda ${lista[idx].cuerda}, ${DEDO(lista[idx].dedo)})`
      : `Oigo ${nombreCompleto(Math.round(ms))}`),
    consejo: (c) => (idx >= 0
      ? (c < 0 ? "Bajo: adelanta el dedo hacia el puente" : "Alto: retrocede el dedo hacia la voluta")
      : (c < 0 ? "Baja: tensa la cuerda con el afinador fino" : "Alta: afloja un poco la cuerda")),
    alSilencio() { /* el contador de «sostener» se reinicia solo al salir de la franja */ },
    alOir(ms, ahora) {
      // Cuerdas al aire
      const c = cuerdaCercana(ms);
      ultimaCuerda = idx < 0 ? c : null;
      cont.querySelectorAll(".cuerda").forEach((b) => {
        const activa = c && Number(b.dataset.midi) === c.midi && idx < 0;
        b.classList.toggle("activa", !!activa);
        if (activa) {
          const cents = Math.round((ms - c.midi) * 100);
          b.classList.toggle("afinada", Math.abs(cents) <= 5);
          b.querySelector(".cuerda-estado").textContent = Math.abs(cents) <= 5 ? "afinada ✓" : `${signo(cents)}¢`;
        }
      });
      // Ejercicio
      if (idx < 0) return;
      const meta = lista[idx].midi;
      const dif = (ms - meta) * 100;
      if (Math.abs(dif) < 60) { intento.suma += dif; intento.n++; }
      const est = $c("#vi-estado");
      if (Math.abs(dif) <= tol) {
        if (!desde) desde = ahora;
        const p = Math.min(1, (ahora - desde) / 500);
        if (est) { est.textContent = `¡Ahí! Sostén… ${"●".repeat(Math.round(p * 5))}${"○".repeat(5 - Math.round(p * 5))}`; est.className = "vi-estado ok"; }
        if (ahora - desde >= 500) siguiente();
      } else {
        desde = 0;
        if (est) {
          est.className = "vi-estado";
          est.textContent = Math.abs(dif) >= 60 ? `Oigo ${nombreCompleto(Math.round(ms))}` : dif < 0 ? `${Math.round(dif)}¢: un poco bajo` : `+${Math.round(dif)}¢: un poco alto`;
        }
      }
    },
    desmontar: () => pararBordon?.(),
  };
}

