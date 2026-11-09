// Editor MIDI: piano roll, carriles de control, arreglo de pistas, tempo, lista de eventos,
// lecciones de MIDI, importar/exportar .mid y conexión con teclados MIDI (Web MIDI).
import {
  cancionNueva, pistaNueva, normalizar, nuevoId, ticksCompas, ticksPulso, posicion, segundosDeTick,
  finCancion, bpmEn, cifraMidi, nombreMidi,
} from "../midi/modelo.js";
import { INSTRUMENTOS, FAMILIAS, CANAL_PERCUSION, PERCUSION } from "../midi/gm.js";
import { escribirSMF, leerSMF, eventosPista, eventosDirector, describirMensaje, bytesHex } from "../midi/smf.js";
import { Motor } from "../midi/motor.js";
import { Sinte } from "../midi/sinte.js";
import { Rollo, Carril, CARRILES, TECLAS, prepararLienzo, colores } from "../midi/rollo.js";
import { desdeMusicXML, desdeTab } from "../midi/importar.js";
import { leccionesHTML, textoTecla, mensajeConstructor, bytesConstructorHTML, lineaMonitor } from "../midi/aprende.js";
import { cargarIndice } from "../app.js";
import { esc } from "../render.js";
import { icono } from "../iconos.js";
import { pref, setPref } from "../progreso.js";

const CLAVE = "atril:midi:cancion";
const REJILLAS = [
  ["1/1", "Redonda"], ["1/2", "Blanca"], ["1/4", "Negra"], ["1/8", "Corchea"], ["1/16", "Semicorchea"], ["1/32", "Fusa"],
  ["1/6", "Tresillo de negra"], ["1/12", "Tresillo de corchea"], ["1/24", "Tresillo de semicorchea"], ["0", "Sin rejilla"],
];
const PESTANAS = [["rollo", "Piano roll"], ["arreglo", "Arreglo"], ["tempo", "Tempo"], ["eventos", "Eventos"], ["aprende", "Aprende MIDI"]];
const TECLAS_PC = {
  KeyZ: 0, KeyS: 1, KeyX: 2, KeyD: 3, KeyC: 4, KeyV: 5, KeyG: 6, KeyB: 7, KeyH: 8, KeyN: 9, KeyJ: 10, KeyM: 11, Comma: 12,
  KeyQ: 12, Digit2: 13, KeyW: 14, Digit3: 15, KeyE: 16, KeyR: 17, Digit5: 18, KeyT: 19, Digit6: 20, KeyY: 21, Digit7: 22, KeyU: 23, KeyI: 24, Digit9: 25, KeyO: 26, Digit0: 27, KeyP: 28,
};

function cargar() {
  try {
    const t = localStorage.getItem(CLAVE);
    return t ? normalizar(JSON.parse(t)) : null;
  } catch { return null; }
}
const nombreArchivo = (s) => (s || "cancion").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "") || "cancion";
const tiempoTxt = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
function descargar(blob, nombre) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export async function mostrar(main) {
  const envoltura = main.closest("main");
  envoltura?.classList.add("ancho");

  const ed = {
    c: cargar() || cancionNueva(),
    pista: 0,
    sel: new Set(),
    herramienta: pref("midiHerramienta", "lapiz"),
    rejillaTxt: pref("midiRejilla", "1/8"),
    rejilla: 240,
    zx: 0.12, zy: 14, scrollX: 0, scrollY: 84,
    cabezal: 0, cabezalVivo: null, bucle: null,
    carril: "vel", verOtras: true, seguir: true,
    ultimaDur: null, ultimaVel: 100, teclasVivas: new Set(),
  };
  let pestana = pref("midiPestana", "rollo");
  let bucleActivo = false, grabando = false, fotoGrabacion = null, tecladoPC = false;
  let deshacer = [], rehacer = [], portapapeles = null, guardarTimer = null, raf = null, limiteEventos = 400;
  let midiAcceso = null;
  const vivas = new Map(); // nota → voz (notas que están sonando desde el teclado)
  const pendientes = new Map(); // nota → { tick, vel } al grabar
  const motor = new Motor({ alFin: () => { finReproduccion(); } });
  motor.metronomo = pref("midiMetronomo", false);

  const opcionesInstrumento = FAMILIAS.map((f, k) => `<optgroup label="${f}">${INSTRUMENTOS.slice(k * 8, k * 8 + 8).map((n, j) => `<option value="${k * 8 + j}">${k * 8 + j} · ${n}</option>`).join("")}</optgroup>`).join("");

  main.innerHTML = `
    <div class="midi" id="midi">
      <div class="midi-cab">
        <div>
          <h1 class="midi-h1">Editor MIDI</h1>
          <p class="sub">Dibuja notas, cambia instrumentos, mira los mensajes y los bytes de verdad, y descarga tu canción como archivo .mid.</p>
        </div>
        <div class="midi-titulo">
          <label class="campo">Canción <input id="m-nombre" class="m-nombre" maxlength="80"></label>
          <div class="sub" id="m-fuente"></div>
        </div>
      </div>

      <div class="midi-barra">
        <div class="menus">
          <div class="menu">
            <button type="button" class="btn menu-btn" data-menu="archivo" aria-haspopup="true" aria-expanded="false">Archivo ▾</button>
            <div class="menu-lista" data-lista="archivo" hidden>
              <button type="button" data-accion="nuevo">Nueva canción</button>
              <button type="button" data-accion="abrir">Abrir archivo .mid… <kbd>Ctrl+O</kbd></button>
              <button type="button" data-accion="biblioteca">Abrir de la biblioteca…</button>
              <hr>
              <button type="button" data-accion="descargar">Descargar .mid <kbd>Ctrl+S</kbd></button>
              <button type="button" data-accion="wav">Exportar audio (.wav)</button>
              <button type="button" data-accion="ver-bytes">Ver los bytes del archivo</button>
            </div>
          </div>
          <div class="menu">
            <button type="button" class="btn menu-btn" data-menu="editar" aria-haspopup="true" aria-expanded="false">Editar ▾</button>
            <div class="menu-lista" data-lista="editar" hidden>
              <button type="button" data-accion="deshacer">Deshacer <kbd>Ctrl+Z</kbd></button>
              <button type="button" data-accion="rehacer">Rehacer <kbd>Ctrl+Shift+Z</kbd></button>
              <hr>
              <button type="button" data-accion="cortar">Cortar <kbd>Ctrl+X</kbd></button>
              <button type="button" data-accion="copiar">Copiar <kbd>Ctrl+C</kbd></button>
              <button type="button" data-accion="pegar">Pegar en el cabezal <kbd>Ctrl+V</kbd></button>
              <button type="button" data-accion="eliminar">Eliminar <kbd>Supr</kbd></button>
              <button type="button" data-accion="duplicar">Duplicar <kbd>Ctrl+D</kbd></button>
              <hr>
              <button type="button" data-accion="todo">Seleccionar todo <kbd>Ctrl+A</kbd></button>
              <button type="button" data-accion="siguiente">Seleccionar siguiente <kbd>→</kbd></button>
              <button type="button" data-accion="anterior">Seleccionar anterior <kbd>←</kbd></button>
              <hr>
              <button type="button" data-accion="octava-arriba">+1 octava <kbd>Shift+↑</kbd></button>
              <button type="button" data-accion="octava-abajo">−1 octava <kbd>Shift+↓</kbd></button>
              <button type="button" data-accion="transponer">Transponer… <kbd>T</kbd></button>
              <button type="button" data-accion="cuantizar">Cuantizar a la rejilla <kbd>Q</kbd></button>
              <button type="button" data-accion="velocidad">Velocidad… </button>
            </div>
          </div>
          <button type="button" class="btn-icono" data-accion="deshacer" title="Deshacer (Ctrl+Z)" aria-label="Deshacer">${icono("deshacer")}</button>
          <button type="button" class="btn-icono" data-accion="rehacer" title="Rehacer (Ctrl+Shift+Z)" aria-label="Rehacer">${icono("rehacer")}</button>
        </div>
        <div class="segmentos midi-pestanas" role="tablist" aria-label="Vista">
          ${PESTANAS.map(([k, t]) => `<button type="button" role="tab" data-pestana-midi="${k}">${t}</button>`).join("")}
        </div>
        <button type="button" class="btn" data-accion="ayuda">Atajos</button>
      </div>

      <section data-panel-midi="rollo">
        <div class="pista-cab panel-fila">
          <label class="campo">Pista <select id="m-pista"></select></label>
          <label class="campo">Nombre <input id="m-pista-nombre" maxlength="40"></label>
          <label class="campo">Instrumento <select id="m-programa">${opcionesInstrumento}</select></label>
          <label class="campo">Canal <select id="m-canal">${Array.from({ length: 16 }, (_, i) => `<option value="${i}">${i + 1}${i === CANAL_PERCUSION ? " · percusión" : ""}</option>`).join("")}</select></label>
          <label class="campo">Vol <input id="m-vol" type="range" min="0" max="127"></label>
          <label class="campo">Pan <input id="m-pan" type="range" min="0" max="127"></label>
          <button type="button" class="btn-ms" data-ms="mute" title="Silenciar la pista">M</button>
          <button type="button" class="btn-ms" data-ms="solo" title="Escuchar solo esta pista">S</button>
        </div>
        <div class="rollo-herr panel-fila">
          <div class="segmentos" role="radiogroup" aria-label="Herramienta">
            <button type="button" role="radio" data-herr="lapiz" title="Lápiz (B)">${icono("lapiz")} Lápiz</button>
            <button type="button" role="radio" data-herr="seleccion" title="Selección (V)">${icono("seleccion")} Selección</button>
          </div>
          <label class="campo">Rejilla <select id="m-rejilla">${REJILLAS.map(([v, t]) => `<option value="${v}">${t}${v !== "0" ? ` (${v})` : ""}</option>`).join("")}</select></label>
          <label class="interruptor"><input type="checkbox" id="m-otras" checked> Ver otras pistas</label>
          <label class="interruptor"><input type="checkbox" id="m-seguir" checked> Seguir al reproducir</label>
          <span class="midi-zoom">
            <button type="button" class="btn-icono" data-zoom="x-" title="Alejar (Ctrl + rueda)" aria-label="Alejar">${icono("menos")}</button>
            <button type="button" class="btn-icono" data-zoom="x+" title="Acercar" aria-label="Acercar">${icono("mas")}</button>
            <button type="button" class="btn-icono txt" data-zoom="y-" title="Filas más bajas" aria-label="Filas más bajas">↕−</button>
            <button type="button" class="btn-icono txt" data-zoom="y+" title="Filas más altas" aria-label="Filas más altas">↕+</button>
          </span>
        </div>
        <div class="rollo-caja"><canvas id="m-rollo" class="lienzo-rollo" aria-label="Piano roll: notas de la pista"></canvas></div>
        <div class="rollo-estado" id="m-info-sel" aria-live="polite"></div>
        <input type="range" class="desplazar" id="m-desplazar" min="0" max="1000" value="0" aria-label="Desplazar en el tiempo">
        <div class="carril-tabs">
          <div class="segmentos" role="tablist" aria-label="Carril">
            ${["vel", "bend", 7, 10, 11, 64, 1].map((k) => `<button type="button" role="tab" data-carril="${k}">${CARRILES[k].nombre}</button>`).join("")}
          </div>
          <button type="button" class="btn" data-accion="limpiar-carril">Borrar este carril</button>
        </div>
        <div class="carril-caja"><canvas id="m-carril" class="lienzo-carril" aria-label="Carril de control"></canvas></div>
        <details class="ayuda-rollo"><summary>Cómo se usa</summary>
          <ul>
            <li><b>Lápiz</b>: clic en la rejilla crea una nota; si arrastras, la alargas. Arrastra una nota para moverla y su borde derecho para cambiar la duración. Doble clic o clic derecho la borra.</li>
            <li><b>Selección</b>: arrastra para seleccionar varias notas (Mayús añade). Luego muévelas, cópialas o cámbialas desde el menú Editar.</li>
            <li><b>Regla</b> (arriba): clic para mover el cabezal; con Mayús y arrastrando, marcas el tramo del bucle.</li>
            <li><b>Teclado</b> de la izquierda: clic para oír la nota (y grabarla si estás grabando).</li>
            <li><b>Rueda</b>: subir y bajar; Mayús + rueda: avanzar en el tiempo; Ctrl + rueda: zoom. En el celular, dos dedos para desplazarte.</li>
            <li><b>Carriles</b>: dibuja la velocidad de las notas o los controladores. Clic derecho borra un punto. Si hay notas seleccionadas, la velocidad solo cambia en ellas.</li>
          </ul>
        </details>
      </section>

      <section data-panel-midi="arreglo" hidden>
        <div class="panel-fila">
          <button type="button" class="btn" data-accion="pista-nueva">${icono("mas")} Pista</button>
          <button type="button" class="btn" data-accion="pista-percusion">${icono("mas")} Pista de percusión</button>
          <span class="sub">Toca una pista para editarla en el piano roll. M = silenciar, S = escuchar solo esa.</span>
        </div>
        <div class="arreglo" id="m-arreglo"></div>
      </section>

      <section data-panel-midi="tempo" hidden>
        <div class="panel-fila">
          <label class="campo">Compás <input id="t-num" type="number" min="1" max="32" class="corto"> / <select id="t-den">${[2, 4, 8, 16].map((d) => `<option>${d}</option>`).join("")}</select></label>
          <label class="campo">Tempo inicial <input id="t-bpm0" type="number" min="20" max="300" step="1" class="corto"> BPM</label>
          <button type="button" class="btn" data-accion="tempo-limpiar">Quitar los cambios de tempo</button>
        </div>
        <div class="carril-caja caja-tempo"><canvas id="m-tempo" class="lienzo-tempo" aria-label="Tempo a lo largo de la canción"></canvas></div>
        <input type="range" class="desplazar" id="t-desplazar" min="0" max="1000" value="0" aria-label="Desplazar en el tiempo">
        <p class="sub">Dibuja para añadir cambios de tempo (cada punto es un evento <code>FF 51</code>, en microsegundos por negra). Clic derecho borra un punto. Las líneas verticales son los compases.</p>
        <div id="t-lista"></div>
      </section>

      <section data-panel-midi="eventos" hidden>
        <div class="panel-fila">
          <label class="campo">Pista <select id="ev-pista"></select></label>
          <button type="button" class="btn" data-accion="ver-bytes">Ver los bytes del archivo</button>
          <span class="sub" id="ev-cuenta"></span>
        </div>
        <p class="sub">Así queda la pista dentro del archivo .mid: cada evento con su delta (ticks desde el anterior) y sus bytes. Al final de cada pista va el evento <code>FF 2F 00</code>.</p>
        <div class="tabla-eventos-caja" id="ev-tabla"></div>
      </section>

      <section data-panel-midi="aprende" hidden>${leccionesHTML()}</section>

      <div class="midi-transporte" role="toolbar" aria-label="Transporte">
        <div class="tr-grupo">
          <button type="button" class="btn-icono" data-accion="al-inicio" title="Al principio (Inicio)" aria-label="Al principio">${icono("inicio")}</button>
          <button type="button" class="btn-icono" data-accion="parar" title="Parar" aria-label="Parar">${icono("stop")}</button>
          <button type="button" class="btn-icono tr-play" data-accion="tocar" title="Reproducir / pausa (Espacio)" aria-label="Reproducir">${icono("play")}</button>
          <button type="button" class="btn-icono" data-accion="compas-sig" title="Siguiente compás" aria-label="Siguiente compás">${icono("avanzar")}</button>
          <button type="button" class="btn-icono tr-grabar" data-accion="grabar" title="Grabar desde un teclado MIDI, el teclado del PC o el de la pantalla" aria-label="Grabar">${icono("grabar")}</button>
          <button type="button" class="btn-icono" data-accion="bucle" title="Bucle (Mayús + arrastrar en la regla para marcarlo)" aria-label="Bucle">${icono("repetir")}</button>
          <button type="button" class="btn-icono" data-accion="metronomo" title="Metrónomo" aria-label="Metrónomo">${icono("metronomo")}</button>
        </div>
        <div class="tr-grupo">
          <label class="campo">BPM <input id="tr-bpm" type="number" min="20" max="300" class="corto"></label>
          <span class="tr-pos"><b id="tr-pos">001:01:000</b><small id="tr-tiempo">0:00.0</small></span>
        </div>
        <div class="tr-grupo">
          <button type="button" class="btn" data-accion="conectar">${icono("cable")} Conectar MIDI</button>
          <label class="campo" id="tr-salida-et" hidden>Salida <select id="tr-salida"></select></label>
          <button type="button" class="btn" data-accion="teclado-pc" aria-pressed="false" title="Las filas Z S X D C… y Q 2 W 3 E… tocan dos octavas">${icono("teclado")} Teclado del PC</button>
        </div>
      </div>
      <input type="file" id="m-archivo" accept=".mid,.midi,audio/midi,audio/x-midi" hidden>
      <dialog class="dialogo" id="m-dialogo"></dialog>
      <div class="aviso-flotante" id="m-aviso" role="status" hidden></div>
    </div>`;

  const $ = (s) => main.querySelector(s);
  const p = () => ed.c.pistas[ed.pista];

  // ---------------------------------------------------------------- Rejilla
  function fijarRejilla() {
    const [a, b] = ed.rejillaTxt.split("/").map(Number);
    ed.rejilla = ed.rejillaTxt === "0" ? 1 : Math.round(ed.c.ppq * 4 * a / b);
  }
  fijarRejilla();

  // ---------------------------------------------------------------- Historial y guardado
  const antes = () => JSON.stringify(ed.c);
  function guardar() {
    clearTimeout(guardarTimer);
    guardarTimer = setTimeout(() => { try { localStorage.setItem(CLAVE, JSON.stringify(ed.c)); } catch { /* sin espacio o bloqueado */ } }, 500);
  }
  function despues(foto) {
    for (const q of ed.c.pistas) q.notas.sort((a, b) => a.tick - b.tick || a.nota - b.nota);
    if (JSON.stringify(ed.c) === foto) { refrescar(); return; }
    deshacer.push(foto);
    if (deshacer.length > 200) deshacer.shift();
    rehacer = [];
    guardar();
    pintarTodo();
  }
  function restaurar(foto) { ed.c = JSON.parse(foto); pintarTodo(); }
  function cambiar(fn) { const f = antes(); fn(); despues(f); }
  function deshacerUno(pila, otra) {
    if (!pila.length) { avisar("No hay nada que " + (pila === deshacer ? "deshacer" : "rehacer")); return; }
    otra.push(antes());
    ed.c = JSON.parse(pila.pop());
    ed.pista = Math.min(ed.pista, ed.c.pistas.length - 1);
    guardar();
    pintarTodo();
  }

  let avisoTimer = null;
  function avisar(txt, ms = 2600) {
    const a = $("#m-aviso");
    a.textContent = txt;
    a.hidden = false;
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(() => { a.hidden = true; }, ms);
  }

  // ---------------------------------------------------------------- Lienzos
  const api = {
    antes, despues, restaurar, nuevoId,
    probar: (nota, vel = 100) => { if (p()) motor.probar(p(), nota, vel, 0.35); },
    tecla: (n, on) => { entradaNota(n, 100, on, "ratón"); return null; },
    moverCabezal: (t) => moverCabezal(t),
    seleccion: () => pintarInfoSel(),
    refrescar: (que) => { if (que === "bucle") pintarBotones(); if (que === "notas" || que === "carril") pintarInfoSel(); refrescar(); },
  };
  const rollo = new Rollo($("#m-rollo"), ed, api);
  const carril = new Carril($("#m-carril"), ed, api);
  const carrilTempo = new Carril($("#m-tempo"), ed, { ...api, despues: (f) => { despues(f); pintarTempo(); } }, "tempo");

  let pendienteDibujo = false;
  function refrescar() {
    if (pendienteDibujo) return;
    pendienteDibujo = true;
    requestAnimationFrame(() => {
      pendienteDibujo = false;
      if (pestana === "rollo") { rollo.dibujar(); carril.dibujar(); }
      if (pestana === "tempo") carrilTempo.dibujar();
      if (pestana === "arreglo") dibujarMinis();
      sincronizarDesplazar();
    });
  }
  const ro = new ResizeObserver(() => refrescar());
  [$("#m-rollo"), $("#m-carril"), $("#m-tempo")].forEach((cv) => ro.observe(cv));

  function sincronizarDesplazar() {
    const max = Math.max(finCancion(ed.c) + ticksCompas(ed.c) * 8, ed.scrollX + ticksCompas(ed.c) * 4);
    for (const r of [$("#m-desplazar"), $("#t-desplazar")]) { r.max = String(Math.round(max)); r.value = String(Math.round(ed.scrollX)); }
  }

  // ---------------------------------------------------------------- Pintar la interfaz
  function pintarTodo() {
    ed.pista = Math.max(0, Math.min(ed.pista, ed.c.pistas.length - 1));
    const vivosIds = new Set(p()?.notas.map((n) => n.id));
    for (const id of [...ed.sel]) if (!vivosIds.has(id)) ed.sel.delete(id);
    $("#m-nombre").value = ed.c.nombre;
    $("#m-fuente").innerHTML = ed.c.fuente ? `Fuente: ${esc(ed.c.fuente)}` : "";
    pintarCabPista();
    pintarBotones();
    pintarInfoSel();
    if (pestana === "arreglo") pintarArreglo();
    if (pestana === "tempo") pintarTempo();
    if (pestana === "eventos") pintarEventos();
    refrescar();
  }

  function pintarCabPista() {
    const q = p();
    $("#m-pista").innerHTML = ed.c.pistas.map((x, i) => `<option value="${i}" ${i === ed.pista ? "selected" : ""}>${i + 1}. ${esc(x.nombre)}</option>`).join("") + `<option value="nueva">＋ Nueva pista</option>`;
    if (!q) return;
    $("#m-pista-nombre").value = q.nombre;
    const perc = q.canal === CANAL_PERCUSION;
    $("#m-programa").value = String(q.programa);
    $("#m-programa").disabled = perc;
    $("#m-programa").title = perc ? "En el canal 10 cada nota es un instrumento de percusión" : "";
    $("#m-canal").value = String(q.canal);
    $("#m-vol").value = String(q.volumen);
    $("#m-pan").value = String(q.pan);
    main.querySelector('[data-ms="mute"]').setAttribute("aria-pressed", String(q.mute));
    main.querySelector('[data-ms="solo"]').setAttribute("aria-pressed", String(q.solo));
  }

  function pintarBotones() {
    main.querySelectorAll("[data-pestana-midi][role=tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.pestanaMidi === pestana)));
    main.querySelectorAll("[data-panel-midi]").forEach((s) => { s.hidden = s.dataset.panelMidi !== pestana; });
    main.querySelectorAll("[data-herr]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.herr === ed.herramienta)));
    main.querySelectorAll("[data-carril]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.carril === String(ed.carril))));
    $("#m-rejilla").value = ed.rejillaTxt;
    const play = main.querySelector('[data-accion="tocar"]');
    play.innerHTML = icono(motor.sonando ? "pausa" : "play");
    play.setAttribute("aria-label", motor.sonando ? "Pausa" : "Reproducir");
    main.querySelector('[data-accion="grabar"]').setAttribute("aria-pressed", String(grabando));
    main.querySelector('[data-accion="bucle"]').setAttribute("aria-pressed", String(bucleActivo));
    main.querySelector('[data-accion="metronomo"]').setAttribute("aria-pressed", String(motor.metronomo));
    main.querySelector('[data-accion="teclado-pc"]').setAttribute("aria-pressed", String(tecladoPC));
    $("#tr-bpm").value = String(Math.round(bpmEn(ed.c, ed.cabezal) * 100) / 100);
    pintarPosicion();
  }

  function pintarPosicion() {
    const t = ed.cabezalVivo ?? ed.cabezal;
    $("#tr-pos").textContent = posicion(ed.c, t);
    $("#tr-tiempo").textContent = tiempoTxt(segundosDeTick(ed.c, t));
  }

  function pintarInfoSel() {
    const q = p();
    const n = q ? q.notas.filter((x) => ed.sel.has(x.id)) : [];
    let txt = `${q?.notas.length ?? 0} notas en la pista`;
    if (n.length === 1) {
      const x = n[0];
      txt = `${q.canal === CANAL_PERCUSION ? PERCUSION[x.nota] || cifraMidi(x.nota) : `${nombreMidi(x.nota)} (${cifraMidi(x.nota)})`} · nota ${x.nota} · velocidad ${x.vel} · empieza en ${posicion(ed.c, x.tick)} · dura ${x.dur} ticks`;
    } else if (n.length > 1) txt = `${n.length} notas seleccionadas`;
    $("#m-info-sel").textContent = txt;
  }

  // ---------------------------------------------------------------- Arreglo
  function pintarArreglo() {
    $("#m-arreglo").innerHTML = ed.c.pistas.map((q, i) => `
      <div class="arr-fila${i === ed.pista ? " actual" : ""}" data-ir-pista="${i}">
        <span class="arr-color" style="background:${q.color}"></span>
        <div class="arr-info">
          <b>${esc(q.nombre)}</b>
          <small>${q.canal === CANAL_PERCUSION ? "Percusión" : esc(INSTRUMENTOS[q.programa])} · canal ${q.canal + 1} · ${q.notas.length} notas</small>
        </div>
        <span class="arr-ms">
          <button type="button" class="btn-ms" data-arr-ms="mute" data-i="${i}" aria-pressed="${q.mute}" title="Silenciar">M</button>
          <button type="button" class="btn-ms" data-arr-ms="solo" data-i="${i}" aria-pressed="${q.solo}" title="Solo">S</button>
        </span>
        <canvas class="arr-mini" data-mini="${i}" aria-hidden="true"></canvas>
        <span class="arr-btns">
          <button type="button" class="btn-icono txt" data-arr="subir" data-i="${i}" title="Subir" aria-label="Subir">↑</button>
          <button type="button" class="btn-icono txt" data-arr="bajar" data-i="${i}" title="Bajar" aria-label="Bajar">↓</button>
          <button type="button" class="btn-mini" data-arr="duplicar" data-i="${i}">Duplicar</button>
          <button type="button" class="btn-mini" data-arr="borrar" data-i="${i}">Eliminar</button>
        </span>
      </div>`).join("");
    dibujarMinis();
  }
  function dibujarMinis() {
    const fin = Math.max(finCancion(ed.c), ticksCompas(ed.c) * 4);
    const col = colores();
    main.querySelectorAll("[data-mini]").forEach((cv) => {
      const q = ed.c.pistas[Number(cv.dataset.mini)];
      if (!q) return;
      const { g, w, h } = prepararLienzo(cv);
      g.clearRect(0, 0, w, h);
      g.fillStyle = col.fondo2;
      g.fillRect(0, 0, w, h);
      const tc = ticksCompas(ed.c);
      g.fillStyle = col.pulso;
      for (let t = 0; t <= fin; t += tc) g.fillRect(Math.round(t / fin * w), 0, 1, h);
      if (!q.notas.length) return;
      const ns = q.notas.map((n) => n.nota), lo = Math.min(...ns), hi = Math.max(...ns) + 1;
      g.fillStyle = q.color;
      for (const n of q.notas) g.fillRect(n.tick / fin * w, h - 3 - ((n.nota - lo + 1) / (hi - lo + 1)) * (h - 6), Math.max(1.5, n.dur / fin * w), 2.5);
      const x = (ed.cabezalVivo ?? ed.cabezal) / fin * w;
      g.fillStyle = col.cabezal;
      g.fillRect(x, 0, 1.5, h);
    });
  }

  // ---------------------------------------------------------------- Tempo
  function pintarTempo() {
    $("#t-num").value = String(ed.c.compas.num);
    $("#t-den").value = String(ed.c.compas.den);
    $("#t-bpm0").value = String(ed.c.tempos[0].bpm);
    $("#t-lista").innerHTML = `<table class="tabla-midi"><thead><tr><th>Posición</th><th>BPM</th><th>µs por negra</th><th>Bytes del evento</th><th></th></tr></thead><tbody>
      ${ed.c.tempos.map((t, i) => {
        const us = Math.round(60e6 / t.bpm);
        return `<tr><td>${posicion(ed.c, t.tick)}</td><td><input type="number" class="corto" min="20" max="300" step="0.5" value="${t.bpm}" data-tempo-bpm="${i}"></td><td>${us.toLocaleString("es")}</td><td><code>FF 51 03 ${bytesHex([(us >> 16) & 255, (us >> 8) & 255, us & 255])}</code></td><td>${i ? `<button type="button" class="btn-mini" data-tempo-borrar="${i}">Quitar</button>` : "<small>inicial</small>"}</td></tr>`;
      }).join("")}</tbody></table>`;
    refrescar();
  }

  // ---------------------------------------------------------------- Eventos
  function pintarEventos() {
    const sel = $("#ev-pista");
    const actual = sel.value === "" ? String(ed.pista) : sel.value;
    sel.innerHTML = `<option value="-1">Director (tempo y compás)</option>` + ed.c.pistas.map((q, i) => `<option value="${i}">${i + 1}. ${esc(q.nombre)}</option>`).join("");
    sel.value = Number(actual) < ed.c.pistas.length ? actual : "-1";
    const k = Number(sel.value);
    const evs = k < 0 ? eventosDirector(ed.c) : eventosPista(ed.c, ed.c.pistas[k]);
    evs.push({ tick: evs.length ? evs[evs.length - 1].tick : 0, bytes: [0xff, 0x2f, 0x00] });
    $("#ev-cuenta").textContent = `${evs.length} eventos`;
    let prev = 0;
    const filas = evs.slice(0, limiteEventos).map((e) => {
      const d = describirMensaje(e.bytes), delta = e.tick - prev;
      prev = e.tick;
      const clase = e.bytes[0] === 0xff ? "meta" : (e.bytes[0] & 0xf0) === 0x90 ? "on" : (e.bytes[0] & 0xf0) === 0x80 ? "off" : "otro";
      return `<tr class="ev-${clase}"><td>${posicion(ed.c, e.tick)}</td><td>${e.tick}</td><td>${delta}</td><td><code>${bytesHex(e.bytes.length > 12 ? e.bytes.slice(0, 12) : e.bytes)}${e.bytes.length > 12 ? " …" : ""}</code></td><td><b>${d.tipo}</b>${d.canal ? ` · c${d.canal}` : ""}</td><td>${esc(d.texto)}</td></tr>`;
    }).join("");
    $("#ev-tabla").innerHTML = `<table class="tabla-eventos"><thead><tr><th>Posición</th><th>Tick</th><th>Delta</th><th>Bytes</th><th>Mensaje</th><th>Qué significa</th></tr></thead><tbody>${filas}</tbody></table>
      ${evs.length > limiteEventos ? `<p><button type="button" class="btn" data-accion="mas-eventos">Mostrar ${Math.min(400, evs.length - limiteEventos)} más (de ${evs.length - limiteEventos} que faltan)</button></p>` : ""}`;
  }

  // ---------------------------------------------------------------- Cabezal y reproducción
  function moverCabezal(t) {
    ed.cabezal = Math.max(0, Math.round(t));
    if (motor.sonando) { motor.tocar(ed.c, ed.cabezal); }
    pintarPosicion();
    $("#tr-bpm").value = String(Math.round(bpmEn(ed.c, ed.cabezal) * 100) / 100);
    refrescar();
  }

  function tocar() {
    if (motor.sonando) { pausar(); return; }
    motor.bucle = bucleActivo && ed.bucle ? ed.bucle : null;
    const desde = motor.bucle && (ed.cabezal < motor.bucle.ini || ed.cabezal >= motor.bucle.fin) ? motor.bucle.ini : ed.cabezal;
    ed.inicioPlay = desde;
    motor.tocar(ed.c, desde);
    animar();
    pintarBotones();
  }
  function pausar() {
    const t = motor.tickActual();
    motor.parar();
    terminarGrabacion();
    ed.cabezal = Math.round(t ?? ed.cabezal);
    ed.cabezalVivo = null;
    pintarBotones();
    refrescar();
  }
  function parar() {
    const estaba = motor.sonando;
    motor.parar();
    terminarGrabacion();
    ed.cabezalVivo = null;
    ed.cabezal = estaba ? ed.inicioPlay ?? 0 : 0;
    pintarBotones();
    refrescar();
  }
  function finReproduccion() {
    terminarGrabacion();
    ed.cabezalVivo = null;
    pintarBotones();
    refrescar();
  }
  function animar() {
    cancelAnimationFrame(raf);
    const paso = () => {
      if (!motor.sonando) return;
      const t = motor.tickActual();
      ed.cabezalVivo = t;
      if (ed.seguir && pestana !== "tempo") {
        const ancho = ($("#m-rollo").clientWidth || 600) - TECLAS;
        const x = (t - ed.scrollX) * ed.zx;
        if (x > ancho * 0.9 || x < 0) ed.scrollX = Math.max(0, t - ancho * 0.1 / ed.zx);
      }
      pintarPosicion();
      refrescar();
      raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
  }

  // ---------------------------------------------------------------- Grabar y tocar en vivo
  function grabar() {
    if (grabando) { pausar(); return; }
    if (!p()) return;
    grabando = true;
    fotoGrabacion = antes();
    pendientes.clear();
    motor.sinFin = true;
    if (!motor.sonando) tocar();
    pintarBotones();
    avisar("Grabando: toca tu teclado MIDI, el teclado del PC o el de la pantalla");
  }
  function terminarGrabacion() {
    motor.sinFin = false;
    if (!grabando) return;
    grabando = false;
    const ahora = motor.tickActual() ?? ed.cabezal;
    for (const [nota, ini] of pendientes) añadirGrabada(nota, ini, ahora);
    pendientes.clear();
    if (fotoGrabacion) despues(fotoGrabacion);
    fotoGrabacion = null;
  }
  function añadirGrabada(nota, ini, fin) {
    const q = p();
    if (!q) return;
    q.notas.push({ id: nuevoId(), tick: Math.round(ini.tick), dur: Math.max(10, Math.round(fin - ini.tick)), nota, vel: ini.vel });
  }

  /** Una nota que llega del teclado MIDI, del teclado del PC o del de la pantalla. */
  function entradaNota(nota, vel, on, origen) {
    const q = p();
    if (!q || nota < 0 || nota > 127) return;
    const ch = q.canal & 15;
    monitor(on ? [0x90 | ch, nota, vel] : [0x80 | ch, nota, 64], origen);
    if (on) {
      vivas.get(nota)?.soltar();
      vivas.set(nota, motor.probar(q, nota, vel, null));
      ed.teclasVivas.add(nota);
      if (grabando && motor.sonando) pendientes.set(nota, { tick: motor.tickActual(), vel });
    } else {
      vivas.get(nota)?.soltar();
      vivas.delete(nota);
      ed.teclasVivas.delete(nota);
      const ini = pendientes.get(nota);
      if (ini && grabando) { añadirGrabada(nota, ini, motor.tickActual()); pendientes.delete(nota); pintarInfoSel(); }
    }
    refrescar();
  }

  function monitor(bytes, origen) {
    const m = $("#monitor");
    if (!m) return;
    if (m.querySelector("p.sub")) m.innerHTML = "";
    m.insertAdjacentHTML("afterbegin", lineaMonitor(bytes, origen));
    while (m.children.length > 60) m.lastElementChild.remove();
  }

  // ---------------------------------------------------------------- Web MIDI
  async function conectarMIDI() {
    if (!navigator.requestMIDIAccess) {
      avisar("Este navegador no tiene Web MIDI. Prueba con Chrome, Edge u Opera (o usa el teclado del PC).");
      return;
    }
    try {
      midiAcceso = await navigator.requestMIDIAccess();
    } catch {
      avisar("No se dio permiso para usar MIDI.");
      return;
    }
    const enlazar = () => {
      for (const ent of midiAcceso.inputs.values()) ent.onmidimessage = (ev) => mensajeEntrada([...ev.data], ent.name);
      const sal = $("#tr-salida");
      const elegida = motor.salida?.id || "";
      sal.innerHTML = `<option value="">Sintetizador del navegador</option>` + [...midiAcceso.outputs.values()].map((o) => `<option value="${esc(o.id)}">${esc(o.name)}</option>`).join("");
      sal.value = [...midiAcceso.outputs.values()].some((o) => o.id === elegida) ? elegida : "";
      if (!sal.value) motor.salida = null;
      $("#tr-salida-et").hidden = false;
      const nE = midiAcceso.inputs.size, nS = midiAcceso.outputs.size;
      main.querySelector('[data-accion="conectar"]').innerHTML = `${icono("cable")} MIDI: ${nE} entrada${nE === 1 ? "" : "s"}`;
      return { nE, nS };
    };
    const { nE } = enlazar();
    midiAcceso.onstatechange = () => enlazar();
    avisar(nE ? "Teclado MIDI conectado: toca y mira el monitor en «Aprende MIDI»" : "MIDI activo, pero no hay ningún teclado conectado. Conéctalo por USB.");
  }
  function mensajeEntrada(bytes, origen) {
    const st = bytes[0];
    if (st === 0xf8 || st === 0xfe) return; // reloj y «sigo conectado»: demasiado frecuentes para el monitor
    const tipo = st & 0xf0;
    if (tipo === 0x90 && bytes[2] > 0) { entradaNota(bytes[1], bytes[2], true, origen); return; }
    if (tipo === 0x80 || (tipo === 0x90 && bytes[2] === 0)) { entradaNota(bytes[1], 0, false, origen); return; }
    monitor(bytes, origen);
    if (tipo === 0xb0 && bytes[1] === 64 && grabando && motor.sonando && p()) {
      (p().ccs[64] ||= []).push({ tick: Math.round(motor.tickActual()), valor: bytes[2] });
      p().ccs[64].sort((a, b) => a.tick - b.tick);
    }
  }

  // ---------------------------------------------------------------- Edición
  const elegidas = () => (p() ? p().notas.filter((n) => ed.sel.has(n.id)) : []);
  const objetivo = () => { const s = elegidas(); return s.length ? s : p()?.notas || []; };

  function copiar() {
    const s = elegidas();
    if (!s.length) { avisar("Selecciona notas primero"); return false; }
    const t0 = Math.min(...s.map((n) => n.tick));
    portapapeles = s.map((n) => ({ tick: n.tick - t0, dur: n.dur, nota: n.nota, vel: n.vel }));
    avisar(`${s.length} nota${s.length > 1 ? "s" : ""} copiada${s.length > 1 ? "s" : ""}`);
    return true;
  }
  function eliminar() {
    if (!ed.sel.size) return;
    cambiar(() => { p().notas = p().notas.filter((n) => !ed.sel.has(n.id)); ed.sel.clear(); });
  }
  function pegarEn(tick, notas) {
    cambiar(() => {
      ed.sel.clear();
      for (const n of notas) {
        const nueva = { ...n, id: nuevoId(), tick: n.tick + tick };
        p().notas.push(nueva);
        ed.sel.add(nueva.id);
      }
    });
  }
  function duplicar() {
    const s = elegidas();
    if (!s.length) { avisar("Selecciona notas primero"); return; }
    const t0 = Math.min(...s.map((n) => n.tick)), t1 = Math.max(...s.map((n) => n.tick + n.dur));
    const largo = Math.ceil((t1 - t0) / Math.max(1, ed.rejilla)) * Math.max(1, ed.rejilla);
    pegarEn(t0 + largo, s.map((n) => ({ tick: n.tick - t0, dur: n.dur, nota: n.nota, vel: n.vel })));
  }
  function transponer(k) {
    const s = objetivo();
    if (!s.length) return;
    const lo = Math.min(...s.map((n) => n.nota)), hi = Math.max(...s.map((n) => n.nota));
    const d = Math.max(-lo, Math.min(127 - hi, k));
    if (!d) return;
    cambiar(() => { s.forEach((n) => { n.nota += d; }); });
    if (s.length === 1) api.probar(s[0].nota, s[0].vel);
  }
  function cuantizar() {
    const s = objetivo();
    if (!s.length || ed.rejilla <= 1) { avisar("Elige una rejilla para cuantizar"); return; }
    cambiar(() => { s.forEach((n) => { n.tick = Math.max(0, Math.round(n.tick / ed.rejilla) * ed.rejilla); }); });
    avisar(`Inicio de ${s.length} nota${s.length > 1 ? "s" : ""} ajustado a la rejilla (${ed.rejillaTxt})`);
  }
  function seleccionarVecina(dir) {
    const q = p();
    if (!q?.notas.length) return;
    const orden = [...q.notas].sort((a, b) => a.tick - b.tick || a.nota - b.nota);
    let i;
    const s = elegidas();
    if (!s.length) i = dir > 0 ? orden.findIndex((n) => n.tick >= ed.cabezal) : orden.length - 1;
    else {
      const ref = dir > 0 ? s.reduce((a, b) => (orden.indexOf(b) > orden.indexOf(a) ? b : a)) : s.reduce((a, b) => (orden.indexOf(b) < orden.indexOf(a) ? b : a));
      i = orden.indexOf(ref) + dir;
    }
    const n = orden[Math.max(0, Math.min(orden.length - 1, i < 0 ? 0 : i))];
    ed.sel = new Set([n.id]);
    asegurarVisible(n.tick, n.nota);
    api.probar(n.nota, n.vel);
    pintarInfoSel();
    refrescar();
  }
  function asegurarVisible(tick, nota) {
    const cv = $("#m-rollo");
    const ancho = (cv.clientWidth - TECLAS) / ed.zx, filas = (cv.clientHeight - 24) / ed.zy;
    if (tick < ed.scrollX || tick > ed.scrollX + ancho * 0.9) ed.scrollX = Math.max(0, tick - ancho * 0.2);
    if (nota != null && (nota > ed.scrollY - 1 || nota < ed.scrollY - filas + 1)) ed.scrollY = Math.min(127.99, nota + filas / 2);
  }
  function centrarEnNotas() {
    const ns = p()?.notas || [];
    const filas = (($("#m-rollo").clientHeight || 440) - 24) / ed.zy;
    if (!ns.length) { ed.scrollY = Math.min(127.99, 72 + filas / 2); return; }
    const media = ns.reduce((a, n) => a + n.nota, 0) / ns.length;
    ed.scrollY = Math.min(127.99, Math.max(filas - 1, Math.round(media + filas / 2)));
  }

  // ---------------------------------------------------------------- Pistas
  function nuevaPista(percusion = false) {
    cambiar(() => {
      const q = pistaNueva(ed.c.pistas.length, percusion ? { canal: CANAL_PERCUSION, nombre: "Percusión" } : {});
      if (!percusion) {
        const usados = new Set(ed.c.pistas.map((x) => x.canal));
        q.canal = [...Array(16).keys()].find((ch) => ch !== CANAL_PERCUSION && !usados.has(ch)) ?? q.canal;
      }
      ed.c.pistas.push(q);
      ed.pista = ed.c.pistas.length - 1;
      ed.sel.clear();
    });
    if (percusion) { ed.scrollY = 60; }
  }

  // ---------------------------------------------------------------- Archivos
  function reemplazar(c, aviso) {
    const foto = antes();
    motor.parar();
    ed.c = c;
    ed.pista = 0;
    ed.sel.clear();
    ed.cabezal = 0;
    ed.cabezalVivo = null;
    ed.bucle = null;
    ed.scrollX = 0;
    fijarRejilla();
    deshacer.push(foto);
    rehacer = [];
    guardar();
    centrarEnNotas();
    pintarTodo();
    if (aviso) avisar(aviso);
  }
  const tieneNotas = () => ed.c.pistas.some((q) => q.notas.length);
  const confirmarReemplazo = () => !tieneNotas() || confirm("Se reemplazará la canción actual (puedes recuperarla con Deshacer). ¿Seguir?");

  async function abrirArchivo(file) {
    if (!file) return;
    try {
      const c = leerSMF(await file.arrayBuffer());
      if (!c.nombre || c.nombre === "Sin título") c.nombre = file.name.replace(/\.midi?$/i, "");
      if (!confirmarReemplazo()) return;
      reemplazar(c, `Abierto «${file.name}»: ${c.pistas.length} pista${c.pistas.length > 1 ? "s" : ""}, ${c.pistas.reduce((a, q) => a + q.notas.length, 0)} notas`);
    } catch (err) {
      avisar(String(err.message || err));
    }
  }

  function descargarMid() {
    const { bytes } = escribirSMF(ed.c);
    descargar(new Blob([bytes], { type: "audio/midi" }), `${nombreArchivo(ed.c.nombre)}.mid`);
    avisar(`Descargado ${nombreArchivo(ed.c.nombre)}.mid (${bytes.length.toLocaleString("es")} bytes)`);
  }

  async function exportarWav() {
    if (!tieneNotas()) { avisar("La canción no tiene notas"); return; }
    avisar("Generando el audio… en canciones largas puede tardar unos segundos", 120000);
    const dur = segundosDeTick(ed.c, finCancion(ed.c)) + 2.5;
    const sr = 44100;
    const off = new OfflineAudioContext(2, Math.ceil(sr * dur), sr);
    const s = new Sinte(off);
    for (const q of ed.c.pistas) {
      s.control(q.id, 7, q.volumen, 0);
      s.control(q.id, 10, q.pan, 0);
    }
    for (const e of new Motor().preparar(ed.c)) {
      if (e.tipo === "nota") s.nota({ id: e.p.id, programa: e.p.programa, canal: e.p.canal, nota: e.n.nota, vel: e.n.vel, t0: e.s + 0.05, t1: e.fin + 0.05 });
      else if (e.tipo === "cc" && [1, 7, 10, 11].includes(e.num)) s.control(e.p.id, e.num, e.valor, e.s + 0.05);
      else if (e.tipo === "bend") s.control(e.p.id, "bend", e.valor, e.s + 0.05);
    }
    const buf = await off.startRendering();
    descargar(wav(buf), `${nombreArchivo(ed.c.nombre)}.wav`);
    avisar("Audio exportado (.wav)");
  }

  async function abrirBiblioteca() {
    const dlg = $("#m-dialogo");
    dlg.innerHTML = `<form method="dialog" class="dlg"><h2>Abrir de la biblioteca</h2><p class="cargando">Cargando…</p><div class="dlg-acciones"><button class="btn">Cerrar</button></div></form>`;
    dlg.showModal();
    try {
      const { canciones } = await cargarIndice();
      const usables = canciones.filter((x) => x.musicxml || x.tab);
      const grupo = (inst, titulo) => {
        const xs = usables.filter((x) => x.instrumento === inst);
        return xs.length ? `<h3>${titulo}</h3><div class="dlg-lista">${xs.map((x) => `<button type="button" class="btn" data-importar="${esc(x.id)}">${esc(x.titulo)}${x.subtitulo ? `<small>${esc(x.subtitulo)}</small>` : ""}</button>`).join("")}</div>` : "";
      };
      dlg.querySelector(".cargando").outerHTML = `<p class="sub">Se convierte la partitura o la tablatura en notas MIDI. Cada canción conserva su fuente: se guarda dentro del .mid como texto.</p>
        ${grupo("piano", "Piano")}${grupo("violin", "Violín")}${grupo("armonica", "Armónica")}`;
      dlg.onclick = async (e) => {
        const b = e.target.closest("[data-importar]");
        if (!b) return;
        const x = usables.find((y) => y.id === b.dataset.importar);
        if (!confirmarReemplazo()) return;
        b.disabled = true;
        try {
          const texto = await (await fetch(x.musicxml || x.tab)).text();
          const programa = x.instrumento === "violin" ? 40 : 0;
          const c = x.musicxml ? desdeMusicXML(texto, { programa, titulo: x.titulo, fuente: x.fuente }) : desdeTab(texto, { tono: x.tono, titulo: x.titulo, fuente: x.fuente });
          dlg.close();
          pestana = "rollo";
          setPref("midiPestana", pestana);
          reemplazar(c, `«${x.titulo}» importada: ${c.pistas.reduce((a, q) => a + q.notas.length, 0)} notas`);
        } catch (err) {
          b.disabled = false;
          avisar(`No se pudo importar: ${err.message || err}`);
        }
      };
    } catch (err) {
      dlg.querySelector(".cargando").textContent = String(err.message || err);
    }
  }

  function verBytes() {
    const { bytes, segmentos } = escribirSMF(ed.c);
    const dlg = $("#m-dialogo");
    const max = Math.min(bytes.length, 4096);
    const segDe = new Int32Array(bytes.length).fill(-1);
    segmentos.forEach((s, i) => { for (let k = s.ini; k < s.fin; k++) segDe[k] = i; });
    let filas = "";
    for (let o = 0; o < max; o += 16) {
      let celdas = "";
      for (let k = o; k < Math.min(o + 16, max); k++) {
        const si = segDe[k];
        celdas += `<span class="hx hx-${si >= 0 ? segmentos[si].tipo : "x"}" data-s="${si}">${bytes[k].toString(16).toUpperCase().padStart(2, "0")}</span>`;
      }
      filas += `<div class="hx-fila"><span class="hx-off">${o.toString(16).toUpperCase().padStart(6, "0")}</span>${celdas}</div>`;
    }
    dlg.innerHTML = `<form method="dialog" class="dlg dlg-ancho">
      <h2>Los bytes de «${esc(ed.c.nombre)}»</h2>
      <p class="sub">${bytes.length.toLocaleString("es")} bytes${bytes.length > max ? ` (se muestran los primeros ${max.toLocaleString("es")})` : ""}. Pasa el mouse o toca un byte para ver qué es. Colores:
        <span class="hx hx-chunk">cabecera de bloque</span> <span class="hx hx-long">longitud</span> <span class="hx hx-cab">datos de la cabecera</span> <span class="hx hx-delta">delta</span> <span class="hx hx-evento">mensaje MIDI</span> <span class="hx hx-meta">evento meta</span></p>
      <div class="hx-explica" id="hx-explica">Empieza con <code>4D 54 68 64</code>: las letras «MThd» en ASCII.</div>
      <div class="hx-caja">${filas}</div>
      <div class="dlg-acciones"><button type="button" class="btn" data-accion="descargar">${icono("descargar")} Descargar .mid</button><button class="btn">Cerrar</button></div>
    </form>`;
    const marcar = (t) => {
      const sp = t.closest?.(".hx[data-s]");
      if (!sp || sp.dataset.s === "-1") return;
      dlg.querySelectorAll(".hx.activo").forEach((x) => x.classList.remove("activo"));
      dlg.querySelectorAll(`.hx[data-s="${sp.dataset.s}"]`).forEach((x) => x.classList.add("activo"));
      const s = segmentos[Number(sp.dataset.s)];
      dlg.querySelector("#hx-explica").innerHTML = `<code>${bytesHex(bytes.slice(s.ini, s.fin))}</code> · byte ${s.ini}${s.fin - s.ini > 1 ? `–${s.fin - 1}` : ""}: ${esc(s.texto)}`;
    };
    dlg.onmouseover = (e) => marcar(e.target);
    dlg.onclick = (e) => { marcar(e.target); if (e.target.closest('[data-accion="descargar"]')) descargarMid(); };
    if (!dlg.open) dlg.showModal();
  }

  function dialogoNumero({ titulo, texto, valor, min, max, alAceptar }) {
    const dlg = $("#m-dialogo");
    dlg.innerHTML = `<form method="dialog" class="dlg"><h2>${titulo}</h2><p class="sub">${texto}</p>
      <label class="campo"><input type="number" id="dlg-num" min="${min}" max="${max}" value="${valor}" class="corto"></label>
      <div class="dlg-acciones"><button class="btn" value="no">Cancelar</button><button class="btn-play" value="si">Aceptar</button></div></form>`;
    dlg.onclick = null;
    dlg.onmouseover = null;
    dlg.onclose = () => {
      dlg.onclose = null;
      if (dlg.returnValue !== "si") return;
      const v = Number(dlg.querySelector("#dlg-num").value);
      if (Number.isFinite(v)) alAceptar(Math.max(min, Math.min(max, Math.round(v))));
    };
    dlg.showModal();
    dlg.querySelector("#dlg-num").select();
  }

  function ayuda() {
    const dlg = $("#m-dialogo");
    const fila = (k, t) => `<tr><td><kbd>${k}</kbd></td><td>${t}</td></tr>`;
    dlg.onclick = null; dlg.onmouseover = null;
    dlg.innerHTML = `<form method="dialog" class="dlg"><h2>Atajos de teclado</h2><table class="tabla-midi">
      ${fila("Espacio", "Reproducir / pausa")}${fila("Inicio", "Cabezal al principio")}${fila("B / V", "Lápiz / Selección")}
      ${fila("Ctrl+Z · Ctrl+Shift+Z", "Deshacer · Rehacer")}${fila("Ctrl+X · C · V", "Cortar · Copiar · Pegar en el cabezal")}
      ${fila("Supr", "Eliminar las notas seleccionadas")}${fila("Ctrl+D", "Duplicar la selección")}${fila("Ctrl+A", "Seleccionar todo")}
      ${fila("← →", "Seleccionar la nota anterior / siguiente")}${fila("↑ ↓", "Subir / bajar un semitono")}${fila("Shift+↑ ↓", "Subir / bajar una octava")}
      ${fila("T", "Transponer…")}${fila("Q", "Cuantizar a la rejilla")}${fila("Esc", "Quitar la selección")}${fila("Ctrl+S · Ctrl+O", "Descargar .mid · Abrir .mid")}
      </table><p class="sub">Con «Teclado del PC» activo, las letras tocan notas: Z S X D C V G B H N J M (una octava) y Q 2 W 3 E R 5 T 6 Y 7 U I (la siguiente).</p>
      <div class="dlg-acciones"><button class="btn">Cerrar</button></div></form>`;
    dlg.showModal();
  }

  // ---------------------------------------------------------------- Acciones
  function accion(a, b) {
    cerrarMenus();
    switch (a) {
      case "nuevo": if (confirmarReemplazo()) reemplazar(cancionNueva(), "Canción nueva"); break;
      case "abrir": $("#m-archivo").click(); break;
      case "biblioteca": abrirBiblioteca(); break;
      case "descargar": descargarMid(); break;
      case "wav": exportarWav(); break;
      case "ver-bytes": verBytes(); break;
      case "deshacer": deshacerUno(deshacer, rehacer); break;
      case "rehacer": deshacerUno(rehacer, deshacer); break;
      case "cortar": if (copiar()) eliminar(); break;
      case "copiar": copiar(); break;
      case "pegar": if (portapapeles) pegarEn(Math.max(0, Math.round(ed.cabezal)), portapapeles); else avisar("El portapapeles está vacío"); break;
      case "eliminar": eliminar(); break;
      case "duplicar": duplicar(); break;
      case "todo": ed.sel = new Set(p()?.notas.map((n) => n.id)); pintarInfoSel(); refrescar(); break;
      case "siguiente": seleccionarVecina(1); break;
      case "anterior": seleccionarVecina(-1); break;
      case "octava-arriba": transponer(12); break;
      case "octava-abajo": transponer(-12); break;
      case "transponer":
        dialogoNumero({ titulo: "Transponer", texto: `Semitonos (12 = una octava; negativo para bajar). Se aplica a ${ed.sel.size ? "las notas seleccionadas" : "toda la pista"}.`, valor: 0, min: -48, max: 48, alAceptar: transponer });
        break;
      case "cuantizar": cuantizar(); break;
      case "velocidad":
        dialogoNumero({
          titulo: "Velocidad", texto: `Nueva velocidad (1–127) para ${ed.sel.size ? "las notas seleccionadas" : "toda la pista"}.`, valor: elegidas()[0]?.vel ?? ed.ultimaVel, min: 1, max: 127,
          alAceptar: (v) => { const s = objetivo(); cambiar(() => s.forEach((n) => { n.vel = v; })); ed.ultimaVel = v; },
        });
        break;
      case "ayuda": ayuda(); break;
      case "limpiar-carril": {
        const k = String(ed.carril);
        if (k === "vel") { avisar("La velocidad es de cada nota: cámbiala dibujando o con Editar → Velocidad"); break; }
        cambiar(() => { if (k === "bend") p().bend = []; else delete p().ccs[k]; });
        break;
      }
      case "pista-nueva": nuevaPista(false); break;
      case "pista-percusion": nuevaPista(true); pestana = "rollo"; pintarTodo(); break;
      case "tempo-limpiar": cambiar(() => { ed.c.tempos = [ed.c.tempos[0]]; }); pintarTempo(); break;
      case "al-inicio": moverCabezal(0); ed.scrollX = 0; refrescar(); break;
      case "parar": parar(); break;
      case "tocar": tocar(); break;
      case "compas-sig": { const tc = ticksCompas(ed.c); moverCabezal((Math.floor((ed.cabezalVivo ?? ed.cabezal) / tc) + 1) * tc); asegurarVisible(ed.cabezal); refrescar(); break; }
      case "grabar": grabar(); break;
      case "bucle":
        bucleActivo = !bucleActivo;
        if (bucleActivo && !ed.bucle) { const tc = ticksCompas(ed.c), ini = Math.floor(ed.cabezal / tc) * tc; ed.bucle = { ini, fin: ini + tc * 4 }; }
        motor.bucle = bucleActivo ? ed.bucle : null;
        if (bucleActivo) avisar("Bucle de 4 compases. Mayús + arrastrar en la regla para cambiarlo");
        pintarBotones(); refrescar();
        break;
      case "metronomo": motor.metronomo = !motor.metronomo; setPref("midiMetronomo", motor.metronomo); pintarBotones(); break;
      case "conectar": conectarMIDI(); break;
      case "teclado-pc":
        tecladoPC = !tecladoPC;
        pintarBotones();
        avisar(tecladoPC ? "Teclado del PC activo: Z S X D C… y Q 2 W 3 E… tocan notas" : "Teclado del PC desactivado");
        break;
      case "mas-eventos": limiteEventos += 400; pintarEventos(); break;
      default: void b;
    }
  }

  function cerrarMenus() {
    main.querySelectorAll(".menu-lista").forEach((l) => { l.hidden = true; });
    main.querySelectorAll(".menu-btn").forEach((b) => b.setAttribute("aria-expanded", "false"));
  }

  // ---------------------------------------------------------------- Eventos de la interfaz
  main.addEventListener("click", (e) => {
    const t = e.target;
    const mb = t.closest(".menu-btn");
    if (mb) {
      const lista = main.querySelector(`[data-lista="${mb.dataset.menu}"]`);
      const abrir = lista.hidden;
      cerrarMenus();
      lista.hidden = !abrir;
      mb.setAttribute("aria-expanded", String(abrir));
      return;
    }
    if (!t.closest(".menu")) cerrarMenus();
    const pm = t.closest("[data-pestana-midi]");
    if (pm) {
      pestana = pm.dataset.pestanaMidi;
      setPref("midiPestana", pestana);
      main.querySelector("#midi").scrollIntoView({ block: "start", behavior: "smooth" });
      pintarTodo();
      return;
    }
    const a = t.closest("[data-accion]");
    if (a && !a.closest("dialog")) { accion(a.dataset.accion, a); return; }
    const hr = t.closest("[data-herr]");
    if (hr) { ed.herramienta = hr.dataset.herr; setPref("midiHerramienta", ed.herramienta); pintarBotones(); return; }
    const ca = t.closest("[data-carril]");
    if (ca) { ed.carril = ca.dataset.carril; pintarBotones(); refrescar(); return; }
    const z = t.closest("[data-zoom]");
    if (z) {
      const cv = $("#m-rollo"), centro = ed.scrollX + (cv.clientWidth - TECLAS) / 2 / ed.zx;
      if (z.dataset.zoom === "x+") ed.zx = Math.min(1.5, ed.zx * 1.4);
      if (z.dataset.zoom === "x-") ed.zx = Math.max(0.005, ed.zx / 1.4);
      if (z.dataset.zoom[0] === "x") ed.scrollX = Math.max(0, centro - (cv.clientWidth - TECLAS) / 2 / ed.zx);
      if (z.dataset.zoom === "y+") ed.zy = Math.min(28, ed.zy + 2);
      if (z.dataset.zoom === "y-") ed.zy = Math.max(6, ed.zy - 2);
      refrescar();
      return;
    }
    const ms = t.closest("[data-ms]");
    if (ms) { cambiar(() => { p()[ms.dataset.ms] = !p()[ms.dataset.ms]; }); if (motor.sonando) motor.tocar(ed.c, Math.round(motor.tickActual())); return; }
    const ams = t.closest("[data-arr-ms]");
    if (ams) { const q = ed.c.pistas[Number(ams.dataset.i)]; cambiar(() => { q[ams.dataset.arrMs] = !q[ams.dataset.arrMs]; }); if (motor.sonando) motor.tocar(ed.c, Math.round(motor.tickActual())); return; }
    const ar = t.closest("[data-arr]");
    if (ar) {
      const i = Number(ar.dataset.i), ps = ed.c.pistas;
      if (ar.dataset.arr === "borrar") {
        if (ps[i].notas.length && !confirm(`¿Eliminar la pista «${ps[i].nombre}» con sus ${ps[i].notas.length} notas?`)) return;
        cambiar(() => { ps.splice(i, 1); if (!ps.length) ps.push(pistaNueva(0)); ed.pista = Math.min(ed.pista, ps.length - 1); });
      } else if (ar.dataset.arr === "duplicar") {
        cambiar(() => { const q = JSON.parse(JSON.stringify(ps[i])); q.id = nuevoId(); q.nombre += " (copia)"; q.notas.forEach((n) => { n.id = nuevoId(); }); q.color = pistaNueva(ps.length).color; ps.splice(i + 1, 0, q); });
      } else {
        const j = ar.dataset.arr === "subir" ? i - 1 : i + 1;
        if (j < 0 || j >= ps.length) return;
        cambiar(() => { [ps[i], ps[j]] = [ps[j], ps[i]]; if (ed.pista === i) ed.pista = j; else if (ed.pista === j) ed.pista = i; });
      }
      return;
    }
    const ir = t.closest("[data-ir-pista]");
    if (ir) { ed.pista = Number(ir.dataset.irPista); ed.sel.clear(); pestana = "rollo"; setPref("midiPestana", pestana); centrarEnNotas(); pintarTodo(); return; }
    const tb = t.closest("[data-tempo-borrar]");
    if (tb) { cambiar(() => { ed.c.tempos.splice(Number(tb.dataset.tempoBorrar), 1); }); pintarTempo(); return; }
    const tecla = t.closest("#ap-teclado rect[data-midi]");
    if (tecla) {
      const m = Number(tecla.dataset.midi);
      $("#ap-tecla").innerHTML = textoTecla(m);
      entradaNota(m, 100, true, "lección");
      setTimeout(() => entradaNota(m, 0, false, "lección"), 400);
      return;
    }
    if (t.closest("#ap-enviar")) {
      const bytes = leerConstructor();
      monitor(bytes, "constructor");
      if (motor.salida) motor.salida.send(bytes);
      else if ((bytes[0] & 0xf0) === 0x90 && bytes[2] > 0) motor.probar({ ...p(), canal: bytes[0] & 15 }, bytes[1], bytes[2], 0.6);
      else if ((bytes[0] & 0xf0) === 0xc0 && p()) { cambiar(() => { p().programa = bytes[1]; }); avisar(`La pista «${p().nombre}» ahora es ${INSTRUMENTOS[bytes[1]]}`); }
    }
  });
  document.addEventListener("click", alClicFuera);
  function alClicFuera(e) { if (!main.contains(e.target)) cerrarMenus(); }

  // Constructor de mensajes (Aprende MIDI)
  function leerConstructor() {
    const tipo = Number($("#ap-tipo").value);
    return mensajeConstructor(tipo, Number($("#ap-canal").value) || 1, Number($("#ap-d1").value) || 0, Number($("#ap-d2").value) || 0);
  }
  function pintarConstructor() {
    const tipo = Number($("#ap-tipo").value);
    const et = { 144: ["Nota", "Velocidad"], 128: ["Nota", "Velocidad"], 176: ["Controlador", "Valor"], 192: ["Instrumento", null], 224: ["Desafinación (−8192 a 8191)", null] }[tipo];
    $("#ap-d1-txt").textContent = et[0];
    $("#ap-d1").min = tipo === 224 ? "-8192" : "0";
    $("#ap-d1").max = tipo === 224 ? "8191" : "127";
    $("#ap-d2-et").hidden = !et[1];
    if (et[1]) $("#ap-d2-txt").textContent = et[1];
    $("#ap-bytes").innerHTML = bytesConstructorHTML(leerConstructor());
  }
  main.querySelector("#ap-constructor").addEventListener("input", pintarConstructor);
  pintarConstructor();

  let fotoDeslizador = null;
  main.addEventListener("input", (e) => {
    const id = e.target.id;
    if (id === "m-vol" || id === "m-pan") {
      fotoDeslizador ||= antes();
      const v = Number(e.target.value);
      if (id === "m-vol") p().volumen = v; else p().pan = v;
      if (!motor.salida) motor.sintetizador().control(p().id, id === "m-vol" ? 7 : 10, v);
      refrescar();
    }
    if (id === "m-desplazar" || id === "t-desplazar") { ed.scrollX = Number(e.target.value); refrescar(); }
  });
  main.addEventListener("change", (e) => {
    const id = e.target.id, v = e.target.value;
    if ((id === "m-vol" || id === "m-pan") && fotoDeslizador) { const f = fotoDeslizador; fotoDeslizador = null; despues(f); return; }
    if (id === "m-nombre") { cambiar(() => { ed.c.nombre = v.trim() || "Sin título"; }); return; }
    if (id === "m-pista") {
      if (v === "nueva") { nuevaPista(false); return; }
      ed.pista = Number(v); ed.sel.clear(); centrarEnNotas(); pintarTodo(); return;
    }
    if (id === "m-pista-nombre") { cambiar(() => { p().nombre = v.trim() || `Pista ${ed.pista + 1}`; }); return; }
    if (id === "m-programa") { cambiar(() => { p().programa = Number(v); }); api.probar(60, 100); return; }
    if (id === "m-canal") { cambiar(() => { p().canal = Number(v); }); if (Number(v) === CANAL_PERCUSION) avisar("Canal 10: cada nota es un instrumento de percusión (36 bombo, 38 caja, 42 hi-hat…)"); return; }
    if (id === "m-rejilla") { ed.rejillaTxt = v; setPref("midiRejilla", v); fijarRejilla(); ed.ultimaDur = null; refrescar(); return; }
    if (id === "m-otras") { ed.verOtras = e.target.checked; refrescar(); return; }
    if (id === "m-seguir") { ed.seguir = e.target.checked; return; }
    if (id === "tr-bpm" || id === "t-bpm0") {
      const bpm = Math.max(20, Math.min(300, Number(v) || 120));
      cambiar(() => {
        if (id === "t-bpm0") ed.c.tempos[0].bpm = bpm;
        else { let t = ed.c.tempos[0]; for (const x of ed.c.tempos) if (x.tick <= ed.cabezal) t = x; t.bpm = bpm; }
      });
      if (motor.sonando) motor.tocar(ed.c, Math.round(motor.tickActual()));
      if (pestana === "tempo") pintarTempo();
      return;
    }
    if (id === "t-num" || id === "t-den") {
      cambiar(() => { ed.c.compas = { num: Math.max(1, Math.min(32, Number($("#t-num").value) || 4)), den: Number($("#t-den").value) }; });
      fijarRejilla();
      pintarTempo();
      return;
    }
    if (e.target.dataset.tempoBpm !== undefined) {
      const i = Number(e.target.dataset.tempoBpm);
      cambiar(() => { ed.c.tempos[i].bpm = Math.max(20, Math.min(300, Number(v) || 120)); });
      pintarTempo();
      return;
    }
    if (id === "ev-pista") { limiteEventos = 400; pintarEventos(); return; }
    if (id === "m-archivo") { abrirArchivo(e.target.files[0]); e.target.value = ""; return; }
    if (id === "tr-salida") {
      motor.silenciar();
      motor.salida = v ? midiAcceso?.outputs.get(v) || null : null;
      avisar(motor.salida ? `Las notas salen por «${motor.salida.name}»` : "Suena con el sintetizador del navegador");
    }
  });

  // Arrastrar un .mid sobre el editor.
  const raiz = $("#midi");
  raiz.addEventListener("dragover", (e) => { if ([...e.dataTransfer.items].some((i) => i.kind === "file")) { e.preventDefault(); raiz.classList.add("soltar"); } });
  raiz.addEventListener("dragleave", (e) => { if (!raiz.contains(e.relatedTarget)) raiz.classList.remove("soltar"); });
  raiz.addEventListener("drop", (e) => { e.preventDefault(); raiz.classList.remove("soltar"); abrirArchivo(e.dataTransfer.files[0]); });

  // ---------------------------------------------------------------- Teclado
  const teclasPCAbajo = new Set();
  function baseTecladoPC() { return p()?.canal === CANAL_PERCUSION ? 36 : 60; }
  function alTeclaAbajo(e) {
    if (!document.body.contains(main)) return;
    const enCampo = e.target.closest?.("input, select, textarea, [contenteditable]");
    if ($("#m-dialogo").open) return;
    if (tecladoPC && !e.ctrlKey && !e.metaKey && !e.altKey && TECLAS_PC[e.code] !== undefined && !enCampo) {
      e.preventDefault();
      if (e.repeat || teclasPCAbajo.has(e.code)) return;
      teclasPCAbajo.add(e.code);
      entradaNota(baseTecladoPC() + TECLAS_PC[e.code], 100, true, "PC");
      return;
    }
    if (enCampo) return;
    const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    const hecho = () => e.preventDefault();
    if (e.key === " ") { hecho(); if (e.target.closest?.("button")) e.target.blur(); tocar(); return; }
    if (ctrl && k === "z") { hecho(); accion(e.shiftKey ? "rehacer" : "deshacer"); return; }
    if (ctrl && k === "y") { hecho(); accion("rehacer"); return; }
    if (ctrl && k === "s") { hecho(); accion("descargar"); return; }
    if (ctrl && k === "o") { hecho(); accion("abrir"); return; }
    if (pestana === "aprende") return;
    if (ctrl && k === "x") { hecho(); accion("cortar"); return; }
    if (ctrl && k === "c") { hecho(); accion("copiar"); return; }
    if (ctrl && k === "v") { hecho(); accion("pegar"); return; }
    if (ctrl && k === "d") { hecho(); accion("duplicar"); return; }
    if (ctrl && k === "a") { hecho(); accion("todo"); return; }
    if (ctrl) return;
    if (e.key === "Delete" || e.key === "Backspace") { hecho(); accion("eliminar"); return; }
    if (e.key === "ArrowRight") { hecho(); accion("siguiente"); return; }
    if (e.key === "ArrowLeft") { hecho(); accion("anterior"); return; }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      if (!ed.sel.size) return;
      hecho();
      transponer((e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 12 : 1));
      return;
    }
    if (e.key === "Home") { hecho(); accion("al-inicio"); return; }
    if (e.key === "Escape") { ed.sel.clear(); pintarInfoSel(); refrescar(); return; }
    if (tecladoPC) return;
    if (k === "t") { hecho(); accion("transponer"); return; }
    if (k === "q") { hecho(); accion("cuantizar"); return; }
    if (k === "b") { ed.herramienta = "lapiz"; pintarBotones(); return; }
    if (k === "v") { ed.herramienta = "seleccion"; pintarBotones(); }
  }
  function alTeclaArriba(e) {
    if (TECLAS_PC[e.code] !== undefined && teclasPCAbajo.has(e.code)) {
      teclasPCAbajo.delete(e.code);
      entradaNota(baseTecladoPC() + TECLAS_PC[e.code], 0, false, "PC");
    }
  }
  document.addEventListener("keydown", alTeclaAbajo);
  document.addEventListener("keyup", alTeclaArriba);

  // ---------------------------------------------------------------- Arranque
  centrarEnNotas();
  pintarTodo();

  return () => {
    motor.parar();
    for (const v of vivas.values()) v?.soltar();
    cancelAnimationFrame(raf);
    ro.disconnect();
    clearTimeout(guardarTimer);
    try { localStorage.setItem(CLAVE, JSON.stringify(ed.c)); } catch { /* nada */ }
    document.removeEventListener("keydown", alTeclaAbajo);
    document.removeEventListener("keyup", alTeclaArriba);
    document.removeEventListener("click", alClicFuera);
    if (midiAcceso) { for (const ent of midiAcceso.inputs.values()) ent.onmidimessage = null; midiAcceso.onstatechange = null; }
    if ($("#m-dialogo").open) $("#m-dialogo").close();
    envoltura?.classList.remove("ancho");
  };
}

/** AudioBuffer → archivo WAV (PCM de 16 bits). */
function wav(buf) {
  const nc = buf.numberOfChannels, sr = buf.sampleRate, n = buf.length;
  const datos = new DataView(new ArrayBuffer(44 + n * nc * 2));
  const txt = (o, s) => [...s].forEach((ch, i) => datos.setUint8(o + i, ch.charCodeAt(0)));
  txt(0, "RIFF"); datos.setUint32(4, 36 + n * nc * 2, true); txt(8, "WAVE");
  txt(12, "fmt "); datos.setUint32(16, 16, true); datos.setUint16(20, 1, true); datos.setUint16(22, nc, true);
  datos.setUint32(24, sr, true); datos.setUint32(28, sr * nc * 2, true); datos.setUint16(32, nc * 2, true); datos.setUint16(34, 16, true);
  txt(36, "data"); datos.setUint32(40, n * nc * 2, true);
  const canales = Array.from({ length: nc }, (_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++) { const v = Math.max(-1, Math.min(1, canales[c][i])); datos.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2; }
  return new Blob([datos], { type: "audio/wav" });
}
