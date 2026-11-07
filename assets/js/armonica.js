// Dibujo interactivo de una armónica de 10 hoyos.
import { SOPLA, ASPIRA, BENDS_ASPIRA, BENDS_SOPLA, midiBase, nombreNota, frecuencia, midiNota } from "./notas.js";
import { tocarNota } from "./audio.js";

export function crearArmonica(contenedor, { tono = "C", compacta = false, alTocar } = {}) {
  const raiz = document.createElement("div");
  raiz.className = "harp" + (compacta ? " compacta" : "");
  raiz.setAttribute("role", "group");
  raiz.setAttribute("aria-label", "Armónica de 10 hoyos");
  contenedor.replaceChildren(raiz);
  let tonoActual = tono;

  function pintar() {
    const base = midiBase(tonoActual);
    let html = '<div class="harp-etq sopla">Soplar</div>';
    for (let h = 1; h <= 10; h++) html += celda(h, false, base);
    html += '<div class="harp-etq"></div>';
    for (let h = 1; h <= 10; h++) html += `<div class="harp-hoyo" data-h="${h}"><span>${h}</span></div>`;
    html += '<div class="harp-etq aspira">Aspirar</div>';
    for (let h = 1; h <= 10; h++) html += celda(h, true, base);
    raiz.innerHTML = html;
  }

  function celda(h, aspira, base) {
    const midi = base + (aspira ? ASPIRA : SOPLA)[h];
    const nb = aspira ? BENDS_ASPIRA[h] : BENDS_SOPLA[h];
    const bends = nb ? `<i title="Bends posibles">${"ʼ".repeat(nb)}</i>` : "";
    return `<button type="button" class="harp-nota ${aspira ? "aspira" : "sopla"}" data-h="${h}" data-a="${aspira ? 1 : 0}"
      aria-label="${aspira ? "Aspirar" : "Soplar"} hoyo ${h}: ${nombreNota(midi)}">${nombreNota(midi)}${bends}</button>`;
  }

  raiz.addEventListener("click", (e) => {
    const b = e.target.closest(".harp-nota");
    if (!b) return;
    const nota = { hoyo: Number(b.dataset.h), aspira: b.dataset.a === "1", bends: 0 };
    tocarNota(frecuencia(midiNota(nota, tonoActual)), 0.5);
    resaltar(nota);
    alTocar?.(nota);
  });

  function resaltar(nota) {
    raiz.querySelectorAll(".on").forEach((el) => el.classList.remove("on"));
    raiz.querySelectorAll(".bend-activo").forEach((el) => el.classList.remove("bend-activo"));
    if (!nota) return;
    raiz.querySelector(`.harp-hoyo[data-h="${nota.hoyo}"]`)?.classList.add("on");
    const el = raiz.querySelector(`.harp-nota[data-h="${nota.hoyo}"][data-a="${nota.aspira ? 1 : 0}"]`);
    el?.classList.add("on");
    if (nota.bends) el?.classList.add("bend-activo");
  }

  pintar();
  return {
    raiz,
    resaltar,
    setTono(t) { tonoActual = t; pintar(); },
  };
}
