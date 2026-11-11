// Prácticas: rutinas de estudio por instrumento (lista de ejercicios con minutos).
// Se empiezan desde aquí o desde el reloj de la cabecera: el temporizador cuenta cada ejercicio,
// avisa al terminarlo y espera a que pulses «Siguiente».
import { cargarIndice } from "../app.js";
import { esc } from "../render.js";
import { icono } from "../iconos.js";
import { pref, setPref } from "../progreso.js";
import { INSTRUMENTOS, EVENTO, listar, obtener, guardar, borrar, mover, minutosTotales, exportar, importar } from "../rutinas.js";
import { empezarRutina, estadoTemporizador, EVENTO_TEMPORIZADOR, durTxt } from "../temporizador.js";

/** Herramientas de Atril que se pueden enlazar desde un ejercicio, según el instrumento. */
function herramientas(inst) {
  const h = [["#/metronomo", "Metrónomo"]];
  h.push([inst === "piano" ? "#/afinador/cromatico" : `#/afinador/${inst}`, "Afinador"]);
  if (inst !== "piano") h.push([`#/notas/${inst}`, inst === "violin" ? "Notas en el violín" : "Notas en la armónica"]);
  h.push([inst === "armonica" ? "#/teoria" : `#/teoria/${inst}`, "Teoría (escalas y acordes)"]);
  if (inst === "armonica") h.push(["#/editor", "Editor de tablaturas"]);
  h.push(["#/midi", "Editor MIDI"]);
  return h;
}

export async function mostrar(main, [instRuta]) {
  let inst = instRuta || (INSTRUMENTOS[pref("practicasInstrumento", "")] ? pref("practicasInstrumento", "") : "violin");
  let editando = null; // id de la rutina en edición, "nueva" o null
  let canciones = [];
  try { canciones = (await cargarIndice()).canciones; } catch { /* sin índice: solo herramientas */ }

  main.innerHTML = `
    <h1>Prácticas</h1>
    <p class="sub">Arma tus rutinas: qué vas a practicar, en qué orden y cuántos minutos. Empiézalas aquí o desde el reloj
      ${icono("reloj")} de arriba: al acabar cada ejercicio te avisa y espera a que pulses <b>Siguiente</b>.</p>
    <div class="segmentos practicas-inst" role="tablist" aria-label="Instrumento">
      ${Object.entries(INSTRUMENTOS).map(([k, v]) => `<button type="button" role="tab" data-inst="${k}" aria-selected="${k === inst}">${v}</button>`).join("")}
    </div>
    <div class="practicas-cuerpo"></div>
    <details class="practicas-archivo">
      <summary>Copiar mis rutinas a otro equipo</summary>
      <p class="nota-texto">Las rutinas se guardan en este navegador. Para llevarlas a otro computador, al celular o al sitio
        privado, expórtalas a un archivo y luego impórtalo allá (las rutinas con el mismo origen se actualizan, no se duplican).</p>
      <div class="practicas-archivo-acciones">
        <button type="button" class="btn" data-accion="exportar">${icono("descargar")} Exportar rutinas</button>
        <label class="btn">${icono("mas")} Importar archivo<input type="file" accept="application/json,.json" data-accion="importar" hidden></label>
      </div>
      <p class="practicas-msg" role="status"></p>
    </details>`;

  const cuerpo = main.querySelector(".practicas-cuerpo");
  const msg = main.querySelector(".practicas-msg");

  function cancionesDe(i) {
    return canciones.filter((c) => c.instrumento === i).map((c) => [`#/${c.instrumento}/${c.carpeta}`, c.titulo]);
  }

  function opcionesEnlace(i, actual) {
    const grupos = [["Herramientas", herramientas(i)], [`Canciones de ${INSTRUMENTOS[i].toLowerCase()}`, cancionesDe(i)]];
    const conocidos = grupos.flatMap(([, l]) => l.map(([h]) => h));
    const extra = actual?.enlace && !conocidos.includes(actual.enlace)
      ? `<option value="${esc(actual.enlace)}" data-txt="${esc(actual.enlaceTxt)}" selected>${esc(actual.enlaceTxt || actual.enlace)}</option>` : "";
    return `<option value="">Sin enlace</option>${extra}${grupos.filter(([, l]) => l.length).map(([g, l]) => `<optgroup label="${esc(g)}">${l.map(([h, txt]) =>
      `<option value="${esc(h)}" data-txt="${esc(txt)}" ${actual?.enlace === h ? "selected" : ""}>${esc(txt)}</option>`).join("")}</optgroup>`).join("")}`;
  }

  // ---------------------------------------------------------------- Lista
  function tarjeta(r, i, n) {
    const est = estadoTemporizador();
    const enCurso = est.rutinaId === r.id && est.estado !== "parado" && est.estado !== "terminado";
    return `
      <article class="panel rutina${enCurso ? " en-curso" : ""}" data-id="${esc(r.id)}">
        <header class="rutina-cab">
          <div>
            <h2>${esc(r.nombre)}</h2>
            <p class="sub">${r.ejercicios.length} ${r.ejercicios.length === 1 ? "ejercicio" : "ejercicios"} · <b>${durTxt(minutosTotales(r))}</b>${enCurso ? ` · <span class="rutina-curso">en curso (${est.paso + 1}/${r.ejercicios.length})</span>` : ""}</p>
          </div>
          <div class="rutina-acciones">
            <button type="button" class="btn-play" data-accion="empezar">${icono("play")}<span>${enCurso ? "Reiniciar" : "Empezar"}</span></button>
            <button type="button" class="btn-mini" data-accion="editar">${icono("lapiz")} Editar</button>
            <button type="button" class="btn-mini" data-accion="duplicar">Duplicar</button>
            <button type="button" class="btn-mini" data-accion="subir" aria-label="Subir rutina" title="Subir" ${i === 0 ? "disabled" : ""}>↑</button>
            <button type="button" class="btn-mini" data-accion="bajar" aria-label="Bajar rutina" title="Bajar" ${i === n - 1 ? "disabled" : ""}>↓</button>
            <button type="button" class="btn-mini peligro" data-accion="borrar">Borrar</button>
          </div>
        </header>
        <ol class="rutina-ejercicios">
          ${r.ejercicios.map((e) => `
            <li><span class="rutina-min">${durTxt(e.min)}</span>
              <div><b>${esc(e.nombre)}</b>${e.enlace ? ` <a href="${esc(e.enlace)}" class="rutina-enlace">${icono("sig")}${esc(e.enlaceTxt || "Abrir")}</a>` : ""}
              ${e.nota ? `<small>${esc(e.nota)}</small>` : ""}</div></li>`).join("")}
        </ol>
      </article>`;
  }

  function pintar() {
    main.querySelectorAll(".practicas-inst [data-inst]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.inst === inst)));
    const rutinas = listar(inst);
    const nombre = INSTRUMENTOS[inst].toLowerCase();
    if (editando) {
      const r = editando === "nueva" ? null : obtener(editando);
      cuerpo.innerHTML = editor(r);
      cuerpo.querySelector('[name="nombre"]').focus();
      return;
    }
    cuerpo.innerHTML = `
      ${rutinas.length ? rutinas.map((r, i) => tarjeta(r, i, rutinas.length)).join("") : `
        <div class="vacio practicas-vacio"><p>Todavía no tienes rutinas de ${nombre}.</p>
          <p class="nota-texto">Una rutina es una lista de ejercicios con sus minutos, por ejemplo:
          «Cuerdas al aire · 5 min», «Escala de Re mayor · 10 min», «Lightly Row · 15 min».</p></div>`}
      <button type="button" class="btn practicas-nueva" data-accion="nueva">${icono("mas")} Nueva rutina de ${nombre}</button>`;
  }

  // ---------------------------------------------------------------- Editor
  function filaEjercicio(e = {}) {
    return `
      <li class="fila-ej">
        <span class="fila-num" aria-hidden="true"></span>
        <input class="ej-nombre" value="${esc(e.nombre || "")}" placeholder="Ejercicio (p. ej. Escala de Re mayor)" aria-label="Nombre del ejercicio" maxlength="120">
        <label class="ej-min"><input type="number" min="1" max="240" step="1" value="${e.min || 5}" inputmode="numeric" aria-label="Minutos"> min</label>
        <select class="ej-enlace" aria-label="Abrir con este ejercicio">${opcionesEnlace(inst, e)}</select>
        <input class="ej-nota" value="${esc(e.nota || "")}" placeholder="Nota opcional: tempo, qué cuidar…" aria-label="Nota del ejercicio" maxlength="300">
        <span class="fila-botones">
          <button type="button" class="btn-mini" data-fila="subir" aria-label="Subir ejercicio" title="Subir">↑</button>
          <button type="button" class="btn-mini" data-fila="bajar" aria-label="Bajar ejercicio" title="Bajar">↓</button>
          <button type="button" class="btn-mini peligro" data-fila="quitar" aria-label="Quitar ejercicio" title="Quitar">✕</button>
        </span>
        ${e.id ? `<input type="hidden" class="ej-id" value="${esc(e.id)}">` : ""}
      </li>`;
  }

  function editor(r) {
    return `
      <form class="panel rutina-editor" novalidate>
        <h2>${r ? "Editar rutina" : `Nueva rutina de ${INSTRUMENTOS[inst].toLowerCase()}`}</h2>
        <label class="editor-nombre">Nombre <input name="nombre" value="${esc(r?.nombre || "")}" placeholder="p. ej. Violín diario" maxlength="80" required></label>
        <p class="nota-texto">Ejercicios en orden. «Abrir con» pone un botón en el reloj para ir directo a esa canción o herramienta.</p>
        <ol class="editor-ejercicios">${(r?.ejercicios.length ? r.ejercicios : [{}]).map(filaEjercicio).join("")}</ol>
        <button type="button" class="btn-mini" data-accion="fila-nueva">${icono("mas")} Añadir ejercicio</button>
        <p class="editor-total" aria-live="polite"></p>
        <p class="editor-error" role="alert" hidden></p>
        <div class="editor-acciones">
          <button type="submit" class="btn-play">${icono("check")}<span>Guardar</span></button>
          <button type="button" class="btn" data-accion="cancelar">Cancelar</button>
        </div>
      </form>`;
  }

  function leerEditor(form) {
    const ejercicios = [...form.querySelectorAll(".fila-ej")].map((li) => {
      const sel = li.querySelector(".ej-enlace");
      return {
        id: li.querySelector(".ej-id")?.value,
        nombre: li.querySelector(".ej-nombre").value,
        min: Number(li.querySelector(".ej-min input").value),
        nota: li.querySelector(".ej-nota").value,
        enlace: sel.value,
        enlaceTxt: sel.selectedOptions[0]?.dataset.txt || "",
      };
    });
    return { nombre: form.querySelector('[name="nombre"]').value, ejercicios };
  }

  function totalEditor(form) {
    const filas = [...form.querySelectorAll(".fila-ej")];
    filas.forEach((li, i) => {
      li.querySelector(".fila-num").textContent = `${i + 1}.`;
      li.querySelector('[data-fila="subir"]').disabled = i === 0;
      li.querySelector('[data-fila="bajar"]').disabled = i === filas.length - 1;
      li.querySelector('[data-fila="quitar"]').disabled = filas.length === 1;
    });
    const min = filas.reduce((s, li) => s + Math.max(0, Math.round(Number(li.querySelector(".ej-min input").value) || 0)), 0);
    form.querySelector(".editor-total").innerHTML = `Total: <b>${durTxt(min)}</b> · ${filas.length} ${filas.length === 1 ? "ejercicio" : "ejercicios"}`;
  }

  // ---------------------------------------------------------------- Eventos
  main.addEventListener("click", (e) => {
    const tab = e.target.closest(".practicas-inst [data-inst]");
    if (tab) {
      if (editando && !confirm("¿Salir sin guardar la rutina?")) return;
      inst = tab.dataset.inst;
      editando = null;
      setPref("practicasInstrumento", inst);
      history.replaceState(null, "", `#/practicas/${inst}`);
      pintar();
      return;
    }
    const b = e.target.closest("button[data-accion], button[data-fila]");
    if (!b) return;
    const form = b.closest("form");
    if (b.dataset.fila && form) {
      const li = b.closest(".fila-ej");
      if (b.dataset.fila === "subir" && li.previousElementSibling) li.previousElementSibling.before(li);
      if (b.dataset.fila === "bajar" && li.nextElementSibling) li.nextElementSibling.after(li);
      if (b.dataset.fila === "quitar" && form.querySelectorAll(".fila-ej").length > 1) li.remove();
      totalEditor(form);
      return;
    }
    const id = b.closest("[data-id]")?.dataset.id;
    switch (b.dataset.accion) {
      case "nueva": editando = "nueva"; pintar(); totalEditor(cuerpo.querySelector("form")); break;
      case "editar": editando = id; pintar(); totalEditor(cuerpo.querySelector("form")); break;
      case "cancelar": editando = null; pintar(); break;
      case "fila-nueva": {
        form.querySelector(".editor-ejercicios").insertAdjacentHTML("beforeend", filaEjercicio());
        totalEditor(form);
        form.querySelector(".fila-ej:last-child .ej-nombre").focus();
        break;
      }
      case "empezar": {
        const est = estadoTemporizador();
        if (est.estado !== "parado" && est.estado !== "terminado" && !confirm("Ya hay una práctica en curso. ¿Empezar esta rutina desde el principio?")) return;
        empezarRutina(id);
        break;
      }
      case "duplicar": {
        const r = obtener(id);
        if (r) guardar({ ...r, id: undefined, nombre: `${r.nombre} (copia)`, ejercicios: r.ejercicios.map((x) => ({ ...x, id: undefined })) });
        break;
      }
      case "subir": mover(id, -1); break;
      case "bajar": mover(id, 1); break;
      case "borrar": {
        const r = obtener(id);
        if (r && confirm(`¿Borrar la rutina «${r.nombre}»? No se puede deshacer.`)) borrar(id);
        break;
      }
      case "exportar": {
        const url = URL.createObjectURL(new Blob([exportar()], { type: "application/json" }));
        const a = Object.assign(document.createElement("a"), { href: url, download: `rutinas-atril-${new Date().toISOString().slice(0, 10)}.json` });
        document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        msg.textContent = `Exporté ${listar().length} rutinas.`;
        break;
      }
    }
  });

  main.addEventListener("input", (e) => {
    const form = e.target.closest("form.rutina-editor");
    if (form && e.target.closest(".ej-min")) totalEditor(form);
  });

  main.addEventListener("change", async (e) => {
    if (e.target.dataset.accion !== "importar" || !e.target.files[0]) return;
    try {
      const n = importar(await e.target.files[0].text());
      msg.textContent = `Importé ${n} ${n === 1 ? "rutina" : "rutinas"}.`;
    } catch (err) {
      msg.textContent = err.message;
    }
    e.target.value = "";
  });

  main.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target;
    const datos = leerEditor(form);
    const error = form.querySelector(".editor-error");
    const vacias = datos.ejercicios.filter((x) => !x.nombre.trim());
    const malos = datos.ejercicios.filter((x) => !(x.min >= 1 && x.min <= 240));
    const problema = !datos.nombre.trim() ? "Ponle un nombre a la rutina."
      : vacias.length === datos.ejercicios.length ? "Escribe al menos un ejercicio."
      : vacias.length ? "Hay ejercicios sin nombre: escríbelo o quítalos con ✕."
      : malos.length ? "Los minutos de cada ejercicio van de 1 a 240." : "";
    if (problema) {
      error.textContent = problema;
      error.hidden = false;
      (form.querySelector(!datos.nombre.trim() ? '[name="nombre"]' : vacias.length ? ".fila-ej .ej-nombre:placeholder-shown" : ".ej-min input") || form).focus();
      return;
    }
    guardar({ id: editando === "nueva" ? undefined : editando, instrumento: inst, ...datos });
    editando = null;
    pintar();
  });

  const alCambiar = () => { if (!editando) pintar(); };
  window.addEventListener(EVENTO, alCambiar);
  window.addEventListener(EVENTO_TEMPORIZADOR, alCambiar);
  pintar();

  return () => {
    window.removeEventListener(EVENTO, alCambiar);
    window.removeEventListener(EVENTO_TEMPORIZADOR, alCambiar);
  };
}
