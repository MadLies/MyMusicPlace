// Rutinas de práctica: listas de ejercicios con minutos, por instrumento.
// Se guardan en este navegador (localStorage). Para llevarlas a otro equipo o al sitio privado,
// se exportan e importan como archivo JSON desde la página «Prácticas».

const CLAVE = "atril:rutinas";
export const INSTRUMENTOS = { armonica: "Armónica", piano: "Piano", violin: "Violín" };
export const EVENTO = "atril:rutinas"; // se emite en window cada vez que cambian

function leerTodo() {
  try {
    const d = JSON.parse(localStorage.getItem(CLAVE));
    return Array.isArray(d?.rutinas) ? d.rutinas : [];
  } catch { return []; }
}
function guardarTodo(rutinas) {
  try { localStorage.setItem(CLAVE, JSON.stringify({ version: 1, rutinas })); } catch { /* sin almacenamiento */ }
  window.dispatchEvent(new CustomEvent(EVENTO));
}

const nuevoId = () => (crypto.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

/** Deja una rutina con forma válida (sirve también para lo que llega de un archivo importado). */
export function limpiar(r) {
  if (!r || typeof r !== "object" || !INSTRUMENTOS[r.instrumento]) return null;
  const ejercicios = (Array.isArray(r.ejercicios) ? r.ejercicios : [])
    .map((e) => ({
      id: typeof e?.id === "string" && e.id ? e.id : nuevoId(),
      nombre: String(e?.nombre ?? "").trim().slice(0, 120),
      min: Math.min(240, Math.max(1, Math.round(Number(e?.min) || 0))),
      nota: String(e?.nota ?? "").trim().slice(0, 300),
      enlace: typeof e?.enlace === "string" && /^#\/[\w/\-.%]*$/.test(e.enlace) ? e.enlace : "",
      enlaceTxt: String(e?.enlaceTxt ?? "").trim().slice(0, 80),
    }))
    .map((e) => (e.enlace ? e : { ...e, enlaceTxt: "" }))
    .filter((e) => e.nombre);
  if (!ejercicios.length) return null;
  return {
    id: typeof r.id === "string" && r.id ? r.id : nuevoId(),
    instrumento: r.instrumento,
    nombre: String(r.nombre ?? "").trim().slice(0, 80) || "Rutina sin nombre",
    ejercicios,
  };
}

export const minutosTotales = (r) => r.ejercicios.reduce((s, e) => s + e.min, 0);

export function listar(instrumento) {
  const todas = leerTodo().map(limpiar).filter(Boolean);
  return instrumento ? todas.filter((r) => r.instrumento === instrumento) : todas;
}
export const obtener = (id) => listar().find((r) => r.id === id) || null;

/** Crea o reemplaza una rutina; devuelve la rutina guardada (o null si no es válida). */
export function guardar(rutina) {
  const r = limpiar(rutina);
  if (!r) return null;
  const todas = leerTodo();
  const i = todas.findIndex((x) => x.id === r.id);
  if (i >= 0) todas[i] = r; else todas.push(r);
  guardarTodo(todas);
  return r;
}
export function borrar(id) { guardarTodo(leerTodo().filter((r) => r.id !== id)); }

/** Cambia de lugar una rutina dentro de su instrumento (paso = -1 sube, +1 baja). */
export function mover(id, paso) {
  const todas = leerTodo();
  const i = todas.findIndex((r) => r.id === id);
  if (i < 0) return;
  const inst = todas[i].instrumento;
  let j = i + paso;
  while (j >= 0 && j < todas.length && todas[j].instrumento !== inst) j += paso;
  if (j < 0 || j >= todas.length) return;
  [todas[i], todas[j]] = [todas[j], todas[i]];
  guardarTodo(todas);
}

export function exportar() {
  return JSON.stringify({ tipo: "atril-rutinas", version: 1, exportado: new Date().toISOString(), rutinas: listar() }, null, 2);
}

/** Importa rutinas desde el texto de un archivo. Las que ya existen (mismo id) se reemplazan. */
export function importar(texto) {
  let d;
  try { d = JSON.parse(texto); } catch { throw new Error("El archivo no es un JSON válido."); }
  const lista = Array.isArray(d) ? d : d?.rutinas;
  if (!Array.isArray(lista)) throw new Error("El archivo no tiene rutinas de Atril.");
  const nuevas = lista.map(limpiar).filter(Boolean);
  if (!nuevas.length) throw new Error("No encontré rutinas válidas en el archivo.");
  const todas = leerTodo();
  for (const r of nuevas) {
    const i = todas.findIndex((x) => x.id === r.id);
    if (i >= 0) todas[i] = r; else todas.push(r);
  }
  guardarTodo(todas);
  return nuevas.length;
}
