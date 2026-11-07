// Dibuja una tablatura (ya leída con leerTab) y devuelve la lista de eventos para reproducirla.
import { midiNota, nombreNota, textoNota } from "./notas.js";
import { icono } from "./iconos.js";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export { esc };

const FRACCIONES = { 0.5: "½", 0.25: "¼", 0.75: "¾", 0.125: "⅛" };
export const textoDuracion = (d) => FRACCIONES[d] || (Math.abs(d - 1 / 3) < 0.01 ? "⅓" : Math.abs(d - 2 / 3) < 0.01 ? "⅔" : String(Math.round(d * 100) / 100));
const pulsos = (d) => (d === 1 ? "1 pulso" : `${textoDuracion(d)} pulsos`);

export function chipHTML(nota, tono, i = null, dur = null) {
  const clase = `n ${nota.aspira ? "aspira" : "sopla"}${nota.bends ? " bend" : ""}`;
  const data = i === null ? "" : ` data-i="${i}"`;
  const corta = dur !== null && dur < 1 ? `<i class="dur">${textoDuracion(dur)}</i>` : "";
  const titulo = dur !== null && dur !== 1 ? ` title="Dura ${pulsos(dur)}"` : "";
  return `<button type="button" class="${clase}"${data}${titulo}><b>${textoNota(nota)}</b><small>${nombreNota(midiNota(nota, tono))}</small>${corta}</button>`;
}

// Cola que alarga visualmente una nota de más de un pulso (un tramo por pulso extra).
const cola = (extra) => (extra > 0 ? `<span class="cola" style="--d:${extra}" aria-hidden="true"></span>` : "");

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
          eventos.push({ tipo: "pausa", dur: t.dur, seccion: si });
          html += `<span class="pausa" data-i="${eventos.length - 1}" style="--d:${t.dur}" title="Pausa de ${pulsos(t.dur)}"></span>`;
        } else if (t.tipo === "barra") {
          html += '<span class="barra" aria-hidden="true"></span>';
        } else {
          const k = t.notas.length;
          const cada = t.dur / k;
          html += `<span class="grupo${k > 1 ? " junto" : ""}">`;
          for (const n of t.notas) {
            eventos.push({ tipo: "nota", nota: n, dur: cada, seccion: si });
            html += chipHTML(n, tono, eventos.length - 1, k > 1 ? null : t.dur);
          }
          html += `${cola(t.dur - 1)}</span>`;
        }
      }
      html += "</div>";
      cuerpo.push(html);
      if (!tab.conRitmo) eventos.push({ tipo: "respiro", dur: 1, seccion: si }); // sin ritmo escrito: respira al final de cada frase
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
    <span><span class="grupo">${ej("6")}${cola(1)}</span> larga (6:2)</span>
    <span><span class="pausa"></span> pausa</span>
  </div>`;
}
