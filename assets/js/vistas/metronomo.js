// Metrónomo: tempo con toques, compases, subdivisiones, entrenador de velocidad y compases mudos.
// Los clics se programan con el reloj de audio (no con setTimeout), así no se desfasan.
import { contexto, clicEn } from "../audio.js";
import { pref, setPref } from "../progreso.js";
import { icono } from "../iconos.js";

const COMPASES = [
  { id: "1", nombre: "Sin compás", pulsos: 1, acentos: [] },
  { id: "2/4", nombre: "2/4", pulsos: 2, acentos: [0] },
  { id: "3/4", nombre: "3/4 (vals)", pulsos: 3, acentos: [0] },
  { id: "4/4", nombre: "4/4", pulsos: 4, acentos: [0] },
  { id: "5/4", nombre: "5/4", pulsos: 5, acentos: [0, 3] },
  { id: "6/8", nombre: "6/8 (pulso = corchea)", pulsos: 6, acentos: [0, 3] },
];
const SUBDIVISIONES = [[1, "Solo el pulso"], [2, "Corcheas (2)"], [3, "Tresillos (3)"], [4, "Semicorcheas (4)"]];

export function nombreTempo(bpm) {
  if (bpm < 50) return "Largo";
  if (bpm < 66) return "Adagio";
  if (bpm < 76) return "Andante";
  if (bpm < 108) return "Moderato";
  if (bpm < 120) return "Allegretto";
  if (bpm < 168) return "Allegro";
  return "Presto";
}

export async function mostrar(main) {
  let bpm = Number(pref("metroBpm", 80));
  let compas = COMPASES.find((c) => c.id === pref("metroCompas", "4/4")) || COMPASES[3];
  let sub = Number(pref("metroSub", 1));
  let volumen = Number(pref("metroVol", 0.8));

  main.innerHTML = `
    <h1>Metrónomo</h1>
    <p class="sub">Marca el pulso para practicar a tempo. Toca <b>Marcar tempo</b> al ritmo de una canción para saber su velocidad.</p>
    <div class="metro">
      <div class="panel metro-panel">
        <div class="metro-tempo">
          <button type="button" class="btn-icono" data-accion="menos" aria-label="Más lento">${icono("menos")}</button>
          <div class="metro-bpm"><output id="bpm">${bpm}</output><span>pulsos por minuto · <b id="nombre-tempo">${nombreTempo(bpm)}</b></span></div>
          <button type="button" class="btn-icono" data-accion="mas" aria-label="Más rápido">${icono("mas")}</button>
        </div>
        <input type="range" min="30" max="240" step="1" value="${bpm}" data-accion="slider" class="metro-slider" aria-label="Tempo">
        <div class="metro-luces" id="luces" aria-hidden="true"></div>
        <div class="metro-botones">
          <button type="button" class="btn-play metro-start" data-accion="start">${icono("play")}<span>Empezar</span></button>
          <button type="button" class="btn metro-tap" data-accion="tap" title="Toca varias veces al ritmo (o pulsa T)">Marcar tempo</button>
        </div>
        <p class="nota-texto metro-ayuda">Teclado: <kbd>Espacio</kbd> empezar/parar · <kbd>T</kbd> marcar tempo · <kbd>↑</kbd> <kbd>↓</kbd> ±1 · <kbd>→</kbd> <kbd>←</kbd> ±5</p>
      </div>
      <div class="metro-opciones">
        <h2>Compás y subdivisión</h2>
        <label class="campo">Compás <select data-accion="compas">${COMPASES.map((c) => `<option value="${c.id}" ${c === compas ? "selected" : ""}>${c.nombre}</option>`).join("")}</select></label>
        <label class="campo">Subdivisión <select data-accion="sub">${SUBDIVISIONES.map(([v, t]) => `<option value="${v}" ${v === sub ? "selected" : ""}>${t}</option>`).join("")}</select></label>
        <label class="campo">Volumen <input type="range" min="0.1" max="1" step="0.05" value="${volumen}" data-accion="vol"></label>

        <h2>Entrenador de velocidad</h2>
        <p class="nota-texto">Empieza lento y deja que el metrónomo suba solo: ideal para pasajes difíciles.</p>
        <label class="interruptor"><input type="checkbox" data-accion="entrenador"> Subir el tempo poco a poco</label>
        <div class="metro-filas">
          <label>Subir <input type="number" min="1" max="20" value="${pref("metroSube", 4)}" data-accion="sube"> ppm</label>
          <label>cada <input type="number" min="1" max="32" value="${pref("metroCada", 4)}" data-accion="cada"> compases</label>
          <label>hasta <input type="number" min="40" max="240" value="${pref("metroHasta", 120)}" data-accion="hasta"> ppm</label>
        </div>

        <h2>Compases mudos</h2>
        <p class="nota-texto">El metrónomo suena unos compases y calla otros; tú sigues contando por dentro. Entrena el pulso interno.</p>
        <label class="interruptor"><input type="checkbox" data-accion="mudos"> Activar</label>
        <div class="metro-filas">
          <label>Suena <input type="number" min="1" max="16" value="${pref("metroSuena", 2)}" data-accion="suena"> compases</label>
          <label>calla <input type="number" min="1" max="16" value="${pref("metroCalla", 2)}" data-accion="calla"></label>
        </div>
        <div class="metro-estado" id="metro-estado"></div>
      </div>
    </div>`;

  const $ = (s) => main.querySelector(s);
  const num = (a) => Number($(`[data-accion="${a}"]`).value);

  // ---------- Estado de reproducción ----------
  let sonando = false, timer = null, raf = null;
  let siguiente = 0; // tiempo de audio del próximo pulso
  let pulso = 0, compasNum = 0, cola = []; // cola de pulsos programados para pintar las luces

  function pintarLuces() {
    $("#luces").innerHTML = Array.from({ length: compas.pulsos }, (_, i) =>
      `<i class="${compas.acentos.includes(i) ? (i === 0 ? "fuerte" : "medio") : ""}"></i>`).join("");
  }
  pintarLuces();

  function setBpm(v, guardar = true) {
    bpm = Math.round(Math.min(240, Math.max(30, v)));
    $("#bpm").textContent = bpm;
    $("#nombre-tempo").textContent = nombreTempo(bpm);
    $('[data-accion="slider"]').value = bpm;
    if (guardar) setPref("metroBpm", bpm);
  }

  function mudo(nCompas) {
    if (!$('[data-accion="mudos"]').checked) return false;
    const s = Math.max(1, num("suena")), c = Math.max(1, num("calla"));
    return nCompas % (s + c) >= s;
  }

  function programar() {
    const ctx = contexto();
    while (siguiente < ctx.currentTime + 0.12) {
      const calla = mudo(compasNum);
      const nivel = pulso === 0 && compas.acentos.length ? 2 : compas.acentos.includes(pulso) ? 2 : 1;
      if (!calla) {
        clicEn(siguiente, nivel, nivel === 2 && pulso !== 0 ? volumen * 0.7 : volumen); // acento secundario más suave
        for (let k = 1; k < sub; k++) clicEn(siguiente + (k * 60) / bpm / sub, 0, volumen);
      }
      cola.push({ t: siguiente, pulso, calla, compasNum });
      siguiente += 60 / bpm;
      pulso++;
      if (pulso >= compas.pulsos) {
        pulso = 0;
        compasNum++;
        // Entrenador de velocidad: sube al terminar cada bloque de compases.
        if ($('[data-accion="entrenador"]').checked && compasNum % Math.max(1, num("cada")) === 0) {
          const hasta = num("hasta");
          if (bpm < hasta) setBpm(Math.min(hasta, bpm + Math.max(1, num("sube"))));
        }
      }
    }
  }

  function animar() {
    const ahora = contexto().currentTime;
    while (cola.length && cola[0].t <= ahora) {
      const p = cola.shift();
      const luces = $("#luces").children;
      [...luces].forEach((l, i) => l.classList.toggle("on", i === p.pulso));
      $("#luces").classList.toggle("mudo", p.calla);
      $("#metro-estado").textContent = p.calla ? "Compás en silencio: sigue contando…" : sonando ? `Compás ${p.compasNum + 1}` : "";
    }
    if (sonando) raf = requestAnimationFrame(animar);
  }

  function empezar() {
    const ctx = contexto();
    sonando = true;
    pulso = 0; compasNum = 0; cola = [];
    siguiente = ctx.currentTime + 0.08;
    programar();
    timer = setInterval(programar, 25);
    raf = requestAnimationFrame(animar);
    $('[data-accion="start"]').innerHTML = `${icono("stop")}<span>Parar</span>`;
    $('[data-accion="start"]').classList.add("sonando");
  }
  function parar() {
    sonando = false;
    clearInterval(timer);
    cancelAnimationFrame(raf);
    [...$("#luces").children].forEach((l) => l.classList.remove("on"));
    $("#luces").classList.remove("mudo");
    $("#metro-estado").textContent = "";
    $('[data-accion="start"]').innerHTML = `${icono("play")}<span>Empezar</span>`;
    $('[data-accion="start"]').classList.remove("sonando");
  }

  // ---------- Marcar tempo con toques ----------
  let toques = [];
  function tap() {
    const t = performance.now();
    toques = toques.filter((x) => t - x < 2500);
    toques.push(t);
    const b = $('[data-accion="tap"]');
    b.classList.add("pulsado");
    setTimeout(() => b.classList.remove("pulsado"), 90);
    if (toques.length >= 2) {
      const intervalos = toques.slice(1).map((x, i) => x - toques[i]);
      const media = intervalos.reduce((a, c) => a + c, 0) / intervalos.length;
      setBpm(60000 / media);
      b.textContent = `Marcar tempo (${toques.length})`;
    } else b.textContent = "Sigue tocando…";
  }

  // ---------- Eventos ----------
  main.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-accion]");
    if (!b) return;
    if (b.dataset.accion === "start") sonando ? parar() : empezar();
    if (b.dataset.accion === "tap") tap();
    if (b.dataset.accion === "mas") setBpm(bpm + 1);
    if (b.dataset.accion === "menos") setBpm(bpm - 1);
  });
  main.addEventListener("input", (e) => {
    const a = e.target.dataset.accion;
    if (a === "slider") setBpm(Number(e.target.value));
    if (a === "vol") { volumen = Number(e.target.value); setPref("metroVol", volumen); }
  });
  main.addEventListener("change", (e) => {
    const a = e.target.dataset.accion;
    if (a === "compas") { compas = COMPASES.find((c) => c.id === e.target.value); setPref("metroCompas", compas.id); pulso = 0; pintarLuces(); }
    if (a === "sub") { sub = Number(e.target.value); setPref("metroSub", sub); }
    const claves = { sube: "metroSube", cada: "metroCada", hasta: "metroHasta", suena: "metroSuena", calla: "metroCalla" };
    if (claves[a]) setPref(claves[a], Number(e.target.value));
  });
  function teclado(e) {
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) && e.target.type !== "range" && e.target.type !== "checkbox") return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (k === " ") { e.preventDefault(); if (!e.repeat) sonando ? parar() : empezar(); }
    else if (k.toLowerCase() === "t") tap();
    else if (k === "ArrowUp") { e.preventDefault(); setBpm(bpm + 1); }
    else if (k === "ArrowDown") { e.preventDefault(); setBpm(bpm - 1); }
    else if (k === "ArrowRight") { e.preventDefault(); setBpm(bpm + 5); }
    else if (k === "ArrowLeft") { e.preventDefault(); setBpm(bpm - 5); }
  }
  const sinActivarBoton = (e) => { if (e.key === " " && !/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) e.preventDefault(); };
  document.addEventListener("keydown", teclado);
  document.addEventListener("keyup", sinActivarBoton);
  return () => { parar(); document.removeEventListener("keydown", teclado); document.removeEventListener("keyup", sinActivarBoton); };
}
