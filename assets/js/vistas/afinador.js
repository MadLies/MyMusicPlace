// Afinador y entrenador de bends con el micrófono.
import { Microfono } from "../microfono.js";
import { crearArmonica } from "../armonica.js";
import { TONOS_ARMONICA, notasArmonica, nombreNota, octava, textoNota, midiDeFrecuencia, frecuencia, midiNota } from "../notas.js";
import { tocarNota } from "../audio.js";
import { pref, setPref } from "../progreso.js";
import { icono } from "../iconos.js";
import { chipHTML } from "../render.js";

export async function mostrar(main) {
  let tono = pref("tonoGuia", "C");
  let objetivo = null; // nota de la armónica a practicar (normalmente un bend)
  let mic = null, enObjetivoDesde = 0, logros = 0;
  const historia = []; // [tiempo, midi]

  main.innerHTML = `
    <h1>Afinador y bends</h1>
    <p class="sub">Toca una nota y mira cuál es y en qué hoyo de tu armónica está. Elige un bend para entrenarlo: la línea te muestra cuánto bajas.</p>
    <div class="afinador">
      <div class="panel afinador-panel">
        <div class="panel-fila">
          <button type="button" class="btn-play" data-accion="mic">${icono("mic")}<span>Activar micrófono</span></button>
          <label>Armónica en
            <select data-accion="tono">${TONOS_ARMONICA.map((t) => `<option ${t === tono ? "selected" : ""}>${t}</option>`).join("")}</select>
          </label>
        </div>
        <div class="lectura">
          <div class="lectura-nota" aria-live="polite"><span id="nota">—</span><sub id="oct"></sub></div>
          <div class="lectura-hoyo" id="hoyo">Activa el micrófono y toca</div>
          <div class="medidor" aria-hidden="true"><div class="medidor-escala"><span>−50¢</span><span>0</span><span>+50¢</span></div><div class="aguja" id="aguja"></div></div>
        </div>
        <canvas id="traza" height="160" aria-label="Gráfica de la nota en el tiempo"></canvas>
        <div class="objetivo-info" id="obj-info">Sin objetivo: el afinador muestra cualquier nota.</div>
      </div>
      <div>
        <h2>Entrena un bend</h2>
        <p class="nota-texto">Elige una nota: suena como referencia y la línea verde de la gráfica marca el objetivo. Aguanta en la franja verde.</p>
        <div class="bends" id="bends"></div>
        <h2>Tu armónica</h2>
        <div class="armonica-cont"></div>
      </div>
    </div>`;

  const $ = (s) => main.querySelector(s);
  const armonica = crearArmonica($(".armonica-cont"), { tono, compacta: true });
  const canvas = $("#traza");
  const g = canvas.getContext("2d");

  function pintarBends() {
    const lista = notasArmonica(tono).filter((n) => n.bends);
    $("#bends").innerHTML = lista
      .map((n, i) => `<button type="button" class="bend-btn${objetivo && objetivo.hoyo === n.hoyo && objetivo.bends === n.bends && objetivo.aspira === n.aspira ? " elegido" : ""}" data-i="${i}">${chipHTML(n, tono).replace('<button type="button"', "<span").replace(/<\/button>$/, "</span>")}<span>${n.aspira ? "aspirado" : "soplado"} −${n.bends === 1 ? "½" : n.bends === 2 ? "1" : "1½"} tono</span></button>`)
      .join("") + `<button type="button" class="bend-btn" data-i="-1"><span>Quitar objetivo</span></button>`;
    $("#bends").onclick = (e) => {
      const b = e.target.closest(".bend-btn");
      if (!b) return;
      const i = Number(b.dataset.i);
      objetivo = i < 0 ? null : lista[i];
      if (objetivo) {
        objetivo.midi = midiNota(objetivo, tono);
        tocarNota(frecuencia(objetivo.midi), 0.9);
        armonica.resaltar(objetivo);
        const sinBend = { ...objetivo, bends: 0 };
        $("#obj-info").innerHTML = `Objetivo: <b>${textoNota(objetivo)}</b> = <b>${nombreNota(objetivo.midi)}</b>. Empieza en ${textoNota(sinBend)} (${nombreNota(midiNota(sinBend, tono))}) y baja ${objetivo.bends === 1 ? "medio tono" : objetivo.bends === 2 ? "un tono" : "tono y medio"}. Logrados: <b id="logros">${logros}</b>`;
      } else {
        armonica.resaltar(null);
        $("#obj-info").textContent = "Sin objetivo: el afinador muestra cualquier nota.";
      }
      pintarBends();
    };
  }
  pintarBends();

  function dibujar() {
    const w = (canvas.width = canvas.clientWidth * devicePixelRatio);
    const h = (canvas.height = 160 * devicePixelRatio);
    const css = getComputedStyle(document.documentElement);
    g.clearRect(0, 0, w, h);
    const ahora = performance.now();
    const ultimos = historia.filter(([t]) => ahora - t < 6000);
    const centro = objetivo ? objetivo.midi : (ultimos.length ? ultimos[ultimos.length - 1][1] : 69);
    const rango = 4; // semitonos arriba y abajo
    const y = (m) => h / 2 - ((m - centro) / rango) * (h / 2);
    // Líneas de semitono
    g.lineWidth = 1 * devicePixelRatio;
    g.font = `${11 * devicePixelRatio}px system-ui`;
    for (let k = Math.ceil(centro - rango); k <= centro + rango; k++) {
      g.strokeStyle = css.getPropertyValue("--line");
      g.beginPath(); g.moveTo(0, y(k)); g.lineTo(w, y(k)); g.stroke();
      g.fillStyle = css.getPropertyValue("--muted");
      g.fillText(nombreNota(k), 4 * devicePixelRatio, y(k) - 3 * devicePixelRatio);
    }
    if (objetivo) {
      g.fillStyle = "rgba(26,127,55,0.18)";
      g.fillRect(0, y(objetivo.midi + 0.2), w, y(objetivo.midi - 0.2) - y(objetivo.midi + 0.2));
    }
    g.strokeStyle = css.getPropertyValue("--accent");
    g.lineWidth = 2.5 * devicePixelRatio;
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

  function alOir({ frec }) {
    const ahora = performance.now();
    historia.push([ahora, frec ? midiDeFrecuencia(frec) : null]);
    while (historia.length && ahora - historia[0][0] > 6500) historia.shift();
    dibujar();
    if (!frec) return;
    const m = midiDeFrecuencia(frec);
    const r = Math.round(m);
    const cents = Math.round((m - r) * 100);
    $("#nota").textContent = nombreNota(r);
    $("#oct").textContent = octava(r);
    $("#aguja").style.left = `${50 + Math.max(-50, Math.min(50, cents))}%`;
    $("#aguja").classList.toggle("afinado", Math.abs(cents) < 10);
    const hoyos = notasArmonica(tono).filter((n) => n.midi === r);
    $("#hoyo").innerHTML = hoyos.length
      ? `En tu armónica: ${hoyos.map((n) => `<b>${textoNota(n)}</b>`).join(" o ")} <small>(${cents > 0 ? "+" : ""}${cents}¢)</small>`
      : `Esta nota no está en una armónica en ${tono} <small>(${cents > 0 ? "+" : ""}${cents}¢)</small>`;
    if (!objetivo && hoyos.length) armonica.resaltar(hoyos[0]);
    if (objetivo) {
      if (Math.abs(m - objetivo.midi) < 0.2) {
        if (!enObjetivoDesde) enObjetivoDesde = ahora;
        if (ahora - enObjetivoDesde > 400 && enObjetivoDesde > 0) {
          logros++;
          enObjetivoDesde = -1; // espera a salir de la franja
          const l = main.querySelector("#logros");
          if (l) l.textContent = logros;
          $("#obj-info").classList.add("logrado");
          setTimeout(() => $("#obj-info")?.classList.remove("logrado"), 900);
        }
      } else if (enObjetivoDesde !== 0) enObjetivoDesde = 0;
    }
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
      $("#hoyo").textContent = `No pude usar el micrófono: ${err.message}`;
      mic = null;
    }
  }

  $('[data-accion="mic"]').addEventListener("click", alternarMic);
  $('[data-accion="tono"]').addEventListener("change", (e) => {
    tono = e.target.value;
    setPref("tonoGuia", tono);
    armonica.setTono(tono);
    objetivo = null;
    $("#obj-info").textContent = "Sin objetivo: el afinador muestra cualquier nota.";
    pintarBends();
  });
  dibujar();
  return () => mic?.detener();
}
