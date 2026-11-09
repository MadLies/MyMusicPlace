// «Aprende MIDI»: lecciones cortas y un constructor de mensajes para ver cómo se escriben los bytes.
import { describirMensaje, bytesHex, vlq } from "./smf.js";
import { INSTRUMENTOS, CONTROLES, PERCUSION } from "./gm.js";
import { cifraMidi, nombreMidi, frecMidi } from "./modelo.js";
import { tecladoSVG } from "../teclado.js";

const b = (n) => n.toString(2).padStart(8, "0");

export function leccionesHTML() {
  const notas = new Map();
  for (let m = 48; m <= 72; m++) notas.set(m, { tipo: m === 60 ? "tonica" : "escala", texto: String(m), sub: m % 12 === 0 ? cifraMidi(m) : "" });
  return `
  <div class="aprende">
    <section class="panel leccion">
      <h2>1 · MIDI no es sonido: son instrucciones</h2>
      <p><b>MIDI</b> (Musical Instrument Digital Interface, 1983) es un idioma para que los instrumentos electrónicos y los ordenadores se hablen. Un mensaje MIDI no lleva audio: dice <i>«toca la nota 60 con fuerza 100»</i> y, más tarde, <i>«suéltala»</i>. El sonido lo pone quien recibe el mensaje: un sintetizador, un piano digital o, aquí, el navegador.</p>
      <p>Por eso un archivo <code>.mid</code> pesa unos pocos kilobytes, se puede editar nota por nota y cambiar de instrumento es cambiar un número. Es como una partitura escrita para máquinas.</p>
    </section>

    <section class="panel leccion">
      <h2>2 · Las notas son números del 0 al 127</h2>
      <p>Cada tecla tiene un número. El <b>60 es el Do central</b> (C4); sumar 1 sube un semitono y sumar 12, una octava. El 69 es el La de 440 Hz. Toca una tecla:</p>
      <div class="aprende-teclado" id="ap-teclado">${tecladoSVG({ desde: 48, hasta: 72, marcas: notas, titulo: "Teclado con los números MIDI" })}</div>
      <p class="ap-salida" id="ap-tecla">Toca una tecla para ver su número, su nombre y su frecuencia.</p>
      <p class="sub">Fórmula: frecuencia = 440 × 2<sup>(n − 69) / 12</sup>.</p>
    </section>

    <section class="panel leccion">
      <h2>3 · Un mensaje: un byte de estado y uno o dos de datos</h2>
      <p>Un <b>byte</b> son 8 bits (de 0 a 255; en hexadecimal, de <code>00</code> a <code>FF</code>). En MIDI:</p>
      <ul>
        <li>El <b>byte de estado</b> empieza por 1 (vale 128 o más). Sus 4 primeros bits dicen <b>qué</b> es el mensaje y los 4 últimos, <b>en qué canal</b>.</li>
        <li>Los <b>bytes de datos</b> empiezan por 0. Por eso casi todo en MIDI va de <b>0 a 127</b>: solo quedan 7 bits.</li>
      </ul>
      <div class="ap-ejemplo"><code class="b-est">90</code> <code class="b-dat">3C</code> <code class="b-dat">64</code> → <b>Note On</b> en el canal 1, nota 60 (3C en hexadecimal), velocidad 100 (64).</div>
      <table class="tabla-midi">
        <thead><tr><th>Estado</th><th>Mensaje</th><th>Datos</th></tr></thead>
        <tbody>
          <tr><td><code>8n</code></td><td>Note Off: soltar una nota</td><td>nota, velocidad de soltado</td></tr>
          <tr><td><code>9n</code></td><td>Note On: tocar una nota</td><td>nota, velocidad (0 = soltar)</td></tr>
          <tr><td><code>An</code></td><td>Aftertouch polifónico</td><td>nota, presión</td></tr>
          <tr><td><code>Bn</code></td><td>Control Change (CC)</td><td>número de controlador, valor</td></tr>
          <tr><td><code>Cn</code></td><td>Program Change: cambiar de instrumento</td><td>instrumento</td></tr>
          <tr><td><code>Dn</code></td><td>Aftertouch de canal</td><td>presión</td></tr>
          <tr><td><code>En</code></td><td>Pitch Bend: desafinar</td><td>parte baja, parte alta (14 bits)</td></tr>
        </tbody>
      </table>
      <p class="sub"><code>n</code> es el canal menos uno: <code>90</code> es el canal 1, <code>9F</code> el canal 16.</p>
    </section>

    <section class="panel leccion" id="ap-constructor">
      <h2>Constructor de mensajes</h2>
      <p>Arma un mensaje y mira cómo se escribe en bytes. «Enviar» lo toca con el sintetizador (o en tu dispositivo MIDI si elegiste uno como salida) y lo apunta en el monitor.</p>
      <div class="ap-form">
        <label class="campo">Mensaje
          <select id="ap-tipo">
            <option value="144">Note On (9n)</option>
            <option value="128">Note Off (8n)</option>
            <option value="176">Control Change (Bn)</option>
            <option value="192">Program Change (Cn)</option>
            <option value="224">Pitch Bend (En)</option>
          </select>
        </label>
        <label class="campo">Canal <input id="ap-canal" type="number" min="1" max="16" value="1"></label>
        <label class="campo" id="ap-d1-et"><span id="ap-d1-txt">Nota</span> <input id="ap-d1" type="number" min="0" max="127" value="60"></label>
        <label class="campo" id="ap-d2-et"><span id="ap-d2-txt">Velocidad</span> <input id="ap-d2" type="number" min="0" max="127" value="100"></label>
        <button type="button" class="btn-play" id="ap-enviar">Enviar</button>
      </div>
      <div class="ap-bytes" id="ap-bytes"></div>
    </section>

    <section class="panel leccion">
      <h2>4 · Canales: 16 instrumentos por un mismo cable</h2>
      <p>Cada mensaje lleva su canal (1–16), así un solo cable o un solo archivo puede manejar 16 instrumentos a la vez. En <b>General MIDI</b>, el <b>canal 10 es la percusión</b>: ahí cada nota es un instrumento del kit (${[36, 38, 42, 46, 49].map((n) => `${n} = ${PERCUSION[n].toLowerCase()}`).join(", ")}…). Crea una pista de percusión en «Arreglo» y prueba.</p>
    </section>

    <section class="panel leccion">
      <h2>5 · Velocidad: con qué fuerza se toca</h2>
      <p>El tercer byte del Note On es la <b>velocidad</b> (1–127): lo rápido que bajó la tecla. Los sintetizadores la usan para el volumen y, a menudo, para el brillo. En el piano roll las notas más claras son más suaves; en el carril «Velocidad» puedes dibujarla. Un Note On con velocidad 0 equivale a un Note Off.</p>
    </section>

    <section class="panel leccion">
      <h2>6 · Controladores (Control Change)</h2>
      <p><code>Bn cc vv</code>: el controlador número <code>cc</code> pasa a valer <code>vv</code>. Son las ruedas, pedales y perillas. Los más usados, todos dibujables en los carriles de abajo del piano roll:</p>
      <ul>${Object.entries(CONTROLES).map(([n, c]) => `<li><b>CC${n} · ${c.corto}</b>: ${c.texto}</li>`).join("")}</ul>
      <p class="sub">Otros útiles: CC121 reinicia los controladores y CC123 suelta todas las notas (lo que manda este editor al parar con un dispositivo externo).</p>
    </section>

    <section class="panel leccion">
      <h2>7 · Program Change y General MIDI</h2>
      <p><code>Cn pp</code> elige el instrumento <code>pp</code>. El estándar <b>General MIDI</b> (1991) fijó qué instrumento es cada número para que un archivo suene parecido en cualquier aparato: 128 instrumentos en 16 familias de 8. Por ejemplo, 0 = ${INSTRUMENTOS[0]}, 22 = ${INSTRUMENTOS[22]}, 40 = ${INSTRUMENTOS[40]}, 73 = ${INSTRUMENTOS[73]}.</p>
      <p class="sub">En los bytes van de 0 a 127; muchos manuales los cuentan de 1 a 128 (el violín es el «41»).</p>
    </section>

    <section class="panel leccion">
      <h2>8 · Pitch Bend: 14 bits para desafinar</h2>
      <p>La rueda de afinación necesita más precisión que 128 pasos, así que usa dos bytes de datos de 7 bits: <code>En lsb msb</code>, un número de 0 a 16383 donde <b>8192 es el centro</b> (sin desafinar). Con el rango habitual de ±2 semitonos, 16383 sube un tono y 0 lo baja.</p>
    </section>

    <section class="panel leccion">
      <h2>9 · El tiempo en un archivo: ticks, deltas y tempo</h2>
      <p>En un <code>.mid</code> el tiempo no va en segundos sino en <b>ticks</b>. La cabecera dice cuántos ticks tiene una negra (<b>PPQ</b>, aquí ${480}). Cada evento lleva su <b>delta</b>: cuántos ticks esperar desde el anterior.</p>
      <p>El delta se escribe como <b>número de longitud variable</b> (VLQ): 7 bits por byte, y el primer bit en 1 significa «sigue otro byte». Ejemplos: 0 → <code>${bytesHex(vlq(0))}</code>, 127 → <code>${bytesHex(vlq(127))}</code>, 128 → <code>${bytesHex(vlq(128))}</code>, 480 → <code>${bytesHex(vlq(480))}</code>.</p>
      <p>El <b>tempo</b> es un evento «meta» (<code>FF 51 03</code> + 3 bytes) en <b>microsegundos por negra</b>: 500 000 µs = 120 BPM (BPM = 60 000 000 ÷ µs). El compás va en <code>FF 58</code>.</p>
    </section>

    <section class="panel leccion">
      <h2>10 · Dentro de un archivo .mid</h2>
      <ol>
        <li><b>Cabecera «MThd»</b>: formato, número de pistas y PPQ.</li>
        <li><b>Pistas «MTrk»</b>: cada una con su longitud y su lista de eventos (delta + mensaje), terminada en <code>FF 2F 00</code>.</li>
      </ol>
      <p><b>Formato 0</b>: todo en una pista. <b>Formato 1</b>: varias pistas que suenan juntas; la primera suele ser la «del director», con el tempo y el compás. Este editor guarda en formato 1.</p>
      <p><button type="button" class="btn" data-accion="ver-bytes">Ver los bytes de esta canción</button> <button type="button" class="btn" data-pestana-midi="eventos">Ver la lista de eventos</button></p>
    </section>

    <section class="panel leccion">
      <h2>11 · MIDI en vivo</h2>
      <p>Si conectas un teclado o controlador MIDI por USB, el navegador puede leerlo (Web MIDI, en Chrome, Edge y Opera). Pulsa «Conectar MIDI» en la barra del editor: verás llegar los mensajes en el monitor de abajo y podrás grabar en la pista. Algunos aparatos mandan también <code>FE</code> (active sensing, «sigo conectado») o <code>F8</code> (reloj).</p>
      <p>¿Sin teclado MIDI? Activa «Teclado del PC» en la barra: las filas Z-X-C… y Q-W-E… tocan dos octavas.</p>
    </section>

    <section class="panel leccion">
      <h2>Ejercicios</h2>
      <ol>
        <li>Dibuja Do–Mi–Sol (60, 64, 67) en el piano roll y mira la pestaña <b>Eventos</b>: verás tres Note On y tres Note Off.</li>
        <li>Cambia la velocidad de una nota en el carril y busca en qué byte cambió.</li>
        <li>Cambia el instrumento de la pista a Violín y encuentra el <code>C0 28</code> (28 en hexadecimal = 40).</li>
        <li>Dibuja un cambio de tempo en la pestaña <b>Tempo</b> y búscalo en los bytes (<code>FF 51 03</code>).</li>
        <li>Abre una canción de la biblioteca, descárgala como .mid y ábrela en otro programa (MuseScore, GarageBand, LMMS…).</li>
      </ol>
    </section>

    <section class="panel leccion">
      <h2>Monitor MIDI</h2>
      <p class="sub">Aquí aparecen los mensajes que llegan de tu teclado MIDI, del teclado del PC y del constructor.</p>
      <div class="monitor" id="monitor" aria-live="polite"><p class="sub">Todavía no hay mensajes.</p></div>
    </section>
  </div>`;
}

/** Explicación de una tecla del teclado de la lección 2. */
export function textoTecla(m) {
  return `<b>${m}</b> = ${nombreMidi(m)} (${cifraMidi(m)}) · ${frecMidi(m).toFixed(2)} Hz · Note On en el canal 1: <code>${bytesHex([0x90, m, 100])}</code>`;
}

/** Bytes del constructor de mensajes, con el byte de estado partido en tipo y canal. */
export function mensajeConstructor(tipo, canal, d1, d2) {
  const ch = Math.max(1, Math.min(16, canal)) - 1;
  const st = tipo | ch;
  let bytes;
  if (tipo === 0xc0) bytes = [st, d1 & 0x7f];
  else if (tipo === 0xe0) { const v = Math.max(0, Math.min(16383, d1 + 8192)); bytes = [st, v & 0x7f, v >> 7]; }
  else bytes = [st, d1 & 0x7f, d2 & 0x7f];
  return bytes;
}

export function bytesConstructorHTML(bytes) {
  const d = describirMensaje(bytes);
  const est = b(bytes[0]);
  return `
    <div class="ap-fila"><span>Hexadecimal</span><span>${bytes.map((x, i) => `<code class="${i ? "b-dat" : "b-est"}">${x.toString(16).toUpperCase().padStart(2, "0")}</code>`).join(" ")}</span></div>
    <div class="ap-fila"><span>Binario</span><span><code class="b-est"><b>${est.slice(0, 4)}</b>${est.slice(4)}</code> ${bytes.slice(1).map((x) => `<code class="b-dat">${b(x)}</code>`).join(" ")}</span></div>
    <div class="ap-fila"><span>Decimal</span><span>${bytes.join(", ")}</span></div>
    <p class="sub">Primer byte: <b>${est.slice(0, 4)}</b> = tipo (${d.tipo}), <b>${est.slice(4)}</b> = canal ${(bytes[0] & 15) + 1} (se cuenta desde 0 en los bits). Los bytes de datos empiezan siempre por 0.</p>
    <p><b>${d.tipo}</b>${d.canal ? ` · canal ${d.canal}` : ""}: ${d.texto}</p>`;
}

/** Línea del monitor MIDI. */
export function lineaMonitor(bytes, origen) {
  const d = describirMensaje(bytes);
  const hora = new Date().toLocaleTimeString("es", { hour12: false }) + "." + String(new Date().getMilliseconds()).padStart(3, "0");
  return `<div class="mon-linea"><span class="mon-hora">${hora}</span><span class="mon-origen">${origen}</span><code>${bytesHex(bytes)}</code><span><b>${d.tipo}</b>${d.canal ? ` · c${d.canal}` : ""} · ${d.texto}</span></div>`;
}
