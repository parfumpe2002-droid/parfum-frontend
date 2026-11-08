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
const canonicalUrls = new Set();
const site = "https://parfum.com.pe";
if (!fs.existsSync(root)) throw new Error("Falta el directorio de fichas de perfumes");
for (const folder of fs.readdirSync(root, {withFileTypes:true})) {
  if (!folder.isDirectory()) continue;
  const file = path.join(root, folder.name, "index.html");
  if (!fs.existsSync(file)) continue;
  const original = fs.readFileSync(file, "utf8");
  let html = original;
  if (html.includes(legacy)) {
    html = html.replace(legacy, modern);
  } else if (!html.includes('id="reviewsMore"') || !html.includes('id="reviewsList"')) {
    throw new Error("La ficha " + folder.name + " no tiene un bloque de reseñas compatible.");
  }

  // Título y descripción visibles incluso si la API tarda en responder.
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1];
  const description = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)?.[1];
  const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1];
  if (!title || !description || !canonical) {
    throw new Error("Metadatos SEO incompletos en: " + folder.name);
  }
  if (!html.includes('class="seo-product-intro"')) {
    const target = '<section class="detail-grid" id="detailGrid"></section>';
    if (!html.includes(target)) {
      throw new Error("No se encontró la sección de detalle: " + folder.name);
    }
    html = html.replace(target,
      '<section class="detail-grid" id="detailGrid">' +
      '<div class="panel seo-product-intro"><h1 class="page-title">' + title + '</h1>' +
      '<p>' + description + '</p></div></section>');
  }

  const expected = site + "/decants/" + folder.name + "/";
  // Las páginas antiguas con canonical hacia otro slug no se anuncian a Google.
  if (canonical === expected) canonicalUrls.add(expected);
  if (html !== original) {
    fs.writeFileSync(file, html);
    updated++;
  }
  validated++;
}
if (validated === 0) throw new Error("No se encontraron fichas individuales de perfumes");
console.log("Parfum: " + validated + " fichas SEO verificadas; " + updated + " actualizadas en build.");

const staticPages = [
  ["index.html", "/"],
  ["productos.html", "/productos.html"],
  ["contacto.html", "/contacto.html"],
  ["combos.html", "/combos.html"],
  ["libro-reclamaciones.html", "/libro-reclamaciones.html"]
];
const urls = staticPages
  .filter(([name]) => fs.existsSync(path.join(__dirname, "..", "public_html", name)))
  .map(([, url]) => site + url);
urls.push(...[...canonicalUrls].sort());
const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map(url => "  <url><loc>" + url.replace(/&/g, "&amp;") + "</loc></url>").join("\n") +
  '\n</urlset>\n';
fs.writeFileSync(path.join(__dirname, "..", "public_html", "sitemap.xml"), xml);
console.log("Parfum: sitemap.xml generado con " + urls.length + " URLs canónicas.");
