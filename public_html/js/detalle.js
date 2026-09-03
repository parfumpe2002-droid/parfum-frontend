(() => {
    "use strict";

    const params = new URLSearchParams(location.search);
    const pathSlug = location.pathname.match(/\/decants\/([^/]+)\/?$/)?.[1];
    const slug = params.get("slug") || (pathSlug ? decodeURIComponent(pathSlug) : null);
    const id = params.get("id");
    const reference = slug || id || PARFUM_FALLBACK_PRODUCTS[0]?.slug;
    const grid = document.getElementById("detailGrid");
    const profile = document.getElementById("fragranceProfile");
    const status = document.getElementById("detailStatus");
    const reviewSubmit = document.getElementById("reviewSubmit");
    const reviewCancel = document.getElementById("reviewCancel");

    const fallback = ParfumAPI.fallbackById(reference) || {
        slug: reference,
        nombre: ParfumDetails.get(reference)?.nombre || "Perfume Parfum",
        marca: ParfumDetails.get(reference)?.marca || "Parfum",
        categoria: ParfumDetails.get(reference)?.categoria || "Perfume",
        genero: ParfumDetails.get(reference)?.genero || "Hombre",
        concentracion: ParfumDetails.get(reference)?.concentracion || "",
        precio: 0,
        stock: 0,
        presentaciones: [],
        decantDisponible: true,
        decants: [],
        fallbackImage: "imagen/perfumes/perfume-default.png",
        activo: true
    };

    let product = ParfumDetails.merge(fallback, reference);
    let mode = "DECANT";
    let selectedBottle = ParfumAPI.defaultPresentation(product);
    let selectedDecant = ParfumAPI.defaultDecant(product);
    let quantity = 1;
    let currentUserReview = null;
    let detailRetryAttempt = 0;
    let detailRetryTimer = null;

    const esc = value => ParfumAPI.escapeHtml(String(value ?? ""));
    const splitList = value => String(value || "").split("|").map(item => item.trim()).filter(Boolean);
    const chips = (value, className = "profile-chip") => splitList(value).map(item => `<span class="${className}">${esc(item)}</span>`).join("");
    const fact = (icon, label, value) => value ? `<article class="fragrance-fact"><i class="${icon}"></i><div><small>${esc(label)}</small><strong>${esc(value)}</strong></div></article>` : "";

    function localDecants() {
        return [
            {id:"local-3", envaseId:"local-3", envaseNombre:"Vidrio negro 3 ml", mililitros:3, etiqueta:"3 ml · Vidrio negro", precio:0, stock:0, activo:true, ordenVisual:10, fallbackImage:"imagen/decants/decant-3ml.png"},
            {id:"local-5", envaseId:"local-5", envaseNombre:"Vidrio negro 5 ml", mililitros:5, etiqueta:"5 ml · Vidrio negro", precio:0, stock:0, activo:true, ordenVisual:20, fallbackImage:"imagen/decants/decant-5ml.png"},
            {id:"local-10", envaseId:"local-10", envaseNombre:"Premium degradé 10 ml", mililitros:10, etiqueta:"10 ml · Premium degradé", precio:0, stock:0, activo:true, ordenVisual:30, fallbackImage:"imagen/decants/decant-10ml-premium.png"},
            {id:"local-20", envaseId:"local-20", envaseNombre:"Atomizador 20 ml", mililitros:20, etiqueta:"20 ml", precio:0, stock:0, activo:true, ordenVisual:40, fallbackImage:"imagen/decants/decant-10ml-premium.png"},
            {id:"local-30", envaseId:"local-30", envaseNombre:"Atomizador 30 ml", mililitros:30, etiqueta:"30 ml", precio:0, stock:0, activo:true, ordenVisual:50, fallbackImage:"imagen/decants/decant-10ml-premium.png"}
        ];
    }

    function bottles() {
        return ParfumAPI.activePresentations(product);
    }

    function decants() {
        const real = ParfumAPI.activeDecants(product);
        return real.length ? real : localDecants();
    }

    function ensureSelections() {
        const bottleList = bottles();
        if (bottleList.length) {
            selectedBottle = bottleList.find(item => selectedBottle?.id != null && String(item.id) === String(selectedBottle.id))
                || bottleList.find(item => selectedBottle?.mililitros != null && Number(item.mililitros) === Number(selectedBottle.mililitros))
                || ParfumAPI.defaultPresentation(product)
                || bottleList[0];
        } else {
            selectedBottle = null;
        }

        const decantList = decants();
        selectedDecant = decantList.find(item => selectedDecant?.id != null && String(item.id) === String(selectedDecant.id))
            || decantList.find(item => selectedDecant?.mililitros != null && Number(item.mililitros) === Number(selectedDecant.mililitros)
                && String(item.envaseNombre || "") === String(selectedDecant.envaseNombre || ""))
            || ParfumAPI.defaultDecant(product)
            || decantList[0];

        mode = "DECANT";
    }

    function currentVariant() {
        return mode === "DECANT" ? selectedDecant : selectedBottle;
    }

    function currentImage() {
        return ParfumAPI.variantImage(product, currentVariant(), mode);
    }

    function currentStock() {
        const variant = currentVariant();
        return Number(variant?.stock ?? product.stock ?? 0);
    }

    function currentCanBuy() {
        return ParfumAPI.canBuy(product, currentVariant(), mode);
    }

    function renderModeTabs() {
        const message = encodeURIComponent(`Hola, vi ${product.nombre} de ${product.marca} en Parfum y quiero consultar por el frasco completo. ¿Lo tienen disponible y cuál es el precio?`);
        return `
            <div class="purchase-mode-tabs decant-primary-mode">
                <div class="active decant-primary-label">
                    <i class="fa-solid fa-vial"></i>
                    <span><b>Comprar decant</b><small>Elige 3, 5, 10, 20 o 30 ml</small></span>
                </div>
                <a class="full-bottle-whatsapp" href="https://wa.me/51963257194?text=${message}" target="_blank" rel="noopener noreferrer">
                    <i class="fa-brands fa-whatsapp"></i>
                    <span><b>¿Quieres el frasco completo?</b><small>Consultar disponibilidad por WhatsApp</small></span>
                </a>
            </div>`;
    }

    function renderBottleOptions() {
        const list = bottles();
        if (!list.length) return '<p class="muted">La presentación de botella se configurará pronto.</p>';
        return `
            <section class="variant-section">
                <div class="variant-section-heading"><b>Mililitros de la botella</b><small>El precio cambia según el tamaño.</small></div>
                <div class="presentation-options bottle-options">
                    ${list.map(item => {
                        const active = selectedBottle && String(item.id ?? item.mililitros) === String(selectedBottle.id ?? selectedBottle.mililitros);
                        const ready = Number(item.precio || 0) > 0 && Number(item.stock || 0) > 0;
                        return `<button type="button" class="presentation-option ${active ? "active" : ""} ${ready ? "available" : "pending"}" data-bottle-id="${esc(item.id ?? "")}" data-bottle-ml="${Number(item.mililitros || 0)}">
                            <b>${esc(item.etiqueta || `${item.mililitros} ml`)}</b>
                            <span>${ready ? esc(ParfumAPI.money(item.precio)) : "Por confirmar"}</span>
                        </button>`;
                    }).join("")}
                </div>
            </section>`;
    }

    function renderDecantOptions() {
        const list = decants();
        const grouped = new Map();
        list.forEach(item => {
            const ml = Number(item.mililitros || 0);
            if (!grouped.has(ml)) grouped.set(ml, []);
            grouped.get(ml).push(item);
        });
        return `
            <section class="variant-section decant-selection-section" id="decantOptions">
                <div class="variant-section-heading">
                    <div><b>Elige tu decant</b><small>Los envases son editables desde el panel de administración.</small></div>
                    <span class="decant-promo-chip"><i class="fa-solid fa-gift"></i> Compra 3 y elige 1 decant árabe de 3 ml gratis</span>
                </div>
                <div class="decant-ml-groups">
                    ${[...grouped.entries()].sort((a,b) => a[0]-b[0]).map(([ml, items]) => `
                        <div class="decant-ml-group">
                            <div class="decant-ml-heading"><strong>${ml} ml</strong>${ml === 10 && items.length > 1 ? `<small>Elige el diseño del envase</small>` : `<small>${items.length > 1 ? "Elige una presentación" : "Presentación disponible"}</small>`}</div>
                            <div class="decant-option-grid">
                                ${items.map(item => {
                                    const active = selectedDecant && String(item.id) === String(selectedDecant.id);
                                    const ready = Number(item.precio || 0) > 0 && Number(item.stock || 0) > 0;
                                    const image = item.imagenUrl || item.fallbackImage || `imagen/decants/decant-${ml}ml.png`;
                                    return `<button type="button" class="decant-option ${active ? "active" : ""} ${ready ? "available" : "pending"}" data-decant-id="${esc(item.id)}">
                                        <img src="${esc(image)}" alt="${esc(item.envaseNombre || `${ml} ml`)}" onerror="this.src='imagen/decants/decant-${ml === 10 ? "10ml-premium" : `${ml}ml`}.png'">
                                        <span><b>${esc(item.envaseNombre || item.etiqueta || `${ml} ml`)}</b><small>${ready ? esc(ParfumAPI.money(item.precio)) : "Precio por configurar"}</small></span>
                                    </button>`;
                                }).join("")}
                            </div>
                        </div>`).join("")}
                </div>
            </section>`;
    }

    function renderProduct() {
        ensureSelections();
        const variant = currentVariant();
        const stock = currentStock();
        const purchasable = currentCanBuy();
        const maxStock = Math.max(1, stock || 1);
        quantity = Math.min(Math.max(1, quantity), maxStock);
        const summaryMeta = [product.genero, product.concentracion, product.familiaOlfativa, product.anoLanzamiento]
            .filter(Boolean).map(value => `<span>${esc(value)}</span>`).join("");

        document.title = `Decant ${product.nombre} | Parfum Perú`;
        const description = `Compra decants de ${product.nombre} de ${product.marca} en 3, 5, 10, 20 o 30 ml. Consulta también por el frasco completo en Parfum Perú.`;
        const metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription) metaDescription.setAttribute("content", description);
        let canonical = document.querySelector('link[rel="canonical"]');
        if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
        canonical.href = `https://parfum.com.pe/decants/${product.slug}/`;
        grid.innerHTML = `
            <div class="detail-image-wrap">
                <div class="detail-image ${mode === "DECANT" ? "detail-image-decant" : ""}">
                    <img id="detailImage" src="${esc(currentImage())}" alt="${esc(product.nombre)} ${mode === "DECANT" ? "en decant" : ""}">
                </div>
                <div class="authenticity-note"><i class="fa-solid fa-shield-halved"></i><span><b>Selección Parfum</b><small>Ficha olfativa y datos de uso organizados para facilitar tu elección.</small></span></div>
            </div>
            <div class="detail-info">
                <p class="section-kicker">${esc(product.categoria)}</p>
                <h1>${esc(product.nombre)}</h1>
                <p class="detail-brand">${esc(product.marca)}</p>
                <div class="detail-meta">${summaryMeta}${product.sku ? `<span>${esc(product.sku)}</span>` : ""}</div>
                <p class="detail-style">${esc(product.estilo || "Una fragancia seleccionada para acompañar distintos momentos y estilos.")}</p>
                ${renderModeTabs()}
                ${renderDecantOptions()}
                <div class="selected-variant-summary">
                    <div><small>Decant seleccionado</small><b>${esc(variant?.etiqueta || variant?.envaseNombre || "Presentación estándar")}</b></div>
                    <p class="price" id="detailPrice">${esc(ParfumAPI.priceLabel(product, variant))}</p>
                </div>
                <p class="description">${esc(product.descripcion || "Una fragancia seleccionada por Parfum para acompañar tus mejores momentos.")}</p>
                <p class="stock-copy"><i class="fa-solid fa-box"></i> ${stock > 0 ? `Stock disponible: ${stock}` : "Stock por confirmar para esta presentación"}</p>
                <div class="button-row detail-buy-row">
                    <div class="quantity">
                        <button data-qty="-1" ${purchasable ? "" : "disabled"} aria-label="Disminuir cantidad">−</button>
                        <input id="qty" value="${quantity}" readonly aria-label="Cantidad">
                        <button data-qty="1" ${purchasable ? "" : "disabled"} aria-label="Aumentar cantidad">+</button>
                    </div>
                    <button id="addCart" class="primary-btn" ${purchasable ? "" : "disabled"}>
                        <i class="fa-solid fa-bag-shopping"></i> ${purchasable ? `Agregar decant` : "Precio por confirmar"}
                    </button>
                    <button id="addFavorite" class="secondary-btn favorite-detail-button" aria-label="Guardar variante en favoritos"><i class="fa-regular fa-heart"></i></button>
                </div>
                <p class="decant-explanation"><i class="fa-solid fa-circle-info"></i> El decant contiene la fragancia original reenvasada en el tamaño seleccionado. Si prefieres el frasco completo, puedes consultarlo directamente por WhatsApp.</p>
                <div class="detail-service-list">
                    <p><i class="fa-solid fa-certificate"></i><span><b>Garantía de originalidad</b><small>Productos seleccionados por el comercio.</small></span></p>
                    <p><i class="fa-solid fa-truck-fast"></i><span><b>Envíos seguros</b><small>Entrega a todo el Perú.</small></span></p>
                    <p><i class="fa-solid fa-headset"></i><span><b>Asesoría personalizada</b><small>Te ayudamos a elegir según tu estilo.</small></span></p>
                </div>
            </div>`;

        document.getElementById("detailImage").addEventListener("error", event => {
            event.target.src = mode === "DECANT"
                ? (variant?.fallbackImage || "imagen/decants/decant-10ml-premium.png")
                : (product.fallbackImage || "imagen/perfumes/perfume-default.png");
        }, {once:true});

        grid.querySelectorAll("[data-bottle-id]").forEach(button => button.addEventListener("click", () => {
            selectedBottle = bottles().find(item =>
                (button.dataset.bottleId && String(item.id) === button.dataset.bottleId)
                || Number(item.mililitros) === Number(button.dataset.bottleMl)) || selectedBottle;
            quantity = 1;
            renderProduct();
        }));

        grid.querySelectorAll("[data-decant-id]").forEach(button => button.addEventListener("click", () => {
            selectedDecant = decants().find(item => String(item.id) === String(button.dataset.decantId)) || selectedDecant;
            quantity = 1;
            renderProduct();
        }));

        grid.querySelectorAll("[data-qty]").forEach(button => button.addEventListener("click", () => {
            quantity = Math.max(1, Math.min(maxStock, quantity + Number(button.dataset.qty)));
            document.getElementById("qty").value = quantity;
        }));

        document.getElementById("addCart").addEventListener("click", async () => {
            try {
                await ParfumStore.addCart(product, quantity, variant, mode);
                ParfumAPI.toast(`${mode === "DECANT" ? "Decant" : "Perfume"} agregado al carrito`);
            } catch (error) {
                ParfumAPI.toast(error.message, "error");
            }
        });

        document.getElementById("addFavorite").addEventListener("click", async event => {
            try {
                const active = await ParfumStore.toggleFavorite(product, variant, mode);
                event.currentTarget.innerHTML = `<i class="${active ? "fa-solid" : "fa-regular"} fa-heart"></i>`;
                ParfumAPI.toast(active ? "Variante guardada en favoritos" : "Variante eliminada de favoritos");
            } catch (error) {
                ParfumAPI.toast(error.message, "error");
            }
        });

        ParfumStore.isFavorite(product, variant, mode).then(active => {
            const button = document.getElementById("addFavorite");
            if (button) button.innerHTML = `<i class="${active ? "fa-solid" : "fa-regular"} fa-heart"></i>`;
        }).catch(() => {});
    }

    function pyramidCard(kind, icon, title, value, description) {
        const notes = splitList(value);
        if (!notes.length) return "";
        return `<article class="note-stage ${kind}">
            <div class="note-stage-head"><span><i class="${icon}"></i></span><div><small>Pirámide olfativa</small><h3>${title}</h3></div></div>
            <div class="note-tags">${notes.map(item => `<span>${esc(item)}</span>`).join("")}</div>
            <p>${description}</p>
        </article>`;
    }

    function renderProfile() {
        profile.innerHTML = `
            <section class="profile-section accords-section">
                <div class="profile-heading"><div><p class="section-kicker">Identidad aromática</p><h2>Acordes principales</h2></div><p>Los acordes resumen las sensaciones que dominan durante la evolución de la fragancia.</p></div>
                <div class="accord-cloud">${chips(product.acordesPrincipales, "accord-chip") || '<span class="muted">Información en preparación</span>'}</div>
            </section>
            <section class="profile-section">
                <div class="profile-heading"><div><p class="section-kicker">Evolución</p><h2>Pirámide olfativa</h2></div><p>La salida aparece primero, el corazón define el carácter y el fondo permanece durante más tiempo.</p></div>
                <div class="olfactory-pyramid">
                    ${pyramidCard("top", "fa-solid fa-sun", "Notas de salida", product.notasSalida, "La primera impresión al aplicar el perfume.")}
                    ${pyramidCard("heart", "fa-solid fa-heart", "Notas de corazón", product.notasCorazon, "El núcleo que se revela después de los primeros minutos.")}
                    ${pyramidCard("base", "fa-solid fa-mountain", "Notas de fondo", product.notasFondo, "La estela profunda que queda sobre la piel y la ropa.")}
                </div>
            </section>
            <section class="profile-section performance-section">
                <div class="profile-heading"><div><p class="section-kicker">Rendimiento estimado</p><h2>Duración y proyección</h2></div><p>Rangos orientativos basados en el perfil de la fragancia y referencias de comunidad.</p></div>
                <div class="performance-grid">
                    ${fact("fa-regular fa-clock", "Duración aproximada", product.duracion)}
                    ${fact("fa-solid fa-wind", "Proyección y estela", product.proyeccion)}
                    ${fact("fa-solid fa-layer-group", "Familia olfativa", product.familiaOlfativa)}
                    ${fact("fa-regular fa-calendar", "Año de lanzamiento", product.anoLanzamiento)}
                    ${fact("fa-solid fa-pen-nib", "Perfumista", product.perfumista)}
                    ${fact("fa-solid fa-user", "Público", product.genero)}
                </div>
                <p class="performance-disclaimer"><i class="fa-solid fa-circle-info"></i> La duración y la proyección pueden cambiar según piel, clima, cantidad aplicada, lote y conservación del perfume. Se muestran como guía, no como garantía exacta.</p>
            </section>
            <section class="profile-section use-section">
                <div class="profile-heading"><div><p class="section-kicker">Cómo usarlo</p><h2>Temporadas y ocasiones</h2></div><p>Una guía rápida para elegir cuándo puede rendir mejor.</p></div>
                <div class="use-grid">
                    <article><div class="use-icon"><i class="fa-solid fa-cloud-sun"></i></div><div><small>Estaciones recomendadas</small><div class="use-chips">${chips(product.estaciones)}</div></div></article>
                    <article><div class="use-icon"><i class="fa-solid fa-champagne-glasses"></i></div><div><small>Ocasiones recomendadas</small><div class="use-chips">${chips(product.ocasiones)}</div></div></article>
                    <article><div class="use-icon"><i class="fa-solid fa-signature"></i></div><div><small>Estilo olfativo</small><p>${esc(product.estilo || "Versátil y personal")}</p></div></article>
                </div>
                <div class="profile-reference"><span>La ficha está redactada por Parfum a partir de información olfativa pública y referencias especializadas. La fuente se conserva internamente para que el administrador pueda verificar o actualizar los datos.</span></div>
            </section>`;
    }

    function apiPath() {
        if (slug) return `/productos/slug/${encodeURIComponent(slug)}`;
        if (/^\d+$/.test(String(id || ""))) return `/productos/${id}`;
        if (product?.sku) return `/productos/sku/${encodeURIComponent(product.sku)}`;
        return `/productos/slug/${encodeURIComponent(reference)}`;
    }

    async function load() {
        ensureSelections();
        renderProduct();
        renderProfile();
        status.innerHTML = '<span class="spinner"></span> Actualizando información…';
        try {
            let apiProduct;
            try {
                apiProduct = await ParfumAPI.request(apiPath(), {auth:false});
            } catch (firstError) {
                if (!product?.sku) throw firstError;
                apiProduct = await ParfumAPI.request(`/productos/sku/${encodeURIComponent(product.sku)}`, {auth:false});
            }
            product = ParfumDetails.merge(apiProduct, apiProduct.slug || reference);
            detailRetryAttempt = 0;
            clearTimeout(detailRetryTimer);
            ensureSelections();
            renderProduct();
            renderProfile();
            status.textContent = "Información actualizada";
            if (ParfumAPI.isLogged() && product.id) {
                ParfumAPI.request(`/historial/${product.id}`, {method:"POST"}).catch(() => {});
            }
        } catch (error) {
            status.textContent = "Servidor iniciando. Mostrando la ficha local de respaldo; se actualizará sola.";
            if (detailRetryAttempt < Number(PARFUM_CONFIG.CATALOG_RETRY_ATTEMPTS || 14)) {
                detailRetryAttempt += 1;
                clearTimeout(detailRetryTimer);
                detailRetryTimer = setTimeout(load, Number(PARFUM_CONFIG.CATALOG_RETRY_MS || 15000));
            }
        }
        window.ParfumActivity?.track("PRODUCT_VIEW", {
            productoId: product.id,
            productoNombre: product.nombre,
            detalle: product.marca
        });
        loadReviews();
    }

    function resetReviewForm() {
        currentUserReview = null;
        document.getElementById("rating").value = "5";
        document.getElementById("reviewComment").value = "";
        reviewSubmit.textContent = "Publicar reseña";
        reviewCancel.hidden = true;
    }

    async function loadReviews() {
        const box = document.getElementById("reviewsList");
        const viewer = ParfumAPI.getUser();
        if (!/^\d+$/.test(String(product?.id || ""))) {
            box.innerHTML = '<p class="muted">Las reseñas se cargarán cuando el catálogo termine de actualizarse.</p>';
            return;
        }
        try {
            const reviews = await ParfumAPI.request(`/resenas/producto/${product.id}`, {auth:false});
            currentUserReview = viewer ? reviews.find(review => String(review.usuarioId) === String(viewer.id)) || null : null;
            if (currentUserReview) {
                document.getElementById("rating").value = String(currentUserReview.puntuacion || 5);
                document.getElementById("reviewComment").value = currentUserReview.comentario || "";
                reviewSubmit.textContent = "Actualizar reseña";
                reviewCancel.hidden = false;
            } else {
                resetReviewForm();
            }
            box.innerHTML = reviews.length
                ? reviews.map(review => {
                    const own = viewer && String(review.usuarioId) === String(viewer.id);
                    const canDelete = own || viewer?.rol === "ADMIN";
                    return `<article class="review-card" data-review-id="${esc(review.id)}">
                        <div class="review-head"><div><b>${esc(review.nombreUsuario)}</b><div class="stars">${'<i class="fa-solid fa-star"></i>'.repeat(review.puntuacion)}</div></div>
                        ${canDelete ? `<div class="review-actions">${own ? `<button class="icon-button" type="button" data-review-edit="${esc(review.id)}" aria-label="Editar reseña"><i class="fa-regular fa-pen-to-square"></i></button>` : ""}<button class="icon-button" type="button" data-review-delete="${esc(review.id)}" aria-label="Eliminar reseña"><i class="fa-regular fa-trash-can"></i></button></div>` : ""}</div>
                        <p class="muted">${esc(review.comentario)}</p>
                    </article>`;
                }).join("")
                : '<p class="muted">Aún no hay reseñas. Sé el primero en comentar.</p>';
        } catch {
            box.innerHTML = '<p class="muted">Las reseñas se cargarán cuando el servidor esté disponible.</p>';
        }
    }

    document.getElementById("reviewsList").addEventListener("click", async event => {
        const deleteButton = event.target.closest("[data-review-delete]");
        const editButton = event.target.closest("[data-review-edit]");
        if (deleteButton) {
            if (!confirm("¿Eliminar esta reseña?")) return;
            try {
                await ParfumAPI.request(`/resenas/${encodeURIComponent(deleteButton.dataset.reviewDelete)}`, {method:"DELETE"});
                ParfumAPI.toast("Reseña eliminada");
                resetReviewForm();
                loadReviews();
            } catch (error) {
                ParfumAPI.toast(error.message, "error");
            }
            return;
        }
        if (editButton && currentUserReview) {
            document.getElementById("rating").value = String(currentUserReview.puntuacion || 5);
            document.getElementById("reviewComment").value = currentUserReview.comentario || "";
            reviewSubmit.textContent = "Actualizar reseña";
            reviewCancel.hidden = false;
            document.getElementById("reviewComment").focus();
        }
    });

    reviewCancel.addEventListener("click", resetReviewForm);

    document.getElementById("reviewForm").addEventListener("submit", async event => {
        event.preventDefault();
        if (!ParfumAPI.requireLogin()) return;
        if (!/^\d+$/.test(String(product?.id || ""))) {
            ParfumAPI.toast("Espera a que el catálogo termine de actualizarse.", "error");
            return;
        }
        try {
            await ParfumAPI.request(`/resenas/producto/${product.id}`, {
                method:"POST",
                body:{puntuacion:Number(document.getElementById("rating").value), comentario:document.getElementById("reviewComment").value}
            });
            ParfumAPI.toast(currentUserReview ? "Reseña actualizada" : "Reseña publicada");
            await loadReviews();
        } catch (error) {
            ParfumAPI.toast(error.message, "error");
        }
    });

    load();
})();
