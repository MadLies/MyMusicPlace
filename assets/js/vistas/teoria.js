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
import { tocarNota } from "../audio.js";
import { frecuencia } from "../notas.js";
import { pref, setPref } from "../progreso.js";
import { icono } from "../iconos.js";

const lista = (ns) => ns.map(nombre).join(" · ");

export async function mostrar(main, [pestanaRuta]) {
  let pestana = pestanaRuta || pref("teoriaPestana", "escalas");
  let p = Number(pref("teoriaTonica", 0));
  let tipo = pref("teoriaTipo", "mayor");
  if (!ESCALAS[tipo]) tipo = "mayor";
  let etiquetas = pref("teoriaEtiquetas", "nombres");
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
  function marcasEscala(t, notas, conEtiquetas, desde, hasta) {
    const grados = formulaGrados(tipo);
    const car = ESCALAS[tipo].caracteristica;
    const marcas = new Map();
    for (let m = desde; m <= hasta; m++) {
      const i = notas.findIndex((n) => pc(n) === mod12(m));
      if (i < 0) continue;
      const n = notas[i];
      const texto = etiquetas === "cifrado" ? cifra(n) : etiquetas === "grados" ? grados[i].texto : nombre(n);
      marcas.set(m, {
        tipo: (i === 0 ? "tonica" : "escala") + (i === car ? " caract" : ""),
        texto: conEtiquetas ? texto : "",
        sub: conEtiquetas ? (etiquetas === "grados" ? nombre(n) : grados[i].texto) : "",
      });
    }
    return marcas;
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
        <label class="campo">En las teclas
          <select data-accion="etiquetas">
            <option value="nombres" ${etiquetas === "nombres" ? "selected" : ""}>Do Re Mi</option>
            <option value="cifrado" ${etiquetas === "cifrado" ? "selected" : ""}>C D E</option>
            <option value="grados" ${etiquetas === "grados" ? "selected" : ""}>Grados (1 2 ♭3)</option>
          </select>
        </label>
      </div>
      <div class="tonicas" role="group" aria-label="Tónica">${Array.from({ length: 12 }, (_, i) => `<button type="button" data-tonica="${i}" aria-pressed="${i === p}">${nombre(tonicaDe(i, tipo))}</button>`).join("")}</div>
      <div class="panel teclado-panel">
        <div class="teclado-cab">
          <h2>${nombre(t)} ${e.nombre}</h2>
          <button type="button" class="btn-play" data-accion="tocar-escala" data-reproduce data-etq="Escuchar">${icono("play")}<span>Escuchar</span></button>
        </div>
        <div class="teclado-principal">${tecladoSVG({ desde: 60, hasta: 83, marcas: marcasEscala(t, notas, true, 60, 83), titulo: `Escala de ${nombre(t)} ${e.nombre}` })}</div>
        <p class="nota-texto">Toca una tecla para oírla. La tónica va en color fuerte${e.caracteristica !== undefined ? "; la nota característica del modo, con un anillo" : ""}.</p>
      </div>
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

  function voces(a) {
    let prev = 0;
    return a.notas.map((n, i) => {
      let m = 48 + pc(n);
      if (i > 0) while (m <= prev) m += 12;
      prev = m;
      return m;
    });
  }
  function tocarAcorde(a, dur = 1.1) {
    const vs = voces(a);
    vs.forEach((m) => nota(m, dur, 0.15));
    tocarNota(frecuencia(vs[0] - 12), dur, { timbre: "piano", volumen: 0.12 });
  }
  function arpegio(a) {
    voces(a).forEach((m, i) => despues(i * 170, () => nota(m, 0.7, 0.2)));
  }

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
      <div class="av-texto">${cuerpoTxt}</div>
      <div class="av-acciones">
        <button type="button" class="btn-mini" data-accion="sel-tocar">${icono("play")} Acorde</button>
        <button type="button" class="btn-mini" data-accion="sel-arpegio">Arpegio</button>
        ${r.tipo === "sec" ? `<button type="button" class="btn-mini" data-accion="sel-resolver">→ ${r.sec.destino.cifrado}</button><button type="button" class="btn-mini" data-accion="sel-iiv">${r.sec.ii.cifrado} → ${r.sec.acorde.cifrado} → ${r.sec.destino.cifrado}</button>` : ""}
        ${r.tipo === "pres" && r.resuelve ? `<button type="button" class="btn-mini" data-accion="sel-resolver">→ ${r.resuelve.cifrado}</button>` : ""}
      </div>`;
  }

  function mostrarAcorde(id, { tocar = true } = {}) {
    const r = registro.get(id);
    if (!r) return;
    elegido = id;
    main.querySelectorAll(".acorde.elegido, .pa.elegido").forEach((x) => x.classList.remove("elegido"));
    main.querySelectorAll(`[data-acorde="${id}"]`).forEach((x) => x.classList.add("elegido"));
    const a = r.acorde, c = r.clave;
    const vs = voces(a);
    const extra = notasExtranas(c, a).map(pc);
    const marcas = new Map();
    for (let m = 48; m <= 71; m++) if (c.pcs.has(mod12(m))) marcas.set(m, { tipo: "tenue" });
    vs.forEach((m, i) => marcas.set(m, { tipo: extra.includes(mod12(m)) ? "fuera" : i === 0 ? "tonica" : "escala", texto: a.intervalos[i] }));
    const vista = $("#acorde-vista");
    vista.innerHTML = `<div class="teclado-principal">${tecladoSVG({ desde: 48, hasta: 71, marcas, grande: true, titulo: `Acorde ${a.cifrado}: ${a.notas.map(nombre).join(", ")}` })}</div>${textoDetalle(r)}`;
    if (tocar) tocarAcorde(a);
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
      <details><summary>Pentatónicas y blues</summary><p>Escalas de 5 notas sin semitonos: suenan bien casi sobre cualquier acorde de su tonalidad, por eso son las primeras para improvisar. La de blues añade la ♭5, la «blue note», que se toca de paso. En la armónica son la base del blues en 2ª posición.</p></details>
    </section>`;
  }

  function teoriaArmonia(c) {
    const n = (k) => nombre(c.notas[k]);
    return `<section class="teoria-breve"><h2>Teoría en breve</h2>
      <details><summary>Cómo se forman los acordes de una tonalidad</summary><p>Se toma una nota de la escala y se apilan terceras: una sí, otra no. Desde ${n(0)}: ${n(0)}–${n(2)}–${n(4)}. Con una tercera más se añade la 7ª (${n(6)}). Como la escala tiene tonos y semitonos en sitios distintos, unos acordes salen mayores, otros menores y uno disminuido.</p></details>
      <details><summary>Números romanos</summary><p>El número es el grado de la escala sobre el que se construye el acorde. <b>Mayúscula</b> = acorde mayor (V), <b>minúscula</b> = menor (ii), <b>°</b> = disminuido (vii°), <b>+</b> = aumentado, <b>ø</b> = semidisminuido (m7♭5), <b>7</b> = lleva séptima, <b>♭</b>/<b>♯</b> delante = la raíz está alterada respecto a la escala (♭VII). Así una progresión se puede tocar en cualquier tonalidad.</p></details>
      <details><summary>Tipos de acorde</summary><ul><li><b>Mayor</b>: 3ª mayor + 3ª menor (4 + 3 semitonos). Estable, luminoso.</li><li><b>Menor</b>: 3ª menor + 3ª mayor (3 + 4). Triste, oscuro.</li><li><b>Disminuido</b>: dos 3ª menores (3 + 3). Tenso, inestable.</li><li><b>Aumentado</b>: dos 3ª mayores (4 + 4). Suspenso, irreal.</li><li><b>Con 7ª</b>: maj7 (soñador), 7 (dominante, pide resolver), m7 (suave), m7♭5 (oscuro), °7 (dramático).</li></ul></details>
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
      main.querySelector(".teclado-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
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
    const tecla = t.closest(".teclado:not(.mini) rect[data-midi]");
    if (tecla) { nota(Number(tecla.dataset.midi), 0.6); return; }

    // Armonía
    const cel = t.closest("[data-clave]");
    if (cel) { cambiarClave(cel.dataset.clave); elegido = null; pintar(); return; }
    const md = t.closest("[data-modo]");
    if (md) { if (md.dataset.modo !== modo) { modo = md.dataset.modo; setPref("armoniaModo", modo); elegido = null; pintar(); } return; }
    const ac = t.closest("[data-acorde]");
    if (ac) { if (!sonando?.startsWith("prog")) parar(); mostrarAcorde(ac.dataset.acorde); $("#acorde-vista")?.classList.remove("plegada"); return; }

    const b = t.closest("[data-accion]");
    if (!b) return;
    const r = registro.get(elegido);
    switch (b.dataset.accion) {
      case "tocar-escala": tocarEscala(b); break;
      case "prog": tocarProgresion(b); break;
      case "sel-tocar": if (r) tocarAcorde(r.acorde); break;
      case "sel-arpegio": if (r) { parar(); arpegio(r.acorde); } break;
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
    if (a === "septimas") { septimas = e.target.checked; setPref("armoniaSeptimas", septimas); pintar(); }
  });

  pintar();
  return parar;
}
