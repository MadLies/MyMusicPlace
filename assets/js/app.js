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
  { re: /^\/afinador$/, vista: () => import("./vistas/afinador.js"), nav: "afinador" },
  { re: /^\/editor$/, vista: () => import("./vistas/editor.js"), nav: "editor" },
];

async function navegar() {
  const ruta = decodeURIComponent(location.hash.replace(/^#/, "")) || "/";
  const r = rutas.find((x) => x.re.test(ruta));
  limpiezaActual?.();
  limpiezaActual = null;
  document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("activo", r && a.dataset.nav === r.nav));
  if (!r) {
    main.innerHTML = `<div class="vacio"><h1>No encontré esta página</h1><p><a href="#/">Volver a la biblioteca</a></p></div>`;
    return;
  }
  main.innerHTML = '<p class="cargando">Cargando…</p>';
  try {
    const mod = await r.vista();
    const params = ruta.match(r.re).slice(1);
    limpiezaActual = (await mod.mostrar(main, params)) || null;
  } catch (err) {
    console.error(err);
    main.innerHTML = `<div class="vacio"><h1>Algo salió mal</h1><p>${String(err.message || err)}</p><p><a href="#/">Volver a la biblioteca</a></p></div>`;
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
