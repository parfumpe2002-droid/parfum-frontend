"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const js = fs.readFileSync(path.join(root, "public_html/js/detalle.js"), "utf8");

// Ejecuta el mismo solucionador de canónicas que usa el navegador.
const resolver = js.match(/    function canonicalUrlForProduct\(productSlug\) \{[\s\S]*?\n    \}/);
assert.ok(resolver, "Debe existir un solucionador de URL canónica validado");
const canonical = (pathSlug, slug, productSlug) => vm.runInNewContext(
    resolver[0] + "\ncanonicalUrlForProduct(productSlug);",
    {pathSlug, slug, productSlug}
);
const url = slug => "https://parfum.com.pe/decants/" + slug + "/";
assert.equal(canonical("erba-pura", "erba-pura", undefined), url("erba-pura"));
assert.equal(canonical("asad-bourbon", "asad-bourbon", "khamrah"), url("asad-bourbon"),
    "La página estática debe prevalecer sobre cualquier slug devuelto por la API");
assert.equal(canonical("stronger-with-you-intensely", "stronger-with-you-intensely", ""), url("stronger-with-you-intensely"));
assert.equal(canonical(undefined, "khamrah", undefined), url("khamrah"));
assert.equal(canonical(undefined, undefined, "althair"), url("althair"));
assert.equal(canonical(undefined, undefined, undefined), null);
assert.equal(canonical(undefined, undefined, "undefined"), null);
assert.ok(js.includes("if (!pathSlug && canonicalUrl)"),
    "El JavaScript no debe sobrescribir las canónicas HTML de fichas /decants/");
assert.ok(!js.includes('canonical.href = `https://parfum.com.pe/decants/${product.slug}/`'),
    "No interpolar un slug que puede ser undefined");

// Cada ficha estática debe declarar su propia URL, no la de otro perfume.
let count = 0;
const dir = path.join(root, "public_html/decants");
for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (!entry.isDirectory()) continue;
    const file = path.join(dir, entry.name, "index.html");
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, "utf8");
    const match = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i);
    assert.ok(match, "Sin canónica: " + entry.name);
    const expected = url(entry.name);
    // Algunas páginas antiguas se conservan como alias; su canonical puede apuntar a su destino.
    if (match[1] !== expected) {
        assert.ok(match[1].startsWith("https://parfum.com.pe/decants/"),
            "Canónica externa/no válida: " + entry.name);
    }
    assert.ok(!match[1].includes("undefined"), "URL canónica indefinida: " + entry.name);
    count++;
}
assert.ok(count >= 80, "Se esperaban al menos 80 fichas de perfume");
console.log("PASS SEO: " + count + " fichas y canónicas JavaScript validadas");
