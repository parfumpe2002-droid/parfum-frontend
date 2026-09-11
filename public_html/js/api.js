(() => {
    "use strict";
    const TOKEN_KEY = "parfum_token";
    const USER_KEY = "parfum_usuario";
    const DEFAULT_IMAGE = "imagen/perfumes/perfume-default.png";

    function getToken() { return localStorage.getItem(TOKEN_KEY); }
    function getUser() {
        try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); }
        catch { return null; }
    }
    function setSession(response) {
        localStorage.setItem(TOKEN_KEY, response.token);
        localStorage.setItem(USER_KEY, JSON.stringify(response.usuario));
    }
    function updateUser(user) { localStorage.setItem(USER_KEY, JSON.stringify(user)); }
    function clearSession() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }
    function isLogged() { return Boolean(getToken() && getUser()); }
    function isAdmin() { return getUser()?.rol === "ADMIN"; }

    async function request(path, options = {}) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), options.timeout ?? PARFUM_CONFIG.API_TIMEOUT_MS);
        const headers = new Headers(options.headers || {});
        const bodyIsForm = options.body instanceof FormData;
        if (!bodyIsForm && options.body !== undefined && !headers.has("Content-Type")) {
            headers.set("Content-Type", "application/json");
        }
        headers.set("Accept", "application/json");
        if (options.auth !== false && getToken()) headers.set("Authorization", `Bearer ${getToken()}`);
        const body = bodyIsForm || typeof options.body === "string" || options.body === undefined
            ? options.body : JSON.stringify(options.body);
        try {
            const response = await fetch(`${PARFUM_CONFIG.API_BASE}${path}`, {...options, headers, body, signal: controller.signal});
            const text = await response.text();
            let data = null;
            try { data = text ? JSON.parse(text) : null; } catch { data = text; }
            if (!response.ok) {
                if (response.status === 401) clearSession();
                if ([502, 503, 504].includes(response.status)) {
                    throw new Error("Render está iniciando. La API todavía no está lista.");
                }
                throw new Error(data?.message || `Error HTTP ${response.status}`);
            }
            return data;
        } catch (error) {
            if (error.name === "AbortError") throw new Error("Render está tardando en despertar. Espera unos segundos y vuelve a intentar.");
            if (error instanceof TypeError || /failed to fetch/i.test(String(error?.message || ""))) {
                throw new Error("No se pudo conectar con el servidor. Si Render estaba dormido, espera 30–60 segundos y vuelve a intentar.");
            }
            throw error;
        } finally {
            clearTimeout(timeout);
        }
    }


    function isWakeError(error) {
        const message = String(error?.message || error || "").toLowerCase();
        return message.includes("render está")
            || message.includes("servidor")
            || message.includes("failed to fetch")
            || message.includes("no se pudo conectar")
            || message.includes("api todavía no está lista")
            || message.includes("error http 502")
            || message.includes("error http 503")
            || message.includes("error http 504");
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms || 0))));
    }

    async function wakeServer() {
        try {
            await request("/health", {auth:false, timeout:15000});
            return true;
        } catch {
            return false;
        }
    }

    function money(value) {
        return new Intl.NumberFormat("es-PE", {style:"currency", currency:"PEN"}).format(Number(value || 0));
    }

    function activePresentations(product) {
        return Array.isArray(product?.presentaciones)
            ? [...product.presentaciones]
                .filter(item => item?.activo !== false)
                .sort((a, b) => Number(a.ordenVisual || 0) - Number(b.ordenVisual || 0)
                    || Number(a.mililitros || 0) - Number(b.mililitros || 0))
            : [];
    }

    function activeDecants(product) {
        if (product?.decantDisponible === false) return [];
        return Array.isArray(product?.decants)
            ? [...product.decants]
                .filter(item => item?.activo !== false)
                .sort((a, b) => Number(a.ordenVisual || 0) - Number(b.ordenVisual || 0)
                    || Number(a.mililitros || 0) - Number(b.mililitros || 0)
                    || String(a.envaseNombre || "").localeCompare(String(b.envaseNombre || "")))
            : [];
    }

    function defaultPresentation(product) {
        const list = activePresentations(product);
        return list.find(item => Number(item.precio || 0) > 0 && Number(item.stock || 0) > 0) || list[0] || null;
    }

    function defaultDecant(product) {
        const list = activeDecants(product);
        return list.find(item => Number(item.precio || 0) > 0 && Number(item.stock || 0) > 0) || list[0] || null;
    }

    function priceLabel(productOrValue, variant = null) {
        if (typeof productOrValue !== "object") return Number(productOrValue || 0) > 0 ? money(productOrValue) : "Precio por confirmar";
        const product = productOrValue;
        if (variant) return Number(variant.precio || 0) > 0 ? money(variant.precio) : "Precio por confirmar";
        const prices = activePresentations(product).map(item => Number(item.precio || 0)).filter(value => value > 0);
        if (prices.length) return `${prices.length > 1 ? "Desde " : ""}${money(Math.min(...prices))}`;
        return Number(product?.precio || 0) > 0 ? money(product.precio) : "Precio por confirmar";
    }

    function decantPriceLabel(product) {
        const prices = activeDecants(product).map(item => Number(item.precio || 0)).filter(value => value > 0);
        return prices.length ? `Decants desde ${money(Math.min(...prices))}` : "Decants por configurar";
    }

    function canBuy(product, variant = null, type = "BOTELLA") {
        if (product?.activo === false) return false;
        if (String(type).toUpperCase() === "DECANT") {
            const selected = variant || defaultDecant(product);
            return Number(selected?.precio || 0) > 0 && Number(selected?.stock || 0) > 0;
        }
        const variants = activePresentations(product);
        if (variants.length) {
            const selected = variant || defaultPresentation(product);
            return Number(selected?.precio || 0) > 0 && Number(selected?.stock || 0) > 0;
        }
        return Number(product?.precio || 0) > 0 && Number(product?.stock || 0) > 0;
    }

    function productKey(product) {
        if (!product) return "";
        return String(product.id ?? product.productoId ?? product.sku ?? product.slug ?? "");
    }

    function variantKey(product, variant = null, type = null) {
        const productId = productKey(product);
        const resolvedType = String(type || variant?.tipoItem || (variant?.productoDecantId || variant?.envaseId ? "DECANT" : "BOTELLA")).toUpperCase();
        const value = resolvedType === "DECANT"
            ? variant?.productoDecantId ?? variant?.id ?? variant?.mililitros ?? "decant"
            : variant?.presentacionId ?? variant?.id ?? variant?.mililitros ?? "standard";
        return `${productId}::${resolvedType}::${value}`;
    }

    function image(product) {
        return product?.imagenUrl || product?.fallbackImage || DEFAULT_IMAGE;
    }

    function variantImage(product, variant = null, type = "BOTELLA") {
        if (String(type).toUpperCase() === "DECANT") {
            return variant?.imagenUrl || variant?.fallbackImage || image(product);
        }
        return image(product);
    }

    function productUrl(product, options = {}) {
        if (product?.slug) return `/decants/${encodeURIComponent(product.slug)}/`;
        const query = new URLSearchParams();
        query.set("id", product?.id ?? product?.productoId ?? "");
        return `detalle.html?${query.toString()}`;
    }

    async function resolveProduct(product) {
        if (!product) throw new Error("Producto no disponible");
        const id = product.id ?? product.productoId;
        if (/^\d+$/.test(String(id ?? ""))) return product;
        if (product.sku) return request(`/productos/sku/${encodeURIComponent(product.sku)}`, {auth:false});
        if (product.slug) return request(`/productos/slug/${encodeURIComponent(product.slug)}`, {auth:false});
        throw new Error("El catálogo todavía se está actualizando. Inténtalo nuevamente en unos segundos.");
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function toast(message, type = "ok") {
        let box = document.querySelector(".app-toast");
        if (!box) {
            box = document.createElement("div");
            box.className = "app-toast";
            document.body.appendChild(box);
        }
        box.textContent = message;
        box.dataset.type = type;
        box.classList.add("show");
        clearTimeout(box._timer);
        box._timer = setTimeout(() => box.classList.remove("show"), 2800);
    }

    function requireLogin() {
        if (!isLogged()) {
            sessionStorage.setItem("parfum_after_login", location.href);
            location.href = "login.html";
            return false;
        }
        return true;
    }

    function requireAdmin() {
        if (!isLogged()) { location.href = "login.html"; return false; }
        if (!isAdmin()) { location.href = "index.html"; return false; }
        return true;
    }

    function fallbackById(value) {
        const key = String(value ?? "");
        return (window.PARFUM_FALLBACK_PRODUCTS || []).find(product =>
            [product.id, product.sku, product.slug].some(candidate => String(candidate ?? "") === key));
    }

    function normalizeList(payload) {
        return Array.isArray(payload) ? payload : payload?.content || payload?.productos || payload?.data || [];
    }

    window.ParfumAPI = {
        request, getToken, getUser, setSession, updateUser, clearSession, isLogged, isAdmin,
        money, priceLabel, decantPriceLabel, canBuy, activePresentations, activeDecants,
        defaultPresentation, defaultDecant, variantKey, image, variantImage, productKey,
        productUrl, resolveProduct, escapeHtml, toast, requireLogin, requireAdmin,
        fallbackById, normalizeList, isWakeError, sleep, wakeServer
    };
})();
