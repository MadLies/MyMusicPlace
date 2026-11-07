// Guía didáctica: leer tablaturas, mapa de notas, posiciones y técnica.
import { crearArmonica } from "../armonica.js";
import { chipHTML, leyendaHTML } from "../render.js";
import { TONOS_ARMONICA, notasArmonica, nombreNota, octava, posiciones, frecuencia } from "../notas.js";
import { tocarNota } from "../audio.js";
import { pref, setPref } from "../progreso.js";

export async function mostrar(main) {
  let tono = pref("tonoGuia", "C");

  main.innerHTML = `
    <article class="guia">
      <h1>Guía de armónica</h1>
      <p class="sub">Lo básico para leer las tablaturas de este atril y sacarle provecho a la armónica diatónica de 10 hoyos.</p>
      <nav class="indice-guia" aria-label="En esta guía">
        <a href="#leer">Leer la tablatura</a><a href="#mapa">Mapa de notas</a><a href="#posiciones">Posiciones</a><a href="#tecnica">Técnica</a><a href="#formato">Escribir tablaturas</a>
      </nav>

      <section id="leer">
        <h2>1. Cómo se lee una tablatura</h2>
        <p>Cada número es un <b>hoyo</b> de la armónica, contando de izquierda (grave) a derecha (agudo). Sin signo se <b>sopla</b>; con un menos delante se <b>aspira</b>. Los colores te ayudan a verlo de un vistazo: azul soplar, rojo aspirar.</p>
        ${leyendaHTML(tono)}
        <ul>
          <li><b>Notas unidas</b> por una línea debajo (<code>-2-2</code>, <code>44</code>, <code>456</code>) van rápidas: se reparten un pulso.</li>
          <li><b>Bend</b> (<code>-4'</code>, borde punteado): aspiras el hoyo y bajas el tono medio paso cambiando la forma de la boca. Algunas tablaturas lo escriben <code>4b</code> o <code>-4/</code>.</li>
          <li>La <b>nota pequeña</b> debajo de cada número es lo que suena. Cambia según el tono de tu armónica, los números no.</li>
          <li>Muchas tablaturas de internet usan <code>(4)</code> para aspirar y <code>4</code> o <code>+4</code> para soplar. El <a href="#/editor">editor</a> las convierte solo.</li>
        </ul>
      </section>

      <section id="mapa">
        <h2>2. Mapa de notas de tu armónica</h2>
        <label class="en-linea">Armónica en
          <select data-accion="tono">${TONOS_ARMONICA.map((t) => `<option ${t === tono ? "selected" : ""}>${t}</option>`).join("")}</select>
        </label>
        <p>Toca cualquier casilla para oír la nota. Las comillas (ʼ) indican cuántos bends permite ese hoyo.</p>
        <div class="armonica-cont grande"></div>
        <h3>Todas las notas, con bends</h3>
        <div class="tabla-notas" id="tabla-notas"></div>
        <p class="nota-texto">Fíjate: el 2 aspirado y el 3 soplado dan la misma nota. Y entre los hoyos 1 a 3 faltan notas de la escala que solo salen con bends; por eso esa zona es la del blues.</p>
      </section>

      <section id="posiciones">
        <h2>3. Posiciones: una armónica, varias tonalidades</h2>
        <p>Con la misma armónica puedes tocar en distintas tonalidades según la nota que uses como base. A eso se le llama <b>posición</b>.</p>
        <div class="posiciones" id="posiciones-lista"></div>
      </section>

      <section id="tecnica">
        <h2>4. Técnica en cinco minutos</h2>
        <ol class="pasos">
          <li><b>Una sola nota.</b> Frunce los labios como para silbar, o tapa con la lengua los hoyos de la izquierda. Empieza en el hoyo 4: sopla y aspira hasta que suene limpio, sin vecinos.</li>
          <li><b>Respira por la armónica.</b> Al tocar soplas y aspiras, así que no te quedas sin aire: respira con calma, desde el abdomen, sin forzar.</li>
          <li><b>Aire suave.</b> Más fuerza no da más volumen, da notas desafinadas (sobre todo en los hoyos 2 y 3 aspirados).</li>
          <li><b>Notas repetidas.</b> Para repetir la misma nota (<code>8 8 8 8</code>) articula con la lengua, como diciendo «ta-ta-ta», sin cortar el aire.</li>
          <li><b>Bends.</b> Aspira el hoyo 4 y, sin moverte, lleva el aire hacia la garganta como diciendo «iii → uuu». La nota baja. En el <a href="#/afinador">afinador</a> puedes ver si llegas al tono exacto.</li>
        </ol>
      </section>

      <section id="formato">
        <h2>5. Escribir tus propias tablaturas</h2>
        <p>Cada tablatura es un archivo de texto <code>.tab</code> dentro de <code>Armonica/&lt;Canción&gt;/02_editable/</code>. Al subirlo al repositorio aparece solo en la biblioteca.</p>
        <pre class="codigo">titulo: Nombre de la canción
subtitulo: Artista
armonica: C
tonalidad: La menor (Am)

&gt; Un comentario que se ve en la página.

[Parte A | se toca 2 veces]
8 -77 -8 7-7 | -6 -67 8 -87
-7 7 -8 8 | 7 -6 -6 _</pre>
        <p><code>|</code> separa compases, <code>_</code> es una pausa, <code>#</code> al principio de una línea es un comentario que no se muestra. Prueba en el <a href="#/editor">editor</a>: ves el resultado mientras escribes.</p>
      </section>
    </article>`;

  const armonica = crearArmonica(main.querySelector(".armonica-cont"), { tono });
  const pintarTabla = () => {
    const notas = notasArmonica(tono).sort((a, b) => a.midi - b.midi || a.hoyo - b.hoyo);
    main.querySelector("#tabla-notas").innerHTML = notas
      .map((n) => `<div class="celda-nota" data-midi="${n.midi}">${chipHTML(n, tono)}<span>${nombreNota(n.midi)}<sub>${octava(n.midi)}</sub></span></div>`)
      .join("");
    main.querySelector("#posiciones-lista").innerHTML = posiciones(tono)
      .map((p) => `<div class="posicion"><h3>${p.nombre}</h3><p class="tonalidad">${p.tonalidad}</p><p>${p.uso}</p><p class="sub">Nota base: ${p.base}</p></div>`)
      .join("");
  };
  pintarTabla();

  main.querySelector('[data-accion="tono"]').addEventListener("change", (e) => {
    tono = e.target.value;
    setPref("tonoGuia", tono);
    armonica.setTono(tono);
    pintarTabla();
    main.querySelector(".leyenda").outerHTML = leyendaHTML(tono);
  });
  main.querySelector("#tabla-notas").addEventListener("click", (e) => {
    const celda = e.target.closest(".celda-nota");
    if (!celda) return;
    tocarNota(frecuencia(Number(celda.dataset.midi)), 0.6);
  });
  main.querySelector(".indice-guia").addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (!a) return;
    e.preventDefault();
    main.querySelector(a.getAttribute("href"))?.scrollIntoView({ behavior: "smooth" });
  });
}
