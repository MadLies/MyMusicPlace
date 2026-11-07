// De dónde salen las canciones: aviso general y origen de cada tablatura/partitura.
import { cargarIndice } from "../app.js";
import { esc } from "../render.js";

const INSTR = { armonica: "Armónica", piano: "Piano", violin: "Violín" };

export function fuenteHTML(texto) {
  if (!texto) return "—";
  return esc(texto).replace(/(https?:\/\/[^\s)]+)/g, (url) => {
    let dominio = url;
    try { dominio = new URL(url).hostname.replace(/^www\./, ""); } catch { /* deja la URL */ }
    return `<a href="${url}" target="_blank" rel="noopener">${dominio}</a>`;
  });
}

export async function mostrar(main) {
  const { canciones } = await cargarIndice();
  main.innerHTML = `
    <article class="fuentes">
      <h1>De dónde salen las canciones</h1>
      <div class="aviso-fuentes">
        <p>Las tablaturas y partituras de este sitio son <b>recopilaciones de notas tomadas de diferentes lugares</b> — páginas de tablaturas, transcripciones de otros músicos y transcripciones propias — que <b>madlies adaptó</b> para estudiarlas aquí: pasadas a un mismo formato, ordenadas por partes, con los nombres de las notas y comentarios para practicar.</p>
        <p>Las canciones pertenecen a sus autores e intérpretes. Este sitio es un proyecto personal de estudio, sin fines comerciales, y no incluye letras. Si eres autor de alguna de estas transcripciones y prefieres que se retire o que se cite de otra forma, <a href="#" id="enlace-issues">abre un issue en el repositorio</a> y se atenderá.</p>
      </div>
      <div class="tabla-fuentes" role="region" aria-label="Fuentes por canción" tabindex="0">
        <table>
          <thead><tr><th>Canción</th><th>Instrumento</th><th>Artista / detalle</th><th>De dónde sale</th></tr></thead>
          <tbody>
            ${canciones.map((c) => `<tr>
              <td><a href="#/${c.id}">${esc(c.titulo)}</a></td>
              <td>${INSTR[c.instrumento]}</td>
              <td>${esc(c.subtitulo || "—")}</td>
              <td>${fuenteHTML(c.fuente)}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
      <h2>Herramientas usadas</h2>
      <ul>
        <li>Partituras renderizadas con <a href="https://opensheetmusicdisplay.org" target="_blank" rel="noopener">OpenSheetMusicDisplay</a> y editadas en <a href="https://musescore.org" target="_blank" rel="noopener">MuseScore</a>.</li>
        <li>El sonido de las notas se genera en el navegador (Web Audio); no se usan grabaciones de las canciones.</li>
      </ul>
    </article>`;
  const repo = document.getElementById("enlace-repo");
  const issues = main.querySelector("#enlace-issues");
  if (repo && !repo.hidden) issues.href = `${repo.href}/issues`;
  else issues.replaceWith(document.createTextNode("contacta a madlies"));
}
