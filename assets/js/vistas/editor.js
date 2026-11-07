// Editor de tablaturas: escribir o pegar, convertir notaciones, previsualizar, escuchar y guardar.
import { leerTab, convertirNotacion, estadisticas, PLANTILLA } from "../tab.js";
import { renderTab, leyendaHTML, esc } from "../render.js";
import { Reproductor } from "../reproductor.js";
import { normalizarTono, nombreTono } from "../notas.js";
import { icono } from "../iconos.js";

const BORRADOR = "atril:editor:borrador";

function leerBorrador() {
  try { return localStorage.getItem(BORRADOR); } catch { return null; }
}
function guardarBorrador(t) {
  try { localStorage.setItem(BORRADOR, t); } catch { /* nada */ }
}

function nombreCarpeta(titulo) {
  return (titulo || "MiCancion")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]+/g, " ").trim()
    .split(/\s+/).map((p) => p[0].toUpperCase() + p.slice(1)).join("") || "MiCancion";
}

function repoGitHub() {
  const m = location.hostname.match(/^([^.]+)\.github\.io$/);
  if (!m) return null;
  const repo = location.pathname.split("/").filter(Boolean)[0] || `${m[1]}.github.io`;
  return { usuario: m[1], repo };
}

export async function mostrar(main) {
  main.innerHTML = `
    <h1>Editor de tablaturas</h1>
    <p class="sub">Escribe o pega una tablatura. Si viene con otra notación — <code>(4)</code> para aspirar, <code>+4</code> para soplar, <code>6b</code> para bend, con la letra encima — pulsa <b>Convertir</b>.</p>
    <div class="editor">
      <div class="editor-izq">
        <div class="barra-herr">
          <button type="button" class="btn" data-accion="convertir" title="Convierte (4)→-4, +4→4, 6b→-6', quita la letra">Convertir notación</button>
          <button type="button" class="btn" data-accion="plantilla">Plantilla</button>
          <button type="button" class="btn" data-accion="copiar">Copiar</button>
          <button type="button" class="btn" data-accion="descargar">${icono("descargar")}.tab</button>
        </div>
        <textarea id="fuente" spellcheck="false" aria-label="Texto de la tablatura"></textarea>
        <div class="mensaje" id="mensaje" role="status"></div>
        <details class="ayuda">
          <summary>Chuleta del formato</summary>
          <table>
            <tr><td><code>4</code> / <code>-4</code></td><td>soplar / aspirar el hoyo 4</td></tr>
            <tr><td><code>-4'</code> <code>-3''</code></td><td>bend de medio tono / de un tono (también vale <code>/</code>)</td></tr>
            <tr><td><code>44</code> <code>-2-2</code> <code>456</code></td><td>notas rápidas (juntas, sin espacio)</td></tr>
            <tr><td><code>_</code> &nbsp; <code>|</code></td><td>pausa · barra de compás</td></tr>
            <tr><td><code>[Parte A | detalle]</code></td><td>empieza una sección</td></tr>
            <tr><td><code>&gt; texto</code></td><td>un comentario visible</td></tr>
            <tr><td><code># texto</code></td><td>una nota oculta</td></tr>
            <tr><td><code>titulo:</code> <code>subtitulo:</code> <code>armonica:</code> <code>tonalidad:</code></td><td>cabecera (antes de la primera sección)</td></tr>
          </table>
        </details>
      </div>
      <div class="editor-der">
        <div class="vista-cab">
          <div><h2 id="v-titulo"></h2><p class="sub" id="v-meta"></p></div>
          <button type="button" class="btn-play" data-accion="play">${icono("play")}<span>Escuchar</span></button>
        </div>
        <div id="v-errores"></div>
        <div id="v-leyenda"></div>
        <div class="tab" id="v-tab"></div>
        <section class="publicar">
          <h2>Añadirla a la web</h2>
          <ol>
            <li>Guarda el archivo como <code id="ruta"></code></li>
            <li>Haz commit y push. La web se actualiza sola en uno o dos minutos.</li>
          </ol>
          <a class="btn" id="crear-github" target="_blank" rel="noopener" hidden>${icono("github")}Crear el archivo en GitHub</a>
        </section>
      </div>
    </div>`;

  const $ = (s) => main.querySelector(s);
  const fuente = $("#fuente");
  fuente.value = leerBorrador() || PLANTILLA;
  let rep = null;
  const gh = repoGitHub();

  function mensaje(txt, tipo = "") {
    const m = $("#mensaje");
    m.textContent = txt;
    m.className = `mensaje ${tipo}`;
  }

  function actualizar() {
    rep?.pausar();
    const texto = fuente.value;
    guardarBorrador(texto);
    const tab = leerTab(texto);
    const tono = normalizarTono(tab.meta.armonica || "C");
    const st = estadisticas(tab);
    $("#v-titulo").textContent = tab.meta.titulo || "Sin título";
    $("#v-meta").textContent = [tab.meta.subtitulo, `Armónica en ${nombreTono(tono)}`, tab.meta.tonalidad, st && `${st.notas} notas · nivel ${st.nivel}/5 · ${st.bends ? st.bends + " bends" : "sin bends"}`].filter(Boolean).join(" · ");
    $("#v-errores").innerHTML = tab.errores.length
      ? `<div class="aviso"><b>Revisa:</b><ul>${tab.errores.map((e) => `<li>Línea ${e.linea}: ${esc(e.msg)}</li>`).join("")}</ul></div>` : "";
    $("#v-leyenda").innerHTML = leyendaHTML(tono);
    const { eventos } = renderTab(tab, $("#v-tab"), { tono });
    rep = new Reproductor({
      eventos, tono,
      alPaso: (i) => {
        $("#v-tab .activa")?.classList.remove("activa");
        if (i !== null) $(`#v-tab [data-i="${i}"]`)?.classList.add("activa");
      },
      alEstado: (s) => {
        $('[data-accion="play"]').innerHTML = s ? `${icono("pausa")}<span>Pausa</span>` : `${icono("play")}<span>Escuchar</span>`;
      },
    });
    rep.tempo = 90;
    const carpeta = nombreCarpeta(tab.meta.titulo);
    const ruta = `Armonica/${carpeta}/02_editable/${carpeta}.tab`;
    $("#ruta").textContent = ruta;
    if (gh) {
      const a = $("#crear-github");
      a.hidden = false;
      a.href = `https://github.com/${gh.usuario}/${gh.repo}/new/main/Armonica/${carpeta}/02_editable?filename=${encodeURIComponent(carpeta + ".tab")}&value=${encodeURIComponent(texto)}`;
    }
  }

  let espera = null;
  fuente.addEventListener("input", () => { clearTimeout(espera); espera = setTimeout(actualizar, 250); });

  main.addEventListener("click", async (e) => {
    const chip = e.target.closest("#v-tab .n[data-i]");
    if (chip) { rep.pausar(); rep.irA(Number(chip.dataset.i)); return; }
    const b = e.target.closest("[data-accion]");
    if (!b) return;
    switch (b.dataset.accion) {
      case "convertir": {
        const r = convertirNotacion(fuente.value);
        fuente.value = r.texto;
        actualizar();
        mensaje(`Convertida.${r.quitadas ? ` Quité ${r.quitadas} línea(s) de letra.` : ""}${r.secciones ? ` Creé ${r.secciones} sección(es): revisa sus nombres.` : ""} Añade la cabecera (titulo:, armonica:…) si falta.`, "ok");
        break;
      }
      case "plantilla":
        if (fuente.value.trim() && !confirm("¿Reemplazar el texto actual por la plantilla?")) return;
        fuente.value = PLANTILLA;
        actualizar();
        break;
      case "copiar":
        try { await navigator.clipboard.writeText(fuente.value); mensaje("Copiado al portapapeles.", "ok"); }
        catch { fuente.select(); mensaje("Selecciona y copia con Ctrl+C."); }
        break;
      case "descargar": {
        const tab = leerTab(fuente.value);
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([fuente.value], { type: "text/plain;charset=utf-8" }));
        a.download = `${nombreCarpeta(tab.meta.titulo)}.tab`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        break;
      }
      case "play": rep.sonando ? rep.pausar() : rep.reproducir(); break;
    }
  });

  actualizar();
  return () => rep?.pausar();
}
