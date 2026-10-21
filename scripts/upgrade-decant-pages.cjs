"use strict";
// Mantiene las fichas SEO individuales sincronizadas con detalle.html.
// No altera los metadatos ni el contenido de cada perfume.
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..", "public_html", "decants");
const legacy = '<div class="panel" id="reviewsList"></div>';
const modern = [
  '<div class="panel reviews-panel" id="reviewsPanel">',
  '  <div id="reviewsList" class="reviews-list" aria-live="polite"></div>',
  '  <div class="reviews-controls" id="reviewsControls" hidden>',
  '    <span id="reviewsCounter" class="reviews-counter"></span>',
  '    <button type="button" class="secondary-btn reviews-more-btn" id="reviewsMore" aria-controls="reviewsList" aria-expanded="false">',
  '      <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>',
  '      <span id="reviewsMoreLabel">Ver más reseñas</span>',
  '    </button>',
  '  </div>',
  '</div>'
].join("\n");
let updated = 0, validated = 0;
if (!fs.existsSync(root)) throw new Error("Falta el directorio de fichas de perfumes");
for (const folder of fs.readdirSync(root, {withFileTypes:true})) {
  if (!folder.isDirectory()) continue;
  const file = path.join(root, folder.name, "index.html");
  if (!fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, "utf8");
  if (html.includes(legacy)) {
    fs.writeFileSync(file, html.replace(legacy, modern));
    updated++;
    validated++;
  } else if (html.includes('id="reviewsMore"') && html.includes('id="reviewsList"')) {
    validated++;
  } else {
    throw new Error("La ficha " + folder.name + " no tiene un bloque de reseñas compatible.");
  }
}
if (validated === 0) throw new Error("No se encontraron fichas individuales de perfumes");
console.log("Parfum: " + validated + " fichas SEO verificadas; " + updated + " actualizadas en build.");
