// Temporizador de práctica: un botón con flecha en la cabecera abre un pequeño menú.
// - «Solo tiempo»: duraciones rápidas (20, 30, 45 min, 1 h) o una a medida.
// - «Rutina»: eliges instrumento y una de tus rutinas (página Prácticas); el reloj cuenta cada ejercicio
//   y, al terminar uno, avisa y se detiene hasta que pulses «Siguiente».
// Sigue contando aunque cambies de página o recargues (guarda la hora de fin), y al terminar avisa con
// sonido, el título de la pestaña y, si lo permites, una notificación del sistema.
import { contexto } from "./audio.js";
import { icono } from "./iconos.js";
import { pref, setPref } from "./progreso.js";
import { INSTRUMENTOS, EVENTO, listar, obtener, minutosTotales } from "./rutinas.js";

const CLAVE = "atril:temporizador";
export const EVENTO_TEMPORIZADOR = "atril:temporizador";
const PRESETS = [20, 30, 45, 60];
const TITULO = document.title;

// estado: parado | corriendo | pausado | espera (rutina: terminó un ejercicio) | terminado
// En una rutina, «total» y «fin» son los del ejercicio actual; «hecho» suma lo ya practicado.
let t = leer() || { estado: "parado", total: 0, fin: 0, restante: 0, avisar: false, rutina: null, paso: 0, hecho: 0 };
let intervalo = null, parpadeo = null;

function leer() { try { return JSON.parse(localStorage.getItem(CLAVE)); } catch { return null; } }
function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(t)); } catch { /* sin almacenamiento */ }
  window.dispatchEvent(new CustomEvent(EVENTO_TEMPORIZADOR));
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const restante = () => (t.estado === "corriendo" ? Math.max(0, t.fin - Date.now()) : t.estado === "pausado" ? t.restante : 0);
function reloj(ms) {
  const s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}` : `${m}:${String(ss).padStart(2, "0")}`;
}
export const durTxt = (min) => (min >= 60 && min % 60 === 0 ? `${min / 60} h` : min > 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`);
const ejercicio = (i = t.paso) => t.rutina?.ejercicios[i] || null;
const nEj = () => t.rutina?.ejercicios.length || 0;

/** Estado para otras páginas (p. ej. Prácticas marca la rutina en curso). */
export function estadoTemporizador() {
  return { estado: t.estado, rutinaId: t.rutina?.id || null, paso: t.paso };
}

// ---------------------------------------------------------------- Interfaz
const raiz = document.createElement("div");
raiz.className = "temporizador";
raiz.innerHTML = `
  <button type="button" class="tempo-btn" aria-haspopup="dialog" aria-expanded="false" aria-controls="tempo-menu" title="Temporizador de práctica">
    ${icono("reloj")}<span class="tempo-txt" aria-live="off"></span><svg class="ico tempo-flecha" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
  </button>
  <div class="tempo-menu" id="tempo-menu" role="dialog" aria-label="Temporizador de práctica" hidden>
    <div class="tempo-cab"><b>Tiempo de práctica</b><span class="tempo-estado"></span></div>
    <div class="tempo-vista"></div>
  </div>`;
const btn = raiz.querySelector(".tempo-btn"), menu = raiz.querySelector(".tempo-menu"), vista = raiz.querySelector(".tempo-vista");

function pintarBoton() {
  const ms = restante();
  const txt = raiz.querySelector(".tempo-txt");
  const prefijo = t.rutina ? `<span class="tempo-paso-btn">${t.paso + 1}/${nEj()}</span>` : "";
  txt.innerHTML = t.estado === "corriendo" || t.estado === "pausado" ? prefijo + reloj(ms)
    : t.estado === "espera" ? `${prefijo}${icono("check")}`
    : t.estado === "terminado" ? "¡Tiempo!" : "";
  btn.classList.toggle("activo", t.estado === "corriendo");
  btn.classList.toggle("pausado", t.estado === "pausado");
  btn.classList.toggle("espera", t.estado === "espera");
  btn.classList.toggle("terminado", t.estado === "terminado");
  btn.setAttribute("aria-label", t.estado === "parado" ? "Temporizador de práctica"
    : t.estado === "terminado" ? "Temporizador: terminado"
    : t.estado === "espera" ? "Temporizador: ejercicio terminado, pulsa Siguiente"
    : `Temporizador: quedan ${reloj(ms)}${t.rutina ? ` del ejercicio ${t.paso + 1} de ${nEj()}` : ""}`);
}

const enlaceHTML = (e) => (e?.enlace ? `<a class="btn-mini tempo-abrir" href="${esc(e.enlace)}">${icono("sig")} Abrir ${esc(e.enlaceTxt || "")}</a>` : "");

function vistaParado() {
  const inst = INSTRUMENTOS[pref("tempoInstrumento", "")] ? pref("tempoInstrumento", "") : "violin";
  const rutinas = listar(inst);
  return `
    <div class="segmentos tempo-inst" role="group" aria-label="Instrumento">
      ${Object.entries(INSTRUMENTOS).map(([k, v]) => `<button type="button" data-inst="${k}" aria-pressed="${k === inst}">${v}</button>`).join("")}
    </div>
    ${rutinas.length ? `<div class="tempo-rutinas">${rutinas.map((r) => `
      <button type="button" class="tempo-rutina" data-rutina="${esc(r.id)}">
        <b>${esc(r.nombre)}</b><small>${r.ejercicios.length} ${r.ejercicios.length === 1 ? "ejercicio" : "ejercicios"} · ${durTxt(minutosTotales(r))}</small>
      </button>`).join("")}</div>`
      : `<p class="tempo-ayuda">Aún no tienes rutinas de ${INSTRUMENTOS[inst].toLowerCase()}.</p>`}
    <a class="tempo-editar" href="#/practicas/${inst}">${icono("lapiz")} ${rutinas.length ? "Editar rutinas" : "Crear una rutina"}</a>
    <p class="tempo-sep"><span>o solo tiempo</span></p>
    <div class="tempo-presets">${PRESETS.map((m) => `<button type="button" class="tempo-chip" data-min="${m}">${durTxt(m)}</button>`).join("")}</div>
    <form class="tempo-otro">
      <label>Otro <input type="number" name="min" min="1" max="600" step="1" placeholder="15" inputmode="numeric"> min</label>
      <button type="submit" class="btn-mini">Empezar</button>
    </form>
    ${"Notification" in window ? `<label class="tempo-notif"><input type="checkbox" data-t="notif" ${t.avisar ? "checked" : ""}> Avisar también con una notificación</label>` : ""}`;
}

function pintarMenu() {
  const est = raiz.querySelector(".tempo-estado");
  const titulo = raiz.querySelector(".tempo-cab b");
  titulo.textContent = t.rutina && t.estado !== "parado" ? t.rutina.nombre : "Tiempo de práctica";
  if (t.estado === "parado") {
    est.textContent = "";
    vista.innerHTML = vistaParado();
    return;
  }
  if (t.estado === "terminado") {
    est.textContent = "";
    const min = Math.round((t.rutina ? t.hecho : t.total) / 60000);
    vista.innerHTML = `
      <div class="tempo-fin"><span class="tempo-fin-ico">${icono("check")}</span>
        <div><b>${t.rutina ? "¡Terminaste la rutina!" : "¡Terminaste tu práctica!"}</b><small>${t.rutina ? `${nEj()} ejercicios · ` : ""}${durTxt(Math.max(1, min))} de estudio</small></div></div>
      <div class="tempo-acciones">
        <button type="button" class="btn-mini" data-t="mas5">+5 min</button>
        <button type="button" class="btn-mini" data-t="otra">Otra sesión</button>
        <button type="button" class="btn-mini primario" data-t="listo">Listo</button>
      </div>`;
    return;
  }
  if (t.estado === "espera") {
    const hecho = ejercicio(), sig = ejercicio(t.paso + 1);
    est.textContent = `ejercicio ${t.paso + 1} de ${nEj()}`;
    vista.innerHTML = `
      <div class="tempo-fin"><span class="tempo-fin-ico">${icono("check")}</span>
        <div><b>Terminaste «${esc(hecho.nombre)}»</b><small>Cuando estés listo, pasa al siguiente.</small></div></div>
      <div class="tempo-ejercicio sig">
        <span class="tempo-paso">Sigue · ${t.paso + 2}/${nEj()}</span>
        <b>${esc(sig.nombre)}</b> <small>${durTxt(sig.min)}</small>
        ${sig.nota ? `<p>${esc(sig.nota)}</p>` : ""}
      </div>
      <div class="tempo-acciones">
        <button type="button" class="btn-mini primario" data-t="siguiente">${icono("avanzar")} Siguiente</button>
        <button type="button" class="btn-mini" data-t="mas5" title="5 minutos más para «${esc(hecho.nombre)}»">+5 min a este</button>
        <button type="button" class="btn-mini" data-t="parar">${icono("stop")} Terminar</button>
      </div>`;
    return;
  }
  const ms = restante(), pct = t.total ? 100 * (1 - ms / t.total) : 0;
  const e = ejercicio(), sig = ejercicio(t.paso + 1);
  est.textContent = t.rutina ? `ejercicio ${t.paso + 1} de ${nEj()}` : t.estado === "pausado" ? "en pausa" : `de ${durTxt(Math.round(t.total / 60000))}`;
  vista.innerHTML = `
    ${e ? `<div class="tempo-ejercicio"><b>${esc(e.nombre)}</b>${e.nota ? `<p>${esc(e.nota)}</p>` : ""}${enlaceHTML(e)}</div>` : ""}
    <div class="tempo-grande" aria-live="off">${reloj(ms)}</div>
    <div class="tempo-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><i style="width:${pct}%"></i></div>
    <p class="tempo-ayuda">${t.estado === "pausado" ? "Pausado" : t.rutina ? (sig ? `Sigue: ${esc(sig.nombre)} · ${durTxt(sig.min)}` : "Es el último ejercicio") : `Termina a las ${new Date(t.fin).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}`}</p>
    <div class="tempo-acciones">
      ${t.estado === "corriendo" ? `<button type="button" class="btn-mini" data-t="pausa">${icono("pausa")} Pausa</button>` : `<button type="button" class="btn-mini primario" data-t="seguir">${icono("play")} Seguir</button>`}
      <button type="button" class="btn-mini" data-t="mas5">+5 min</button>
      ${t.rutina ? `<button type="button" class="btn-mini" data-t="saltar" title="${sig ? "Pasar ya al siguiente ejercicio" : "Terminar la rutina"}">${icono("sig")} ${sig ? "Saltar" : "Acabar"}</button>` : ""}
      <button type="button" class="btn-mini" data-t="parar">${icono("stop")} Terminar</button>
    </div>`;
}

// Solo se actualizan los números cada segundo (no se rehace el menú, para no perder el foco).
function actualizarNumeros() {
  pintarBoton();
  if (menu.hidden || (t.estado !== "corriendo" && t.estado !== "pausado")) return;
  const ms = restante(), pct = t.total ? 100 * (1 - ms / t.total) : 0;
  const g = vista.querySelector(".tempo-grande");
  if (g) g.textContent = reloj(ms);
  const b = vista.querySelector(".tempo-barra");
  if (b) { b.firstElementChild.style.width = `${pct}%`; b.setAttribute("aria-valuenow", String(Math.round(pct))); }
}

function refrescar() { guardar(); pintarMenu(); pintarBoton(); }

// ---------------------------------------------------------------- Lógica
function correr(ms) {
  t = { ...t, estado: "corriendo", total: ms, fin: Date.now() + ms, restante: 0 };
  contexto(); // desbloquea el audio ahora (con el clic) para poder sonar al final
  arrancar();
}
function empezar(min) {
  t = { ...t, rutina: null, paso: 0, hecho: 0 };
  dejarDeParpadear();
  correr(Math.round(min * 60000));
  refrescar();
}
/** Empieza una rutina guardada (por id). Se copia: si la editas mientras corre, no cambia la sesión. */
export function empezarRutina(id) {
  const r = obtener(id);
  if (!r) return false;
  setPref("tempoInstrumento", r.instrumento);
  t = { ...t, rutina: r, paso: 0, hecho: 0 };
  dejarDeParpadear();
  correr(r.ejercicios[0].min * 60000);
  refrescar();
  setTimeout(abrir); // después del clic que lo pidió (si no, el «clic fuera» lo cerraría enseguida)
  return true;
}
function arrancar() {
  clearInterval(intervalo);
  intervalo = setInterval(tic, 1000);
}
function tic() {
  if (t.estado === "corriendo" && Date.now() >= t.fin) { finDeTramo(true); return; }
  actualizarNumeros();
  if (t.estado !== "corriendo") clearInterval(intervalo);
}
/** Se acabó el tiempo del ejercicio (o de la sesión libre). */
function finDeTramo(conAviso) {
  clearInterval(intervalo);
  if (t.rutina) t = { ...t, hecho: t.hecho + t.total };
  if (t.rutina && t.paso < nEj() - 1) {
    t = { ...t, estado: "espera", restante: 0 };
    refrescar();
    if (!conAviso) return;
    abrir();
    aviso();
    avisarSistema(`Terminó «${ejercicio().nombre}»`, `Sigue: ${ejercicio(t.paso + 1).nombre} (${durTxt(ejercicio(t.paso + 1).min)})`);
    parpadearTitulo("⏰ Siguiente ejercicio");
    return;
  }
  terminar(conAviso);
}
function terminar(conAviso) {
  clearInterval(intervalo);
  t = { ...t, estado: "terminado", restante: 0 };
  refrescar();
  if (!conAviso) return;
  abrir();
  campana();
  const min = Math.max(1, Math.round((t.rutina ? t.hecho : t.total) / 60000));
  avisarSistema(t.rutina ? `¡Terminaste «${t.rutina.nombre}»!` : "¡Tiempo de práctica terminado!", `${durTxt(min)} de estudio. Buen trabajo.`);
  parpadearTitulo("⏰ ¡Tiempo!");
}
function cambiar(accion) {
  if (accion === "pausa" && t.estado === "corriendo") { t = { ...t, estado: "pausado", restante: restante() }; clearInterval(intervalo); }
  else if (accion === "seguir" && t.estado === "pausado") { t = { ...t, estado: "corriendo", fin: Date.now() + t.restante }; arrancar(); }
  else if (accion === "siguiente" && t.estado === "espera") { dejarDeParpadear(); t = { ...t, paso: t.paso + 1 }; correr(ejercicio().min * 60000); }
  else if (accion === "saltar" && t.rutina && (t.estado === "corriendo" || t.estado === "pausado")) {
    clearInterval(intervalo);
    t = { ...t, hecho: t.hecho + (t.total - restante()) };
    if (t.paso < nEj() - 1) { t = { ...t, paso: t.paso + 1 }; correr(ejercicio().min * 60000); }
    else { terminar(false); return; }
  } else if (accion === "mas5") {
    if (t.estado === "terminado") { t = { ...t, rutina: null, paso: 0, hecho: 0 }; correr(5 * 60000); dejarDeParpadear(); }
    else if (t.estado === "espera") { dejarDeParpadear(); correr(5 * 60000); } // 5 min más del mismo ejercicio
    else if (t.estado === "pausado") t = { ...t, restante: t.restante + 5 * 60000, total: t.total + 5 * 60000 };
    else t = { ...t, fin: t.fin + 5 * 60000, total: t.total + 5 * 60000 };
  } else if (accion === "parar" || accion === "listo" || accion === "otra") {
    t = { ...t, estado: "parado", rutina: null, paso: 0, hecho: 0 };
    clearInterval(intervalo);
    dejarDeParpadear();
  }
  refrescar();
  if (accion === "listo") cerrar(true);
}

function nota(c, f, ti, dur, vol) {
  const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), g2 = c.createGain();
  o.type = "sine"; o.frequency.value = f;
  o2.type = "sine"; o2.frequency.value = f * 2.76; // parcial inarmónico: suena a campana
  g2.gain.value = 0.18;
  g.gain.setValueAtTime(0.0001, ti);
  g.gain.exponentialRampToValueAtTime(vol, ti + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ti + dur);
  o.connect(g); o2.connect(g2).connect(g); g.connect(c.destination);
  o.start(ti); o2.start(ti); o.stop(ti + dur + 0.1); o2.stop(ti + dur + 0.1);
}
/** Final: tres campanadas suaves (Do–Mi–Sol), dos veces. */
function campana() {
  try {
    const c = contexto(), t0 = c.currentTime + 0.05;
    [0, 1.6].forEach((r) => [523.25, 659.25, 783.99].forEach((f, i) => nota(c, f, t0 + r + i * 0.22, 1.4, 0.32)));
  } catch { /* sin audio */ }
}
/** Fin de un ejercicio: dos notas que suben (Sol–Do), distinto de la campana final. */
function aviso() {
  try {
    const c = contexto(), t0 = c.currentTime + 0.05;
    [0, 0.9].forEach((r) => { nota(c, 783.99, t0 + r, 0.9, 0.3); nota(c, 1046.5, t0 + r + 0.18, 1.1, 0.3); });
  } catch { /* sin audio */ }
}

function avisarSistema(titulo, cuerpo) {
  if (!t.avisar || !("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const n = new Notification(titulo, { body: cuerpo, tag: "atril-temporizador" });
    n.onclick = () => { window.focus(); n.close(); };
  } catch { /* algunos navegadores solo permiten notificaciones desde un service worker */ }
}

function parpadearTitulo(texto) {
  dejarDeParpadear();
  let on = false;
  parpadeo = setInterval(() => { on = !on; document.title = on ? texto : TITULO; }, 1000);
}
function dejarDeParpadear() {
  clearInterval(parpadeo);
  parpadeo = null;
  document.title = TITULO;
}

// ---------------------------------------------------------------- Abrir y cerrar
function abrir() {
  pintarMenu();
  menu.hidden = false;
  btn.setAttribute("aria-expanded", "true");
}
function cerrar(devolverFoco = false) {
  menu.hidden = true;
  btn.setAttribute("aria-expanded", "false");
  if (t.estado === "terminado" || t.estado === "espera") dejarDeParpadear();
  if (devolverFoco) btn.focus();
}

btn.addEventListener("click", () => (menu.hidden ? abrir() : cerrar()));
menu.addEventListener("click", (e) => {
  const chip = e.target.closest("[data-min]");
  if (chip) { empezar(Number(chip.dataset.min)); return; }
  const r = e.target.closest("[data-rutina]");
  if (r) { empezarRutina(r.dataset.rutina); return; }
  const inst = e.target.closest("[data-inst]");
  if (inst) { setPref("tempoInstrumento", inst.dataset.inst); pintarMenu(); return; }
  if (e.target.closest("a[href]")) { cerrar(); return; } // enlaces: Prácticas o el material del ejercicio
  const a = e.target.closest("button[data-t]");
  if (a) cambiar(a.dataset.t);
});
menu.addEventListener("submit", (e) => {
  e.preventDefault();
  const min = Number(new FormData(e.target).get("min"));
  if (min >= 1 && min <= 600) empezar(min);
  else e.target.querySelector("input").focus();
});
menu.addEventListener("change", async (e) => {
  if (e.target.dataset.t !== "notif") return;
  t.avisar = e.target.checked;
  if (t.avisar && Notification.permission === "default") {
    const p = await Notification.requestPermission();
    if (p !== "granted") { t.avisar = false; e.target.checked = false; }
  } else if (t.avisar && Notification.permission === "denied") {
    t.avisar = false;
    e.target.checked = false;
    e.target.closest("label").insertAdjacentHTML("afterend", '<p class="tempo-ayuda">El navegador tiene bloqueadas las notificaciones de esta web.</p>');
  }
  guardar();
});
// «Clic fuera»: se mira la ruta del clic (el botón pulsado puede haberse quitado al redibujar el menú).
document.addEventListener("click", (e) => { if (!menu.hidden && !e.composedPath().includes(raiz)) cerrar(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) cerrar(true); });
// Al volver a la pestaña (los temporizadores del navegador se frenan en segundo plano), poner al día.
document.addEventListener("visibilitychange", () => { if (!document.hidden) tic(); });
// Si cambian las rutinas (en Prácticas) con el menú abierto en «parado», se redibuja la lista.
window.addEventListener(EVENTO, () => { if (!menu.hidden && t.estado === "parado") pintarMenu(); });
// Otra pestaña cambió el temporizador: se toma su estado.
window.addEventListener("storage", (e) => {
  if (e.key !== CLAVE) return;
  const nuevo = leer();
  if (!nuevo) return;
  t = nuevo;
  if (t.estado === "corriendo") arrancar(); else clearInterval(intervalo);
  pintarBoton();
  if (!menu.hidden) pintarMenu();
});

// ---------------------------------------------------------------- Arranque
t = { rutina: null, paso: 0, hecho: 0, ...t };
document.getElementById("btn-tema")?.before(raiz);
if (t.estado === "corriendo") {
  if (Date.now() >= t.fin) {
    // Terminó mientras la web estaba cerrada: se muestra, pero sin sonar si fue hace rato.
    finDeTramo(Date.now() - t.fin < 60000);
  } else {
    arrancar();
    // Tras recargar, el navegador no deja sonar audio hasta que tocas la página: se reactiva con el
    // primer clic o tecla, para que el aviso sí suene.
    const desbloquear = () => { contexto(); removeEventListener("pointerdown", desbloquear, true); removeEventListener("keydown", desbloquear, true); };
    addEventListener("pointerdown", desbloquear, true);
    addEventListener("keydown", desbloquear, true);
  }
}
pintarBoton();
