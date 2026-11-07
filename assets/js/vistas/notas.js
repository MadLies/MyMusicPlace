// Notas en los instrumentos: mapa de la armónica (con bends) y diapasón del violín.
// Pasa el mouse o toca un círculo para ver la nota y cómo se toca; con el micrófono,
// se enciende el círculo de la nota que suena con un color según su afinación.
import { Microfono } from "../microfono.js";
import { tocarNota } from "../audio.js";
import { TONOS_ARMONICA, notasArmonica, nombreNota, octava, CIFRADO, frecuencia, midiDeFrecuencia, NOMBRES } from "../notas.js";
import { pref, setPref } from "../progreso.js";
import { icono } from "../iconos.js";

const nombre = (m) => `${nombreNota(m)}${octava(m)}`;
const cifrado = (m) => `${CIFRADO[((m % 12) + 12) % 12]}${octava(m)}`;

const ESCALAS = {
  mayor: { nombre: "mayor", pasos: [0, 2, 4, 5, 7, 9, 11] },
  menor: { nombre: "menor", pasos: [0, 2, 3, 5, 7, 8, 10] },
  pentaMayor: { nombre: "pentatónica mayor", pasos: [0, 2, 4, 7, 9] },
  pentaMenor: { nombre: "pentatónica menor", pasos: [0, 3, 5, 7, 10] },
  blues: { nombre: "blues", pasos: [0, 3, 5, 6, 7, 10] },
};

// ---------- Violín: dedo según la distancia (en semitonos) a la cuerda al aire ----------
const CUERDAS = [{ id: "Sol", midi: 55 }, { id: "Re", midi: 62 }, { id: "La", midi: 69 }, { id: "Mi", midi: 76 }];
const PRIMERA = ["al aire", "1er dedo bajo", "1er dedo", "2º dedo bajo", "2º dedo alto", "3er dedo", "3er dedo alto (o 4º bajo)", "4º dedo"];
const TERCERA = { 5: "1er dedo", 6: "2º dedo bajo", 7: "2º dedo alto", 8: "3er dedo", 9: "3er dedo alto (o 4º bajo)", 10: "4º dedo" };
const DEDO_CORTO = ["0", "1", "1", "2", "2", "3", "3", "4", "3", "3", "4"];
const TRASTES = 10; // hasta el 4º dedo en 3ª posición

function comoViolin(cuerda, s) {
  const partes = [];
  if (s === 0) partes.push("Cuerda al aire (sin pisar)");
  else if (s <= 7) partes.push(`1ª posición: <b>${PRIMERA[s]}</b>`);
  if (TERCERA[s]) partes.push(`${s <= 7 ? "o en " : ""}3ª posición: <b>${TERCERA[s]}</b>`);
  if (s === 7) partes.push(`Suena igual que la cuerda ${CUERDAS[CUERDAS.indexOf(cuerda) + 1]?.id ?? "siguiente"} al aire`);
  return partes;
}

export async function mostrar(main, [instRuta]) {
  let inst = instRuta || pref("notasInstrumento", "armonica");
  let tono = pref("tonoGuia", "C");
  let escala = pref("notasEscala", "");
  let tonica = Number(pref("notasTonica", 0));
  let verDedos = pref("notasDedos", false);

  main.innerHTML = `
    <h1>Notas en los instrumentos</h1>
    <p class="sub">Dónde está cada nota. Pasa el mouse o toca un círculo para ver cómo se toca y oírla. Activa el micrófono: la nota que toques se enciende en el mapa.</p>
    <div class="segmentos modos" role="tablist" aria-label="Instrumento">
      <button type="button" role="tab" data-inst="armonica" aria-selected="${inst === "armonica"}">Armónica</button>
      <button type="button" role="tab" data-inst="violin" aria-selected="${inst === "violin"}">Violín</button>
    </div>
    <div class="notas-layout">
      <div class="panel notas-mic">
        <button type="button" class="btn-play" data-accion="mic">${icono("mic")}<span>Activar micrófono</span></button>
        <svg class="dial" viewBox="0 0 200 200" aria-hidden="true">
          <circle class="dial-pista" cx="100" cy="100" r="88"></circle>
          <path class="dial-zona" d="M 100 12 A 88 88 0 0 1 127.2 16.3"></path>
          <path class="dial-zona" d="M 100 12 A 88 88 0 0 0 72.8 16.3"></path>
          <g class="dial-marcas">${Array.from({ length: 11 }, (_, i) => { const a = (-90 + i * 18) * Math.PI / 180; return `<line x1="${100 + 80 * Math.cos(a - Math.PI / 2)}" y1="${100 + 80 * Math.sin(a - Math.PI / 2)}" x2="${100 + 88 * Math.cos(a - Math.PI / 2)}" y2="${100 + 88 * Math.sin(a - Math.PI / 2)}"></line>`; }).join("")}</g>
          <circle class="dial-centro" id="dial-centro" cx="100" cy="100" r="62"></circle>
          <line class="dial-aguja" id="dial-aguja" x1="100" y1="100" x2="100" y2="20"></line>
          <text x="100" y="104" class="dial-nota" id="dial-nota">—</text>
          <text x="100" y="132" class="dial-sub" id="dial-sub"></text>
          <text x="25" y="118" class="dial-lado">bajo</text><text x="175" y="118" class="dial-lado">alto</text>
        </svg>
        <div class="notas-lectura" id="lectura" aria-live="polite">Toca o canta una nota</div>
      </div>
      <div class="notas-mapa">
        <div class="panel-fila opciones" id="opciones"></div>
        <div id="mapa"></div>
        <div class="notas-info" id="info">Pasa el mouse o toca un círculo.</div>
      </div>
    </div>`;

  const $ = (s) => main.querySelector(s);
  let celdas = []; // [{el, midi}]

  // ---------- Escala resaltada ----------
  function enEscala(midi) {
    if (!escala) return true;
    return ESCALAS[escala].pasos.includes((((midi - tonica) % 12) + 12) % 12);
  }
  const opcionesEscala = () => `
    <label class="campo">Resaltar escala
      <select data-accion="tonica">${NOMBRES.map((n, i) => `<option value="${i}" ${i === tonica ? "selected" : ""}>${n}</option>`).join("")}</select>
      <select data-accion="escala"><option value="">— ninguna —</option>${Object.entries(ESCALAS).map(([k, e]) => `<option value="${k}" ${k === escala ? "selected" : ""}>${e.nombre}</option>`).join("")}</select>
    </label>`;

  function circulo(midi, extra = "", dato = "") {
    const fuera = enEscala(midi) ? "" : " fuera";
    const raiz = escala && (((midi - tonica) % 12) + 12) % 12 === 0 ? " tonica" : "";
    return `<button type="button" class="nc${fuera}${raiz} ${extra}" data-midi="${midi}" ${dato}><span>${nombreNota(midi)}</span><small>${octava(midi)}</small></button>`;
  }

  // ---------- Armónica ----------
  function pintarArmonica() {
    $("#opciones").innerHTML = `
      <label class="campo">Armónica en <select data-accion="tono">${TONOS_ARMONICA.map((t) => `<option ${t === tono ? "selected" : ""}>${t}</option>`).join("")}</select></label>
      ${opcionesEscala()}`;
    const notas = notasArmonica(tono);
    const busca = (h, aspira, b) => notas.find((n) => n.hoyo === h && n.aspira === aspira && n.bends === b);
    const fila = (etq, clase, fn) => `<div class="hm-etq ${clase}">${etq}</div>` +
      Array.from({ length: 10 }, (_, i) => { const n = fn(i + 1); return `<div class="hm-celda">${n ? circulo(n.midi, clase, `data-h="${n.hoyo}" data-a="${n.aspira ? 1 : 0}" data-b="${n.bends}"`) : ""}</div>`; }).join("");
    $("#mapa").innerHTML = `<div class="hm" role="group" aria-label="Notas de la armónica">
      ${fila("Bend soplado 1 tono", "sopla bend", (h) => busca(h, false, 2))}
      ${fila("Bend soplado ½", "sopla bend", (h) => busca(h, false, 1))}
      ${fila("Soplar", "sopla", (h) => busca(h, false, 0))}
      <div class="hm-etq"></div>${Array.from({ length: 10 }, (_, i) => `<div class="hm-hoyo">${i + 1}</div>`).join("")}
      ${fila("Aspirar", "aspira", (h) => busca(h, true, 0))}
      ${fila("Bend aspirado ½", "aspira bend", (h) => busca(h, true, 1))}
      ${fila("Bend aspirado 1 tono", "aspira bend", (h) => busca(h, true, 2))}
      ${fila("Bend aspirado 1½", "aspira bend", (h) => busca(h, true, 3))}
    </div>
    <p class="nota-texto">Los círculos con borde punteado son <b>bends</b>: la misma posición del hoyo pero bajando el tono con la boca. Armónica diatónica de 10 hoyos, afinación Richter.</p>`;
    recolectar();
  }

  function infoArmonica(el) {
    const h = Number(el.dataset.h), aspira = el.dataset.a === "1", b = Number(el.dataset.b);
    const midi = Number(el.dataset.midi);
    const otros = celdas.filter((c) => c.midi === midi && c.el !== el).map((c) => `${c.el.dataset.a === "1" ? "-" : ""}${c.el.dataset.h}${"ʼ".repeat(Number(c.el.dataset.b))}`);
    return `<div class="info-nota">${nombre(midi)} <small>${cifrado(midi)} · ${frecuencia(midi).toFixed(1)} Hz</small></div>
      <div><b>${aspira ? "Aspirar" : "Soplar"} el hoyo ${h}</b>${b ? ` con bend de ${b === 1 ? "medio tono" : b === 2 ? "un tono" : "tono y medio"}` : ""} · en la tablatura: <code>${aspira ? "-" : ""}${h}${"'".repeat(b)}</code></div>
      ${otros.length ? `<div class="sub">También sale en: ${otros.join(", ")}</div>` : ""}`;
  }

  // ---------- Violín ----------
  function pintarViolin() {
    $("#opciones").innerHTML = `${opcionesEscala()}
      <label class="interruptor"><input type="checkbox" data-accion="dedos" ${verDedos ? "checked" : ""}> Mostrar dedos (1ª posición)</label>`;
    let html = `<div class="diap-etq"></div>${CUERDAS.map((c) => `<div class="diap-cab">${c.id}</div>`).join("")}`;
    for (let s = 0; s <= TRASTES; s++) {
      const etq = s === 0 ? "al aire" : s === 8 ? "solo en 3ª pos." : "";
      html += `<div class="diap-etq${s === 1 ? " cejuela" : ""}${s === 8 ? " pos3" : ""}">${etq}</div>`;
      for (const c of CUERDAS) {
        const midi = c.midi + s;
        const dedo = verDedos && s <= 7 ? `<i class="dedo">${DEDO_CORTO[s]}</i>` : "";
        html += `<div class="diap-celda${s === 0 ? " aire" : ""}${s === 1 ? " cejuela" : ""}${s === 8 ? " pos3" : ""}">${circulo(midi, "", `data-cuerda="${c.id}" data-s="${s}"`).replace("</button>", `${dedo}</button>`)}</div>`;
      }
    }
    $("#mapa").innerHTML = `<div class="diap" role="group" aria-label="Diapasón del violín">${html}</div>
      <p class="nota-texto">Vista del diapasón como si miraras tu violín: la voluta arriba y el puente abajo; de izquierda a derecha, de la cuerda más grave (Sol) a la más aguda (Mi). Cada fila es un semitono más.</p>`;
    recolectar();
  }

  function infoViolin(el) {
    const midi = Number(el.dataset.midi);
    const cuerda = CUERDAS.find((c) => c.id === el.dataset.cuerda);
    const s = Number(el.dataset.s);
    const otros = celdas.filter((c) => c.midi === midi && c.el !== el).map((c) => `cuerda ${c.el.dataset.cuerda}`);
    return `<div class="info-nota">${nombre(midi)} <small>${cifrado(midi)} · ${frecuencia(midi).toFixed(1)} Hz</small></div>
      <div>Cuerda <b>${cuerda.id}</b>${s ? `, ${s} semitono${s > 1 ? "s" : ""} sobre la cuerda al aire` : ""}</div>
      ${comoViolin(cuerda, s).map((t) => `<div>${t}</div>`).join("")}
      ${otros.length ? `<div class="sub">La misma nota también está en: ${otros.join(", ")}</div>` : ""}`;
  }

  function recolectar() {
    celdas = [...main.querySelectorAll("#mapa .nc")].map((el) => ({ el, midi: Number(el.dataset.midi) }));
  }

  function pintar() {
    main.querySelectorAll("[data-inst]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.inst === inst)));
    history.replaceState(null, "", `#/notas/${inst}`);
    if (inst === "violin") pintarViolin(); else pintarArmonica();
    $("#info").textContent = "Pasa el mouse o toca un círculo.";
  }

  function mostrarInfo(el) {
    main.querySelectorAll("#mapa .nc.elegido").forEach((x) => x.classList.remove("elegido"));
    el.classList.add("elegido");
    $("#info").innerHTML = inst === "violin" ? infoViolin(el) : infoArmonica(el);
  }

  // ---------- Micrófono ----------
  let mic = null;
  const suav = [];
  const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  let encendidas = [];

  function apagar() {
    encendidas.forEach((el) => el.classList.remove("suena", "ok", "cerca", "lejos"));
    encendidas = [];
  }

  function alOir({ frec }) {
    if (!frec) {
      suav.length = 0;
      apagar();
      $("#dial-centro").setAttribute("class", "dial-centro");
      return;
    }
    const m = midiDeFrecuencia(frec);
    if (suav.length && Math.abs(m - med(suav)) > 0.6) suav.length = 0;
    suav.push(m);
    if (suav.length > 5) suav.shift();
    const ms = med(suav);
    const r = Math.round(ms);
    const cents = Math.round((ms - r) * 100);
    const estado = Math.abs(cents) <= 5 ? "ok" : Math.abs(cents) <= 15 ? "cerca" : "lejos";
    // Dial
    $("#dial-nota").textContent = nombreNota(r);
    $("#dial-sub").textContent = `${cifrado(r)} · ${cents > 0 ? "+" : ""}${cents}¢`;
    $("#dial-aguja").setAttribute("transform", `rotate(${Math.max(-50, Math.min(50, cents)) * 1.8} 100 100)`);
    $("#dial-centro").setAttribute("class", `dial-centro ${estado}`);
    $("#lectura").innerHTML = estado === "ok" ? `<b>${nombre(r)}</b> afinada ✓`
      : `<b>${nombre(r)}</b> ${cents < 0 ? "un poco baja: sube" : "un poco alta: baja"} (${cents > 0 ? "+" : ""}${cents}¢)`;
    // Círculos del mapa
    apagar();
    encendidas = celdas.filter((c) => c.midi === r).map((c) => c.el);
    encendidas.forEach((el) => el.classList.add("suena", estado));
    if (!encendidas.length) $("#lectura").innerHTML += `<br><small>Esta nota no está en el mapa${inst === "armonica" ? ` de una armónica en ${tono}` : ""}.</small>`;
  }

  async function alternarMic() {
    const b = $('[data-accion="mic"]');
    if (mic?.activo) {
      mic.detener(); mic = null; apagar();
      b.innerHTML = `${icono("mic")}<span>Activar micrófono</span>`;
      b.classList.remove("sonando");
      $("#lectura").textContent = "Toca o canta una nota";
      return;
    }
    mic = new Microfono(alOir);
    try {
      await mic.iniciar();
      b.innerHTML = `${icono("mic")}<span>Detener micrófono</span>`;
      b.classList.add("sonando");
      $("#lectura").textContent = "Escuchando…";
    } catch (err) {
      $("#lectura").textContent = `No pude usar el micrófono: ${err.message}`;
      mic = null;
    }
  }

  // ---------- Eventos ----------
  main.addEventListener("click", (e) => {
    const t = e.target.closest("[data-inst]");
    if (t && t.dataset.inst !== inst) { inst = t.dataset.inst; setPref("notasInstrumento", inst); apagar(); pintar(); return; }
    if (e.target.closest('[data-accion="mic"]')) { alternarMic(); return; }
    const c = e.target.closest("#mapa .nc");
    if (c) { mostrarInfo(c); tocarNota(frecuencia(Number(c.dataset.midi)), 0.8, { timbre: inst === "violin" ? "violin" : "armonica" }); }
  });
  main.addEventListener("mouseover", (e) => {
    const c = e.target.closest("#mapa .nc");
    if (c) mostrarInfo(c);
  });
  main.addEventListener("change", (e) => {
    const a = e.target.dataset.accion;
    if (a === "tono") { tono = e.target.value; setPref("tonoGuia", tono); pintar(); }
    if (a === "escala") { escala = e.target.value; setPref("notasEscala", escala); pintar(); }
    if (a === "tonica") { tonica = Number(e.target.value); setPref("notasTonica", tonica); if (escala) pintar(); }
    if (a === "dedos") { verDedos = e.target.checked; setPref("notasDedos", verDedos); pintar(); }
  });

  pintar();
  return () => mic?.detener();
}
