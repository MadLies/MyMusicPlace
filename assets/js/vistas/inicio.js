// Biblioteca: todas las canciones, con filtros y progreso.
import { cargarIndice } from "../app.js";
import { porcentaje, pref, setPref } from "../progreso.js";
import { nombreTono } from "../notas.js";
import { esc } from "../render.js";

const INSTR = {
  armonica: { nombre: "Armónica", plural: "Armónica" },
  piano: { nombre: "Piano", plural: "Piano" },
  violin: { nombre: "Violín", plural: "Violín" },
};

function puntos(nivel) {
  return `<span class="nivel" title="Nivel ${nivel} de 5" aria-label="Nivel ${nivel} de 5">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= nivel ? "si" : ""}"></i>`).join("")}</span>`;
}

function tarjeta(c) {
  const st = c.stats;
  const etiquetas = [];
  if (c.instrumento === "armonica") {
    etiquetas.push(`Armónica en ${nombreTono(c.tono).split(" ")[0]}`);
    if (c.tonalidad) etiquetas.push(c.tonalidad.split("·")[0].trim());
    if (st) etiquetas.push(st.bends ? `${st.bends} bend${st.bends > 1 ? "s" : ""}` : "sin bends");
    if (st) etiquetas.push(`hoyos ${st.hoyoMin}–${st.hoyoMax}`);
  } else {
    etiquetas.push(INSTR[c.instrumento].nombre);
    if (c.musicxml) etiquetas.push("partitura interactiva");
    if (c.notas) etiquetas.push("análisis y plan");
  }
  const total = c.secciones?.length || 0;
  const pct = total ? porcentaje(c.id, total) : 0;
  return `<a class="tarjeta" href="#/${c.id}" data-instr="${c.instrumento}" data-busca="${esc((c.titulo + " " + c.subtitulo).toLowerCase())}">
    <div class="tarjeta-cab">
      <span class="instr instr-${c.instrumento}">${INSTR[c.instrumento].nombre}</span>
      ${st ? puntos(st.nivel) : ""}
    </div>
    <h3>${esc(c.titulo)}</h3>
    ${c.subtitulo ? `<p class="sub">${esc(c.subtitulo)}</p>` : ""}
    <p class="etiquetas">${etiquetas.map((e) => `<span>${esc(e)}</span>`).join("")}</p>
    ${total ? `<div class="progreso" title="${pct}% aprendido"><div style="width:${pct}%"></div></div><p class="progreso-txt">${pct ? `${pct}% aprendido` : "Sin empezar"}</p>` : ""}
  </a>`;
}

export async function mostrar(main) {
  const { canciones } = await cargarIndice();
  const filtro = pref("filtroInstrumento", "todos");
  const cuenta = (i) => canciones.filter((c) => c.instrumento === i).length;

  main.innerHTML = `
    <section class="portada">
      <h1>Tu atril de estudio</h1>
      <p>Tablaturas de armónica y partituras para escuchar, practicar nota a nota con el micrófono y seguir lo que ya aprendiste.</p>
    </section>
    <div class="filtros" role="toolbar" aria-label="Filtrar">
      <div class="segmentos" role="radiogroup" aria-label="Instrumento">
        ${[["todos", `Todo (${canciones.length})`], ["armonica", `Armónica (${cuenta("armonica")})`], ["piano", `Piano (${cuenta("piano")})`], ["violin", `Violín (${cuenta("violin")})`]]
          .map(([v, t]) => `<button type="button" role="radio" data-f="${v}" aria-checked="${v === filtro}">${t}</button>`).join("")}
      </div>
      <input type="search" class="buscar" placeholder="Buscar canción o artista…" aria-label="Buscar">
    </div>
    <div class="rejilla" id="rejilla">${canciones.map(tarjeta).join("")}</div>
    <div class="vacio" id="sin-resultados" hidden>
      <p>No hay canciones aquí todavía.</p>
      <p class="sub">Para añadir una de violín, crea <code>Violin/&lt;Canción&gt;/</code> desde la plantilla y exporta su MusicXML a <code>03_exportados/musicxml/</code>.</p>
    </div>
    <section class="atajos">
      <a href="#/guia"><strong>¿Primera vez con la armónica?</strong><span>Cómo leer tablaturas, el mapa de notas y las posiciones.</span></a>
      <a href="#/afinador"><strong>Afinador y bends</strong><span>Mira qué nota estás tocando y entrena los bends.</span></a>
      <a href="#/editor"><strong>Añadir una tablatura</strong><span>Pega una tablatura en cualquier notación y conviértela.</span></a>
    </section>`;

  const rejilla = main.querySelector("#rejilla");
  const buscar = main.querySelector(".buscar");
  let actual = filtro;
  function aplicar() {
    const q = buscar.value.trim().toLowerCase();
    let visibles = 0;
    rejilla.querySelectorAll(".tarjeta").forEach((t) => {
      const ok = (actual === "todos" || t.dataset.instr === actual) && (!q || t.dataset.busca.includes(q));
      t.hidden = !ok;
      if (ok) visibles++;
    });
    main.querySelector("#sin-resultados").hidden = visibles > 0;
  }
  main.querySelector(".segmentos").addEventListener("click", (e) => {
    const b = e.target.closest("[data-f]");
    if (!b) return;
    actual = b.dataset.f;
    setPref("filtroInstrumento", actual);
    main.querySelectorAll(".segmentos [data-f]").forEach((x) => x.setAttribute("aria-checked", x === b));
    aplicar();
  });
  buscar.addEventListener("input", aplicar);
  aplicar();
}
