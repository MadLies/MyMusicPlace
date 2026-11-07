// Enrutador y arranque de la web.
import { icono } from "./iconos.js";
import { setPref } from "./progreso.js";

const main = document.getElementById("contenido");
let limpiezaActual = null;
let indice = null;

export async function cargarIndice() {
  if (!indice) {
    const r = await fetch("data/canciones.json", { cache: "no-cache" });
    if (!r.ok) throw new Error("No se encontró data/canciones.json. Ejecuta: python3 herramientas/generar_indice.py");
    indice = await r.json();
  }
  return indice;
}

const rutas = [
  { re: /^\/?$/, vista: () => import("./vistas/inicio.js"), nav: "inicio" },
  { re: /^\/armonica\/([^/]+)$/, vista: () => import("./vistas/cancion.js"), nav: "inicio" },
  { re: /^\/(piano|violin)\/([^/]+)$/, vista: () => import("./vistas/partitura.js"), nav: "inicio" },
  { re: /^\/guia$/, vista: () => import("./vistas/guia.js"), nav: "guia" },
  { re: /^\/afinador(?:\/(cromatico|armonica|violin))?$/, vista: () => import("./vistas/afinador.js"), nav: "afinador" },
  { re: /^\/metronomo$/, vista: () => import("./vistas/metronomo.js"), nav: "metronomo" },
  { re: /^\/notas(?:\/(armonica|violin))?$/, vista: () => import("./vistas/notas.js"), nav: "notas" },
  { re: /^\/editor$/, vista: () => import("./vistas/editor.js"), nav: "editor" },
  { re: /^\/fuentes$/, vista: () => import("./vistas/fuentes.js"), nav: "fuentes" },
];

let navegacion = 0;

async function navegar() {
  const ruta = decodeURIComponent(location.hash.replace(/^#/, "")) || "/";
  const r = rutas.find((x) => x.re.test(ruta));
  const esta = ++navegacion;
  limpiezaActual?.();
  limpiezaActual = null;
  document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("activo", r && a.dataset.nav === r.nav));
  // Cada vista recibe un contenedor nuevo: al cambiar de página se descarta junto con
  // todos sus manejadores de eventos (si no, los botones de una vista anterior seguían
  // reaccionando, p. ej. «Escuchar» reproducía otra canción de fondo).
  const vista = document.createElement("div");
  vista.className = "vista";
  main.replaceChildren(vista);
  if (!r) {
    vista.innerHTML = `<div class="vacio"><h1>No encontré esta página</h1><p><a href="#/">Volver a la biblioteca</a></p></div>`;
    return;
  }
  vista.innerHTML = '<p class="cargando">Cargando…</p>';
  try {
    const mod = await r.vista();
    const params = ruta.match(r.re).slice(1);
    const limpieza = (await mod.mostrar(vista, params)) || null;
    if (esta !== navegacion) { limpieza?.(); return; } // ya se navegó a otra página mientras cargaba
    limpiezaActual = limpieza;
  } catch (err) {
    console.error(err);
    if (esta !== navegacion) return;
    vista.innerHTML = `<div class="vacio"><h1>Algo salió mal</h1><p>${String(err.message || err)}</p><p><a href="#/">Volver a la biblioteca</a></p></div>`;
  }
  if (!location.hash.includes("?")) window.scrollTo(0, 0);
  main.focus({ preventScroll: true });
}

// Tema claro / oscuro.
const btnTema = document.getElementById("btn-tema");
function temaEfectivo() {
  return document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}
function pintarBotonTema() {
  btnTema.innerHTML = icono(temaEfectivo() === "dark" ? "sol" : "luna");
}
btnTema.addEventListener("click", () => {
  const nuevo = temaEfectivo() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = nuevo;
  setPref("tema", nuevo);
  pintarBotonTema();
});
pintarBotonTema();

// Enlace al repositorio cuando la web está publicada en GitHub Pages.
const m = location.hostname.match(/^([^.]+)\.github\.io$/);
if (m) {
  const repo = location.pathname.split("/").filter(Boolean)[0];
  const a = document.getElementById("enlace-repo");
  a.href = `https://github.com/${m[1]}/${repo || m[1] + ".github.io"}`;
  a.hidden = false;
}

window.addEventListener("hashchange", navegar);
navegar();
