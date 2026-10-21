const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..", "public_html");
const read = p => fs.readFileSync(path.join(root,p),"utf8");

test("No se imprime el teléfono personal en texto del sitio y se conserva el QR de pago", () => {
    for (const page of ["contacto.html","privacidad.html","libro-reclamaciones.html","index.html"]) {
        assert.doesNotMatch(read(page), /\+51\s*963\s*257\s*194|963\s+257\s+194/);
    }
    const cart = read("js/carrito.js");
    assert.doesNotMatch(cart, /Número Yape<\/dt>|data-copy="963257194"|<span>963\s*257\s*194<\/span>/);
    assert.match(cart, /class="payment-qr"/);
    assert.match(cart, /payment-whatsapp-link/);
    assert.match(read("contacto.html"), /Abrir WhatsApp/);
});

test("Las reseñas tienen contenedor, botón y límite de altura", () => {
    const html = read("detalle.html");
    const styles = read("css/app.css");
    assert.match(html, /id="reviewsList"/);
    assert.match(html, /id="reviewsMore"/);
    assert.match(html, /aria-expanded="false"/);
    assert.match(styles, /\.reviews-list\.expanded\{max-height:/);
    assert.match(styles, /overflow-y:auto/);
});

function setupReviewHarness() {
    const source = read("js/detalle.js");
    const start = source.indexOf("    function resetReviewForm()");
    const stop = source.indexOf("    async function loadReviews()", start);
    assert.ok(start >= 0 && stop > start);
    const elements = {};
    const classes = new Set();
    const names = ["reviewsList","reviewsControls","reviewsMore","reviewsMoreLabel",
                   "reviewsCounter","rating","reviewComment"];
    names.forEach(id => {
        elements[id] = {
            innerHTML:"",value:"",hidden:false,textContent:"",tabIndex:0,scrollTop:2,
            attributes:{},
            classList:{
                toggle(name,active) {
                    if (active) classes.add(name);
                    else classes.delete(name);
                }
            },
            setAttribute(k,v) {this.attributes[k] = v},
            querySelector() {return {classList:{toggle(){}}}},
            addEventListener(event,fn) {this[event] = fn}
        };
    });
    const reviewSubmit = {textContent:"Publicar reseña"};
    const reviewCancel = {hidden:true};
    const context = {
        document:{getElementById:id => elements[id]},
        ParfumAPI:{getUser:()=>({id:100,rol:"USER"})},
        esc:value=>String(value??""),
        reviewSubmit,reviewCancel,
        console
    };
    vm.createContext(context);
    vm.runInContext("let reviewsCache=[]; let reviewsExpanded=false; const REVIEWS_PREVIEW_COUNT=4;\n"+
        source.slice(start,stop),context);
    const reviews = n => Array.from({length:n},(_,i)=>({
        id:i+1,usuarioId: i===0 ? 100 : 200+i,
        nombreUsuario:"Persona "+(i+1),puntuacion:5,comentario:"Mensaje "+(i+1)
    }));
    return {elements,classes,reviewSubmit,reviewCancel,render:r=>context.renderReviews(r),reviews};
}

test("Con 9 reseñas se ven 4, después 9 con scroll, y se pueden volver a ocultar", () => {
    const h=setupReviewHarness();
    h.render(h.reviews(9));
    assert.match(h.elements.reviewsList.innerHTML,/Persona 4/);
    assert.doesNotMatch(h.elements.reviewsList.innerHTML,/Persona 5/);
    assert.match(h.elements.reviewsMoreLabel.textContent,/5/);
    assert.equal(h.elements.reviewsMore.attributes["aria-expanded"],"false");
    assert.equal(h.elements.reviewsControls.hidden,false);
    h.elements.reviewsMore.click();
    assert.match(h.elements.reviewsList.innerHTML,/Persona 9/);
    assert.equal(h.elements.reviewsMore.attributes["aria-expanded"],"true");
    assert.ok(h.classes.has("expanded"));
    assert.equal(h.elements.reviewsList.scrollTop,0);
    h.elements.reviewsMore.click();
    assert.doesNotMatch(h.elements.reviewsList.innerHTML,/Persona 5/);
    assert.ok(!h.classes.has("expanded"));
});

test("Con hasta 4 reseñas no se muestra Ver más", () => {
    const h=setupReviewHarness();
    h.render(h.reviews(4));
    assert.equal(h.elements.reviewsControls.hidden,true);
    assert.match(h.elements.reviewsList.innerHTML,/Persona 4/);
    h.render(h.reviews(0));
    assert.equal(h.elements.reviewsControls.hidden,true);
    assert.match(h.elements.reviewsList.innerHTML,/Aún no hay reseñas/);
});

test("Ver más nunca borra una reseña en edición antes de enviarla", () => {
    const h=setupReviewHarness();
    h.render(h.reviews(7));
    h.elements.reviewComment.value="Comentario todavía sin enviar";
    h.elements.rating.value="4";
    h.elements.reviewsMore.click();
    assert.equal(h.elements.reviewComment.value,"Comentario todavía sin enviar");
    assert.equal(h.elements.rating.value,"4");
    assert.equal(h.reviewSubmit.textContent,"Actualizar reseña");
    assert.equal(h.reviewCancel.hidden,false);
});
