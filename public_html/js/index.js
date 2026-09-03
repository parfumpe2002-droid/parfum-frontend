(() => {
    "use strict";
    const $ = (selector, parent = document) => parent.querySelector(selector);
    const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

    const grid = $("#productGrid");
    const status = $("#catalogStatus");
    const cacheKey = "parfum_catalog_home_v9";
    let products = [...PARFUM_FALLBACK_PRODUCTS];
    let favoriteKeys = new Set();
    let catalogPollAttempt = 0;
    let catalogPollTimer = null;

    function keysFor(product) {
        return [product?.id, product?.productoId, product?.sku, product?.slug]
            .filter(value => value !== undefined && value !== null)
            .map(String);
    }

    function isFavorite(product) {
        return keysFor(product).some(key => favoriteKeys.has(key));
    }

    function setStatus(text, type = "loading") {
        if (!status) return;
        status.classList.remove("ready", "warning");
        if (type !== "loading") status.classList.add(type);
        status.innerHTML = `<span class="status-spinner"></span><span>${ParfumAPI.escapeHtml(text)}</span>`;
    }

    function card(product) {
        const active = isFavorite(product);
        const presentations = ParfumAPI.activeDecants(product);
        const purchasable = ParfumAPI.canBuy(product, ParfumAPI.defaultDecant(product), "DECANT");
        const key = ParfumAPI.productKey(product);
        const sizes = presentations.length ? `<div class="home-card-sizes">${presentations.slice(0, 3).map(item => `<span>${ParfumAPI.escapeHtml(item.etiqueta || `${item.mililitros} ml`)}</span>`).join("")}${presentations.length > 3 ? `<span>+${presentations.length - 3}</span>` : ""}</div>` : "";
        const fallback = product.fallbackImage || "imagen/perfumes/perfume-default.png";
        return `
            <article class="product-card" data-key="${ParfumAPI.escapeHtml(key)}"
                     data-search="${ParfumAPI.escapeHtml(`${product.nombre} ${product.marca} ${product.categoria} ${product.concentracion || ""}`.toLowerCase())}">
                <button class="favorite-button ${active ? "active" : ""}" data-action="favorite" aria-label="Favorito">
                    <i class="${active ? "fa-solid" : "fa-regular"} fa-heart"></i>
                </button>
                <a href="${ParfumAPI.productUrl(product)}" class="product-link">
                    <div class="product-image">
                        <img src="${ParfumAPI.escapeHtml(ParfumAPI.image(product))}"
                             alt="${ParfumAPI.escapeHtml(product.nombre)}"
                             loading="lazy"
                             data-fallback="${ParfumAPI.escapeHtml(fallback)}">
                    </div>
                    <div class="product-info">
                        <h3>${ParfumAPI.escapeHtml(product.nombre)}</h3>
                        <p>${ParfumAPI.escapeHtml(product.marca)}</p>
                        <span class="product-tag">${ParfumAPI.escapeHtml(product.categoria)}</span>
                        ${sizes}
                        <strong>${ParfumAPI.escapeHtml(ParfumAPI.decantPriceLabel(product))}</strong>
                    </div>
                </a>
                <div class="home-card-actions">
                    <button class="add-button" data-action="${presentations.length ? "choose" : "cart"}" ${presentations.length || purchasable ? "" : "disabled"}>
                        ${presentations.length ? "Elegir decant" : (purchasable ? "Agregar" : "Próximamente")}
                    </button>
                    <a class="home-decant-button" target="_blank" rel="noopener noreferrer" href="https://wa.me/51963257194?text=${encodeURIComponent(`Hola, quiero consultar por el frasco completo de ${product.nombre} de ${product.marca}.`)}"><i class="fa-brands fa-whatsapp"></i> Frasco completo</a>
                </div>
            </article>`;
    }

    function render(list) {
        products = list.slice(0, 15);
        grid.innerHTML = products.map(card).join("");
        $$("img[data-fallback]", grid).forEach(image => image.addEventListener("error", () => {
            image.src = image.dataset.fallback || "imagen/perfumes/perfume-default.png";
        }, {once:true}));
    }

    async function loadFavorites() {
        try {
            favoriteKeys = new Set((await ParfumStore.favorites()).flatMap(keysFor));
        } catch {
            favoriteKeys = new Set();
        }
    }

    function readCache() {
        try {
            const value = JSON.parse(localStorage.getItem(cacheKey) || "null");
            const maxAge = Number(PARFUM_CONFIG.CATALOG_CACHE_HOURS || 12) * 3600000;
            return value?.products?.length && Date.now() - Number(value.savedAt || 0) < maxAge ? value : null;
        } catch {
            return null;
        }
    }

    async function updateCatalog({background = false} = {}) {
        if (!background) {
            render(PARFUM_FALLBACK_PRODUCTS);
            await loadFavorites();
            render(products);

            const cached = readCache();
            if (cached?.products?.length) {
                render(cached.products);
                setStatus("Mostrando catálogo guardado mientras comprobamos novedades…");
            } else {
                setStatus("Actualizando catálogo…");
            }
        }

        try {
            const data = await ParfumAPI.request("/productos?size=15&sort=destacado,desc", {auth:false});
            const list = ParfumAPI.normalizeList(data);
            const totalElements = Number(data?.totalElements ?? list.length ?? 0);
            if (!list.length) throw new Error("Catálogo vacío");
            render(list);
            localStorage.setItem(cacheKey, JSON.stringify({savedAt:Date.now(), products:list}));
            const expected = Number(PARFUM_CONFIG.CATALOG_EXPECTED_COUNT || 86);
            setStatus(totalElements < expected
                ? `Render está terminando de cargar el catálogo (${totalElements}/${expected})…`
                : "Catálogo actualizado", totalElements < expected ? "loading" : "ready");
            return {ok:true, totalElements};
        } catch (error) {
            if (!background) {
                const cached = readCache();
                setStatus(
                    cached?.products?.length
                        ? "No se pudo actualizar todavía. Reintentando mientras Render inicia…"
                        : "Servidor iniciando. Mostrando la selección local de respaldo.",
                    "warning"
                );
            }
            return {ok:false, totalElements:0, error};
        }
    }

    async function pollCatalog() {
        clearTimeout(catalogPollTimer);
        const result = await updateCatalog({background: catalogPollAttempt > 0});
        const expected = Number(PARFUM_CONFIG.CATALOG_EXPECTED_COUNT || 86);
        if ((result.ok && result.totalElements >= expected)
                || catalogPollAttempt >= Number(PARFUM_CONFIG.CATALOG_RETRY_ATTEMPTS || 14)) return;
        catalogPollAttempt += 1;
        catalogPollTimer = setTimeout(pollCatalog, Number(PARFUM_CONFIG.CATALOG_RETRY_MS || 15000));
    }

    grid?.addEventListener("click", async event => {
        const action = event.target.closest("[data-action]");
        if (!action) return;
        event.preventDefault();
        const cardElement = action.closest(".product-card");
        const product = products.find(item => keysFor(item).includes(cardElement.dataset.key))
            || ParfumAPI.fallbackById(cardElement.dataset.key);
        if (!product) return;

        try {
            if (action.dataset.action === "choose") {
                location.href = ParfumAPI.productUrl(product);
            } else if (action.dataset.action === "cart") {
                await ParfumStore.addCart(product, 1, ParfumAPI.defaultDecant(product), "DECANT");
                const previous = action.textContent;
                action.textContent = "Agregado ✓";
                setTimeout(() => action.textContent = previous, 1100);
                ParfumAPI.toast("Agregado al carrito");
            } else {
                const active = await ParfumStore.toggleFavorite(product, ParfumAPI.defaultDecant(product), "DECANT");
                action.classList.toggle("active", active);
                action.innerHTML = `<i class="${active ? "fa-solid" : "fa-regular"} fa-heart"></i>`;
            }
        } catch (error) {
            ParfumAPI.toast(error.message, "error");
        }
    });

    ParfumStore.updateBadges();
    pollCatalog();
})();
