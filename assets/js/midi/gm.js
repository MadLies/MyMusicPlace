// General MIDI: los 128 instrumentos (Program Change 0–127) y el mapa de percusión del canal 10.
// En los archivos MIDI el instrumento es solo un número; el sintetizador decide cómo suena.

export const FAMILIAS = [
  "Pianos", "Percusión cromática", "Órganos", "Guitarras", "Bajos", "Cuerdas solistas",
  "Conjuntos", "Metales", "Lengüetas", "Flautas", "Sintetizador solista", "Sintetizador de fondo (pad)",
  "Efectos de sintetizador", "Étnicos", "Percusión", "Efectos de sonido",
];

export const INSTRUMENTOS = [
  // 0–7 Pianos
  "Piano de cola", "Piano brillante", "Piano eléctrico de cola", "Piano de bar (honky-tonk)", "Piano eléctrico 1 (Rhodes)", "Piano eléctrico 2 (FM)", "Clavecín", "Clavinet",
  // 8–15 Percusión cromática
  "Celesta", "Glockenspiel", "Caja de música", "Vibráfono", "Marimba", "Xilófono", "Campanas tubulares", "Dulcémele",
  // 16–23 Órganos
  "Órgano Hammond", "Órgano percusivo", "Órgano de rock", "Órgano de iglesia", "Armonio", "Acordeón", "Armónica", "Bandoneón",
  // 24–31 Guitarras
  "Guitarra de nailon", "Guitarra de acero", "Guitarra eléctrica (jazz)", "Guitarra eléctrica (limpia)", "Guitarra eléctrica (apagada)", "Guitarra saturada (overdrive)", "Guitarra distorsionada", "Armónicos de guitarra",
  // 32–39 Bajos
  "Contrabajo acústico", "Bajo eléctrico (dedos)", "Bajo eléctrico (púa)", "Bajo sin trastes", "Bajo slap 1", "Bajo slap 2", "Bajo de sintetizador 1", "Bajo de sintetizador 2",
  // 40–47 Cuerdas solistas
  "Violín", "Viola", "Violonchelo", "Contrabajo", "Cuerdas en trémolo", "Cuerdas en pizzicato", "Arpa", "Timbales (timpani)",
  // 48–55 Conjuntos
  "Orquesta de cuerdas 1", "Orquesta de cuerdas 2", "Cuerdas de sintetizador 1", "Cuerdas de sintetizador 2", "Coro «aah»", "Voz «ooh»", "Voz de sintetizador", "Golpe de orquesta",
  // 56–63 Metales
  "Trompeta", "Trombón", "Tuba", "Trompeta con sordina", "Trompa", "Sección de metales", "Metales de sintetizador 1", "Metales de sintetizador 2",
  // 64–71 Lengüetas
  "Saxo soprano", "Saxo alto", "Saxo tenor", "Saxo barítono", "Oboe", "Corno inglés", "Fagot", "Clarinete",
  // 72–79 Flautas
  "Flautín", "Flauta", "Flauta dulce", "Flauta de pan", "Botella soplada", "Shakuhachi", "Silbido", "Ocarina",
  // 80–87 Sintetizador solista
  "Lead cuadrada", "Lead diente de sierra", "Lead calíope", "Lead chiff", "Lead charango", "Lead voz", "Lead quintas", "Lead bajo + solista",
  // 88–95 Pads
  "Pad new age", "Pad cálido", "Pad polisintetizador", "Pad coro", "Pad arco", "Pad metálico", "Pad halo", "Pad barrido",
  // 96–103 Efectos de sintetizador
  "FX lluvia", "FX banda sonora", "FX cristal", "FX atmósfera", "FX brillo", "FX duendes", "FX ecos", "FX ciencia ficción",
  // 104–111 Étnicos
  "Sitar", "Banjo", "Shamisen", "Koto", "Kalimba", "Gaita", "Violín folk (fiddle)", "Shanai",
  // 112–119 Percusión
  "Campanilla", "Agogó", "Steel drum", "Caja china (woodblock)", "Taiko", "Tom melódico", "Tambor de sintetizador", "Platillo al revés",
  // 120–127 Efectos de sonido
  "Ruido de traste", "Respiración", "Olas del mar", "Pájaro", "Teléfono", "Helicóptero", "Aplausos", "Disparo",
];

export const familiaDe = (programa) => Math.floor(programa / 8);

// Mapa de percusión General MIDI (canal 10): cada nota es un instrumento distinto.
export const PERCUSION = {
  35: "Bombo acústico", 36: "Bombo", 37: "Golpe de aro", 38: "Caja", 39: "Palmada", 40: "Caja eléctrica",
  41: "Tom grave de suelo", 42: "Hi-hat cerrado", 43: "Tom agudo de suelo", 44: "Hi-hat con pedal", 45: "Tom grave",
  46: "Hi-hat abierto", 47: "Tom medio-grave", 48: "Tom medio-agudo", 49: "Platillo crash 1", 50: "Tom agudo",
  51: "Platillo ride 1", 52: "Platillo chino", 53: "Campana del ride", 54: "Pandereta", 55: "Platillo splash",
  56: "Cencerro", 57: "Platillo crash 2", 58: "Vibraslap", 59: "Platillo ride 2", 60: "Bongó agudo", 61: "Bongó grave",
  62: "Conga apagada", 63: "Conga abierta", 64: "Conga grave", 65: "Timbal agudo", 66: "Timbal grave",
  67: "Agogó agudo", 68: "Agogó grave", 69: "Cabasa", 70: "Maracas", 71: "Silbato corto", 72: "Silbato largo",
  73: "Güiro corto", 74: "Güiro largo", 75: "Claves", 76: "Caja china aguda", 77: "Caja china grave",
  78: "Cuíca apagada", 79: "Cuíca abierta", 80: "Triángulo apagado", 81: "Triángulo abierto",
};

export const CANAL_PERCUSION = 9; // el «canal 10» (los canales se cuentan 1–16, en los bytes 0–15)

// Controladores (Control Change) que el editor permite dibujar.
export const CONTROLES = {
  1: { nombre: "Modulación", corto: "Modulación", texto: "Vibrato: cuánto oscila la afinación. 0 = nada." },
  7: { nombre: "Volumen (CC7)", corto: "Volumen", texto: "Volumen del canal. Se suele fijar al principio y dejarlo." },
  10: { nombre: "Panorama (CC10)", corto: "Pan", texto: "Izquierda (0) – centro (64) – derecha (127)." },
  11: { nombre: "Expresión (CC11)", corto: "Expresión", texto: "Volumen «expresivo» dentro del volumen del canal: crescendos y diminuendos." },
  64: { nombre: "Pedal de sostenido (CC64)", corto: "Sostenido", texto: "Pedal derecho del piano: 0–63 = suelto, 64–127 = pisado. Las notas siguen sonando mientras está pisado." },
};
