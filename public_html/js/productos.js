(() => {
    "use strict";
    const grid = document.getElementById("catalogGrid");
    const status = document.getElementById("catalogStatus");
    const pagination = document.getElementById("pagination");
    const q = document.getElementById("q");
    const category = document.getElementById("category");
    const sort = document.getElementById("sort");
    const params = new URLSearchParams(location.search);

    category.value = params.get("categoria") || "";
    q.value = params.get("q") || "";

    let currentProducts = [...PARFUM_FALLBACK_PRODUCTS];
    let currentPage = 0;
    let totalPages = 1;
    let favoriteKeys = new Set();
    let catalogPollAttempt = 0;
    let catalogPollTimer = null;
    const cacheKey = "parfum_catalog_cache_v9";

    function keysFor(product) {
        return [product?.id, product?.productoId, product?.sku, product?.slug]
            .filter(value => value !== undefined && value !== null)
            .map(String);
    }

    function isFavorite(product) {
        return keysFor(product).some(key => favoriteKeys.has(key));
    }

    function productCard(product) {
        const favorite = isFavorite(product);
        const presentations = ParfumAPI.activeDecants(product);
        const purchasable = ParfumAPI.canBuy(product, ParfumAPI.defaultDecant(product), "DECANT");
        const key = ParfumAPI.productKey(product);
        const sizes = presentations.length ? `<div class="card-sizes">${presentations.slice(0, 4).map(item => `<span>${ParfumAPI.escapeHtml(item.etiqueta || `${item.mililitros} ml`)}</span>`).join("")}${presentations.length > 4 ? `<span>+${presentations.length - 4}</span>` : ""}</div>` : "";
        return `
            <article class="catalog-card" data-key="${ParfumAPI.escapeHtml(key)}">
                <button class="card-fav ${favorite ? "active" : ""}" data-action="fav" aria-label="Favorito">
                    <i class="${favorite ? "fa-solid" : "fa-regular"} fa-heart"></i>
                </button>
                <a href="${ParfumAPI.productUrl(product)}">
                    <div class="image">
                        <img src="${ParfumAPI.escapeHtml(ParfumAPI.image(product))}"
                             data-fallback="${ParfumAPI.escapeHtml(product.fallbackImage || "imagen/perfumes/perfume-default.png")}"
                             alt="${ParfumAPI.escapeHtml(product.nombre)}">
                    </div>
                    <div class="info">
                        <h3>${ParfumAPI.escapeHtml(product.nombre)}</h3>
                        <div class="brand">${ParfumAPI.escapeHtml(product.marca)}</div>
                        <span class="tag">${ParfumAPI.escapeHtml(product.categoria)}</span>
                        ${product.concentracion ? `<small class="muted">${ParfumAPI.escapeHtml(product.concentracion)}</small>` : ""}
                        ${sizes}
                        <strong>${ParfumAPI.escapeHtml(ParfumAPI.decantPriceLabel(product))}</strong>
                    </div>
                </a>
                <div class="card-actions card-actions-stacked">
                    <button class="primary-btn" data-action="${presentations.length ? "choose" : "cart"}" ${presentations.length || purchasable ? "" : "disabled"}>
                        ${presentations.length ? "Elegir decant" : (purchasable ? "Agregar" : "Próximamente")}
                    </button>
                    <a class="secondary-btn decant-card-button" target="_blank" rel="noopener noreferrer" href="https://wa.me/51963257194?text=${encodeURIComponent(`Hola, quiero consultar por el frasco completo de ${product.nombre} de ${product.marca}.`)}" aria-label="Consultar frasco completo de ${ParfumAPI.escapeHtml(product.nombre)}">
                        <i class="fa-brands fa-whatsapp"></i> Frasco completo
                    </a>
                </div>
            </article>`;
    }

    function render(list) {
        currentProducts = list;
        grid.innerHTML = list.length
            ? list.map(productCard).join("")
            : `<div class="empty-state"><i class="fa-solid fa-spray-can-sparkles"></i><h3>No encontramos perfumes</h3><p>Prueba con otro nombre o categoría.</p></div>`;
        grid.querySelectorAll("img[data-fallback]").forEach(image => image.addEventListener("error", () => {
            image.src = image.dataset.fallback || "imagen/perfumes/perfume-default.png";
        }, {once:true}));
    }

    function renderPages() {
        pagination.innerHTML = "";
        if (totalPages <= 1) return;
        for (let page = 0; page < totalPages; page++) {
            const button = document.createElement("button");
            button.textContent = page + 1;
            button.classList.toggle("active", page === currentPage);
            button.addEventListener("click", () => loadApi(page));
            pagination.appendChild(button);
        }
    }

    function localFilter() {
        const term = q.value.trim().toLowerCase();
        const selectedCategory = category.value;
        const list = PARFUM_FALLBACK_PRODUCTS.filter(product =>
            (!term || `${product.nombre} ${product.marca} ${product.categoria} ${product.concentracion || ""}`.toLowerCase().includes(term))
            && (!selectedCategory || product.categoria === selectedCategory));

        list.sort((a, b) => {
            if (sort.value === "precio,asc") return Number(a.precio) - Number(b.precio);
            if (sort.value === "precio,desc") return Number(b.precio) - Number(a.precio);
            if (sort.value === "nombre,asc") return a.nombre.localeCompare(b.nombre);
            return Number(b.destacado) - Number(a.destacado);
        });
        totalPages = 1;
        currentPage = 0;
        render(list);
        renderPages();
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

    async function loadApi(page = 0, {background = false} = {}) {
        currentPage = page;
        if (!background) status.innerHTML = '<span class="spinner"></span> Actualizando catálogo…';
        const query = new URLSearchParams({page:String(page), size:"16", sort:sort.value});
        if (q.value.trim()) query.set("q", q.value.trim());
        if (category.value) query.set("categoria", category.value);

        try {
            const data = await ParfumAPI.request(`/productos?${query}`, {auth:false});
            const list = ParfumAPI.normalizeList(data);
            const totalElements = Number(data?.totalElements ?? list.length ?? 0);
            if (!list.length && page === 0) {
                localFilter();
                status.textContent = "El catálogo real todavía se está preparando. Mostrando la selección local.";
                return {ok:true, totalElements};
            }
            render(list);
            totalPages = Number(data.totalPages || 1);
            renderPages();
            localStorage.setItem(cacheKey, JSON.stringify({savedAt:Date.now(), products:list}));
            const expected = Number(PARFUM_CONFIG.CATALOG_EXPECTED_COUNT || 86);
            status.textContent = !q.value.trim() && !category.value && totalElements < expected
                ? `Render está terminando de cargar el catálogo (${totalElements}/${expected})…`
                : "Catálogo actualizado";
            return {ok:true, totalElements};
        } catch (error) {
            if (!background || !currentProducts.length) localFilter();
            status.textContent = "Servidor iniciando. Mostrando los perfumes de respaldo mientras tanto.";
            return {ok:false, totalElements:0, error};
        }
    }

    async function pollCatalog() {
        clearTimeout(catalogPollTimer);
        const result = await loadApi(currentPage, {background: catalogPollAttempt > 0});
        const expected = Number(PARFUM_CONFIG.CATALOG_EXPECTED_COUNT || 86);
        const unfiltered = !q.value.trim() && !category.value;
        const complete = result.ok && (!unfiltered || result.totalElements >= expected);
        if (complete || catalogPollAttempt >= Number(PARFUM_CONFIG.CATALOG_RETRY_ATTEMPTS || 14)) return;
        catalogPollAttempt += 1;
        catalogPollTimer = setTimeout(pollCatalog, Number(PARFUM_CONFIG.CATALOG_RETRY_MS || 15000));
    }

    async function start() {
        render(PARFUM_FALLBACK_PRODUCTS);
        await loadFavorites();
        render(currentProducts);

        const cached = readCache();
        if (cached?.products?.length) {
            render(cached.products);
            status.innerHTML = '<span class="spinner"></span> Mostrando catálogo guardado mientras comprobamos novedades…';
        }
        catalogPollAttempt = 0;
        pollCatalog();
    }

    document.getElementById("filterButton").addEventListener("click", () => {
        const next = new URLSearchParams();
        if (q.value.trim()) next.set("q", q.value.trim());
        if (category.value) next.set("categoria", category.value);
        history.replaceState(null, "", `${location.pathname}${next.size ? "?" + next : ""}`);
        catalogPollAttempt = 0;
        pollCatalog();
    });

    q.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            document.getElementById("filterButton").click();
        }
    });

    grid.addEventListener("click", async event => {
        const action = event.target.closest("[data-action]");
        if (!action) return;
        event.preventDefault();
        const card = action.closest(".catalog-card");
        const product = currentProducts.find(item => keysFor(item).includes(card.dataset.key))
            || ParfumAPI.fallbackById(card.dataset.key);
        if (!product) return;

        try {
            if (action.dataset.action === "choose") {
                location.href = ParfumAPI.productUrl(product);
            } else if (action.dataset.action === "cart") {
                await ParfumStore.addCart(product, 1, ParfumAPI.defaultDecant(product), "DECANT");
                ParfumAPI.toast("Perfume agregado al carrito");
            } else {
                const active = await ParfumStore.toggleFavorite(product, ParfumAPI.defaultDecant(product), "DECANT");
                action.classList.toggle("active", active);
                action.innerHTML = `<i class="${active ? "fa-solid" : "fa-regular"} fa-heart"></i>`;
                ParfumAPI.toast(active ? "Guardado en favoritos" : "Eliminado de favoritos");
            }
        } catch (error) {
            ParfumAPI.toast(error.message, "error");
        }
    });

    start();
})();
