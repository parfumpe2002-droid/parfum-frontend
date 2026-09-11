(() => {
    "use strict";
    const grid = document.getElementById("offersGrid");
    const status = document.getElementById("offersStatus");
    let products = [];
    let favoriteKeys = new Set();

    const keysFor = product => [product?.id, product?.productoId, product?.sku, product?.slug]
        .filter(value => value !== undefined && value !== null).map(String);
    const isFavorite = product => keysFor(product).some(key => favoriteKeys.has(key));

    function card(product) {
        const favorite = isFavorite(product);
        const presentations = ParfumAPI.activePresentations(product);
        const purchasable = ParfumAPI.canBuy(product);
        const key = ParfumAPI.productKey(product);
        const sizes = presentations.length ? `<div class="card-sizes">${presentations.slice(0, 4).map(item => `<span>${ParfumAPI.escapeHtml(item.etiqueta || `${item.mililitros} ml`)}</span>`).join("")}</div>` : "";
        return `
            <article class="catalog-card" data-key="${ParfumAPI.escapeHtml(key)}">
                <button class="card-fav ${favorite ? "active" : ""}" data-action="fav" aria-label="Favorito"><i class="${favorite ? "fa-solid" : "fa-regular"} fa-heart"></i></button>
                <a href="${ParfumAPI.productUrl(product)}">
                    <div class="image"><img src="${ParfumAPI.escapeHtml(ParfumAPI.image(product))}" data-fallback="${ParfumAPI.escapeHtml(product.fallbackImage || "imagen/perfumes/perfume-default.png")}" alt="${ParfumAPI.escapeHtml(product.nombre)}"></div>
                    <div class="info"><h3>${ParfumAPI.escapeHtml(product.nombre)}</h3><div class="brand">${ParfumAPI.escapeHtml(product.marca)}</div><span class="tag">Destacado</span>${product.concentracion ? `<small class="muted">${ParfumAPI.escapeHtml(product.concentracion)}</small>` : ""}${sizes}<strong>${ParfumAPI.escapeHtml(ParfumAPI.priceLabel(product))}</strong></div>
                </a>
                <div class="card-actions card-actions-stacked"><button class="primary-btn" data-action="${presentations.length ? "choose" : "cart"}" ${presentations.length || purchasable ? "" : "disabled"}>${presentations.length ? "Elegir tamaño" : (purchasable ? "Agregar" : "Próximamente")}</button><a class="secondary-btn decant-card-button" href="${ParfumAPI.productUrl(product, {decant:true})}"><i class="fa-solid fa-vial"></i> Pedir en decant</a></div>
            </article>`;
    }

    function render(list) {
        products = list;
        grid.innerHTML = list.length ? list.map(card).join("") : `<div class="empty-state"><i class="fa-solid fa-tags"></i><h3>No hay ofertas activas</h3><p>Cuando el administrador marque productos como destacados aparecerán aquí.</p></div>`;
        grid.querySelectorAll("img[data-fallback]").forEach(image => image.addEventListener("error", () => image.src = image.dataset.fallback || "imagen/perfumes/perfume-default.png", {once:true}));
    }

    async function start() {
        const fallback = PARFUM_FALLBACK_PRODUCTS.filter(product => product.destacado).slice(0, 12);
        render(fallback.length ? fallback : PARFUM_FALLBACK_PRODUCTS.slice(0, 8));
        try { favoriteKeys = new Set((await ParfumStore.favorites()).flatMap(keysFor)); render(products); } catch {}
        try {
            const data = await ParfumAPI.request("/productos/destacados", {auth:false});
            const list = ParfumAPI.normalizeList(data);
            if (list.length) render(list);
            status.textContent = list.length ? "Ofertas actualizadas" : "No hay ofertas activas. Mostrando productos destacados locales.";
        } catch {
            status.textContent = "Servidor iniciando. Mostrando la selección local mientras tanto.";
        }
    }

    grid.addEventListener("click", async event => {
        const action = event.target.closest("[data-action]");
        if (!action) return;
        event.preventDefault();
        const cardElement = action.closest(".catalog-card");
        const product = products.find(item => keysFor(item).includes(cardElement.dataset.key)) || ParfumAPI.fallbackById(cardElement.dataset.key);
        if (!product) return;
        try {
            if (action.dataset.action === "choose") {
                location.href = ParfumAPI.productUrl(product);
            } else if (action.dataset.action === "cart") {
                await ParfumStore.addCart(product, 1);
                ParfumAPI.toast("Perfume agregado al carrito");
            } else {
                const active = await ParfumStore.toggleFavorite(product);
                action.classList.toggle("active", active);
                action.innerHTML = `<i class="${active ? "fa-solid" : "fa-regular"} fa-heart"></i>`;
            }
        } catch (error) { ParfumAPI.toast(error.message, "error"); }
    });

    start();
})();
