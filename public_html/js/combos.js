(() => {
    "use strict";
    const $ = id => document.getElementById(id);
    const esc = value => ParfumAPI.escapeHtml(value ?? "");
    const card = combo => {
        const parts = Array.isArray(combo.componentes) ? combo.componentes : [];
        const collage = '<div class="combo-card-collage">'+parts.slice(0,3).map(item =>
            '<img loading="lazy" src="'+esc(item.imagenUrl || "imagen/perfumes/perfume-default.png")+
            '" alt="'+esc(item.nombre)+'"/>').join("")+'</div>';
        const visual = combo.imagenUrl ?
            '<img loading="lazy" src="'+esc(combo.imagenUrl)+'" alt="Combo '+esc(combo.nombre)+'"/>' : collage;
        const included = parts.map(item =>
            '<li><b>'+esc(item.nombre)+'</b> · '+esc(item.presentacion)+' × '+esc(item.cantidad)+'</li>').join("");
        const price = ParfumAPI.money(combo.precio);
        const text = encodeURIComponent("Hola, quiero consultar por el combo "+combo.nombre+
            " de Parfum ("+price+"). ¿Sigue disponible?");
        const contact = '<a class="primary-btn" target="_blank" rel="noopener noreferrer" href="https://wa.me/51963257194?text='+text+'"><i class="fa-brands fa-whatsapp"></i> Consultar combo</a>';
        return '<article class="combo-card"><div class="combo-card-visual">'+visual+'</div>'+
            '<div class="combo-card-content"><h2>'+esc(combo.nombre)+'</h2><p>'+esc(combo.descripcion || "")+'</p>'+
            '<ul>'+included+'</ul><strong>'+esc(price)+'</strong>'+
            (combo.disponible ? contact : '<span class="combo-card-out">Temporalmente agotado</span>')+
            '</div></article>';
    };
    async function load() {
        $("combosStatus").textContent = "Consultando combos disponibles…";
        try {
            const combos = await ParfumAPI.request("/combos", {auth:false});
            if (!Array.isArray(combos)) throw new Error("Respuesta inesperada");
            if (combos.length) {
                $("combosGrid").innerHTML = combos.map(card).join("");
                $("combosPublished").hidden = false;
                document.querySelector(".combo-layout").hidden = true;
                document.querySelector(".combo-detail").hidden = true;
                $("combosStatus").textContent = "";
            } else {
                $("combosStatus").textContent = "";
            }
        } catch (error) {
            $("combosStatus").innerHTML = 'No pudimos actualizar la lista de combos. <button class="secondary-btn" type="button" id="combosRetry">Reintentar</button>';
            $("combosRetry").addEventListener("click",load,{once:true});
        }
    }
    load();
})();
