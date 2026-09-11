(() => {
    "use strict";
    const CART = "parfum_guest_cart_v5";
    const FAV = "parfum_guest_favorites_v4";

    const parse = key => {
        try { return JSON.parse(localStorage.getItem(key) || "[]"); }
        catch { return []; }
    };
    const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
    const productKeyOf = value => String(value?.productoId ?? value?.id ?? value?.sku ?? value?.slug ?? "");

    function normalizeType(type, variant) {
        if (variant?.productoDecantId != null || variant?.envaseId != null) return "DECANT";
        return String(type || variant?.tipoItem || "BOTELLA").toUpperCase() === "DECANT" ? "DECANT" : "BOTELLA";
    }

    function variantIdOf(value) {
        const type = normalizeType(value?.tipoItem, value);
        if (type === "DECANT") return value?.productoDecantId ?? value?.id ?? value?.mililitros ?? "decant";
        return value?.presentacionId ?? value?.id ?? value?.mililitros ?? "standard";
    }

    const cartKeyOf = value => `${productKeyOf(value)}::${normalizeType(value?.tipoItem, value)}::${variantIdOf(value)}`;

    function resolveBottle(product, requested = null) {
        const list = ParfumAPI.activePresentations(product);
        if (!list.length) return null;
        if (requested?.id != null) {
            const byId = list.find(item => String(item.id) === String(requested.id));
            if (byId) return byId;
        }
        if (requested?.presentacionId != null) {
            const byId = list.find(item => String(item.id) === String(requested.presentacionId));
            if (byId) return byId;
        }
        if (requested?.mililitros != null) {
            const byMl = list.find(item => Number(item.mililitros) === Number(requested.mililitros));
            if (byMl) return byMl;
        }
        return ParfumAPI.defaultPresentation(product);
    }

    function resolveDecant(product, requested = null) {
        const list = ParfumAPI.activeDecants(product);
        if (!list.length) return null;
        const requestedId = requested?.productoDecantId ?? requested?.id;
        if (requestedId != null) {
            const byId = list.find(item => String(item.id) === String(requestedId));
            if (byId) return byId;
        }
        if (requested?.envaseId != null) {
            const byEnvase = list.find(item => String(item.envaseId) === String(requested.envaseId));
            if (byEnvase) return byEnvase;
        }
        return ParfumAPI.defaultDecant(product);
    }

    function normalizeSelection(product, requestedVariant = null, requestedType = null) {
        const type = normalizeType(requestedType, requestedVariant);
        const variant = type === "DECANT"
            ? resolveDecant(product, requestedVariant)
            : resolveBottle(product, requestedVariant);
        return {type, variant};
    }

    async function cart() {
        if (ParfumAPI.isLogged()) return ParfumAPI.request("/carrito/me");
        return parse(CART);
    }

    async function addCart(product, quantity = 1, requestedVariant = null, requestedType = null) {
        let selection = normalizeSelection(product, requestedVariant, requestedType);
        if (!ParfumAPI.canBuy(product, selection.variant, selection.type)) {
            throw new Error(selection.type === "DECANT"
                ? "Elige un decant que tenga precio y stock disponibles."
                : "Elige una presentación que tenga precio y stock disponibles.");
        }

        if (ParfumAPI.isLogged()) {
            const realProduct = await ParfumAPI.resolveProduct(product);
            selection = normalizeSelection(realProduct, selection.variant, selection.type);
            if (!ParfumAPI.canBuy(realProduct, selection.variant, selection.type)) {
                throw new Error("Esta presentación ya no está disponible.");
            }
            const result = await ParfumAPI.request(`/carrito/${realProduct.id}`, {
                method: "POST",
                body: {
                    cantidad: quantity,
                    presentacionId: selection.type === "BOTELLA" ? selection.variant?.id ?? null : null,
                    productoDecantId: selection.type === "DECANT" ? selection.variant?.id ?? null : null,
                    tipoItem: selection.type
                }
            });
            window.ParfumActivity?.track("ADD_CART", {
                productoId: realProduct.id,
                productoNombre: realProduct.nombre || product.nombre,
                detalle: `${selection.variant?.etiqueta || selection.type} · Cantidad: ${quantity}`
            });
            await updateBadges();
            return result;
        }

        const variant = selection.variant;
        const list = parse(CART);
        const itemCandidate = {
            productoId: /^\d+$/.test(String(product.id ?? "")) ? Number(product.id) : null,
            sku: product.sku || null,
            slug: product.slug || null,
            tipoItem: selection.type,
            presentacionId: selection.type === "BOTELLA" ? variant?.id ?? null : null,
            productoDecantId: selection.type === "DECANT" ? variant?.id ?? null : null,
            envaseId: selection.type === "DECANT" ? variant?.envaseId ?? null : null,
            mililitros: variant?.mililitros ?? null,
            presentacion: selection.type === "DECANT"
                ? `DECANT · ${variant?.etiqueta || `${variant?.mililitros || ""} ml`}`
                : variant?.etiqueta || (variant?.mililitros ? `${variant.mililitros} ml` : "Presentación estándar"),
            nombre: product.nombre,
            marca: product.marca,
            precio: Number(variant?.precio ?? product.precio),
            stock: Number(variant?.stock ?? product.stock ?? 0),
            cantidad: quantity,
            imagenUrl: ParfumAPI.variantImage(product, variant, selection.type)
        };
        const found = list.find(item => cartKeyOf(item) === cartKeyOf(itemCandidate));
        if (found) found.cantidad += quantity;
        else list.push(itemCandidate);
        save(CART, list);
        await updateBadges();
        window.ParfumActivity?.track("ADD_CART", {
            productoId: product.id ?? product.productoId,
            productoNombre: product.nombre,
            detalle: `${itemCandidate.presentacion} · Cantidad: ${quantity}`
        });
        return list;
    }

    async function updateCart(itemOrProductId, quantity, presentationId = null, mililitros = null, productDecantId = null, type = null) {
        const item = typeof itemOrProductId === "object" ? itemOrProductId : {
            productoId:itemOrProductId, presentacionId, mililitros, productoDecantId, tipoItem:type
        };
        const productId = item.productoId ?? item.id ?? item.sku ?? item.slug;
        const resolvedType = normalizeType(item.tipoItem, item);
        if (ParfumAPI.isLogged()) {
            return ParfumAPI.request(`/carrito/${productId}`, {
                method:"PUT",
                body:{
                    cantidad:quantity,
                    presentacionId: resolvedType === "BOTELLA" ? item.presentacionId ?? null : null,
                    productoDecantId: resolvedType === "DECANT" ? item.productoDecantId ?? null : null,
                    tipoItem:resolvedType
                }
            });
        }
        const list = parse(CART);
        const key = cartKeyOf(item);
        const found = list.find(entry => cartKeyOf(entry) === key);
        if (found) found.cantidad = quantity;
        save(CART, list);
        await updateBadges();
        return list;
    }

    async function removeCart(itemOrProductId, presentationId = null, mililitros = null, productDecantId = null, type = null) {
        const item = typeof itemOrProductId === "object" ? itemOrProductId : {
            productoId:itemOrProductId, presentacionId, mililitros, productoDecantId, tipoItem:type
        };
        const productId = item.productoId ?? item.id ?? item.sku ?? item.slug;
        const resolvedType = normalizeType(item.tipoItem, item);
        if (ParfumAPI.isLogged()) {
            const query = new URLSearchParams({tipoItem:resolvedType});
            if (resolvedType === "DECANT" && item.productoDecantId != null) query.set("productoDecantId", item.productoDecantId);
            if (resolvedType === "BOTELLA" && item.presentacionId != null) query.set("presentacionId", item.presentacionId);
            await ParfumAPI.request(`/carrito/${productId}?${query}`, {method:"DELETE"});
        } else {
            const key = cartKeyOf(item);
            save(CART, parse(CART).filter(entry => cartKeyOf(entry) !== key));
        }
        await updateBadges();
    }

    async function clearCart() {
        if (ParfumAPI.isLogged()) await ParfumAPI.request("/carrito/me", {method:"DELETE"});
        else save(CART, []);
        await updateBadges();
    }

    async function favorites() {
        if (ParfumAPI.isLogged()) return ParfumAPI.request("/favoritos/me");
        return parse(FAV);
    }

    async function isFavorite(product, variant = null, type = null) {
        const selection = normalizeSelection(product, variant, type);
        const key = ParfumAPI.variantKey(product, selection.variant, selection.type);
        return (await favorites()).some(item => cartKeyOf(item) === key || item.varianteClave === key);
    }

    async function toggleFavorite(product, requestedVariant = null, requestedType = null) {
        let selection = normalizeSelection(product, requestedVariant, requestedType);
        const list = await favorites();
        let key = ParfumAPI.variantKey(product, selection.variant, selection.type);
        let exists = list.some(item => cartKeyOf(item) === key || item.varianteClave === key);

        if (ParfumAPI.isLogged()) {
            const realProduct = await ParfumAPI.resolveProduct(product);
            selection = normalizeSelection(realProduct, selection.variant, selection.type);
            key = ParfumAPI.variantKey(realProduct, selection.variant, selection.type);
            exists = list.some(item => cartKeyOf(item) === key || item.varianteClave === key);
            if (exists) {
                const query = new URLSearchParams({tipoItem:selection.type});
                if (selection.type === "DECANT") query.set("productoDecantId", selection.variant?.id ?? "");
                else if (selection.variant?.id != null) query.set("presentacionId", selection.variant.id);
                await ParfumAPI.request(`/favoritos/${realProduct.id}?${query}`, {method:"DELETE"});
            } else {
                await ParfumAPI.request(`/favoritos/${realProduct.id}`, {
                    method:"POST",
                    body:{
                        tipoItem:selection.type,
                        presentacionId:selection.type === "BOTELLA" ? selection.variant?.id ?? null : null,
                        productoDecantId:selection.type === "DECANT" ? selection.variant?.id ?? null : null
                    }
                });
            }
        } else {
            const variant = selection.variant;
            const item = {
                productoId: /^\d+$/.test(String(product.id ?? "")) ? Number(product.id) : null,
                sku: product.sku || null,
                slug: product.slug || null,
                tipoItem: selection.type,
                presentacionId: selection.type === "BOTELLA" ? variant?.id ?? null : null,
                productoDecantId: selection.type === "DECANT" ? variant?.id ?? null : null,
                envaseId: selection.type === "DECANT" ? variant?.envaseId ?? null : null,
                mililitros: variant?.mililitros ?? null,
                presentacion: selection.type === "DECANT"
                    ? `DECANT · ${variant?.etiqueta || `${variant?.mililitros || ""} ml`}`
                    : variant?.etiqueta || (variant?.mililitros ? `${variant.mililitros} ml` : "Presentación estándar"),
                nombre: product.nombre,
                marca: product.marca,
                precio: Number(variant?.precio ?? product.precio ?? 0),
                stock: Number(variant?.stock ?? product.stock ?? 0),
                imagenUrl: ParfumAPI.variantImage(product, variant, selection.type)
            };
            save(FAV, exists ? list.filter(entry => cartKeyOf(entry) !== key) : [...list, item]);
        }
        await updateBadges();
        window.ParfumActivity?.track("FAVORITE", {
            productoId: product.id ?? product.productoId,
            productoNombre: product.nombre,
            detalle: `${exists ? "Eliminado" : "Agregado"} · ${selection.type} · ${selection.variant?.etiqueta || "estándar"}`
        });
        return !exists;
    }

    async function resolveGuestItem(item) {
        if (/^\d+$/.test(String(item.productoId ?? ""))) return {id:Number(item.productoId), ...item};
        return ParfumAPI.resolveProduct(item);
    }

    async function syncGuest() {
        if (!ParfumAPI.isLogged()) return;
        const guestCart = parse(CART);
        const guestFavorites = parse(FAV);

        for (const item of guestCart) {
            try {
                const product = await resolveGuestItem(item);
                await ParfumAPI.request(`/carrito/${product.id}`, {
                    method:"POST",
                    body:{
                        cantidad:item.cantidad,
                        presentacionId:item.tipoItem === "DECANT" ? null : item.presentacionId || null,
                        productoDecantId:item.tipoItem === "DECANT" ? item.productoDecantId || null : null,
                        tipoItem:item.tipoItem || "BOTELLA"
                    }
                });
            } catch (error) {
                console.warn("No se pudo sincronizar un producto del carrito:", error.message);
            }
        }

        for (const item of guestFavorites) {
            try {
                const product = await resolveGuestItem(item);
                await ParfumAPI.request(`/favoritos/${product.id}`, {
                    method:"POST",
                    body:{
                        presentacionId:item.tipoItem === "DECANT" ? null : item.presentacionId || null,
                        productoDecantId:item.tipoItem === "DECANT" ? item.productoDecantId || null : null,
                        tipoItem:item.tipoItem || "BOTELLA"
                    }
                });
            } catch (error) {
                console.warn("No se pudo sincronizar un favorito:", error.message);
            }
        }

        save(CART, []);
        save(FAV, []);
        await updateBadges();
    }

    async function updateBadges() {
        try {
            const [cartItems, favoriteItems] = await Promise.all([cart(), favorites()]);
            const count = cartItems.reduce((total, item) => total + Number(item.cantidad || 1), 0);
            document.querySelectorAll("[data-cart-count]").forEach(element => element.textContent = String(count));
            document.querySelectorAll("[data-fav-count]").forEach(element => element.textContent = String(favoriteItems.length));
        } catch {}
    }

    window.ParfumStore = {
        cart, addCart, updateCart, removeCart, clearCart,
        favorites, isFavorite, toggleFavorite, syncGuest, updateBadges,
        productKeyOf, cartKeyOf, normalizeSelection
    };
})();
