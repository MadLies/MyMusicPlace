// Teoría: escalas en el teclado (las 12 tonalidades, menores, modos griegos, pentatónicas)
// y armonía de una tonalidad (acordes, funciones, progresiones, dominantes secundarias,
// préstamo modal y círculo de quintas).
import {
  ESCALAS, GRUPOS, MODOS_BRILLO, MAYOR, escala, tonicaDe, enarmonica, armadura, textoArmadura, armaduraCorta,
  formulaGrados, formulaPasos, nombreGrado, nombre, cifra, pc, deletrear, mod12,
  clave, acordesDiatonicos, dominantesSecundarias, prestados, acordeNumeral, notasExtranas, sensible,
  FUNCIONES, PROGRESIONES,
} from "../teoria.js";
import { tecladoSVG, pulsar } from "../teclado.js";
import { diapasonSVG, pulsarViolin, dedosCuerda, posicionViolin, CUERDAS_VIOLIN, ZONA, FIN_PRIMERA } from "../diapason.js";
import { tocarNota } from "../audio.js";
import { frecuencia } from "../notas.js";
import { pref, setPref } from "../progreso.js";
import { icono } from "../iconos.js";

const lista = (ns) => ns.map(nombre).join(" · ");

export async function mostrar(main, [pestanaRuta]) {
  let pestana = pestanaRuta || pref("teoriaPestana", "escalas");
  // Atajos: #/teoria/violin o #/teoria/piano abren las escalas en ese instrumento.
  let instrRuta = null;
  if (["violin", "piano"].includes(pestana)) { instrRuta = pestana; pestana = "escalas"; }
  if (!["escalas", "armonia"].includes(pestana)) pestana = "escalas";
  let p = Number(pref("teoriaTonica", 0));
  let tipo = pref("teoriaTipo", "mayor");
  if (!ESCALAS[tipo]) tipo = "mayor";
  let etiquetas = pref("teoriaEtiquetas", "nombres");
  let instr = instrRuta || pref("teoriaInstrumento", "piano"); // piano | violin | ambos
  if (instrRuta) setPref("teoriaInstrumento", instr);
  let violinAlto = pref("teoriaViolinAlto", false);
  let modo = pref("armoniaModo", "mayor");
  let septimas = pref("armoniaSeptimas", false);

  main.innerHTML = `
    <h1>Teoría</h1>
    <p class="sub">Escalas en el teclado y la armonía de cada tonalidad: qué acordes tiene, qué función cumple cada uno y qué acordes «invitados» puedes traer de fuera.</p>
    <div class="segmentos modos" role="tablist" aria-label="Tema">
      <button type="button" role="tab" data-pestana="escalas">Escalas</button>
      <button type="button" role="tab" data-pestana="armonia">Armonía</button>
    </div>
    <div id="cuerpo"></div>`;
  const $ = (s) => main.querySelector(s);
  const cuerpo = $("#cuerpo");

  // ---------------------------------------------------------------- Sonido
  let timers = [];
  let sonando = null; // qué se está reproduciendo (para el botón de parar)
  function parar() {
    timers.forEach(clearTimeout);
    timers = [];
    sonando = null;
    main.querySelectorAll(".sonando-ahora").forEach((x) => x.classList.remove("sonando-ahora"));
    main.querySelectorAll("[data-reproduce]").forEach((b) => { b.innerHTML = `${icono("play")}<span>${b.dataset.etq || ""}</span>`; b.classList.remove("sonando"); });
  }
  // Las notas se lanzan en su momento (no se programan por adelantado): así, al parar o
  // cambiar de página no queda nada sonando de fondo.
  const despues = (ms, fn) => timers.push(setTimeout(fn, ms));
  function nota(midi, dur = 0.5, vol = 0.22) {
    tocarNota(frecuencia(midi), dur, { timbre: "piano", volumen: vol });
    pulsar(main.querySelector(".teclado-principal svg"), midi, Math.max(200, dur * 900));
  }
  function botonSonando(b) {
    if (!b) return;
    b.innerHTML = `${icono("stop")}<span>Parar</span>`;
    b.classList.add("sonando");
  }

  // ================================================================ ESCALAS
  // Cómo se marca una nota de la escala (en el teclado o en el diapasón); null si no está.
  function marcaDe(notas, m, conEtiquetas = true) {
    const grados = formulaGrados(tipo);
    const car = ESCALAS[tipo].caracteristica;
    const i = notas.findIndex((n) => pc(n) === mod12(m));
    if (i < 0) return null;
    const n = notas[i];
    const texto = etiquetas === "cifrado" ? cifra(n) : etiquetas === "grados" ? grados[i].texto : nombre(n);
    return {
      tipo: (i === 0 ? "tonica" : "escala") + (i === car ? " caract" : ""),
      texto: conEtiquetas ? texto : "",
      sub: conEtiquetas ? (etiquetas === "grados" ? nombre(n) : grados[i].texto) : "",
      n, i,
    };
  }
  function marcasEscala(t, notas, conEtiquetas, desde, hasta) {
    const marcas = new Map();
    for (let m = desde; m <= hasta; m++) {
      const mk = marcaDe(notas, m, conEtiquetas);
      if (mk) marcas.set(m, mk);
    }
    return marcas;
  }

  // ---------------------------------------------------------------- Violín
  // Escala en 1ª posición: desde la tónica más grave del violín; dos octavas si caben (hasta el 4º dedo en Mi).
  function rangoViolin() {
    const base = 55 + mod12(p - 7);
    return { base, octavas: base + 24 <= 76 + FIN_PRIMERA ? 2 : 1 };
  }

  function patronDedos(dedos, k) {
    const ss = [...dedos.keys()].filter((s) => s > 0).sort((a, b) => a - b);
    const partes = [];
    if (ss[0] === 1) partes.push("1 bajo, pegado a la cejuela");
    for (let j = 1; j < ss.length; j++) {
      const a = ss[j - 1], b = ss[j], da = dedos.get(a), db = dedos.get(b);
      if (b - a === 1) partes.push(da === db ? `el ${da} se desliza medio tono` : `<b>${da} y ${db} juntos</b>`);
      else if (b - a === 3) partes.push(`tono y medio entre ${da} y ${db}`);
    }
    if (dedos.has(FIN_PRIMERA) && CUERDAS_VIOLIN[k + 1]) partes.push(`el 4 suena igual que la cuerda ${CUERDAS_VIOLIN[k + 1].id} al aire`);
    return partes.length ? partes.join(" · ") : "sin dedos juntos";
  }

  function panelViolin(t, notas) {
    const e = ESCALAS[tipo];
    const marca = (m) => marcaDe(notas, m);
    const { base, octavas } = rangoViolin();
    const ini = posicionViolin(base);
    const filas = CUERDAS_VIOLIN.map((c, k) => {
      const dedos = dedosCuerda(c, (m) => !!marca(m));
      const chips = [...dedos].map(([s, d]) => {
        const mk = marca(c.midi + s);
        return `<span class="dg${mk.i === 0 ? " tonica" : ""}" title="${ZONA[s]}"><b>${nombre(mk.n)}</b><i>${d}</i></span>`;
      }).join("");
      return `<div class="dig-fila"><b class="dig-cuerda">${c.id}</b><div class="dig-notas">${chips || "—"}</div><div class="sub">${patronDedos(dedos, k)}</div></div>`;
    }).join("");
    return `
      <div class="panel violin-panel">
        <div class="teclado-cab">
          <h2>${nombre(t)} ${e.nombre} en el violín</h2>
          <button type="button" class="btn-play" data-accion="tocar-violin" data-reproduce data-etq="Escuchar">${icono("play")}<span>Escuchar</span></button>
        </div>
        <div class="violin-cuerpo">
          <div>
            ${diapasonSVG({ marca, hasta: violinAlto ? 12 : FIN_PRIMERA, titulo: `Escala de ${nombre(t)} ${e.nombre} en el diapasón del violín` })}
            <label class="interruptor"><input type="checkbox" data-accion="violin-alto" ${violinAlto ? "checked" : ""}> Ver más arriba (hasta la octava de cada cuerda)</label>
          </div>
          <div>
            <h3>Digitación en 1ª posición</h3>
            <p class="sub">Cada nota con su dedo (0 = cuerda al aire). La 1ª posición es la de la mano cerca de la voluta: el 1er dedo a un tono de la cuerda al aire.</p>
            <div class="digitacion">${filas}</div>
            <p class="nota-texto">«Escuchar» toca ${octavas === 2 ? "dos octavas" : "una octava"} desde el ${nombre(t)} más grave del violín: cuerda ${ini.cuerda.id}, ${ini.s === 0 ? "al aire" : `dedo ${ZONA[ini.s]}`}.</p>
            <div class="vd-info" id="vd-info" aria-live="polite">Toca un punto del diapasón para oír la nota.</div>
          </div>
        </div>
        <p class="nota-texto">Vista del diapasón como si miraras tu violín: la voluta arriba y el puente abajo; de izquierda a derecha, de la cuerda más grave (Sol) a la más aguda (Mi). Cada fila es medio tono (el violín no tiene trastes: las líneas son solo una guía). El número amarillo es el dedo en 1ª posición.</p>
      </div>`;
  }

  function notaViolin(m, dur, pos = posicionViolin(m)) {
    tocarNota(frecuencia(m), dur, { timbre: "violin", volumen: 0.2 });
    if (pos) pulsarViolin(main.querySelector(".diapason-svg"), CUERDAS_VIOLIN.indexOf(pos.cuerda), pos.s, Math.max(220, dur * 900));
  }

  function tocarEscalaViolin(b) {
    if (sonando === "violin") { parar(); return; }
    parar();
    sonando = "violin";
    botonSonando(b);
    const { base, octavas } = rangoViolin();
    const sube = [];
    for (let o = 0; o < octavas; o++) ESCALAS[tipo].pasos.forEach((x) => sube.push(base + 12 * o + x));
    sube.push(base + 12 * octavas);
    const secuencia = [...sube, ...sube.slice(0, -1).reverse()];
    secuencia.forEach((m, i) => despues(i * 360, () => notaViolin(m, 0.45)));
    despues(secuencia.length * 360 + 300, parar);
  }

  function infoViolin(g) {
    const midi = Number(g.dataset.midi), k = Number(g.dataset.cuerda), s = Number(g.dataset.s);
    const c = CUERDAS_VIOLIN[k];
    const t = tonicaDe(p, tipo), notas = escala(t, tipo);
    const mk = marcaDe(notas, midi);
    const dedo = mk && s > 0 && s <= FIN_PRIMERA ? dedosCuerda(c, (m) => !!marcaDe(notas, m)).get(s) : null;
    const donde = s === 0 ? "al aire" : s <= FIN_PRIMERA ? `${dedo ? `dedo ${dedo}` : ZONA[s]} en 1ª posición` : "más arriba (3ª posición o más)";
    const que = mk ? `es el grado <b>${formulaGrados(tipo)[mk.i].texto}</b> de ${nombre(t)} ${ESCALAS[tipo].nombre}` : `no está en ${nombre(t)} ${ESCALAS[tipo].nombre}`;
    // Fuera de la escala: con ♭ si la escala usa bemoles, con ♯ si no.
    const conBemoles = notas.some((n) => n.a < 0);
    const alt = [...Array(7).keys()].map((l) => deletrear(midi, l)).filter((n) => Math.abs(n.a) <= 1)
      .sort((x, y) => Math.abs(x.a) - Math.abs(y.a) || (conBemoles ? x.a - y.a : y.a - x.a))[0];
    const nom = mk ? nombre(mk.n) : nombre(alt);
    return `<b>${nom}</b> · cuerda ${c.id}, ${donde} — ${que}.`;
  }

  function relacion(t, e) {
    const k = e.modo ? e.modo - 1 : null;
    if (e.id === "mayor" || e.id === "jonico") {
      const r = deletrear(pc(t) + 9, t.l + 5);
      return `Relativa menor: <b>${nombre(r)} menor</b> (mismas notas, empieza en el 6º grado). Homónima: ${nombre(t)} menor.`;
    }
    if (["menor", "eolico", "armonica", "melodica"].includes(e.id)) {
      const r = deletrear(pc(t) + 3, t.l + 2);
      return `Relativa mayor: <b>${nombre(r)} mayor</b>${e.id === "menor" || e.id === "eolico" ? " (mismas notas)" : " (su armadura)"}. Homónima: ${nombre(t)} mayor.`;
    }
    if (k !== null) {
      const padre = deletrear(pc(t) - MAYOR[k], t.l - k);
      return `Mismas notas que <b>${nombre(padre)} mayor</b>, pero empezando en su ${k + 1}º grado (${nombre(t)}).`;
    }
    if (e.id === "pentaMayor") return `Mismas notas que la pentatónica menor de ${nombre(deletrear(pc(t) + 9, t.l + 5))} (su relativa).`;
    if (e.id === "pentaMenor") return `Mismas notas que la pentatónica mayor de ${nombre(deletrear(pc(t) + 3, t.l + 2))} (su relativa).`;
    return `Es la pentatónica menor de ${nombre(t)} con una nota más: la ♭5 (${nombre(escala(t, tipo)[3])}).`;
  }

  function fichaEscala(t, notas) {
    const e = ESCALAS[tipo];
    const grados = formulaGrados(tipo);
    const pasos = formulaPasos(tipo);
    const base = escala(t, e.base);
    const ar = armadura(base);
    const accid = notas.filter((n) => !base.some((b) => pc(b) === pc(n)));
    const enar = enarmonica(p, tipo);
    const car = e.caracteristica;
    const chips = notas.map((n, i) => `<span class="chip-nota${i === 0 ? " tonica" : ""}${i === car ? " caract" : ""}"><b>${nombre(n)}</b><small>${cifra(n)} · ${grados[i].texto}</small></span>${i < notas.length - 1 ? `<i class="paso">${pasos[i]}</i>` : ""}`).join("") +
      `<i class="paso">${pasos[pasos.length - 1]}</i><span class="chip-nota tonica"><b>${nombre(t)}</b><small>octava</small></span>`;
    // Ir a la armonía: de la propia tonalidad o, en los modos, de la mayor de la que salen.
    let ir = "";
    if (e.clave) ir = `<button type="button" class="btn" data-ir-armonia="${p}:${e.clave}">Ver la armonía de ${nombre(t)} ${e.clave} →</button>`;
    else if (e.modo) {
      const k = e.modo - 1, padre = deletrear(pc(t) - MAYOR[k], t.l - k);
      ir = `<button type="button" class="btn" data-ir-armonia="${pc(padre)}:mayor">Ver la armonía de ${nombre(padre)} mayor (mismas notas) →</button>`;
    }
    return `
      <section class="panel ficha">
        <div class="notas-escala">${chips}</div>
        <p class="leyenda-pasos"><b>T</b> = tono · <b>St</b> = semitono${pasos.includes("T½") ? " · <b>T½</b> = tono y medio" : ""}</p>
        <dl class="datos">
          <dt>Grados</dt><dd>${grados.map((g) => `<span class="${g.alterado ? "alterado" : ""}">${g.texto}</span>`).join(" ")} <small>(comparada con la escala mayor)</small></dd>
          <dt>Armadura</dt><dd>${textoArmadura(ar)}${accid.length ? ` + ${accid.map(nombre).join(", ")} como accidente` : ""}${e.base !== tipo && !e.modo && !accid.length ? ` (la de ${nombre(t)} ${e.base})` : ""}</dd>
          <dt>Relación</dt><dd>${relacion(t, e)}</dd>
          ${car !== undefined ? `<dt>Nota característica</dt><dd><b>${nombre(notas[car])}</b> (${grados[car].texto}): la que distingue a este modo. Está marcada con un anillo.</dd>` : ""}
          ${enar ? `<dt>También se escribe</dt><dd>${nombre(enar)} ${e.nombre}: ${lista(escala(enar, tipo))}</dd>` : ""}
        </dl>
        <p class="caracter">${e.caracter}</p>
        ${notas.length === 7 ? `<details class="ayuda"><summary>Nombre de cada grado</summary><table>${notas.map((n, i) => `<tr><td>${grados[i].texto}</td><td><b>${nombre(n)}</b></td><td>${nombreGrado(tipo, i)}</td></tr>`).join("")}</table></details>` : ""}
        ${ir}
      </section>`;
  }

  function comparar() {
    const e = ESCALAS[tipo];
    let tipos, titulo, nota = "";
    if (e.modo || tipo === "mayor") {
      tipos = MODOS_BRILLO;
      titulo = "Los 7 modos, del más brillante al más oscuro";
      nota = "Cada modo baja una nota respecto al anterior. Las notas resaltadas son las que cambian frente a la escala mayor.";
    } else if (e.base === "menor" && !e.letras) {
      tipos = ["menor", "armonica", "melodica", "dorico"];
      titulo = "Las escalas menores";
      nota = "Las tres menores comparten el comienzo (1 2 ♭3 4 5) y cambian en el 6º y el 7º grados.";
    } else {
      tipos = ["pentaMayor", "pentaMenor", "blues"];
      titulo = "Pentatónicas y blues";
    }
    const actual = tipo === "mayor" ? "jonico" : tipo;
    return `<section class="comparar"><h2>${titulo}</h2>${nota ? `<p class="sub">${nota}</p>` : ""}
      <div class="comparar-lista">${tipos.map((x) => {
        const t = tonicaDe(p, x), g = formulaGrados(x);
        return `<button type="button" class="fila-escala" data-tipo="${x}" aria-pressed="${x === actual || (tipo === "eolico" && x === "menor")}">
          <b>${nombre(t)} ${ESCALAS[x].nombre}</b>
          <span class="grados">${g.map((y) => `<i class="${y.alterado ? "alterado" : ""}">${y.texto}</i>`).join("")}</span>
          <span class="sub">${lista(escala(t, x))}</span>
        </button>`;
      }).join("")}</div></section>`;
  }

  function galeria() {
    const e = ESCALAS[tipo];
    // Orden del círculo de quintas, empezando por la que no lleva alteraciones.
    const inicio = [...Array(12).keys()].find((i) => armadura(escala(tonicaDe(i, tipo), e.base)).n === 0) ?? 0;
    const orden = Array.from({ length: 12 }, (_, k) => mod12(inicio + 7 * k));
    return `<section><h2>Las 12 tonalidades · ${e.nombre}</h2>
      <p class="sub">Ordenadas por el círculo de quintas: cada una tiene un sostenido más (o un bemol menos) que la anterior. Toca una para verla en grande.</p>
      <div class="galeria">${orden.map((i) => {
        const t = tonicaDe(i, tipo), notas = escala(t, tipo);
        const desde = 60 + i, marcas = new Map();
        for (let m = desde; m <= desde + 12; m++) {
          const k = notas.findIndex((n) => pc(n) === mod12(m));
          if (k >= 0) marcas.set(m, { tipo: k === 0 ? "tonica" : "escala" });
        }
        return `<button type="button" class="tarjeta-escala" data-tonica-galeria="${i}" aria-pressed="${i === p}">
          <span class="te-cab"><b>${nombre(t)} ${e.nombre}</b><span class="te-arm">${armaduraCorta(armadura(escala(t, e.base)))}</span></span>
          ${tecladoSVG({ desde: 60, hasta: 83, marcas, mini: true, titulo: `${nombre(t)} ${e.nombre}` })}
          <span class="sub">${notas.map(nombre).join(" ")}</span>
        </button>`;
      }).join("")}</div></section>`;
  }

  function pintarEscalas() {
    const e = ESCALAS[tipo];
    const t = tonicaDe(p, tipo);
    const notas = escala(t, tipo);
    cuerpo.innerHTML = `
      <div class="panel-fila opciones teoria-ctrl">
        <label class="campo">Escala
          <select data-accion="tipo">${GRUPOS.map((g) => `<optgroup label="${g.nombre}">${g.tipos.map((x) => `<option value="${x}" ${x === tipo ? "selected" : ""}>${ESCALAS[x].nombre}</option>`).join("")}</optgroup>`).join("")}</select>
        </label>
        <div class="segmentos" role="radiogroup" aria-label="Ver en">
          <button type="button" role="radio" data-instr="piano" aria-checked="${instr === "piano"}">Piano</button>
          <button type="button" role="radio" data-instr="violin" aria-checked="${instr === "violin"}">Violín</button>
          <button type="button" role="radio" data-instr="ambos" aria-checked="${instr === "ambos"}">Los dos</button>
        </div>
        <label class="campo">Etiquetas
          <select data-accion="etiquetas">
            <option value="nombres" ${etiquetas === "nombres" ? "selected" : ""}>Do Re Mi</option>
            <option value="cifrado" ${etiquetas === "cifrado" ? "selected" : ""}>C D E</option>
            <option value="grados" ${etiquetas === "grados" ? "selected" : ""}>Grados (1 2 ♭3)</option>
          </select>
        </label>
      </div>
      <div class="tonicas" role="group" aria-label="Tónica">${Array.from({ length: 12 }, (_, i) => `<button type="button" data-tonica="${i}" aria-pressed="${i === p}">${nombre(tonicaDe(i, tipo))}</button>`).join("")}</div>
      ${instr !== "violin" ? `<div class="panel teclado-panel">
        <div class="teclado-cab">
          <h2>${nombre(t)} ${e.nombre}${instr === "ambos" ? " en el piano" : ""}</h2>
          <button type="button" class="btn-play" data-accion="tocar-escala" data-reproduce data-etq="Escuchar">${icono("play")}<span>Escuchar</span></button>
        </div>
        <div class="teclado-principal">${tecladoSVG({ desde: 60, hasta: 83, marcas: marcasEscala(t, notas, true, 60, 83), titulo: `Escala de ${nombre(t)} ${e.nombre}` })}</div>
        <p class="nota-texto">Toca una tecla para oírla. La tónica va en color fuerte${e.caracteristica !== undefined ? "; la nota característica del modo, con un anillo" : ""}.</p>
      </div>` : ""}
      ${instr !== "piano" ? panelViolin(t, notas) : ""}
      <div class="teoria-dos">
        ${fichaEscala(t, notas)}
        ${comparar()}
      </div>
      ${galeria()}
      ${teoriaEscalas()}`;
  }

  function tocarEscala(b) {
    if (sonando === "escala") { parar(); return; }
    parar();
    sonando = "escala";
    botonSonando(b);
    const pasos = ESCALAS[tipo].pasos;
    const base = 60 + p;
    const sube = [...pasos.map((x) => base + x), base + 12];
    const secuencia = [...sube, ...sube.slice(0, -1).reverse()];
    secuencia.forEach((m, i) => despues(i * 330, () => nota(m, 0.42)));
    despues(secuencia.length * 330 + 300, parar);
  }

  // ================================================================ ARMONÍA
  let registro = new Map(); // id → { acorde, ... } de cada acorde que se puede tocar
  let elegido = null;
  let inversion = 0; // 0 = estado fundamental; 1, 2 (y 3 con 7ª) = qué nota del acorde va en el bajo

  /** Orden de las notas del acorde de abajo arriba en una inversión (índices de a.notas). */
  const ordenInv = (a, inv = 0) => a.notas.map((_, i) => (i + inv) % a.notas.length);
  /** Teclas (MIDI) del acorde en una inversión: el bajo en la octava de Do3 y el resto encima. */
  function voces(a, inv = 0) {
    let prev = 0;
    return ordenInv(a, inv).map((k, i) => {
      let m = 48 + pc(a.notas[k]);
      if (i > 0) while (m <= prev) m += 12;
      prev = m;
      return m;
    });
  }
  function tocarAcorde(a, dur = 1.1, inv = 0) {
    const vs = voces(a, inv);
    vs.forEach((m) => nota(m, dur, 0.15));
    tocarNota(frecuencia(vs[0] - 12), dur, { timbre: "piano", volumen: 0.12 });
  }
  function arpegio(a, inv = 0) {
    voces(a, inv).forEach((m, i) => despues(i * 170, () => nota(m, 0.7, 0.2)));
  }

  // Inversiones: nombre, cifrado del bajo continuo y para qué se usan.
  const INV_NOMBRE = ["Fundamental", "1ª inversión", "2ª inversión", "3ª inversión"];
  const INV_FIG = { 3: ["", "6", "6/4"], 4: ["7", "6/5", "4/3", "4/2"] };
  const INV_ALIAS = { 3: ["", "acorde de sexta", "acorde de cuarta y sexta"], 4: ["", "quinta y sexta", "tercera y cuarta", "segunda"] };
  const INV_PAPEL = ["la raíz", "la 3ª", "la 5ª", "la 7ª"];
  const INV_USO = {
    3: [
      "Es la posición más estable y la que suena más «firme»: la que se usa para empezar y para terminar.",
      "Suena más ligera que la fundamental. Sirve para que el bajo camine por grados en vez de saltar (por ejemplo I – I6 – IV).",
      "Es inestable: casi siempre va de paso o justo antes de la dominante en la cadencia (I6/4 → V → I).",
    ],
    4: [
      "La forma «de libro» del acorde con séptima.",
      "Suena más suave que la fundamental y deja el bajo a un paso de la nota siguiente.",
      "Casi siempre va de paso, con el bajo moviéndose por grados.",
      "La séptima está en el bajo y tiende a bajar un grado, así que el bajo baja.",
    ],
  };
  // En el acorde de dominante (7) las inversiones tienen usos típicos.
  const INV_DOMINANTE = ["", "En la dominante, el bajo es la sensible y sube a la tónica (V6/5 → I).",
    "En la dominante, va de paso entre dos posiciones de la tónica (I – V4/3 – I6).",
    "En la dominante, resuelve en la tónica en 1ª inversión (V4/2 → I6)."];
  function romanoInv(a, inv) {
    const fig = (INV_FIG[a.notas.length] || [])[inv] || "";
    if (!inv) return a.romano;
    const [base, ...resto] = a.romano.split("/");
    const sin7 = base.replace(/\(?maj7\)?$|7$/, ""); // la cifra de la inversión ya dice que lleva 7ª
    return [`${sin7}${fig}`, ...resto].join("/");
  }
  const cifradoInv = (a, inv) => (inv ? `${a.cifrado}/${cifra(a.notas[ordenInv(a, inv)[0]])}` : a.cifrado);

  function tarjeta(id, a, { numero, arriba, abajo, clase = "" }) {
    return `<button type="button" class="acorde ${clase}" data-acorde="${id}">
      <span class="ac-num">${numero}</span>
      <span class="ac-cif">${arriba}</span>
      <span class="ac-notas">${abajo ?? lista(a.notas)}</span>
    </button>`;
  }

  function circuloSVG(c) {
    const C = 150;
    const pto = (r, ang) => [C + r * Math.cos(ang * Math.PI / 180), C + r * Math.sin(ang * Math.PI / 180)];
    const sector = (r1, r2, a0, a1) => {
      const [x1, y1] = pto(r2, a0), [x2, y2] = pto(r2, a1), [x3, y3] = pto(r1, a1), [x4, y4] = pto(r1, a0);
      return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${r2} ${r2} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)} L${x3.toFixed(1)} ${y3.toFixed(1)} A${r1} ${r1} 0 0 0 ${x4.toFixed(1)} ${y4.toFixed(1)}Z`;
    };
    // Posición de la tonalidad actual en el círculo.
    const s = [...Array(12).keys()].find((i) => mod12(7 * i + (c.modo === "menor" ? 9 : 0)) === c.p);
    const romanos = c.modo === "mayor" ? { ext: ["IV", "I", "V"], int: ["ii", "vi", "iii"] } : { ext: ["VI", "III", "VII"], int: ["iv", "i", "v"] };
    let html = "";
    for (let i = 0; i < 12; i++) {
      const ang = -90 + i * 30, a0 = ang - 15, a1 = ang + 15;
      const pM = mod12(7 * i), pm = mod12(pM + 9);
      const tM = tonicaDe(pM, "mayor"), tm = tonicaDe(pm, "menor");
      const d = ((i - s + 18) % 12) - 6; // distancia a la tonalidad actual (-6..5)
      const cerca = Math.abs(d) <= 1;
      const selM = c.modo === "mayor" && pM === c.p, selm = c.modo === "menor" && pm === c.p;
      const [xn, yn] = pto(121, ang), [xa, ya] = pto(139, ang), [xr, yr] = pto(104, ang);
      const [xn2, yn2] = pto(80, ang), [xr2, yr2] = pto(64, ang);
      html += `<g class="cq-celda${cerca ? " diatonica" : ""}${selM ? " sel" : ""}" data-clave="${pM}:mayor" role="button" tabindex="0" aria-label="${nombre(tM)} mayor">
          <path d="${sector(96, 148, a0, a1)}"></path>
          <text x="${xn.toFixed(1)}" y="${(yn + 4.5).toFixed(1)}" class="cq-nombre">${nombre(tM)}</text>
          <text x="${xa.toFixed(1)}" y="${(ya + 3).toFixed(1)}" class="cq-arm">${armaduraCorta(armadura(escala(tM, "mayor")))}</text>
          ${cerca ? `<text x="${xr.toFixed(1)}" y="${(yr + 3).toFixed(1)}" class="cq-rom">${romanos.ext[d + 1]}</text>` : ""}
        </g>
        <g class="cq-celda menor${cerca ? " diatonica" : ""}${selm ? " sel" : ""}" data-clave="${pm}:menor" role="button" tabindex="0" aria-label="${nombre(tm)} menor">
          <path d="${sector(54, 96, a0, a1)}"></path>
          <text x="${xn2.toFixed(1)}" y="${(yn2 + 4).toFixed(1)}" class="cq-nombre chico">${nombre(tm)}m</text>
          ${cerca ? `<text x="${xr2.toFixed(1)}" y="${(yr2 + 3).toFixed(1)}" class="cq-rom">${romanos.int[d + 1]}</text>` : ""}
        </g>`;
    }
    const ar = armadura(c.notas);
    return `<svg class="circulo" viewBox="0 0 300 300" role="group" aria-label="Círculo de quintas">${html}
      <circle class="cq-centro" cx="${C}" cy="${C}" r="52"></circle>
      <text x="${C}" y="${C - 2}" class="cq-tit">${nombre(c.tonica)}</text>
      <text x="${C}" y="${C + 16}" class="cq-sub">${c.modo} · ${armaduraCorta(ar)}</text>
    </svg>`;
  }

  function textoDetalle(r) {
    const a = r.acorde;
    const c = r.clave;
    const extra = notasExtranas(c, a).map(pc);
    const chips = a.notas.map((n, i) => `<span class="chip-nota${extra.includes(pc(n)) ? " fuera" : ""}${i === 0 ? " raiz" : ""}"><b>${nombre(n)}</b><small>${a.intervalos[i]}</small></span>`).join("");
    let cuerpoTxt = "";
    if (r.tipo === "diat") {
      const f = FUNCIONES[r.funcion];
      cuerpoTxt = `<p><span class="fun f-${r.funcion}">${f.nombre}${r.debil ? " (débil)" : ""}</span> ${r.txt}</p><p class="sub">Suele ir a: <b>${r.va}</b></p>`;
    } else if (r.tipo === "sec") {
      const s = r.sec;
      cuerpoTxt = `<p><span class="fun f-inv">Dominante secundaria</span> Es el V7 de <b>${s.destino.cifrado}</b> (${s.destino.romano}): por un momento trata a ese acorde como si fuera la tónica.</p>
        <p>${s.extra.length ? `Trae ${s.extra.map((n) => `<b class="t-fuera">${nombre(n)}</b>`).join(" y ")}, que no ${s.extra.length > 1 ? "están" : "está"} en ${c.nombre}${s.sensDestino ? `: ${nombre(s.sensDestino)} es la sensible de ${nombre(s.destino.raiz)} y sube medio tono hacia ella` : ""}.` : `Todas sus notas ya están en ${c.nombre}: es un acorde de la escala con función de dominante.`}</p>
        <p class="sub">Prepáralo con su ii: <b>${s.ii.cifrado} → ${s.acorde.cifrado} → ${s.destino.cifrado}</b>. O cámbialo por su acorde de sensible: <b>${s.vii.cifrado} → ${s.destino.cifrado}</b>.</p>`;
    } else if (r.tipo === "pres") {
      cuerpoTxt = `<p><span class="fun f-inv">${r.origen === "frigio" || r.origen === "sustitución tritonal" ? "Invitado" : "Préstamo modal"}</span> ${r.origen === "frigio" || r.origen === "sustitución tritonal" ? "" : `Viene de <b>${r.origen}</b>. `}${r.txt}</p>`;
    } else if (r.tipo === "prog") {
      cuerpoTxt = `<p class="sub">Acorde ${r.k + 1} de «${r.prog.nombre}».</p>`;
    }
    return `<div class="av-cab">
        <div><span class="av-num">${a.romano}</span> <span class="av-cif">${a.cifrado}</span><div class="sub">${a.nombre}</div></div>
        <button type="button" class="btn-icono av-plegar" data-accion="plegar" aria-label="Plegar el panel" title="Plegar">▾</button>
      </div>
      <div class="av-notas">${chips}</div>
      ${bloqueInversiones(a)}
      <div class="av-texto">${cuerpoTxt}</div>
      <div class="av-acciones">
        <button type="button" class="btn-mini" data-accion="sel-tocar">${icono("play")} Acorde</button>
        <button type="button" class="btn-mini" data-accion="sel-arpegio">Arpegio</button>
        ${r.tipo === "sec" ? `<button type="button" class="btn-mini" data-accion="sel-resolver">→ ${r.sec.destino.cifrado}</button><button type="button" class="btn-mini" data-accion="sel-iiv">${r.sec.ii.cifrado} → ${r.sec.acorde.cifrado} → ${r.sec.destino.cifrado}</button>` : ""}
        ${r.tipo === "pres" && r.resuelve ? `<button type="button" class="btn-mini" data-accion="sel-resolver">→ ${r.resuelve.cifrado}</button>` : ""}
      </div>`;
  }

  function bloqueInversiones(a) {
    const n = a.notas.length;
    const inv = Math.min(inversion, n - 1);
    const orden = ordenInv(a, inv);
    const fig = INV_FIG[n]?.[inv] || "", alias = INV_ALIAS[n]?.[inv] || "";
    return `<div class="av-inv">
        <div class="av-inv-cab"><b>Inversiones</b> <small>qué nota del acorde va en el bajo</small></div>
        <div class="segmentos inv-opciones" role="group" aria-label="Inversión">
          ${Array.from({ length: n }, (_, k) => `<button type="button" data-inv="${k}" aria-pressed="${k === inv}">
            <span>${k ? `${k}ª` : "Fund."}</span><b>${cifradoInv(a, k)}</b></button>`).join("")}
        </div>
        <p class="inv-txt"><b>${INV_NOMBRE[inv]}</b>${fig ? ` · cifrado <b>${fig}</b>${alias ? ` (${alias})` : ""}` : ""} · <span class="inv-rom">${romanoInv(a, inv)}</span><br>
          De abajo arriba: ${orden.map((k, i) => (i === 0 ? `<b class="inv-bajo">${nombre(a.notas[k])}</b>` : nombre(a.notas[k]))).join(" – ")}.
          ${inv ? `${INV_PAPEL[inv][0].toUpperCase()}${INV_PAPEL[inv].slice(1)} (${nombre(a.notas[inv])}) va en el bajo; las notas son las mismas que en la fundamental, solo cambia el orden.` : `La raíz (${nombre(a.notas[0])}) va en el bajo.`}
          ${INV_USO[n]?.[inv] || ""} ${a.cal?.cif === "7" ? INV_DOMINANTE[inv] : ""}</p>
        <button type="button" class="btn-mini" data-accion="sel-inversiones" data-reproduce data-etq="Escuchar las ${n} posiciones">${icono("play")}<span>Escuchar las ${n} posiciones</span></button>
      </div>`;
  }

  function mostrarAcorde(id, { tocar = true, inv = 0 } = {}) {
    const r = registro.get(id);
    if (!r) return;
    inversion = Math.min(inv, r.acorde.notas.length - 1);
    elegido = id;
    main.querySelectorAll(".acorde.elegido, .pa.elegido").forEach((x) => x.classList.remove("elegido"));
    main.querySelectorAll(`[data-acorde="${id}"]`).forEach((x) => x.classList.add("elegido"));
    const a = r.acorde, c = r.clave;
    const vs = voces(a, inversion), orden = ordenInv(a, inversion);
    const extra = notasExtranas(c, a).map(pc);
    const marcas = new Map();
    for (let m = 48; m <= 71; m++) if (c.pcs.has(mod12(m))) marcas.set(m, { tipo: "tenue" });
    vs.forEach((m, i) => {
      const k = orden[i]; // qué nota del acorde es (0 = raíz)
      marcas.set(m, { tipo: extra.includes(mod12(m)) ? "fuera" : k === 0 ? "tonica" : "escala", texto: a.intervalos[k], sub: i === 0 && inversion ? "bajo" : undefined });
    });
    const vista = $("#acorde-vista");
    vista.innerHTML = `<div class="teclado-principal">${tecladoSVG({ desde: 48, hasta: 71, marcas, grande: true, titulo: `Acorde ${cifradoInv(a, inversion)}: ${orden.map((k) => nombre(a.notas[k])).join(", ")}` })}</div>${textoDetalle(r)}`;
    if (tocar) tocarAcorde(a, 1.1, inversion);
  }

  function pintarArmonia() {
    const c = clave(p, modo);
    registro = new Map();
    const diat = acordesDiatonicos(c, septimas);
    diat.forEach((a, i) => registro.set(`d${i}`, { tipo: "diat", acorde: a, clave: c, funcion: a.funcion, txt: a.txt, va: a.va, debil: a.debil }));
    const secs = dominantesSecundarias(c);
    secs.forEach((s, i) => registro.set(`s${i}`, { tipo: "sec", acorde: s.acorde, clave: c, sec: s }));
    const pres = prestados(c);
    const ton = acordeNumeral(c, c.modo === "mayor" ? "I" : "i");
    const quinto = acordeNumeral(c, "V7");
    pres.forEach((x, i) => {
      const n = x.acorde.romano;
      const resuelve = ["♭II", "iiø7", "ii"].includes(n) ? quinto : n === "I" ? null : ton;
      registro.set(`p${i}`, { tipo: "pres", acorde: x.acorde, clave: c, origen: x.origen, txt: x.txt, resuelve });
    });
    const progs = PROGRESIONES[modo].map((pr, k) => ({ ...pr, acordes: pr.nums.map((n) => acordeNumeral(c, n)), k }));
    progs.forEach((pr) => pr.acordes.forEach((a, j) => registro.set(`g${pr.k}-${j}`, { tipo: "prog", acorde: a, clave: c, prog: pr, k: j })));

    const ar = armadura(c.notas);
    const relativa = c.modo === "mayor" ? `${nombre(deletrear(pc(c.tonica) + 9, c.tonica.l + 5))} menor` : `${nombre(deletrear(pc(c.tonica) + 3, c.tonica.l + 2))} mayor`;
    const fun = (f) => diat.map((a, i) => ({ a, i })).filter((x) => x.a.funcion === f);

    cuerpo.innerHTML = `
      <div class="panel-fila opciones teoria-ctrl">
        <label class="campo">Tonalidad
          <select data-accion="tonica">${Array.from({ length: 12 }, (_, i) => `<option value="${i}" ${i === p ? "selected" : ""}>${nombre(tonicaDe(i, modo))}</option>`).join("")}</select>
        </label>
        <div class="segmentos" role="radiogroup" aria-label="Modo">
          <button type="button" role="radio" data-modo="mayor" aria-checked="${modo === "mayor"}">Mayor</button>
          <button type="button" role="radio" data-modo="menor" aria-checked="${modo === "menor"}">Menor</button>
        </div>
        <label class="interruptor"><input type="checkbox" data-accion="septimas" ${septimas ? "checked" : ""}> Con séptimas</label>
      </div>
      <p class="sub">Armadura: ${textoArmadura(ar)} · Relativa: ${relativa} · <a href="#/teoria/escalas" data-ir-escala="${p}:${modo}">ver la escala en el teclado</a></p>
      <div class="armonia">
        <div class="armonia-prin">
          <h2>Los acordes de ${c.nombre}</h2>
          <p class="sub">Se forman apilando terceras sobre cada nota de la escala: una sí, otra no (1-3-5${septimas ? "-7" : ""}). El color indica su función. Toca uno para oírlo y verlo en el teclado.</p>
          <div class="acordes">${diat.filter((a) => !a.armonica).map((a, i) => tarjeta(`d${i}`, a, { numero: a.romano, arriba: a.cifrado, clase: `f-${a.funcion}` })).join("")}</div>
          ${c.modo === "menor" ? `<h3 class="h-sec">Con la sensible (de la menor armónica)</h3>
            <p class="sub">Subiendo el 7º grado (${nombre(c.notas[6])} → ${nombre(sensible(c))}) el v se vuelve V mayor y aparece el vii°: la dominante de verdad en menor.</p>
            <div class="acordes">${diat.map((a, i) => ({ a, i })).filter((x) => x.a.armonica).map(({ a, i }) => tarjeta(`d${i}`, a, { numero: a.romano, arriba: a.cifrado, clase: `f-${a.funcion}` })).join("")}</div>` : ""}

          <h2>Funciones: tónica, subdominante y dominante</h2>
          <p class="sub">Toda la música tonal va de casa (T) a alejarse (SD), a la tensión (D) y de vuelta a casa. Los acordes de la misma función se pueden sustituir entre sí.</p>
          <div class="funciones">${["T", "SD", "D"].map((f) => `<div class="funcion f-${f}">
              <h3>${FUNCIONES[f].nombre} <small>${f}</small></h3><p>${FUNCIONES[f].txt}</p>
              <div class="fun-chips">${fun(f).map(({ a, i }) => `<button type="button" class="pa" data-acorde="d${i}"><b>${a.romano}</b>${a.cifrado}</button>`).join("")}</div>
            </div>`).join("")}</div>

          <h2>Progresiones típicas</h2>
          <p class="sub">Pulsa ▶ para escucharlas en ${c.nombre}; toca un acorde para verlo. En morado, los acordes con notas de fuera de la tonalidad.</p>
          <div class="progresiones">${progs.map((pr) => `<div class="prog">
              <button type="button" class="btn-play prog-play" data-accion="prog" data-k="${pr.k}" data-reproduce data-etq="" aria-label="Escuchar ${pr.nombre}">${icono("play")}<span></span></button>
              <div class="prog-cuerpo">
                <div><b>${pr.nombre}</b> <span class="sub">${pr.txt}</span></div>
                <div class="prog-acordes">${pr.acordes.map((a, j) => `<button type="button" class="pa${notasExtranas(c, a).length ? " invitado" : ""}" data-acorde="g${pr.k}-${j}"><b>${a.romano}</b>${a.cifrado}</button>`).join("")}</div>
              </div>
            </div>`).join("")}</div>

          <h2>Invitados: acordes de fuera de la tonalidad</h2>
          <p class="sub">Acordes que no salen de la escala pero se usan muchísimo para dar color o fuerza. Las notas de fuera se ven en morado.</p>
          <h3 class="h-sec">Dominantes secundarias («el V de…»)</h3>
          <p class="sub">Cualquier acorde mayor o menor de la tonalidad puede tener su propia dominante: el acorde mayor con 7ª que está una quinta por encima de él. Se escribe V7/ii («quinto del segundo»), V7/V («quinto del quinto»)…</p>
          <div class="acordes invitados">${secs.map((s, i) => tarjeta(`s${i}`, s.acorde, { numero: s.acorde.romano, arriba: `${s.acorde.cifrado} → ${s.destino.cifrado}`, clase: "f-inv" })).join("")}</div>
          <h3 class="h-sec">Préstamo modal y otros invitados</h3>
          <p class="sub">${c.modo === "mayor" ? `Acordes tomados de ${nombre(c.tonica)} menor (la tonalidad homónima): misma tónica, otro color.` : `Acordes tomados de ${nombre(c.tonica)} mayor (la tonalidad homónima) y del modo dórico.`} Más el napolitano y el sustituto tritonal.</p>
          <div class="acordes invitados">${pres.map((x, i) => tarjeta(`p${i}`, x.acorde, { numero: x.acorde.romano, arriba: x.acorde.cifrado, clase: "f-inv" })).join("")}</div>
          ${teoriaArmonia(c)}
        </div>
        <aside class="armonia-lado">
          <div class="panel acorde-vista" id="acorde-vista"></div>
          <div class="circulo-caja">
            ${circuloSVG(c)}
            <p class="nota-texto">Círculo de quintas. Los 6 acordes resaltados alrededor de ${nombre(c.tonica)} son los de la tonalidad. Toca otra para cambiar.</p>
          </div>
        </aside>
      </div>`;
    mostrarAcorde(registro.has(elegido) ? elegido : "d0", { tocar: false });
    // En el móvil el panel del acorde va abajo: empieza plegado y se abre al tocar un acorde.
    if (matchMedia("(max-width: 860px)").matches) $("#acorde-vista").classList.add("plegada");
  }

  function tocarProgresion(b) {
    const k = Number(b.dataset.k);
    if (sonando === `prog${k}`) { parar(); return; }
    parar();
    sonando = `prog${k}`;
    botonSonando(b);
    b.querySelector("span").textContent = "";
    $("#acorde-vista")?.classList.remove("plegada");
    const pr = PROGRESIONES[modo][k];
    const dur = pr.nums.length > 8 ? 900 : 1150;
    pr.nums.forEach((_, j) => despues(j * dur, () => {
      mostrarAcorde(`g${k}-${j}`, { tocar: false });
      main.querySelectorAll(".pa.sonando-ahora").forEach((x) => x.classList.remove("sonando-ahora"));
      main.querySelector(`[data-acorde="g${k}-${j}"]`)?.classList.add("sonando-ahora");
      tocarAcorde(registro.get(`g${k}-${j}`).acorde, dur / 1000);
    }));
    despues(pr.nums.length * dur + 400, parar);
  }

  // ================================================================ Textos de teoría
  function teoriaEscalas() {
    return `<section class="teoria-breve"><h2>Teoría en breve</h2>
      <details><summary>Tono y semitono</summary><p>Un <b>semitono</b> es la distancia entre una tecla y la de al lado, contando las negras (Mi–Fa y Si–Do son semitonos porque no hay negra entre ellas). Un <b>tono</b> son dos semitonos. Toda escala es una receta de tonos y semitonos.</p></details>
      <details><summary>La escala mayor: T T St T T T St</summary><p>Empezando en cualquier tecla y siguiendo esa receta sale la escala mayor. Desde Do salen solo teclas blancas; desde cualquier otra nota hacen falta teclas negras, y por eso cada tonalidad tiene su <b>armadura</b> (los ♯ o ♭ que se escriben al principio del pentagrama).</p></details>
      <details><summary>Las tres menores</summary><p><b>Natural</b>: T St T T St T T, las mismas notas que su relativa mayor. <b>Armónica</b>: sube el 7º grado para tener sensible (una nota a medio tono de la tónica que «tira» hacia ella). <b>Melódica</b>: sube el 6º y el 7º para evitar el salto de tono y medio de la armónica.</p></details>
      <details><summary>Los modos griegos</summary><p>Son la escala mayor empezando en cada una de sus notas: desde Do, jónico; desde Re, dórico; desde Mi, frigio; desde Fa, lidio; desde Sol, mixolidio; desde La, eólico; desde Si, locrio. Hay dos formas de pensarlos:</p><ul><li><b>Relativa</b>: Re dórico tiene las mismas notas que Do mayor.</li><li><b>Paralela</b>: Re dórico es Re menor con la 6ª mayor. Esta sirve más para tocar, porque te dice qué nota cambia: la <b>nota característica</b> de cada modo.</li></ul><p>Modos mayores (con 3ª mayor): lidio, jónico y mixolidio. Modos menores: dórico, eólico y frigio. El locrio es disminuido.</p></details>
      <details><summary>Armaduras y círculo de quintas</summary><p>Orden de los sostenidos: <b>Fa Do Sol Re La Mi Si</b>. Orden de los bemoles: al revés, <b>Si Mi La Re Sol Do Fa</b>. Truco: con sostenidos, la tónica mayor está medio tono por encima del último sostenido (Fa♯ → Sol mayor). Con bemoles, la tónica es el penúltimo bemol (Si♭ Mi♭ → Si♭ mayor).</p></details>
      <details><summary>Escalas en el violín: patrones de dedos</summary><p>Las cuerdas del violín están afinadas por quintas (Sol Re La Mi), así que en 1ª posición cada cuerda tiene 4 notas pisadas antes de llegar a la siguiente cuerda al aire. Lo que cambia de una escala a otra es dónde quedan los <b>medios tonos</b>, es decir, qué dedos van <b>juntos</b>:</p><ul><li><b>2 y 3 juntos</b> (2 alto): el patrón de la escala mayor desde la cuerda al aire. Ejemplo: Re mayor en la cuerda Re (Re Mi Fa♯ Sol).</li><li><b>1 y 2 juntos</b> (2 bajo): el patrón menor. Ejemplo: Sol mayor en la cuerda La (La Si Do Re), o La menor.</li><li><b>3 y 4 juntos</b>: aparece en la cuerda donde la escala sube a la sensible. Ejemplo: Sol mayor en la cuerda Re (… Fa♯ Sol).</li><li><b>1 bajo</b>: cuando la nota está a medio tono de la cuerda al aire, el 1er dedo se pega a la cejuela (Si♭ en la cuerda La, en Fa mayor).</li></ul><p>Las escalas que empiezan en una cuerda al aire (Sol, Re, La) son las más cómodas al principio, por eso los métodos empiezan por Re mayor, La mayor y Sol mayor.</p></details>
      <details><summary>Pentatónicas y blues</summary><p>Escalas de 5 notas sin semitonos: suenan bien casi sobre cualquier acorde de su tonalidad, por eso son las primeras para improvisar. La de blues añade la ♭5, la «blue note», que se toca de paso. En la armónica son la base del blues en 2ª posición.</p></details>
    </section>`;
  }

  function teoriaArmonia(c) {
    const n = (k) => nombre(c.notas[k]);
    return `<section class="teoria-breve"><h2>Teoría en breve</h2>
      <details><summary>Cómo se forman los acordes de una tonalidad</summary><p>Se toma una nota de la escala y se apilan terceras: una sí, otra no. Desde ${n(0)}: ${n(0)}–${n(2)}–${n(4)}. Con una tercera más se añade la 7ª (${n(6)}). Como la escala tiene tonos y semitonos en sitios distintos, unos acordes salen mayores, otros menores y uno disminuido.</p></details>
      <details><summary>Números romanos</summary><p>El número es el grado de la escala sobre el que se construye el acorde. <b>Mayúscula</b> = acorde mayor (V), <b>minúscula</b> = menor (ii), <b>°</b> = disminuido (vii°), <b>+</b> = aumentado, <b>ø</b> = semidisminuido (m7♭5), <b>7</b> = lleva séptima, <b>♭</b>/<b>♯</b> delante = la raíz está alterada respecto a la escala (♭VII). Así una progresión se puede tocar en cualquier tonalidad.</p></details>
      <details><summary>Tipos de acorde</summary><ul><li><b>Mayor</b>: 3ª mayor + 3ª menor (4 + 3 semitonos). Estable, luminoso.</li><li><b>Menor</b>: 3ª menor + 3ª mayor (3 + 4). Triste, oscuro.</li><li><b>Disminuido</b>: dos 3ª menores (3 + 3). Tenso, inestable.</li><li><b>Aumentado</b>: dos 3ª mayores (4 + 4). Suspenso, irreal.</li><li><b>Con 7ª</b>: maj7 (soñador), 7 (dominante, pide resolver), m7 (suave), m7♭5 (oscuro), °7 (dramático).</li></ul></details>
      <details><summary>Inversiones: qué nota va en el bajo</summary><p>Un acorde no cambia de nombre por el orden de sus notas: ${n(0)}–${n(2)}–${n(4)} sigue siendo el mismo acorde si lo tocas ${n(2)}–${n(4)}–${n(0)}. Lo que importa es la nota <b>más grave</b> (el bajo):</p><ul><li><b>Estado fundamental</b>: la raíz en el bajo. Estable.</li><li><b>1ª inversión</b>: la 3ª en el bajo. Se escribe ${c.cifrado}/${cifra(c.notas[2])} o «6».</li><li><b>2ª inversión</b>: la 5ª en el bajo. ${c.cifrado}/${cifra(c.notas[4])} o «6/4». Inestable.</li><li><b>3ª inversión</b> (solo con 7ª): la 7ª en el bajo. «4/2».</li></ul><p>Las inversiones sirven para que el bajo se mueva poco, por grados, y la mano no salte de un acorde a otro: en el piano, C → F/C → G/B → C (Do, Fa, Sol, Do) se toca casi sin mover la mano.</p></details>
      <details><summary>Cadencias: cómo terminan las frases</summary><ul><li><b>Perfecta (auténtica)</b>: V → I. Punto final.</li><li><b>Plagal</b>: IV → I. Final suave, el «amén».</li><li><b>Rota</b>: V → vi. Parece que termina y no: sorpresa.</li><li><b>Semicadencia</b>: termina en V. Una pregunta, una coma.</li></ul></details>
      <details><summary>¿Por qué la dominante pide volver?</summary><p>Porque tiene la <b>sensible</b> (${nombre(sensible(c))}), a medio tono de la tónica, y con la 7ª forma un <b>tritono</b> (${n(3)}–${nombre(sensible(c))}), el intervalo más inestable. Al resolver, la sensible sube a ${n(0)} y la 7ª (${n(3)}) baja a ${n(2)}: las dos tensiones se relajan a la vez.</p></details>
      <details><summary>Dominantes secundarias, paso a paso</summary><ol><li>Elige el acorde al que quieres llegar (por ejemplo, el ${c.modo === "mayor" ? `ii: ${nombre(c.notas[1])} menor` : `iv: ${nombre(c.notas[3])} menor`}).</li><li>Sube una quinta desde su raíz.</li><li>Haz ahí un acorde mayor con 7ª. Ese es su V7.</li></ol><p>La nota nueva suele ser la sensible del acorde destino, por eso «lo convierte en tónica» por un instante. Puedes encadenarlas: V7/V → V7 → I, o V7/ii → ii → V7 → I.</p></details>
      <details><summary>Préstamo modal</summary><p>Tomar acordes de la tonalidad homónima (misma tónica, otro modo): en ${nombre(c.tonica)} mayor se puede usar el iv, ♭VI o ♭VII de ${nombre(c.tonica)} menor. La melodía sigue en su tonalidad; solo cambia el color de un acorde.</p></details>
      <details><summary>El círculo de quintas</summary><p>Cada paso en el sentido del reloj sube una quinta y añade un ♯ (o quita un ♭). Las tonalidades vecinas comparten 6 de sus 7 notas, por eso modular a ellas es fácil y natural. Los acordes de una tonalidad son los 6 que rodean a su tónica: el IV a la izquierda, el V a la derecha y las relativas menores dentro.</p></details>
    </section>`;
  }

  // ================================================================ Pestañas y eventos
  function pintar() {
    parar();
    main.querySelectorAll("[data-pestana]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.pestana === pestana)));
    history.replaceState(null, "", `#/teoria/${pestana}`);
    if (pestana === "armonia") pintarArmonia(); else pintarEscalas();
  }

  function cambiarClave(valor) {
    const [np, nm] = valor.split(":");
    p = Number(np); setPref("teoriaTonica", p);
    modo = nm; setPref("armoniaModo", modo);
  }

  main.addEventListener("click", (e) => {
    const t = e.target;
    const pest = t.closest("[data-pestana]");
    if (pest) { if (pest.dataset.pestana !== pestana) { pestana = pest.dataset.pestana; setPref("teoriaPestana", pestana); pintar(); } return; }

    // Escalas
    const ton = t.closest("[data-tonica]");
    if (ton) { p = Number(ton.dataset.tonica); setPref("teoriaTonica", p); pintar(); return; }
    const gal = t.closest("[data-tonica-galeria]");
    if (gal) {
      p = Number(gal.dataset.tonicaGaleria); setPref("teoriaTonica", p); pintar();
      main.querySelector(".teclado-panel, .violin-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const fila = t.closest("[data-tipo]");
    if (fila) { tipo = fila.dataset.tipo; setPref("teoriaTipo", tipo); pintar(); return; }
    const irA = t.closest("[data-ir-armonia]");
    if (irA) { cambiarClave(irA.dataset.irArmonia); pestana = "armonia"; setPref("teoriaPestana", pestana); elegido = null; pintar(); window.scrollTo(0, 0); return; }
    const irE = t.closest("[data-ir-escala]");
    if (irE) {
      e.preventDefault();
      const [np, nm] = irE.dataset.irEscala.split(":");
      p = Number(np); tipo = nm; setPref("teoriaTonica", p); setPref("teoriaTipo", tipo);
      pestana = "escalas"; setPref("teoriaPestana", pestana); pintar(); window.scrollTo(0, 0);
      return;
    }
    const ins = t.closest("[data-instr]");
    if (ins) { if (ins.dataset.instr !== instr) { instr = ins.dataset.instr; setPref("teoriaInstrumento", instr); pintar(); } return; }
    const vd = t.closest(".diapason-svg .vd");
    if (vd) {
      notaViolin(Number(vd.dataset.midi), 0.7, { cuerda: CUERDAS_VIOLIN[Number(vd.dataset.cuerda)], s: Number(vd.dataset.s) });
      const info = $("#vd-info");
      if (info) info.innerHTML = infoViolin(vd);
      return;
    }
    const tecla = t.closest(".teclado:not(.mini) rect[data-midi]");
    if (tecla) { nota(Number(tecla.dataset.midi), 0.6); return; }

    // Armonía
    const cel = t.closest("[data-clave]");
    if (cel) { cambiarClave(cel.dataset.clave); elegido = null; pintar(); return; }
    const md = t.closest("[data-modo]");
    if (md) { if (md.dataset.modo !== modo) { modo = md.dataset.modo; setPref("armoniaModo", modo); elegido = null; pintar(); } return; }
    const bInv = t.closest("[data-inv]");
    if (bInv && elegido) { if (sonando === "inversiones") parar(); mostrarAcorde(elegido, { inv: Number(bInv.dataset.inv) }); return; }
    const ac = t.closest("[data-acorde]");
    if (ac) { if (!sonando?.startsWith("prog")) parar(); mostrarAcorde(ac.dataset.acorde); $("#acorde-vista")?.classList.remove("plegada"); return; }

    const b = t.closest("[data-accion]");
    if (!b) return;
    const r = registro.get(elegido);
    switch (b.dataset.accion) {
      case "tocar-escala": tocarEscala(b); break;
      case "tocar-violin": tocarEscalaViolin(b); break;
      case "prog": tocarProgresion(b); break;
      case "sel-tocar": if (r) tocarAcorde(r.acorde, 1.1, inversion); break;
      case "sel-arpegio": if (r) { parar(); arpegio(r.acorde, inversion); } break;
      case "sel-inversiones": {
        if (!r) break;
        if (sonando === "inversiones") { parar(); break; }
        parar();
        sonando = "inversiones";
        const id = elegido, n = r.acorde.notas.length;
        botonSonando(b);
        for (let k = 0; k < n; k++) despues(k * 1300, () => {
          mostrarAcorde(id, { inv: k });
          botonSonando(main.querySelector('[data-accion="sel-inversiones"]'));
        });
        despues(n * 1300 + 200, parar);
        break;
      }
      case "sel-resolver": {
        const destino = r?.tipo === "sec" ? r.sec.destino : r?.resuelve;
        if (!destino) break;
        parar();
        tocarAcorde(r.acorde);
        despues(1100, () => tocarAcorde(destino, 1.4));
        break;
      }
      case "sel-iiv": {
        if (r?.tipo !== "sec") break;
        parar();
        [r.sec.ii, r.sec.acorde, r.sec.destino].forEach((a, i) => despues(i * 1100, () => tocarAcorde(a, i === 2 ? 1.4 : 1.1)));
        break;
      }
      case "plegar": $("#acorde-vista")?.classList.toggle("plegada"); break;
    }
  });

  main.addEventListener("keydown", (e) => {
    const cel = e.target.closest?.("[data-clave]");
    if (cel && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); cel.dispatchEvent(new MouseEvent("click", { bubbles: true })); }
  });

  main.addEventListener("change", (e) => {
    const a = e.target.dataset.accion;
    if (a === "tipo") { tipo = e.target.value; setPref("teoriaTipo", tipo); pintar(); }
    if (a === "etiquetas") { etiquetas = e.target.value; setPref("teoriaEtiquetas", etiquetas); pintar(); }
    if (a === "tonica") { p = Number(e.target.value); setPref("teoriaTonica", p); elegido = null; pintar(); }
    if (a === "violin-alto") { violinAlto = e.target.checked; setPref("teoriaViolinAlto", violinAlto); pintar(); }
    if (a === "septimas") { septimas = e.target.checked; setPref("armoniaSeptimas", septimas); pintar(); }
  });

  pintar();
  return parar;
}
