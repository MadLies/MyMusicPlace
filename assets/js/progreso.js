// Progreso de estudio guardado en este navegador (localStorage).
const CLAVE = "atril:progreso:v1";

function leer() {
  try { return JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch { return {}; }
}
function guardar(datos) {
  try { localStorage.setItem(CLAVE, JSON.stringify(datos)); } catch { /* sin almacenamiento: no pasa nada */ }
}

export function progresoDe(id) {
  return leer()[id] || { secciones: {}, tempo: null, practicas: 0 };
}

export function actualizar(id, cambios) {
  const datos = leer();
  datos[id] = { ...progresoDe(id), ...cambios, ultima: new Date().toISOString() };
  guardar(datos);
  return datos[id];
}

export function marcarSeccion(id, indice, aprendida) {
  const p = progresoDe(id);
  const secciones = { ...p.secciones, [indice]: aprendida };
  if (!aprendida) delete secciones[indice];
  return actualizar(id, { secciones });
}

export function porcentaje(id, total) {
  if (!total) return 0;
  const n = Object.values(progresoDe(id).secciones).filter(Boolean).length;
  return Math.round((100 * Math.min(n, total)) / total);
}

// Preferencias generales (tema, mostrar nombres, etc.).
const PREF = "atril:preferencias:v1";
export function pref(nombre, porDefecto) {
  try { const v = JSON.parse(localStorage.getItem(PREF) || "{}")[nombre]; return v === undefined ? porDefecto : v; } catch { return porDefecto; }
}
export function setPref(nombre, valor) {
  try {
    const d = JSON.parse(localStorage.getItem(PREF) || "{}");
    d[nombre] = valor;
    localStorage.setItem(PREF, JSON.stringify(d));
  } catch { /* nada */ }
}
