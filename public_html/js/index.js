(() => {
    "use strict";
    const $ = (selector, parent = document) => parent.querySelector(selector);
    const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

    const grid = $("#productGrid");
    const status = $("#catalogStatus");
    let products = [];
    let favoriteKeys = new Set();
    let catalogPollAttempt = 0;
    let catalogPollTimer = null;

    async function hydrateHeroProducts() {
        const nodes = [...document.querySelectorAll("[data-hero-product]")];
        const slugs = [...new Set(nodes.map(node => node.dataset.heroProduct).filter(Boolean))];
        const loaded = new Map();
        await Promise.allSettled(slugs.map(async slug => {
            const item = await ParfumAPI.request(`/productos/slug/${encodeURIComponent(slug)}`, {auth:false, timeout:20000});
            loaded.set(slug, item);
        }));
        nodes.forEach(node => {
            const item = loaded.get(node.dataset.heroProduct);
            if (!item) return;
            const image = node.querySelector("img");
            if (image) {
                image.src = ParfumAPI.image(item);
                image.alt = item.nombre || "Perfume Parfum";
                image.addEventListener("error", () => {
                    image.src = item.fallbackImage || "imagen/perfumes/perfume-default.png";
                }, {once:true});
            }
            const caption = node.querySelector("figcaption");
            if (caption) caption.textContent = item.nombre || caption.textContent;
        });
    }

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
        status.innerHTML = `${type === "loading" ? '<span class="status-spinner"></span>' : ""}<span>${ParfumAPI.escapeHtml(text)}</span>${type === "warning" ? ' <button type="button" class="secondary-btn" data-retry-catalog>Reintentar</button>' : ""}`;
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
        grid.innerHTML = products.length ? products.map(card).join("") : '<div class="empty-state"><i class="fa-solid fa-spray-can-sparkles"></i><h3>Catálogo no disponible por el momento</h3><p>Estamos verificando los perfumes disponibles. Por favor, vuelve a intentar en unos instantes.</p></div>';
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

    async function updateCatalog() {
        setStatus("Consultando perfumes disponibles…");
        try {
            const data = await ParfumAPI.request("/productos?size=15&sort=destacado,desc", {auth:false});
            const list = ParfumAPI.normalizeList(data);
            const total = Number(data?.totalElements ?? list.length);
            if (!Array.isArray(list)) throw new Error("Respuesta de catálogo inválida");
            render(list);
            // Las imágenes promocionales no deben sustituir el inventario real.
            if (list.length) hydrateHeroProducts().catch(() => {});
            setStatus(total
                ? `Mostrando ${Math.min(list.length,15)} de ${total} perfumes del catálogo`
                : "Todavía no hay perfumes publicados.", "ready");
            catalogPollAttempt = 0;
            return true;
        } catch (error) {
            products = [];
            render([]);
            setStatus("No se pudo consultar el catálogo. Intenta nuevamente para ver los productos reales.", "warning");
            return false;
        }
    }

    async function pollCatalog() {
        clearTimeout(catalogPollTimer);
        const loaded = await updateCatalog();
        if (loaded || catalogPollAttempt >= Number(PARFUM_CONFIG.CATALOG_RETRY_ATTEMPTS || 3)) return;
        catalogPollAttempt++;
        catalogPollTimer = setTimeout(pollCatalog, Number(PARFUM_CONFIG.CATALOG_RETRY_MS || 15000));
    }

    document.addEventListener("click", event => {
        if (!event.target.closest("[data-retry-catalog]")) return;
        catalogPollAttempt = 0;
        pollCatalog();
    });

    grid?.addEventListener("click", async event => {
        const action = event.target.closest("[data-action]");
        if (!action) return;
        event.preventDefault();
        const cardElement = action.closest(".product-card");
        const product = products.find(item => keysFor(item).includes(cardElement.dataset.key));
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
