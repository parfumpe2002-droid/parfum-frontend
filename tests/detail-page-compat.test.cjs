const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname,"..","public_html");
const file = name => fs.readFileSync(path.join(root,name),"utf8");

test("Todas las fichas de decants regeneran el botón de reseñas sin perder SEO", () => {
    require("../scripts/upgrade-decant-pages.cjs");
    const folders = fs.readdirSync(path.join(root,"decants"),{withFileTypes:true}).filter(x=>x.isDirectory());
    assert.ok(folders.length > 50);
    for (const folder of folders) {
        const content = file("decants/"+folder.name+"/index.html");
        assert.match(content,/id="reviewsMore"/,"Botón Ver más faltante en "+folder.name);
        assert.match(content,/id="reviewsList"/);
        assert.match(content,/id="reviewsControls"/);
        assert.match(content,/rel="canonical"/);
        assert.match(content,/js\/detalle\.js/);
    }
});

test("El script protege también las fichas antiguas que quedaron en caché", () => {
    const source = file("js/detalle.js");
    const migration = source.indexOf("    ensureReviewMarkup();");
    const listener = source.indexOf('    document.getElementById("reviewsMore").addEventListener');
    const loader = source.lastIndexOf("    load();");
    assert.ok(migration > 0 && migration < listener && listener < loader);
    assert.match(source,/oldList\.id = "reviewsPanel"/);
    assert.match(source,/while \(oldList\.firstChild\) list\.appendChild/);
});

test("La plantilla principal incluye el botón y no se duplica en el prerender", () => {
    const template = file("detalle.html");
    assert.match(template,/id="reviewsMore"/);
    const perfume = file("decants/hawas-ice/index.html");
    assert.equal((perfume.match(/id="reviewsMore"/g)||[]).length,1);
    assert.equal((template.match(/id="reviewsMore"/g)||[]).length,1);
});
