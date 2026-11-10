# Atril · Partituras

Partituras de piano y violín y tablaturas de armónica, organizadas por instrumento, con una
**web interactiva** para estudiarlas (se publica sola en GitHub Pages).

## La web

- **Biblioteca**: todas las canciones con nivel, bends, hoyos y tu progreso.
- **Tablaturas interactivas**: toca una nota para oírla; *Escuchar* ilumina la tablatura nota a
  nota con tempo ajustable; repite una parte en bucle; avanza con las flechas del teclado.
- **Armónica dibujada**: muestra qué hoyo tocar y si se sopla o se aspira, en el tono de tu armónica.
- **Ritmo**: las tablaturas pueden llevar duraciones (`6:2`, `-7:1.5`, `7:1/2`) y `tempo:`/`compas:`;
  *Escuchar* sigue el ritmo real, con metrónomo y cuenta de entrada opcionales.
- **Tocar con micrófono**: tú tocas y la tablatura (o la partitura de violín) avanza cuando oye la nota correcta.
- **Metrónomo**: marcar el tempo con toques, compases, subdivisiones, entrenador de velocidad y compases mudos.
- **Notas en los instrumentos**: mapa de la armónica (con todos los bends, según su tono) y diapasón
  del violín con el dedo de cada posición; resalta escalas, y con el micrófono se enciende el círculo
  de la nota que suena, en verde, amarillo o rojo según su afinación.
- **Teoría**:
  - *Escalas*: las 12 tonalidades en el teclado del piano (mayor, las tres menores, los 7 modos griegos,
    pentatónicas y blues), bien escritas (Fa♯ en Re mayor, no Sol♭), con fórmula, grados, armadura,
    relativa, nota característica de cada modo y la galería de las 12.
    También en el diapasón del violín: notas de la escala en cada cuerda, dedos y patrón de dedos
    en 1ª posición (qué dedos van juntos) y la escala para escuchar en una o dos octavas.
  - *Armonía*: los acordes de cada tonalidad (tríadas o con 7ª) con su número romano y su función
    (tónica, subdominante, dominante), progresiones típicas para escuchar, dominantes secundarias
    (V7/ii, V7/V…), préstamo modal, napolitano, sustituto tritonal y el círculo de quintas.
- **Temporizador de práctica** (botón con flecha en la cabecera, en todas las páginas): 20, 30, 45 min,
  1 h o la duración que quieras; pausa, +5 min y aviso al terminar con campana, el título de la pestaña
  y, si lo permites, una notificación del sistema. Sigue contando aunque cambies de página o recargues.
- **Editor MIDI**: piano roll (lápiz y selección, rejilla con tresillos, zoom), varias pistas con
  instrumento General MIDI, canal, volumen, pan, mute y solo; carriles de velocidad, pitch bend,
  volumen, pan, expresión, pedal y modulación; tempo y compás; deshacer, copiar/pegar, duplicar,
  transponer y cuantizar. Abre y descarga archivos .mid, exporta audio .wav e importa las partituras y
  tablaturas de la biblioteca (con su fuente guardada dentro del .mid). Para aprender MIDI: lista de
  eventos con sus bytes, visor de los bytes del archivo, lecciones, constructor de mensajes y monitor.
  Graba desde un teclado MIDI (Web MIDI), el teclado del PC o el de la pantalla, y puede mandar las
  notas a un sintetizador externo.
- **Afinador** con tres modos:
  - *Cromático*: cualquier instrumento o la voz (≈50 Hz–3 kHz), La4 de referencia ajustable,
    transposición para instrumentos en Si♭/Mi♭/Fa y notas de referencia (cortas o sostenidas).
  - *Armónica*: en qué hoyo está la nota y entrenador de bends.
  - *Violín*: cuerdas al aire, entonación en 1ª posición (escalas con diagrama del diapasón e
    informe por dedo: cuál queda alto o bajo y cómo corregir la mano), estabilidad del arco y bordón.
- **Partituras de piano** desde MusicXML, con cursor que sigue la música y el análisis en otra pestaña.
- **Editor**: pega una tablatura en cualquier notación — `(4)` para aspirar, `+4`, `6b`, con la letra
  encima — y la convierte, la previsualiza y la deja lista para el repo.
- **Progreso**: marca las partes aprendidas (se guarda en tu navegador).

Para verla en local (desde esta carpeta):

```
python3 herramientas/generar_indice.py     # actualiza data/canciones.json
python3 -m http.server 8000                # y abre http://localhost:8000
```

Al hacer push a `main`, la GitHub Action `.github/workflows/publicar.yml` regenera el índice y
publica la web. No hay que compilar nada.

## Carpetas

```
Partituras/
├── index.html, assets/, data/   la web (data/canciones.json se genera solo)
├── herramientas/                generar_indice.py
├── Piano/
│   ├── _Plantillas/             Piano_en_blanco.mscz / .musicxml (2 pautas: sol + fa)
│   └── NoviembreSinTi/
├── Violin/
│   ├── _Plantillas/             Violin_en_blanco.mscz / .musicxml (1 pauta, clave de sol)
│   └── 01_CuerdasAlAire … 06_HimnoALaAlegria   6 piezas para empezar (con dedos y nombres de notas)
└── Armonica/
    ├── _Plantillas/             Tablatura_en_blanco.tab + tab2pdf.py (tablaturas → PDF)
    ├── Flaca/
    ├── LaLeyendaDelHadaYElMago/
    ├── Lambada/
    ├── OneSummersDay/
    ├── ThePlaceIllReturnToSomeday/
    ├── Tetris/
    └── VueltaDeBlues/
```

Cada canción tiene la misma estructura:

```
<NombreCancion>/
├── 01_referencias/        fuente original, audios, enlaces
├── 02_editable/           el .mscz de MuseScore o el .tab de la tablatura
├── 03_exportados/
│   ├── pdf/
│   ├── audio/
│   └── musicxml/          ← la web muestra la partitura desde aquí
└── Analisis_y_plan.md     (opcional) aparece en la web como pestaña «Análisis y plan»
```

## Añadir canciones

**Armónica.** Crea `Armonica/<Cancion>/02_editable/<Cancion>.tab` (o usa el editor de la web, que
te da el archivo y, ya publicada, un botón para crearlo directamente en GitHub). El formato está
explicado en `Armonica/_Plantillas/Tablatura_en_blanco.tab`. Para el PDF:

```
python3 Armonica/_Plantillas/tab2pdf.py Armonica/<Cancion>/02_editable/<Cancion>.tab
```

**Piano / violín.** Crea `<Instrumento>/<Cancion>/` desde la plantilla, y exporta el MusicXML para
que la web lo muestre:

```
mscore -o <Instrumento>/<Cancion>/03_exportados/musicxml/<Cancion>.musicxml <Instrumento>/<Cancion>/02_editable/<Cancion>.mscz
```

En `01_referencias/fuente.txt` pon de dónde sale la pieza (primera línea) y, si quieres, una línea
`nivel: 1` (1 a 5) para que la biblioteca muestre su dificultad.

Si la misma canción existe para varios instrumentos, usa el mismo nombre de carpeta en cada uno.
