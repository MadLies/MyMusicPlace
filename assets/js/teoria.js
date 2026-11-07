// Teoría musical para las vistas de Escalas y Armonía: deletreo correcto de las notas
// (en Re mayor se escribe Fa♯, no Sol♭), escalas y modos, acordes, grados y funciones.

export const LETRAS = ["C", "D", "E", "F", "G", "A", "B"];
export const SOLFEO = ["Do", "Re", "Mi", "Fa", "Sol", "La", "Si"];
const PC_LETRA = [0, 2, 4, 5, 7, 9, 11];
const SIGNO = { "-2": "♭♭", "-1": "♭", 0: "", 1: "♯", 2: "♯♯" };
export const mod12 = (x) => ((x % 12) + 12) % 12;
const mod7 = (x) => ((x % 7) + 7) % 7;

// Una nota «deletreada» es { l: letra 0..6 (Do..Si), a: alteración -2..2 }.
export const pc = (n) => mod12(PC_LETRA[n.l] + n.a);
export function deletrear(p, l) {
  l = mod7(l);
  let a = mod12(p - PC_LETRA[l]);
  if (a > 6) a -= 12;
  return { l, a };
}
export const nombre = (n) => SOLFEO[n.l] + SIGNO[n.a];
export const cifra = (n) => LETRAS[n.l] + SIGNO[n.a];
export const romanoAlt = (a) => (a < 0 ? "♭".repeat(-a) : "♯".repeat(a));

// ---------------------------------------------------------------- Escalas
export const MAYOR = [0, 2, 4, 5, 7, 9, 11];
const rotar = (k) => MAYOR.map((_, i) => mod12(MAYOR[(i + k) % 7] - MAYOR[k]));

export const ESCALAS = {
  mayor: { nombre: "mayor", pasos: MAYOR, base: "mayor", clave: "mayor",
    caracter: "Brillante, estable y alegre. Es la referencia: las demás escalas se describen comparándolas con ella." },
  menor: { nombre: "menor natural", pasos: [0, 2, 3, 5, 7, 8, 10], base: "menor", clave: "menor",
    caracter: "Triste o melancólica. Tiene las mismas notas que su relativa mayor, empezando en el 6º grado." },
  armonica: { nombre: "menor armónica", pasos: [0, 2, 3, 5, 7, 8, 11], base: "menor", clave: "menor",
    caracter: "La menor natural con el 7º grado subido medio tono: así tiene sensible y un acorde V mayor. El salto de 1½ tonos entre el 6º y el 7º le da un aire árabe o flamenco." },
  melodica: { nombre: "menor melódica", pasos: [0, 2, 3, 5, 7, 9, 11], base: "menor", clave: "menor",
    caracter: "Sube el 6º y el 7º grados para que la melodía suba suave hacia la tónica. En la música clásica se usa al subir y al bajar se vuelve a la natural; en el jazz se usa igual en los dos sentidos." },
  jonico: { nombre: "jónico", modo: 1, pasos: rotar(0), clave: "mayor",
    caracter: "Es la escala mayor con su nombre de modo. Brillante y estable." },
  dorico: { nombre: "dórico", modo: 2, pasos: rotar(1), caracteristica: 5,
    caracter: "Menor, pero con la 6ª mayor: un menor luminoso. Muy usado en jazz, funk, rock y música celta. Ejemplos: «Oye cómo va» (Santana), «Scarborough Fair»." },
  frigio: { nombre: "frigio", modo: 3, pasos: rotar(2), caracteristica: 1,
    caracter: "Menor con la 2ª menor (♭2), a medio tono de la tónica. Oscuro y tenso: suena a flamenco y a metal." },
  lidio: { nombre: "lidio", modo: 4, pasos: rotar(3), caracteristica: 3,
    caracter: "Mayor con la 4ª aumentada (♯4). Etéreo, de ensueño, muy de bandas sonoras. Ejemplo: el tema de «Los Simpson»." },
  mixolidio: { nombre: "mixolidio", modo: 5, pasos: rotar(4), caracteristica: 6,
    caracter: "Mayor con la 7ª menor (♭7). Mayor pero relajado, sin la tensión de la sensible: rock, blues y folk. Ejemplo: «Norwegian Wood» (The Beatles)." },
  eolico: { nombre: "eólico", modo: 6, pasos: rotar(5), clave: "menor",
    caracter: "Es la menor natural con su nombre de modo. Triste y melancólico." },
  locrio: { nombre: "locrio", modo: 7, pasos: rotar(6), caracteristica: 4,
    caracter: "Con 2ª menor y 5ª disminuida (♭2, ♭5): su acorde de tónica es disminuido, así que nunca suena a reposo. Casi no se usa como tonalidad; sí para improvisar sobre acordes m7♭5 en jazz, y en metal." },
  pentaMayor: { nombre: "pentatónica mayor", pasos: [0, 2, 4, 7, 9], letras: [0, 1, 2, 4, 5], base: "mayor",
    caracter: "La escala mayor sin el 4º ni el 7º grados: sin semitonos, así que es casi imposible que suene mal. Country, folk, pop y música de muchos pueblos del mundo." },
  pentaMenor: { nombre: "pentatónica menor", pasos: [0, 3, 5, 7, 10], letras: [0, 2, 3, 4, 6], base: "menor",
    caracter: "La menor natural sin el 2º ni el 6º grados. La escala del rock y del blues: la primera que se aprende para improvisar." },
  blues: { nombre: "blues", pasos: [0, 3, 5, 6, 7, 10], letras: [0, 2, 3, 4, 4, 6], base: "menor",
    caracter: "La pentatónica menor más la «blue note» (♭5) entre el 4º y el 5º grados, que se usa de paso." },
};
for (const [k, e] of Object.entries(ESCALAS)) { e.id = k; e.base ??= k; }

export const GRUPOS = [
  { nombre: "Mayores y menores", tipos: ["mayor", "menor", "armonica", "melodica"] },
  { nombre: "Modos griegos", tipos: ["jonico", "dorico", "frigio", "lidio", "mixolidio", "eolico", "locrio"] },
  { nombre: "Otras", tipos: ["pentaMayor", "pentaMenor", "blues"] },
];
// Del más brillante al más oscuro: cada modo baja una nota respecto al anterior.
export const MODOS_BRILLO = ["lidio", "jonico", "mixolidio", "dorico", "eolico", "frigio", "locrio"];

/** Notas deletreadas de una escala a partir de su tónica deletreada. */
export function escala(t, tipo) {
  const e = ESCALAS[tipo];
  return e.pasos.map((p, i) => deletrear(pc(t) + p, t.l + (e.letras ? e.letras[i] : i)));
}

const costo = (notas) => notas.reduce((s, n) => s + Math.abs(n.a) + (Math.abs(n.a) > 1 ? 20 : 0), 0);

/** Formas de escribir la tónica (Do♯ o Re♭…), de la más sencilla a la más complicada. */
export function opcionesTonica(p, tipo) {
  const base = ESCALAS[tipo].base;
  const lista = [];
  for (let l = 0; l < 7; l++) {
    const t = deletrear(p, l);
    if (Math.abs(t.a) <= 1) lista.push({ t, costo: costo(escala(t, base)) });
  }
  // A igual número de alteraciones se prefieren los sostenidos (Fa♯ mayor antes que Sol♭).
  return lista.sort((x, y) => x.costo - y.costo || y.t.a - x.t.a);
}
export const tonicaDe = (p, tipo) => opcionesTonica(p, tipo)[0].t;

/** Otra escritura razonable (enarmónica), si la hay: Do♯ mayor ↔ Re♭ mayor. */
export function enarmonica(p, tipo) {
  const [a, b] = opcionesTonica(p, tipo);
  return b && b.costo <= 7 ? b.t : null;
}

const ORDEN_SOST = [3, 0, 4, 1, 5, 2, 6];
const ORDEN_BEM = [6, 2, 5, 1, 4, 0, 3];
/** Armadura de una lista de 7 notas: cuántos ♯ o ♭ y cuáles, en orden. */
export function armadura(notas) {
  const sost = notas.filter((n) => n.a > 0), bem = notas.filter((n) => n.a < 0);
  if (sost.length) return { n: sost.length, signo: "♯", notas: ORDEN_SOST.map((l) => sost.find((x) => x.l === l)).filter(Boolean) };
  if (bem.length) return { n: bem.length, signo: "♭", notas: ORDEN_BEM.map((l) => bem.find((x) => x.l === l)).filter(Boolean) };
  return { n: 0, signo: "", notas: [] };
}
export function textoArmadura(ar) {
  if (!ar.n) return "sin alteraciones";
  return `${ar.n} ${ar.signo === "♯" ? "sostenido" : "bemol"}${ar.n > 1 ? (ar.signo === "♯" ? "s" : "es") : ""} (${ar.notas.map(nombre).join(", ")})`;
}
export const armaduraCorta = (ar) => (ar.n ? `${ar.n}${ar.signo}` : "0");

/** Grados respecto a la escala mayor de la misma tónica: 1 2 ♭3 4 5 ♭6 ♭7. */
export function formulaGrados(tipo) {
  const e = ESCALAS[tipo];
  return e.pasos.map((p, i) => {
    const g = e.letras ? e.letras[i] : i;
    let d = p - MAYOR[g];
    if (d > 6) d -= 12;
    return { texto: romanoAlt(d) + (g + 1), alterado: d !== 0 };
  });
}

/** Tonos y semitonos entre notas seguidas (cerrando en la octava). */
export function formulaPasos(tipo) {
  const p = [...ESCALAS[tipo].pasos, 12];
  return p.slice(1).map((x, i) => ({ 1: "St", 2: "T", 3: "T½", 4: "2T" }[x - p[i]] || "?"));
}

const NOMBRE_GRADO = ["Tónica", "Supertónica", "Mediante", "Subdominante", "Dominante", "Superdominante"];
export function nombreGrado(tipo, i) {
  if (i < 6) return NOMBRE_GRADO[i];
  return ESCALAS[tipo].pasos[6] === 11 ? "Sensible" : "Subtónica";
}

// ---------------------------------------------------------------- Acordes
const may = (r) => r, men = (r) => r.toLowerCase();
export const CALIDADES = [
  { iv: [4, 7], cif: "", nombre: "mayor", rom: may },
  { iv: [3, 7], cif: "m", nombre: "menor", rom: men },
  { iv: [3, 6], cif: "°", nombre: "disminuido", rom: (r) => men(r) + "°" },
  { iv: [4, 8], cif: "+", nombre: "aumentado", rom: (r) => r + "+" },
  { iv: [4, 7, 11], cif: "maj7", nombre: "mayor con 7ª mayor", rom: (r) => r + "maj7" },
  { iv: [4, 7, 10], cif: "7", nombre: "con 7ª (dominante)", rom: (r) => r + "7" },
  { iv: [3, 7, 10], cif: "m7", nombre: "menor con 7ª", rom: (r) => men(r) + "7" },
  { iv: [3, 6, 10], cif: "m7♭5", nombre: "semidisminuido", rom: (r) => men(r) + "ø7" },
  { iv: [3, 6, 9], cif: "°7", nombre: "disminuido con 7ª disminuida", rom: (r) => men(r) + "°7" },
  { iv: [3, 7, 11], cif: "m(maj7)", nombre: "menor con 7ª mayor", rom: (r) => men(r) + "(maj7)" },
  { iv: [4, 8, 11], cif: "+maj7", nombre: "aumentado con 7ª mayor", rom: (r) => r + "+maj7" },
];
const ROMANOS = ["I", "II", "III", "IV", "V", "VI", "VII"];
const ETQ_INTERVALO = ["1", "3", "5", "7"];

/** Acorde a partir de su raíz deletreada y sus intervalos en semitonos ([4, 7] = mayor). */
export function construir(raiz, iv) {
  const cal = CALIDADES.find((c) => c.iv.join() === iv.join());
  const notas = [raiz, ...iv.map((s, i) => deletrear(pc(raiz) + s, raiz.l + 2 * (i + 1)))];
  return {
    raiz, notas, cal,
    intervalos: notas.map((_, i) => ETQ_INTERVALO[i]),
    cifrado: cifra(raiz) + cal.cif,
    nombre: `${nombre(raiz)} ${cal.nombre}`,
  };
}

/** Acorde que se forma apilando terceras sobre el grado i de una escala de 7 notas. */
function apilar(notas, i, septima) {
  const tomadas = (septima ? [0, 2, 4, 6] : [0, 2, 4]).map((k) => notas[(i + k) % 7]);
  const iv = tomadas.slice(1).map((n) => mod12(pc(n) - pc(tomadas[0])));
  return construir(tomadas[0], iv);
}

// ---------------------------------------------------------------- Tonalidades
export function clave(p, modo) {
  const tonica = tonicaDe(p, modo);
  const notas = escala(tonica, modo);
  return { p, modo, tonica, notas, pcs: new Set(notas.map(pc)), nombre: `${nombre(tonica)} ${modo}`, cifrado: cifra(tonica) + (modo === "menor" ? "m" : "") };
}
export function sensible(c) {
  const s = c.notas[6];
  return c.modo === "menor" ? deletrear(pc(s) + 1, s.l) : s;
}

/** Número romano de un acorde dentro de una tonalidad (♭VI, V7, iiø7…). */
export function romano(c, acorde) {
  const d = mod7(acorde.raiz.l - c.tonica.l);
  let alt = mod12(pc(acorde.raiz) - pc(c.notas[d]));
  if (alt > 6) alt -= 12;
  if (c.modo === "menor" && d === 6 && alt === 1) alt = 0; // la sensible de la menor armónica: vii°, no ♯vii°
  return romanoAlt(alt) + acorde.cal.rom(ROMANOS[d]);
}

const RE_NUM = /^([♭♯]?)(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(°7|ø7|°|\+|maj7|7)?(?:\/(.+))?$/;
function intervalosDe(rom, suf = "") {
  const M = rom === rom.toUpperCase();
  return { "°7": [3, 6, 9], "ø7": [3, 6, 10], "°": [3, 6], "+": [4, 8], maj7: M ? [4, 7, 11] : [3, 7, 11], 7: M ? [4, 7, 10] : [3, 7, 10] }[suf] || (M ? [4, 7] : [3, 7]);
}

/** Acorde a partir de un número romano: "V7", "♭VII", "iiø7", "V7/vi", "vii°7/V"… */
export function acordeNumeral(c, txt) {
  const m = txt.match(RE_NUM);
  if (!m) throw new Error(`Número romano desconocido: ${txt}`);
  const [, acc, rom, suf, destino] = m;
  const R = rom.toUpperCase();
  let raiz;
  if (destino) {
    const t = acordeNumeral(c, destino).raiz;
    const salto = { V: [7, 4], VII: [11, 6], II: [2, 1], IV: [5, 3] }[R];
    raiz = deletrear(pc(t) + salto[0], t.l + salto[1]);
  } else {
    const d = ROMANOS.indexOf(R);
    raiz = c.notas[d];
    let alt = acc === "♭" ? -1 : acc === "♯" ? 1 : 0;
    if (c.modo === "menor" && d === 6 && rom === "vii") alt += 1; // vii° en menor = sobre la sensible
    if (alt) raiz = deletrear(pc(raiz) + alt, raiz.l);
  }
  return { ...construir(raiz, intervalosDe(rom, suf)), romano: txt };
}

// Funciones armónicas. {1}…{7} = grados de la escala; {s} = sensible.
const FUN_MAYOR = [
  { f: "T", txt: "Tónica: el hogar. Reposo total; casi todas las canciones empiezan y terminan aquí.", va: "cualquier acorde" },
  { f: "SD", txt: "Subdominante: prepara la dominante. Es el «ii» del famoso ii–V–I del jazz.", va: "V" },
  { f: "T", txt: "Tónica débil: comparte dos notas con el I ({3} y {5}), por eso a veces lo sustituye.", va: "vi o IV" },
  { f: "SD", txt: "Subdominante: se aleja de casa sin tensión; abre el camino. IV–I es la cadencia plagal («amén»).", va: "V o I" },
  { f: "D", txt: "Dominante: máxima tensión. Tiene la sensible ({7}), que quiere subir a {1}; con la 7ª ({4}) forma el tritono {4}–{7}, que pide resolver.", va: "I (o vi, en la cadencia rota)" },
  { f: "T", txt: "Tónica relativa: es el acorde de la relativa menor ({6} menor). Reposo, pero con un aire triste.", va: "ii o IV" },
  { f: "D", txt: "Dominante sin fundamental: tiene las notas del V7 sin su raíz ({5}), así que resuelve igual que el V.", va: "I" },
];
const FUN_MENOR = [
  { f: "T", txt: "Tónica menor: el hogar, con color triste.", va: "cualquier acorde" },
  { f: "SD", txt: "Subdominante disminuida: tensa. En el jazz se toca como iiø7 en el ii–V–i menor.", va: "V" },
  { f: "T", txt: "Tónica relativa: el acorde de la relativa mayor ({3} mayor). Una tónica más luminosa.", va: "VI o iv" },
  { f: "SD", txt: "Subdominante menor: profunda y oscura.", va: "V o i" },
  { f: "D", txt: "Dominante «natural»: sin sensible casi no tiene tensión. Por eso en menor se suele usar el V mayor de la menor armónica.", va: "i o VI", debil: true },
  { f: "SD", txt: "Submediante: hace de subdominante (o de tónica sorpresa en la cadencia rota V–VI). Muy usada en el pop.", va: "VII, iv o V" },
  { f: "D", txt: "Subtónica: es el V de la relativa mayor. Una dominante suave, muy común en pop y rock (i–VII–VI).", va: "III o i", debil: true },
];
const FUN_ARMONICA = [
  { grado: 4, f: "D", txt: "Dominante de la menor armónica: sube el 7º grado a {s}, la sensible, que tira con fuerza hacia {1}. Es la dominante que más se usa en menor.", va: "i (o VI, en la cadencia rota)" },
  { grado: 6, f: "D", txt: "Acorde sobre la sensible ({s}). Con 7ª es el famoso disminuido (vii°7): dramático, de película de suspenso.", va: "i" },
];
export const FUNCIONES = {
  T: { nombre: "Tónica", corto: "T", txt: "Reposo. Es «casa»." },
  SD: { nombre: "Subdominante", corto: "SD", txt: "Se aleja de casa y prepara la tensión." },
  D: { nombre: "Dominante", corto: "D", txt: "Tensión que pide volver a la tónica." },
};

function rellenar(c, txt) {
  return txt.replace(/\{(\d|s)\}/g, (_, k) => nombre(k === "s" ? sensible(c) : c.notas[Number(k) - 1]));
}

/** Los acordes de la tonalidad, con su número, función y a dónde suelen ir. */
export function acordesDiatonicos(c, septimas) {
  const fun = c.modo === "mayor" ? FUN_MAYOR : FUN_MENOR;
  const lista = c.notas.map((_, i) => {
    const a = apilar(c.notas, i, septimas);
    return { ...a, grado: i, romano: romano(c, a), funcion: fun[i].f, debil: fun[i].debil, txt: rellenar(c, fun[i].txt), va: fun[i].va };
  });
  if (c.modo === "menor") {
    const arm = escala(c.tonica, "armonica");
    for (const x of FUN_ARMONICA) {
      const a = apilar(arm, x.grado, septimas);
      lista.push({ ...a, grado: x.grado, armonica: true, romano: romano(c, a), funcion: x.f, txt: rellenar(c, x.txt), va: x.va });
    }
  }
  return lista;
}

/** Notas del acorde que no están en la tonalidad (en menor, la sensible no cuenta como extraña). */
export function notasExtranas(c, acorde) {
  const sens = pc(sensible(c));
  return acorde.notas.filter((n) => !c.pcs.has(pc(n)) && !(c.modo === "menor" && pc(n) === sens));
}

/** Dominantes secundarias: el V7 de cada acorde mayor o menor de la tonalidad. */
export function dominantesSecundarias(c) {
  const diat = acordesDiatonicos(c, false).filter((a) => !a.armonica);
  return diat.slice(1).filter((a) => a.cal.cif !== "°").map((destino) => {
    const nDest = c.modo === "menor" && destino.grado === 4 ? "V" : destino.romano;
    const t = destino.raiz;
    const dom = { ...construir(deletrear(pc(t) + 7, t.l + 4), [4, 7, 10]), romano: `V7/${nDest}` };
    const dest = c.modo === "menor" && destino.grado === 4 ? acordeNumeral(c, "V") : destino;
    const ii = construir(deletrear(pc(t) + 2, t.l + 1), dest.cal.cif === "m" ? [3, 6, 10] : [3, 7, 10]);
    const vii = construir(deletrear(pc(t) - 1, t.l - 1), [3, 6, 9]);
    const extra = notasExtranas(c, dom);
    const sens = extra.find((n) => pc(n) === mod12(pc(t) - 1));
    return { acorde: dom, destino: dest, ii, vii, extra, sensDestino: sens };
  });
}

/** Acordes prestados del modo paralelo (y otros invitados frecuentes). */
export function prestados(c) {
  const lista = [];
  const t = c.tonica;
  const add = (num, origen, txt, septimas = false) => {
    const a = acordeNumeral(c, num);
    lista.push({ acorde: a, origen, txt: rellenar(c, txt), extra: notasExtranas(c, a), septimas });
  };
  if (c.modo === "mayor") {
    const homo = `${nombre(t)} menor`;
    add("iv", homo, "La subdominante menor: el acorde de la nostalgia. I–IV–iv–I suena a despedida (como en «Creep» de Radiohead).");
    add("♭VII", homo, "Sonido rock y pop: I–♭VII–IV, o ♭VII–I como cadencia sin sensible (viene del mixolidio).");
    add("♭VI", homo, "Grande y emotivo. ♭VI–♭VII–I es la «cadencia épica» de bandas sonoras y videojuegos.");
    add("♭III", homo, "Oscuro y heroico; suele ir con ♭VI y ♭VII.");
    add("iiø7", homo, "Un ii más oscuro antes del V: iiø7–V7–I. Muy común en baladas y en jazz.");
    add("v", homo, "Dominante sin sensible: no tiene tensión, suena modal (mixolidio).");
  } else {
    const homo = `${nombre(t)} mayor`;
    add("I", homo, "Tercera de picardía: terminar una pieza menor en el acorde mayor. Muy barroco (Bach la usa a menudo).");
    add("IV", homo, "IV mayor: sonido dórico, menor pero luminoso (i–IV, como en «Oye cómo va»).");
    add("ii", homo, "ii menor (de la menor melódica o el dórico): un ii más suave que el ii°.");
  }
  add("♭II", "frigio", "Acorde napolitano: se forma sobre el 2º grado bajado. Va al V (♭II–V–i), casi siempre en primera inversión. Muy clásico y dramático, sobre todo en menor.");
  add("♭II7", "sustitución tritonal", "Sustituto tritonal del V7: comparte con él el tritono ({4}–{s}) y baja por semitono a la tónica. Muy usado en jazz (ii–♭II7–I).");
  return lista;
}

// Progresiones típicas (números romanos).
export const PROGRESIONES = {
  mayor: [
    { nombre: "Cadencia perfecta", nums: ["I", "IV", "V7", "I"], txt: "El viaje completo: tónica → subdominante → dominante → tónica." },
    { nombre: "ii–V–I (jazz)", nums: ["ii7", "V7", "Imaj7"], txt: "La progresión más importante del jazz." },
    { nombre: "Pop de cuatro acordes", nums: ["I", "V", "vi", "IV"], txt: "Cientos de canciones pop usan solo estos cuatro acordes." },
    { nombre: "Años 50 (doo-wop)", nums: ["I", "vi", "IV", "V"], txt: "La de las baladas de los 50 y 60." },
    { nombre: "Canon de Pachelbel", nums: ["I", "V", "vi", "iii", "IV", "I", "IV", "V"], txt: "El bajo baja por grados; base de muchísimas canciones." },
    { nombre: "Cadencia plagal («amén»)", nums: ["I", "IV", "I"], txt: "IV–I: un final suave, sin la tensión de la dominante." },
    { nombre: "Cadencia rota", nums: ["IV", "V7", "vi"], txt: "La dominante va al vi en vez de al I: una sorpresa que alarga la frase." },
    { nombre: "Semicadencia", nums: ["I", "vi", "ii", "V"], txt: "Termina en el V: queda en suspenso, como una pregunta." },
    { nombre: "Blues de 12 compases", nums: ["I7", "I7", "I7", "I7", "IV7", "IV7", "I7", "I7", "V7", "IV7", "I7", "V7"], txt: "Un acorde por compás. En el blues todos los acordes llevan 7ª menor." },
    { nombre: "Con dominante secundaria", nums: ["I", "V7/V", "V7", "I"], txt: "El V7/V trae una nota de fuera que hace más fuerte la llegada al V." },
    { nombre: "Visita a la relativa", nums: ["I", "V7/vi", "vi", "IV", "V7", "I"], txt: "El V7/vi convierte por un momento al vi en tónica." },
    { nombre: "Subdominante menor", nums: ["I", "IV", "iv", "I"], txt: "Préstamo modal: el iv menor le da un toque nostálgico." },
    { nombre: "Rock con ♭VII", nums: ["I", "♭VII", "IV", "I"], txt: "Préstamo del modo mixolidio, típico del rock." },
    { nombre: "Cadencia épica", nums: ["IV", "♭VI", "♭VII", "I"], txt: "♭VI–♭VII–I: un final triunfal." },
  ],
  menor: [
    { nombre: "Cadencia perfecta en menor", nums: ["i", "iv", "V7", "i"], txt: "Con el V mayor de la menor armónica: la sensible lleva a la tónica." },
    { nombre: "ii–V–i menor (jazz)", nums: ["iiø7", "V7", "i"], txt: "La versión menor del ii–V–I." },
    { nombre: "Cadencia andaluza", nums: ["i", "VII", "VI", "V"], txt: "El bajo baja por grados hasta la dominante: flamenco puro." },
    { nombre: "Pop en menor", nums: ["i", "VI", "III", "VII"], txt: "Los mismos cuatro acordes del pop, empezando en la relativa menor." },
    { nombre: "Círculo de quintas", nums: ["i", "iv", "VII", "III", "VI", "iiø7", "V7", "i"], txt: "Cada acorde está una quinta por debajo del anterior: la base de muchos estándares de jazz y del barroco." },
    { nombre: "Cadencia rota", nums: ["iv", "V7", "VI"], txt: "La dominante va al VI en vez de a la tónica." },
    { nombre: "Vamp dórico", nums: ["i", "IV", "i", "IV"], txt: "El IV mayor (prestado) da el color del modo dórico." },
    { nombre: "Napolitana", nums: ["i", "♭II", "V7", "i"], txt: "El acorde napolitano antes de la dominante: muy dramático." },
    { nombre: "Picardía", nums: ["iv", "V7", "I"], txt: "Termina en mayor: tercera de picardía." },
    { nombre: "Blues menor", nums: ["i7", "i7", "i7", "i7", "iv7", "iv7", "i7", "i7", "VI7", "V7", "i7", "V7"], txt: "Un acorde por compás, como el blues mayor pero en menor." },
  ],
};
