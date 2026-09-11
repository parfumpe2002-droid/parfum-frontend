(() => {
    "use strict";
    const grid = document.getElementById("favoritesGrid");
    let items = [];
    const keyOf = item => ParfumStore.cartKeyOf(item);

    function productOf(item) {
        return {
            id:item.productoId,
            productoId:item.productoId,
            sku:item.sku,
            slug:item.slug,
            nombre:item.nombre,
            marca:item.marca,
            precio:item.precio,
            stock:item.stock,
            imagenUrl:item.imagenUrl,
            activo:true,
            presentaciones:item.tipoItem === "BOTELLA" && item.presentacionId != null ? [{
                id:item.presentacionId,
                mililitros:item.mililitros,
                etiqueta:item.presentacion,
                precio:item.precio,
                stock:item.stock,
                activo:true
            }] : [],
            decantDisponible:item.tipoItem === "DECANT",
            decants:item.tipoItem === "DECANT" ? [{
                id:item.productoDecantId,
                envaseId:item.envaseId,
                envaseNombre:item.presentacion,
                mililitros:item.mililitros,
                etiqueta:item.presentacion,
                precio:item.precio,
                stock:item.stock,
                activo:true,
                imagenUrl:item.imagenUrl
            }] : []
        };
    }

    function variantOf(item) {
        return item.tipoItem === "DECANT" ? {
            id:item.productoDecantId,
            productoDecantId:item.productoDecantId,
            envaseId:item.envaseId,
            mililitros:item.mililitros,
            etiqueta:item.presentacion,
            precio:item.precio,
            stock:item.stock,
            activo:true,
            imagenUrl:item.imagenUrl
        } : {
            id:item.presentacionId,
            presentacionId:item.presentacionId,
            mililitros:item.mililitros,
            etiqueta:item.presentacion,
            precio:item.precio,
            stock:item.stock,
            activo:true
        };
    }

    function render() {
        grid.innerHTML = items.length ? items.map(item => {
            const product = productOf(item);
            const type = item.tipoItem || "BOTELLA";
            const detailUrl = ParfumAPI.productUrl(product, {decant:type === "DECANT"});
            return `
                <article class="catalog-card favorite-variant-card" data-key="${ParfumAPI.escapeHtml(keyOf(item))}">
                    <button class="card-fav active" data-action="remove" aria-label="Eliminar de favoritos"><i class="fa-solid fa-heart"></i></button>
                    <a href="${detailUrl}">
                        <div class="image"><img src="${ParfumAPI.escapeHtml(item.imagenUrl || ParfumAPI.image(ParfumAPI.fallbackById(item.productoId)))}" alt="${ParfumAPI.escapeHtml(item.nombre)}"></div>
                        <div class="info">
                            <h3>${ParfumAPI.escapeHtml(item.nombre)}</h3>
                            <div class="brand">${ParfumAPI.escapeHtml(item.marca)}</div>
                            <span class="tag ${type === "DECANT" ? "decant-tag" : ""}">${type === "DECANT" ? "DECANT" : "BOTELLA"}</span>
                            <small class="favorite-variant-label">${ParfumAPI.escapeHtml(item.presentacion || (item.mililitros ? `${item.mililitros} ml` : "Presentación estándar"))}</small>
                            <strong>${ParfumAPI.escapeHtml(ParfumAPI.priceLabel(item.precio))}</strong>
                        </div>
                    </a>
                    <div class="card-actions card-actions-stacked">
                        <button class="primary-btn" data-action="cart" ${Number(item.precio || 0) > 0 && Number(item.stock || 0) > 0 ? "" : "disabled"}>
                            ${Number(item.precio || 0) > 0 && Number(item.stock || 0) > 0 ? "Agregar al carrito" : "Próximamente"}
                        </button>
                        <a class="secondary-btn" href="${detailUrl}"><i class="fa-solid fa-arrow-right"></i> Ver detalle</a>
                    </div>
                </article>`;
        }).join("") : `<div class="empty-state"><i class="fa-regular fa-heart"></i><h3>No tienes favoritos</h3><p>Guarda botellas o decants específicos desde el catálogo.</p><a class="primary-btn" href="productos.html">Explorar catálogo</a></div>`;
    }

    async function load() {
        try {
            items = await ParfumStore.favorites();
            render();
        } catch (error) {
            grid.innerHTML = `<div class="empty-state"><p>${ParfumAPI.escapeHtml(error.message)}</p></div>`;
        }
    }

    grid.addEventListener("click", async event => {
        const action = event.target.closest("[data-action]");
        if (!action) return;
        event.preventDefault();
        const card = action.closest(".catalog-card");
        const item = items.find(entry => keyOf(entry) === card.dataset.key);
        if (!item) return;
        const product = productOf(item);
        const variant = variantOf(item);
        const type = item.tipoItem || "BOTELLA";
        try {
            if (action.dataset.action === "remove") {
                await ParfumStore.toggleFavorite(product, variant, type);
                items = items.filter(entry => keyOf(entry) !== card.dataset.key);
                render();
            } else if (action.dataset.action === "cart") {
                await ParfumStore.addCart(product, 1, variant, type);
                ParfumAPI.toast("Agregado al carrito");
            }
        } catch (error) {
            ParfumAPI.toast(error.message, "error");
        }
    });

    load();
})();
