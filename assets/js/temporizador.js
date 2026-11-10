// Temporizador de práctica: un botón con flecha en la cabecera abre un pequeño menú con
// duraciones rápidas (20, 30, 45 min, 1 h) o una a medida. Sigue contando aunque cambies de página
// o recargues (guarda la hora de fin), y al terminar avisa con sonido, el título de la pestaña
// y, si lo permites, una notificación del sistema.
import { contexto } from "./audio.js";
import { icono } from "./iconos.js";

const CLAVE = "atril:temporizador";
const PRESETS = [20, 30, 45, 60];
const TITULO = document.title;

// estado: parado | corriendo | pausado | terminado
let t = leer() || { estado: "parado", total: 0, fin: 0, restante: 0, avisar: false };
let intervalo = null, parpadeo = null;

function leer() { try { return JSON.parse(localStorage.getItem(CLAVE)); } catch { return null; } }
function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(t)); } catch { /* sin almacenamiento */ } }

const restante = () => (t.estado === "corriendo" ? Math.max(0, t.fin - Date.now()) : t.estado === "pausado" ? t.restante : 0);
function reloj(ms) {
  const s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}` : `${m}:${String(ss).padStart(2, "0")}`;
}
const durTxt = (min) => (min >= 60 && min % 60 === 0 ? `${min / 60} h` : min > 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`);

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
  txt.textContent = t.estado === "corriendo" || t.estado === "pausado" ? reloj(ms) : t.estado === "terminado" ? "¡Tiempo!" : "";
  btn.classList.toggle("activo", t.estado === "corriendo");
  btn.classList.toggle("pausado", t.estado === "pausado");
  btn.classList.toggle("terminado", t.estado === "terminado");
  btn.setAttribute("aria-label", t.estado === "parado" ? "Temporizador de práctica" : `Temporizador: ${t.estado === "terminado" ? "terminado" : `quedan ${reloj(ms)}`}`);
}

function pintarMenu() {
  const est = raiz.querySelector(".tempo-estado");
  if (t.estado === "parado") {
    est.textContent = "";
    vista.innerHTML = `
      <p class="tempo-ayuda">¿Cuánto vas a practicar?</p>
      <div class="tempo-presets">${PRESETS.map((m) => `<button type="button" class="tempo-chip" data-min="${m}">${durTxt(m)}</button>`).join("")}</div>
      <form class="tempo-otro">
        <label>Otro <input type="number" name="min" min="1" max="600" step="1" placeholder="15" inputmode="numeric"> min</label>
        <button type="submit" class="btn-mini">Empezar</button>
      </form>
      ${"Notification" in window ? `<label class="tempo-notif"><input type="checkbox" data-t="notif" ${t.avisar ? "checked" : ""}> Avisar también con una notificación</label>` : ""}`;
    return;
  }
  if (t.estado === "terminado") {
    est.textContent = "";
    vista.innerHTML = `
      <div class="tempo-fin"><span class="tempo-fin-ico">${icono("check")}</span>
        <div><b>¡Terminaste tu práctica!</b><small>${durTxt(Math.round(t.total / 60000))} de estudio</small></div></div>
      <div class="tempo-acciones">
        <button type="button" class="btn-mini" data-t="mas5">+5 min</button>
        <button type="button" class="btn-mini" data-t="otra">Otra sesión</button>
        <button type="button" class="btn-mini primario" data-t="listo">Listo</button>
      </div>`;
    return;
  }
  const ms = restante(), pct = t.total ? 100 * (1 - ms / t.total) : 0;
  est.textContent = t.estado === "pausado" ? "en pausa" : `de ${durTxt(Math.round(t.total / 60000))}`;
  vista.innerHTML = `
    <div class="tempo-grande" aria-live="off">${reloj(ms)}</div>
    <div class="tempo-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><i style="width:${pct}%"></i></div>
    <p class="tempo-ayuda">${t.estado === "corriendo" ? `Termina a las ${new Date(t.fin).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}` : "Pausado"}</p>
    <div class="tempo-acciones">
      ${t.estado === "corriendo" ? `<button type="button" class="btn-mini" data-t="pausa">${icono("pausa")} Pausa</button>` : `<button type="button" class="btn-mini primario" data-t="seguir">${icono("play")} Seguir</button>`}
      <button type="button" class="btn-mini" data-t="mas5">+5 min</button>
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

// ---------------------------------------------------------------- Lógica
function empezar(min) {
  const ms = Math.round(min * 60000);
  t = { ...t, estado: "corriendo", total: ms, fin: Date.now() + ms, restante: 0 };
  contexto(); // desbloquea el audio ahora (con el clic) para poder sonar al final
  guardar();
  arrancar();
  pintarMenu();
  pintarBoton();
}
function arrancar() {
  clearInterval(intervalo);
  intervalo = setInterval(tic, 1000);
}
function tic() {
  if (t.estado === "corriendo" && Date.now() >= t.fin) { terminar(true); return; }
  actualizarNumeros();
  if (t.estado !== "corriendo") clearInterval(intervalo);
}
function terminar(conAviso) {
  clearInterval(intervalo);
  t = { ...t, estado: "terminado", restante: 0 };
  guardar();
  pintarBoton();
  pintarMenu();
  if (!conAviso) return;
  abrir();
  campana();
  avisarSistema();
  parpadearTitulo();
}
function cambiar(accion) {
  if (accion === "pausa" && t.estado === "corriendo") { t = { ...t, estado: "pausado", restante: restante() }; clearInterval(intervalo); }
  else if (accion === "seguir" && t.estado === "pausado") { t = { ...t, estado: "corriendo", fin: Date.now() + t.restante }; arrancar(); }
  else if (accion === "mas5") {
    if (t.estado === "terminado") { t = { ...t, estado: "corriendo", total: 5 * 60000, fin: Date.now() + 5 * 60000 }; arrancar(); dejarDeParpadear(); }
    else if (t.estado === "pausado") t = { ...t, restante: t.restante + 5 * 60000, total: t.total + 5 * 60000 };
    else t = { ...t, fin: t.fin + 5 * 60000, total: t.total + 5 * 60000 };
  } else if (accion === "parar" || accion === "listo" || accion === "otra") { t = { ...t, estado: "parado" }; clearInterval(intervalo); dejarDeParpadear(); }
  guardar();
  pintarMenu();
  pintarBoton();
  if (accion === "listo") cerrar(true);
}

/** Tres campanadas suaves (Do–Mi–Sol), dos veces. */
function campana() {
  try {
    const c = contexto();
    const t0 = c.currentTime + 0.05;
    [0, 1.6].forEach((r) => [523.25, 659.25, 783.99].forEach((f, i) => {
      const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain();
      o.type = "sine"; o.frequency.value = f;
      o2.type = "sine"; o2.frequency.value = f * 2.76; // parcial inarmónico: suena a campana
      const g2 = c.createGain(); g2.gain.value = 0.18;
      const ti = t0 + r + i * 0.22;
      g.gain.setValueAtTime(0.0001, ti);
      g.gain.exponentialRampToValueAtTime(0.32, ti + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ti + 1.4);
      o.connect(g); o2.connect(g2).connect(g); g.connect(c.destination);
      o.start(ti); o2.start(ti); o.stop(ti + 1.5); o2.stop(ti + 1.5);
    }));
  } catch { /* sin audio */ }
}

function avisarSistema() {
  if (!t.avisar || !("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const n = new Notification("¡Tiempo de práctica terminado!", { body: `${durTxt(Math.round(t.total / 60000))} de estudio. Buen trabajo.`, tag: "atril-temporizador" });
    n.onclick = () => { window.focus(); n.close(); };
  } catch { /* algunos navegadores solo permiten notificaciones desde un service worker */ }
}

function parpadearTitulo() {
  dejarDeParpadear();
  let on = false;
  parpadeo = setInterval(() => { on = !on; document.title = on ? "⏰ ¡Tiempo!" : TITULO; }, 1000);
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
  if (t.estado === "terminado") dejarDeParpadear();
  if (devolverFoco) btn.focus();
}

btn.addEventListener("click", () => (menu.hidden ? abrir() : cerrar()));
menu.addEventListener("click", (e) => {
  const chip = e.target.closest("[data-min]");
  if (chip) { empezar(Number(chip.dataset.min)); return; }
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

// ---------------------------------------------------------------- Arranque
document.getElementById("btn-tema")?.before(raiz);
if (t.estado === "corriendo") {
  if (Date.now() >= t.fin) {
    // Terminó mientras la web estaba cerrada: se muestra, pero sin sonar si fue hace rato.
    terminar(Date.now() - t.fin < 60000);
  } else {
    arrancar();
    // Tras recargar, el navegador no deja sonar audio hasta que tocas la página: se reactiva con el
    // primer clic o tecla, para que la campana del final sí suene.
    const desbloquear = () => { contexto(); removeEventListener("pointerdown", desbloquear, true); removeEventListener("keydown", desbloquear, true); };
    addEventListener("pointerdown", desbloquear, true);
    addEventListener("keydown", desbloquear, true);
  }
}
pintarBoton();
