(() => {
    "use strict";
    const grid = document.getElementById("catalogGrid");
    const status = document.getElementById("catalogStatus");
    const pagination = document.getElementById("pagination");
    const q = document.getElementById("q");
    const category = document.getElementById("category");
    const gender = document.getElementById("gender");
    const sort = document.getElementById("sort");
    const params = new URLSearchParams(location.search);

    category.value = params.get("categoria") || "";
    gender.value = params.get("genero") || "";
    q.value = params.get("q") || "";
    if (params.get("sort")) sort.value = params.get("sort");

    const PAGE_SIZE = 16;
    const API_PAGE_SIZE = 100;
    let fullCatalog = [...PARFUM_FALLBACK_PRODUCTS];
    let currentProducts = [];
    let currentFilteredProducts = [];
    let currentPage = 0;
    let totalPages = 1;
    let favoriteKeys = new Set();
    let catalogPollAttempt = 0;
    let catalogPollTimer = null;
    let catalogOnline = false;
    let searchTimer = null;
    const cacheKey = "parfum_catalog_cache_v10_full";

    function normalizeText(value) {
        return String(value ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
    }

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
            : `<div class="empty-state"><i class="fa-solid fa-spray-can-sparkles"></i><h3>No encontramos perfumes</h3><p>Prueba con otro nombre, marca, categoría o público.</p></div>`;
        grid.querySelectorAll("img[data-fallback]").forEach(image => image.addEventListener("error", () => {
            image.src = image.dataset.fallback || "imagen/perfumes/perfume-default.png";
        }, {once:true}));
    }

    function scrollToCatalog() {
        const headerHeight = document.querySelector(".site-header")?.getBoundingClientRect().height || 82;
        const targetTop = grid.getBoundingClientRect().top + window.scrollY - headerHeight - 14;
        window.scrollTo({top: Math.max(0, targetTop), behavior: "smooth"});
    }

    function renderPages() {
        pagination.innerHTML = "";
        if (totalPages <= 1) return;
        for (let page = 0; page < totalPages; page++) {
            const button = document.createElement("button");
            button.textContent = page + 1;
            button.classList.toggle("active", page === currentPage);
            button.setAttribute("aria-label", `Ir a la página ${page + 1}`);
            button.addEventListener("click", () => {
                applyFilters(page);
                scrollToCatalog();
            });
            pagination.appendChild(button);
        }
    }

    function productSearchText(product) {
        return normalizeText([
            product.nombre,
            product.marca,
            product.categoria,
            product.genero,
            product.concentracion,
            product.sku,
            product.descripcion,
            product.familiaOlfativa,
            product.perfumista,
            product.notasSalida,
            product.notasCorazon,
            product.notasFondo,
            product.acordesPrincipales,
            product.estilo,
            product.ocasiones
        ].filter(Boolean).join(" "));
    }

    function matchesGender(product, selected) {
        if (!selected) return true;
        const actual = normalizeText(product.genero);
        if (selected === "Hombre") return ["hombre", "masculino", "para el", "el"].includes(actual);
        if (selected === "Mujer") return ["mujer", "femenino", "para ella", "ella"].includes(actual);
        if (selected === "Unisex") return actual === "unisex";
        return actual === normalizeText(selected);
    }

    function sortProducts(list) {
        const copy = [...list];
        copy.sort((a, b) => {
            if (sort.value === "precio,asc") return Number(ParfumAPI.defaultDecant(a)?.precio || a.precio || 0) - Number(ParfumAPI.defaultDecant(b)?.precio || b.precio || 0);
            if (sort.value === "precio,desc") return Number(ParfumAPI.defaultDecant(b)?.precio || b.precio || 0) - Number(ParfumAPI.defaultDecant(a)?.precio || a.precio || 0);
            if (sort.value === "nombre,asc") return String(a.nombre || "").localeCompare(String(b.nombre || ""), "es", {sensitivity:"base"});
            return Number(Boolean(b.destacado)) - Number(Boolean(a.destacado))
                || String(a.nombre || "").localeCompare(String(b.nombre || ""), "es", {sensitivity:"base"});
        });
        return copy;
    }

    function updateUrl() {
        const next = new URLSearchParams();
        if (q.value.trim()) next.set("q", q.value.trim());
        if (category.value) next.set("categoria", category.value);
        if (gender.value) next.set("genero", gender.value);
        if (sort.value !== "destacado,desc") next.set("sort", sort.value);
        history.replaceState(null, "", `${location.pathname}${next.size ? "?" + next : ""}`);
    }

    function applyFilters(page = 0) {
        const term = normalizeText(q.value);
        const selectedCategory = normalizeText(category.value);
        const selectedGender = gender.value;
        let list = fullCatalog.filter(product => {
            const bySearch = !term || productSearchText(product).includes(term);
            const byCategory = !selectedCategory || normalizeText(product.categoria) === selectedCategory;
            const byGender = matchesGender(product, selectedGender);
            return bySearch && byCategory && byGender;
        });

        list = sortProducts(list);
        currentFilteredProducts = list;
        totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
        currentPage = Math.min(Math.max(Number(page) || 0, 0), totalPages - 1);
        const start = currentPage * PAGE_SIZE;
        render(list.slice(start, start + PAGE_SIZE));
        renderPages();

        const filtering = Boolean(term || selectedCategory || selectedGender);
        if (catalogOnline) {
            status.textContent = filtering
                ? `${list.length} ${list.length === 1 ? "perfume encontrado" : "perfumes encontrados"}`
                : "Catálogo actualizado";
        }
        return list.length;
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

    function uniqueProducts(list) {
        const map = new Map();
        list.forEach(product => {
            const key = String(product.id ?? product.productoId ?? product.sku ?? product.slug ?? Math.random());
            map.set(key, product);
        });
        return [...map.values()];
    }

    async function fetchWholeCatalog() {
        const firstQuery = new URLSearchParams({page:"0", size:String(API_PAGE_SIZE), sort:"actualizadoEn,desc"});
        const first = await ParfumAPI.request(`/productos?${firstQuery}`, {auth:false});
        let products = ParfumAPI.normalizeList(first);
        const pages = Math.max(1, Number(first?.totalPages || 1));
        const totalElements = Number(first?.totalElements ?? products.length ?? 0);

        if (pages > 1) {
            const requests = [];
            for (let page = 1; page < pages; page++) {
                const query = new URLSearchParams({page:String(page), size:String(API_PAGE_SIZE), sort:"actualizadoEn,desc"});
                requests.push(ParfumAPI.request(`/productos?${query}`, {auth:false}));
            }
            const rest = await Promise.all(requests);
            rest.forEach(payload => { products = products.concat(ParfumAPI.normalizeList(payload)); });
        }
        return {products: uniqueProducts(products), totalElements};
    }

    async function loadApi({background = false} = {}) {
        if (!background) status.innerHTML = '<span class="spinner"></span> Actualizando catálogo…';
        try {
            const data = await fetchWholeCatalog();
            if (!data.products.length) throw new Error("El catálogo llegó vacío");
            fullCatalog = data.products;
            catalogOnline = true;
            localStorage.setItem(cacheKey, JSON.stringify({savedAt:Date.now(), products:fullCatalog}));
            applyFilters(0);
            const expected = Number(PARFUM_CONFIG.CATALOG_EXPECTED_COUNT || 86);
            if (!q.value.trim() && !category.value && !gender.value && data.totalElements < expected) {
                status.textContent = `Render está terminando de cargar el catálogo (${data.totalElements}/${expected})…`;
            }
            return {ok:true, totalElements:data.totalElements};
        } catch (error) {
            catalogOnline = false;
            if (!fullCatalog.length) fullCatalog = [...PARFUM_FALLBACK_PRODUCTS];
            applyFilters(0);
            status.textContent = "Servidor iniciando. Puedes buscar en la selección disponible mientras Render despierta.";
            return {ok:false, totalElements:fullCatalog.length, error};
        }
    }

    async function pollCatalog() {
        clearTimeout(catalogPollTimer);
        const result = await loadApi({background: catalogPollAttempt > 0});
        const expected = Number(PARFUM_CONFIG.CATALOG_EXPECTED_COUNT || 86);
        const complete = result.ok && result.totalElements >= expected;
        if (complete || catalogPollAttempt >= Number(PARFUM_CONFIG.CATALOG_RETRY_ATTEMPTS || 14)) return;
        catalogPollAttempt += 1;
        catalogPollTimer = setTimeout(pollCatalog, Number(PARFUM_CONFIG.CATALOG_RETRY_MS || 15000));
    }

    function applyFilterAction() {
        currentPage = 0; // importante: una búsqueda nueva siempre empieza en la primera página
        updateUrl();
        applyFilters(0);
        if (!catalogOnline) {
            catalogPollAttempt = 0;
            pollCatalog();
        }
    }

    async function start() {
        fullCatalog = [...PARFUM_FALLBACK_PRODUCTS];
        await loadFavorites();
        applyFilters(0);

        const cached = readCache();
        if (cached?.products?.length) {
            fullCatalog = cached.products;
            applyFilters(0);
            status.innerHTML = '<span class="spinner"></span> Mostrando catálogo guardado mientras comprobamos novedades…';
        }
        catalogPollAttempt = 0;
        pollCatalog();
    }

    document.getElementById("filterButton").addEventListener("click", applyFilterAction);

    q.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            applyFilterAction();
        }
    });

    // Búsqueda cómoda: también responde al escribir sin obligar a pulsar el botón.
    q.addEventListener("input", () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(applyFilterAction, 280);
    });
    category.addEventListener("change", applyFilterAction);
    gender.addEventListener("change", applyFilterAction);
    sort.addEventListener("change", applyFilterAction);

    grid.addEventListener("click", async event => {
        const action = event.target.closest("[data-action]");
        if (!action) return;
        event.preventDefault();
        const card = action.closest(".catalog-card");
        const product = currentProducts.find(item => keysFor(item).includes(card.dataset.key))
            || currentFilteredProducts.find(item => keysFor(item).includes(card.dataset.key))
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
