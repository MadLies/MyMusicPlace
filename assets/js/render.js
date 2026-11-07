// Dibuja una tablatura (ya leída con leerTab) y devuelve la lista de eventos para reproducirla.
import { midiNota, nombreNota, textoNota } from "./notas.js";
import { icono } from "./iconos.js";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export { esc };

export function chipHTML(nota, tono, i = null) {
  const clase = `n ${nota.aspira ? "aspira" : "sopla"}${nota.bends ? " bend" : ""}`;
  const data = i === null ? "" : ` data-i="${i}"`;
  return `<button type="button" class="${clase}"${data}><b>${textoNota(nota)}</b><small>${nombreNota(midiNota(nota, tono))}</small></button>`;
}

/**
 * opciones.controles: añade botones por sección (tocar, repetir, aprendida).
 * Devuelve { eventos, rangos } — rangos[s] = [primer, último] índice de evento de la sección s.
 */
export function renderTab(tab, contenedor, { tono, controles = false, aprendidas = {} } = {}) {
  const eventos = [];
  const rangos = [];
  const partes = [];
  if (tab.intro.length) partes.push(`<div class="intro">${tab.intro.map((t) => `<p>${esc(t.texto)}</p>`).join("")}</div>`);

  tab.secciones.forEach((s, si) => {
    const inicio = eventos.length;
    const cuerpo = [];
    let tieneTab = false;
    for (const it of s.items) {
      if (it.tipo === "texto") { cuerpo.push(`<p class="nota-texto">${esc(it.texto)}</p>`); continue; }
      tieneTab = true;
      let html = '<div class="linea">';
      for (const t of it.tokens) {
        if (t.tipo === "pausa") {
          eventos.push({ tipo: "pausa", dur: 1, seccion: si });
          html += `<span class="pausa" data-i="${eventos.length - 1}" title="Pausa"></span>`;
        } else if (t.tipo === "barra") {
          html += '<span class="barra" aria-hidden="true"></span>';
        } else {
          const k = t.notas.length;
          html += `<span class="grupo${k > 1 ? " junto" : ""}">`;
          for (const n of t.notas) {
            eventos.push({ tipo: "nota", nota: n, dur: 1 / k, seccion: si });
            html += chipHTML(n, tono, eventos.length - 1);
          }
          html += "</span>";
        }
      }
      html += "</div>";
      cuerpo.push(html);
      eventos.push({ tipo: "respiro", dur: 1, seccion: si }); // pausa natural al final de cada frase
    }
    const fin = eventos.length - 1;
    rangos.push(fin >= inicio ? [inicio, fin] : null);
    const detalle = s.detalle.length ? `<span class="det">${esc(s.detalle.join(" · "))}</span>` : "";
    const botones = controles && tieneTab ? `
      <div class="sec-acciones">
        <button type="button" class="btn-mini" data-accion="tocar-seccion" data-s="${si}" title="Tocar solo esta parte">${icono("play")}<span>Tocar</span></button>
        <button type="button" class="btn-mini" data-accion="repetir-seccion" data-s="${si}" aria-pressed="false" title="Repetir esta parte en bucle">${icono("repetir")}<span>Repetir</span></button>
        <label class="btn-mini check" title="Marcar como aprendida"><input type="checkbox" data-accion="aprendida" data-s="${si}" ${aprendidas[si] ? "checked" : ""}>${icono("check")}<span>Aprendida</span></label>
      </div>` : "";
    partes.push(`<section class="seccion${tieneTab ? "" : " solo-texto"}${aprendidas[si] ? " hecha" : ""}" data-s="${si}">
      <header class="sec-cab"><h3>${esc(s.titulo)} ${detalle}</h3>${botones}</header>${cuerpo.join("")}</section>`);
  });
  contenedor.innerHTML = partes.join("");
  return { eventos, rangos };
}

export function actualizarNombres(contenedor, eventos, tono) {
  contenedor.querySelectorAll(".n[data-i]").forEach((el) => {
    const ev = eventos[Number(el.dataset.i)];
    if (ev?.nota) el.querySelector("small").textContent = nombreNota(midiNota(ev.nota, tono));
  });
}

export function leyendaHTML(tono) {
  const ej = (raw) => {
    const m = /^(-?)(\d+)('*)$/.exec(raw);
    return chipHTML({ aspira: m[1] === "-", hoyo: Number(m[2]), bends: m[3].length }, tono);
  };
  return `<div class="leyenda">
    <span>${ej("4")} soplar</span>
    <span>${ej("-4")} aspirar</span>
    <span>${ej("-4'")} bend</span>
    <span><span class="grupo junto">${ej("-2")}${ej("-2")}</span> rápidas</span>
    <span><span class="pausa"></span> pausa</span>
  </div>`;
}
