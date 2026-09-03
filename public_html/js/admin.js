(() => {
    "use strict";

    if (!ParfumAPI.requireAdmin()) return;

    const $ = id => document.getElementById(id);
    const esc = value => ParfumAPI.escapeHtml(value ?? "");
    const dateTime = value => value ? new Date(value).toLocaleString("es-PE", {dateStyle:"short", timeStyle:"short"}) : "—";

    let products = [];
    let orders = [];
    let users = [];
    let messages = [];
    let activities = [];
    let decantContainers = [];
    let originalImagePublicId = "";
    let originalDecantImagePublicId = "";

    const ACTIVITY_LABELS = {
        PAGE_VIEW:"Visitó una página",
        PRODUCT_VIEW:"Vio un perfume",
        LOGIN:"Inició sesión",
        REGISTER:"Creó una cuenta",
        ADD_CART:"Agregó al carrito",
        FAVORITE:"Actualizó favoritos",
        CONTACT:"Envió un mensaje",
        ORDER:"Registró un pedido",
        SEARCH:"Realizó una búsqueda",
        OTHER:"Otra actividad"
    };

    const ACTIVITY_ICONS = {
        PAGE_VIEW:"fa-regular fa-window-maximize",
        PRODUCT_VIEW:"fa-solid fa-spray-can-sparkles",
        LOGIN:"fa-solid fa-right-to-bracket",
        REGISTER:"fa-solid fa-user-plus",
        ADD_CART:"fa-solid fa-bag-shopping",
        FAVORITE:"fa-solid fa-heart",
        CONTACT:"fa-solid fa-envelope",
        ORDER:"fa-solid fa-box",
        SEARCH:"fa-solid fa-magnifying-glass",
        OTHER:"fa-solid fa-circle-info"
    };

    function activateTab(name) {
        document.querySelectorAll(".admin-tabs button").forEach(button => {
            button.classList.toggle("active", button.dataset.tab === name);
        });
        document.querySelectorAll(".admin-view").forEach(view => {
            view.classList.toggle("active", view.id === name);
        });
        if (name === "products") Promise.all([loadDecantContainers(), loadProducts()]);
        if (name === "decants") loadDecantContainers(true);
        if (name === "orders") loadOrders();
        if (name === "users") loadUsers();
        if (name === "messages") loadMessages();
        if (name === "activity") loadActivity();
    }

    document.querySelectorAll(".admin-tabs button").forEach(button => {
        button.addEventListener("click", () => activateTab(button.dataset.tab));
    });
    document.querySelectorAll("[data-open-tab]").forEach(button => {
        button.addEventListener("click", () => activateTab(button.dataset.openTab));
    });

    function table(headers, rows, emptyMessage = "No hay registros") {
        if (!rows.length) return `<div class="empty-state admin-empty"><i class="fa-regular fa-folder-open"></i><p>${esc(emptyMessage)}</p></div>`;
        return `<div class="data-table-wrap"><table class="data-table"><thead><tr>${headers.map(header => `<th>${header}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
    }

    async function loadSummary() {
        try {
            const summary = await ParfumAPI.request("/admin/resumen");
            const cards = [
                ["fa-solid fa-users", "Usuarios", summary.usuarios],
                ["fa-solid fa-spray-can-sparkles", "Productos activos", summary.productos],
                ["fa-solid fa-box", "Pedidos", summary.pedidos],
                ["fa-solid fa-receipt", "Pagos por revisar", summary.pagosPendientes || 0],
                ["fa-solid fa-coins", "Ventas confirmadas", ParfumAPI.money(summary.ventas)],
                ["fa-solid fa-envelope", "Mensajes nuevos", summary.mensajesNuevos],
                ["fa-regular fa-eye", "Visitas hoy", summary.visitasHoy],
                ["fa-solid fa-user-group", "Visitantes hoy", summary.visitantesHoy],
                ["fa-solid fa-bottle-droplet", "Perfumes vistos hoy", summary.productosVistosHoy]
            ];
            $("statsGrid").innerHTML = cards.map(([icon, label, value]) => `
                <article class="stat-card admin-stat-card">
                    <span><i class="${icon}"></i></span>
                    <div><small>${label}</small><strong>${esc(value)}</strong></div>
                </article>`).join("");
            renderVisitChart(summary.serie7Dias || []);
            renderRecentActivity(summary.actividadReciente || []);
        } catch (error) {
            $("statsGrid").innerHTML = `<div class="panel"><p>${esc(error.message)}</p></div>`;
        }
    }

    function renderVisitChart(series) {
        if (!series.length) {
            $("visitChart").innerHTML = '<div class="admin-empty"><p>Aún no hay actividad registrada.</p></div>';
            return;
        }
        const maxValue = Math.max(1, ...series.flatMap(point => [Number(point.visitas || 0), Number(point.visitantes || 0)]));
        $("visitChart").innerHTML = series.map(point => {
            const visitsHeight = Math.max(Number(point.visitas || 0) ? 8 : 2, Number(point.visitas || 0) / maxValue * 100);
            const visitorsHeight = Math.max(Number(point.visitantes || 0) ? 8 : 2, Number(point.visitantes || 0) / maxValue * 100);
            return `<div class="chart-day" title="${esc(point.etiqueta)}: ${point.visitas} visitas, ${point.visitantes} visitantes">
                <div class="chart-bars"><i class="visits" style="height:${visitsHeight}%"><b>${Number(point.visitas || 0)}</b></i><i class="visitors" style="height:${visitorsHeight}%"><b>${Number(point.visitantes || 0)}</b></i></div>
                <span>${esc(point.etiqueta)}</span>
            </div>`;
        }).join("");
    }

    function activityTitle(item) {
        return ACTIVITY_LABELS[item.tipo] || item.tipo || "Actividad";
    }

    function activityDescription(item) {
        if (item.productoNombre) return `${item.productoNombre}${item.detalle ? ` · ${item.detalle}` : ""}`;
        if (item.detalle) return item.detalle;
        if (item.usuarioEmail) return item.usuarioEmail;
        return item.pagina || item.ruta || "Visita anónima";
    }

    function renderRecentActivity(list) {
        $("recentActivity").innerHTML = list.length ? list.map(item => `
            <article class="recent-activity-item">
                <span><i class="${ACTIVITY_ICONS[item.tipo] || ACTIVITY_ICONS.OTHER}"></i></span>
                <div><b>${esc(activityTitle(item))}</b><p>${esc(activityDescription(item))}</p></div>
                <time>${esc(dateTime(item.creadoEn))}</time>
            </article>`).join("") : '<div class="admin-empty"><p>La actividad aparecerá cuando los visitantes naveguen por la tienda.</p></div>';
    }

    async function loadCategories() {
        try {
            const categories = await ParfumAPI.request("/admin/categorias");
            const filter = $("adminCategoryFilter");
            const selected = filter.value;
            filter.innerHTML = '<option value="">Todas</option>' + categories.map(category => `<option value="${esc(category)}">${esc(category)}</option>`).join("");
            filter.value = selected;
            $("categoryOptions").innerHTML = categories.map(category => `<option value="${esc(category)}"></option>`).join("");
        } catch {}
    }

    async function loadProducts() {
        try {
            products = await ParfumAPI.request("/admin/productos");
            await loadCategories();
            renderProducts();
        } catch (error) {
            $("productsTable").innerHTML = `<p>${esc(error.message)}</p>`;
        }
    }

    function productMatches(product) {
        const term = $("adminProductSearch").value.trim().toLowerCase();
        const category = $("adminCategoryFilter").value;
        const status = $("adminStatusFilter").value;
        const text = `${product.sku || ""} ${product.nombre || ""} ${product.marca || ""}`.toLowerCase();
        if (term && !text.includes(term)) return false;
        if (category && product.categoria !== category) return false;
        if (status === "active" && !product.activo) return false;
        if (status === "inactive" && product.activo) return false;
        if (status === "pending" && Number(product.precio || 0) > 0 && Number(product.stock || 0) > 0) return false;
        return true;
    }

    function renderProducts() {
        const filtered = products.filter(productMatches);
        $("productsCount").textContent = `${filtered.length} de ${products.length} productos`;

        if (!filtered.length) {
            $("productsTable").innerHTML = '<div class="empty-state admin-empty"><i class="fa-regular fa-folder-open"></i><p>No hay productos que coincidan con los filtros.</p></div>';
            return;
        }

        $("productsTable").innerHTML = `<div class="admin-product-cards">${filtered.map(product => {
            const presentations = ParfumAPI.activePresentations(product);
            const ready = presentations.length
                ? presentations.some(item => Number(item.precio || 0) > 0 && Number(item.stock || 0) > 0)
                : Number(product.precio || 0) > 0 && Number(product.stock || 0) > 0;
            const sizes = presentations.length
                ? presentations.map(item => item.etiqueta || `${item.mililitros} ml`).join(", ")
                : "Sin tamaños";
            const decantSizes = (product.decants || []).filter(item => item.activo !== false)
                .map(item => item.etiqueta || `${item.mililitros} ml`).join(", ") || "Sin decants";
            const stock = Number(product.stock || 0);

            return `<article class="admin-product-card" data-product-card="${product.id}">
                <div class="admin-product-card-top">
                    <img class="thumb admin-product-thumb" src="${esc(ParfumAPI.image(product))}" alt="${esc(product.nombre)}" onerror="this.src='imagen/perfumes/perfume-default.png'">
                    <div class="admin-product-identity">
                        <small>${esc(product.sku || "Sin SKU")}</small>
                        <h3>${esc(product.nombre)}</h3>
                        <p>${esc(product.marca)}</p>
                    </div>
                    <div class="admin-product-card-actions">
                        <button class="secondary-btn" data-edit="${product.id}" type="button"><i class="fa-solid fa-pen"></i> Editar</button>
                        <button class="${product.activo ? "danger-btn" : "secondary-btn"}" data-toggle="${product.id}" type="button">${product.activo ? "Ocultar" : "Activar"}</button>
                    </div>
                </div>
                <div class="admin-product-card-meta">
                    <div>
                        <span>Categoría</span>
                        <b><span class="admin-category-chip">${esc(product.categoria)}</span></b>
                        <small>${esc(product.concentracion || "Sin concentración")}</small>
                        <small class="admin-size-summary">Botellas: ${esc(sizes)}</small><small class="admin-size-summary decant-summary">Decants: ${esc(decantSizes)}</small>
                    </div>
                    <div>
                        <span>Precio</span>
                        <b>${esc(ParfumAPI.priceLabel(product))}</b>
                        ${!ready ? '<small class="warning-text">Próximamente</small>' : '<small class="success-text">Disponible</small>'}
                    </div>
                    <div>
                        <span>Stock</span>
                        <b><span class="stock-pill ${stock > 0 ? "in-stock" : "out-stock"}">${stock}</span></b>
                        <small>${stock > 0 ? "unidades" : "sin stock"}</small>
                    </div>
                    <div>
                        <span>Estado</span>
                        <b><span class="status-pill ${product.activo ? "active" : "inactive"}">${product.activo ? "Visible" : "Oculto"}</span></b>
                        ${product.destacado ? '<small class="featured-label"><i class="fa-solid fa-star"></i> Destacado</small>' : '<small>No destacado</small>'}
                    </div>
                </div>
            </article>`;
        }).join("")}</div>`;
    }

    ["adminProductSearch", "adminCategoryFilter", "adminStatusFilter"].forEach(id => {
        $(id).addEventListener(id === "adminProductSearch" ? "input" : "change", renderProducts);
    });

    function presentationRow(item = {}, index = 0) {
        const ml = Number(item.mililitros || 0) || "";
        const price = Number(item.precio || 0);
        const stock = Number(item.stock || 0);
        return `<div class="presentation-admin-row" data-presentation-row>
            <input type="hidden" data-presentation-id value="${esc(item.id || "")}">
            <div class="field"><label>Mililitros</label><div class="ml-input"><input data-presentation-ml type="number" min="1" step="1" required value="${ml}" placeholder="100"><span>ml</span></div></div>
            <div class="field"><label>Precio (S/)</label><input data-presentation-price type="number" min="0" step="0.01" required value="${price.toFixed(2)}"></div>
            <div class="field"><label>Stock</label><input data-presentation-stock type="number" min="0" step="1" required value="${stock}"></div>
            <label class="presentation-active"><input data-presentation-active type="checkbox" ${item.activo !== false ? "checked" : ""}> Activo</label>
            <button class="presentation-remove" type="button" data-remove-presentation aria-label="Eliminar tamaño"><i class="fa-solid fa-trash"></i></button>
            <input type="hidden" data-presentation-order value="${Number(item.ordenVisual ?? index)}">
        </div>`;
    }

    function renderPresentations(items = []) {
        const list = items.length ? items : [{mililitros:100, precio:0, stock:0, activo:true, ordenVisual:0}];
        $("presentationRows").innerHTML = list.map(presentationRow).join("");
        updatePresentationSummary();
    }

    function readPresentations() {
        const rows = [...document.querySelectorAll("[data-presentation-row]")];
        const values = rows.map((row, index) => ({
            id:row.querySelector("[data-presentation-id]").value ? Number(row.querySelector("[data-presentation-id]").value) : null,
            mililitros:Number(row.querySelector("[data-presentation-ml]").value),
            precio:Number(row.querySelector("[data-presentation-price]").value || 0),
            stock:Number(row.querySelector("[data-presentation-stock]").value || 0),
            activo:row.querySelector("[data-presentation-active]").checked,
            ordenVisual:index
        }));
        const activeMl = values.map(item => item.mililitros);
        if (values.some(item => !Number.isInteger(item.mililitros) || item.mililitros <= 0)) throw new Error("Todos los tamaños deben tener mililitros válidos");
        if (new Set(activeMl).size !== activeMl.length) throw new Error("No puedes repetir el mismo tamaño en un producto");
        return values;
    }

    function updatePresentationSummary() {
        const rows = [...document.querySelectorAll("[data-presentation-row]")];
        const active = rows.filter(row => row.querySelector("[data-presentation-active]")?.checked);
        const prices = active.map(row => Number(row.querySelector("[data-presentation-price]")?.value || 0)).filter(value => value > 0);
        const stock = active.reduce((sum, row) => sum + Math.max(0, Number(row.querySelector("[data-presentation-stock]")?.value || 0)), 0);
        $("productPrice").value = prices.length ? Math.min(...prices).toFixed(2) : "0";
        $("productStock").value = String(stock);
    }


    async function loadDecantContainers(renderAdmin = false) {
        try {
            decantContainers = await ParfumAPI.request("/admin/decants/envases");
            if (renderAdmin) renderDecantContainersAdmin();
            if (!$("productId").value && !document.querySelector("[data-product-decant-row]")) {
                renderProductDecants([]);
            }
        } catch (error) {
            if (renderAdmin) $("decantContainersList").innerHTML = `<p>${esc(error.message)}</p>`;
        }
    }

    function productDecantRow(item = {}, index = 0) {
        const envaseId = item.envaseId ?? item.envase?.id ?? "";
        const selectedContainer = decantContainers.find(container => String(container.id) === String(envaseId));
        const image = item.imagenUrl || item.fallbackImage || selectedContainer?.imagenUrl || selectedContainer?.fallbackImage || "imagen/decants/decant-10ml-premium.png";
        const label = item.envaseNombre || selectedContainer?.nombre || "Envase";
        const ml = item.mililitros || selectedContainer?.mililitros || "";
        return `<div class="product-decant-admin-row" data-product-decant-row>
            <input type="hidden" data-product-decant-id value="${esc(item.id || "")}">
            <input type="hidden" data-product-decant-envase value="${esc(envaseId)}">
            <img src="${esc(image)}" alt="${esc(label)}" onerror="this.src='imagen/decants/decant-10ml-premium.png'">
            <div class="product-decant-admin-identity"><b>${esc(label)}</b><small>${esc(ml)} ml</small></div>
            <div class="field"><label>Precio (S/)</label><input data-product-decant-price type="number" min="0" step="0.01" value="${Number(item.precio || 0).toFixed(2)}"></div>
            <div class="field"><label>Stock</label><input data-product-decant-stock type="number" min="0" step="1" value="${Number(item.stock || 0)}"></div>
            <label class="presentation-active"><input data-product-decant-active type="checkbox" ${item.activo !== false ? "checked" : ""}> Activo</label>
            <input type="hidden" data-product-decant-order value="${Number(item.ordenVisual ?? index)}">
        </div>`;
    }

    function renderProductDecants(items = []) {
        const existing = new Map((items || []).map(item => [String(item.envaseId), item]));
        const rows = decantContainers.map((container, index) => productDecantRow(existing.get(String(container.id)) || {
            envaseId:container.id,
            envaseNombre:container.nombre,
            mililitros:container.mililitros,
            imagenUrl:container.imagenUrl,
            fallbackImage:container.fallbackImage,
            precio:0,
            stock:0,
            activo:container.activo !== false,
            ordenVisual:index
        }, index));
        $("productDecantRows").innerHTML = rows.length
            ? rows.join("")
            : '<div class="admin-empty"><p>No hay envases de decant. Créalo primero en la pestaña Decants.</p></div>';
    }

    function readProductDecants() {
        return [...document.querySelectorAll("[data-product-decant-row]")].map((row, index) => ({
            id:row.querySelector("[data-product-decant-id]").value ? Number(row.querySelector("[data-product-decant-id]").value) : null,
            envaseId:Number(row.querySelector("[data-product-decant-envase]").value),
            precio:Number(row.querySelector("[data-product-decant-price]").value || 0),
            stock:Number(row.querySelector("[data-product-decant-stock]").value || 0),
            activo:row.querySelector("[data-product-decant-active]").checked,
            ordenVisual:index
        })).filter(item => Number.isFinite(item.envaseId));
    }

    function setDecantImagePreview(src) {
        $("decantImagePreview").src = src || $("decantContainerFallback").value || "imagen/decants/decant-10ml-premium.png";
    }

    function resetDecantForm() {
        $("decantContainerForm").reset();
        $("decantContainerId").value = "";
        $("decantImageUrl").value = "";
        $("decantImagePublicId").value = "";
        $("decantContainerMl").value = "10";
        $("decantContainerOrder").value = "0";
        $("decantContainerFallback").value = "imagen/decants/decant-10ml-premium.png";
        $("decantContainerActive").checked = true;
        $("decantFormTitle").textContent = "Nuevo envase";
        $("decantMessage").textContent = "";
        originalDecantImagePublicId = "";
        setDecantImagePreview("imagen/decants/decant-10ml-premium.png");
    }

    function fillDecantForm(container) {
        $("decantContainerId").value = container.id;
        $("decantContainerName").value = container.nombre || "";
        $("decantContainerMl").value = container.mililitros || 10;
        $("decantContainerOrder").value = container.ordenVisual || 0;
        $("decantContainerDescription").value = container.descripcion || "";
        $("decantContainerFallback").value = container.fallbackImage || "imagen/decants/decant-10ml-premium.png";
        $("decantImageUrl").value = container.imagenUrl || "";
        $("decantImagePublicId").value = container.imagenPublicId || "";
        $("decantContainerActive").checked = container.activo !== false;
        $("decantFormTitle").textContent = "Editar envase";
        originalDecantImagePublicId = container.imagenPublicId || "";
        setDecantImagePreview(container.imagenUrl || container.fallbackImage);
        scrollTo({top:$("decantContainerForm").offsetTop - 110, behavior:"smooth"});
    }

    function renderDecantContainersAdmin() {
        $("decantCount").textContent = `${decantContainers.length} ${decantContainers.length === 1 ? "envase" : "envases"}`;
        $("decantContainersList").innerHTML = decantContainers.length ? decantContainers.map(container => `
            <article class="admin-decant-card" data-decant-container="${container.id}">
                <img src="${esc(container.imagenUrl || container.fallbackImage || "imagen/decants/decant-10ml-premium.png")}" alt="${esc(container.nombre)}" onerror="this.src='imagen/decants/decant-10ml-premium.png'">
                <div><small>${esc(container.mililitros)} ml</small><h3>${esc(container.nombre)}</h3><p>${esc(container.descripcion || "Sin descripción")}</p><span class="status-pill ${container.activo ? "active" : "inactive"}">${container.activo ? "Visible" : "Oculto"}</span></div>
                <div class="admin-decant-card-actions"><button class="secondary-btn" data-edit-decant="${container.id}" type="button"><i class="fa-solid fa-pen"></i> Editar</button><button class="danger-btn" data-delete-decant="${container.id}" type="button"><i class="fa-solid fa-trash"></i> Eliminar</button></div>
            </article>`).join("") : '<div class="empty-state"><p>No hay envases configurados.</p></div>';
    }

    $("resetDecantForm").addEventListener("click", resetDecantForm);
    $("decantImageFile").addEventListener("change", event => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setDecantImagePreview(reader.result);
        reader.readAsDataURL(file);
    });
    $("decantContainerFallback").addEventListener("input", () => {
        if (!$("decantImageUrl").value && !$("decantImageFile").files[0]) setDecantImagePreview($("decantContainerFallback").value);
    });
    $("removeDecantImage").addEventListener("click", () => {
        $("decantImageUrl").value = "";
        $("decantImagePublicId").value = "";
        $("decantImageFile").value = "";
        setDecantImagePreview($("decantContainerFallback").value);
    });

    $("decantContainerForm").addEventListener("submit", async event => {
        event.preventDefault();
        const message = $("decantMessage");
        const submit = event.currentTarget.querySelector('button[type="submit"]');
        submit.disabled = true;
        try {
            const file = $("decantImageFile").files[0];
            if (file) {
                message.textContent = "Subiendo imagen…";
                const form = new FormData();
                form.append("file", file);
                const uploaded = await ParfumAPI.request("/imagenes/upload", {method:"POST", body:form});
                $("decantImageUrl").value = uploaded.url;
                $("decantImagePublicId").value = uploaded.publicId;
            }
            const body = {
                nombre:$("decantContainerName").value,
                mililitros:Number($("decantContainerMl").value),
                descripcion:$("decantContainerDescription").value,
                imagenUrl:$("decantImageUrl").value,
                imagenPublicId:$("decantImagePublicId").value,
                fallbackImage:$("decantContainerFallback").value,
                activo:$("decantContainerActive").checked,
                ordenVisual:Number($("decantContainerOrder").value || 0)
            };
            const id = $("decantContainerId").value;
            const saved = await ParfumAPI.request(id ? `/admin/decants/envases/${id}` : "/admin/decants/envases", {method:id ? "PUT" : "POST", body});
            if (originalDecantImagePublicId && originalDecantImagePublicId !== saved.imagenPublicId) {
                ParfumAPI.request(`/imagenes?publicId=${encodeURIComponent(originalDecantImagePublicId)}`, {method:"DELETE"}).catch(() => {});
            }
            message.textContent = "Envase guardado correctamente";
            message.className = "form-message ok";
            resetDecantForm();
            await loadDecantContainers(true);
        } catch (error) {
            message.textContent = error.message;
            message.className = "form-message error";
        } finally {
            submit.disabled = false;
        }
    });

    $("decantContainersList").addEventListener("click", async event => {
        const edit = event.target.closest("[data-edit-decant]");
        const remove = event.target.closest("[data-delete-decant]");
        if (edit) {
            const container = decantContainers.find(item => String(item.id) === edit.dataset.editDecant);
            if (container) fillDecantForm(container);
            return;
        }
        if (remove) {
            if (!confirm("¿Eliminar u ocultar este envase de decant?")) return;
            try {
                await ParfumAPI.request(`/admin/decants/envases/${remove.dataset.deleteDecant}`, {method:"DELETE"});
                ParfumAPI.toast("Envase actualizado");
                await loadDecantContainers(true);
            } catch (error) {
                ParfumAPI.toast(error.message, "error");
            }
        }
    });

    function setImagePreview(src) {
        $("productImagePreview").src = src || $("productFallback").value || "imagen/perfumes/perfume-default.png";
    }

    function fillProductForm(product) {
        const values = {
            productId:product.id,
            productSku:product.sku || "",
            productSlug:product.slug || "",
            productName:product.nombre || "",
            productBrand:product.marca || "",
            productCategory:product.categoria || "Diseñador",
            productGender:product.genero || "Hombre",
            productConcentration:product.concentracion || "",
            productPrice:product.precio ?? 0,
            productStock:product.stock ?? 0,
            productDescription:product.descripcion || "",
            productFamily:product.familiaOlfativa || "",
            productYear:product.anoLanzamiento || "",
            productPerfumer:product.perfumista || "",
            productTopNotes:product.notasSalida || "",
            productHeartNotes:product.notasCorazon || "",
            productBaseNotes:product.notasFondo || "",
            productAccords:product.acordesPrincipales || "",
            productLongevity:product.duracion || "",
            productProjection:product.proyeccion || "",
            productSeasons:product.estaciones || "",
            productOccasions:product.ocasiones || "",
            productStyle:product.estilo || "",
            productReference:product.fuenteReferencia || "",
            productFallback:product.fallbackImage || "imagen/perfumes/perfume-default.png",
            productImageUrl:product.imagenUrl || "",
            productImagePublicId:product.imagenPublicId || ""
        };
        Object.entries(values).forEach(([id, value]) => { $(id).value = value; });
        $("productFeatured").checked = Boolean(product.destacado);
        $("productActive").checked = product.activo !== false;
        $("productDecantAvailable").checked = product.decantDisponible !== false;
        renderPresentations(product.presentaciones || []);
        renderProductDecants(product.decants || []);
        originalImagePublicId = product.imagenPublicId || "";
        $("productFormTitle").textContent = "Editar producto";
        setImagePreview(ParfumAPI.image(product));
        $("productMessage").textContent = "";
        $("productForm").scrollTo({top:0, behavior:"smooth"});
        document.querySelectorAll("[data-product-card]").forEach(card => {
            card.classList.toggle("selected", String(card.dataset.productCard) === String(product.id));
        });
        scrollTo({top:$("productForm").offsetTop - 110, behavior:"smooth"});
    }

    function resetProduct() {
        $("productForm").reset();
        $("productId").value = "";
        $("productImageUrl").value = "";
        $("productImagePublicId").value = "";
        $("productPrice").value = "0";
        $("productStock").value = "0";
        $("productActive").checked = true;
        $("productDecantAvailable").checked = true;
        $("productGender").value = "Hombre";
        $("productFallback").value = "imagen/perfumes/perfume-default.png";
        renderPresentations([{mililitros:100, precio:0, stock:0, activo:true, ordenVisual:0}]);
        renderProductDecants([]);
        $("productFormTitle").textContent = "Nuevo producto";
        $("productMessage").textContent = "";
        originalImagePublicId = "";
        setImagePreview("imagen/perfumes/perfume-default.png");
    }

    $("cancelEdit").addEventListener("click", resetProduct);
    $("newProductButton").addEventListener("click", () => {
        resetProduct();
        scrollTo({top:$("productForm").offsetTop - 110, behavior:"smooth"});
        $("productName").focus();
    });
    $("productImageFile").addEventListener("change", event => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setImagePreview(reader.result);
        reader.readAsDataURL(file);
    });
    $("productFallback").addEventListener("input", () => {
        if (!$("productImageUrl").value && !$("productImageFile").files[0]) setImagePreview($("productFallback").value);
    });
    $("removeProductImage").addEventListener("click", () => {
        $("productImageUrl").value = "";
        $("productImagePublicId").value = "";
        $("productImageFile").value = "";
        setImagePreview($("productFallback").value);
    });

    function productRequestBody(product = null) {
        if (product) {
            return {
                sku:product.sku, slug:product.slug, nombre:product.nombre, marca:product.marca,
                categoria:product.categoria, genero:product.genero || "Hombre", concentracion:product.concentracion,
                descripcion:product.descripcion, familiaOlfativa:product.familiaOlfativa,
                anoLanzamiento:product.anoLanzamiento, perfumista:product.perfumista,
                notasSalida:product.notasSalida, notasCorazon:product.notasCorazon, notasFondo:product.notasFondo,
                acordesPrincipales:product.acordesPrincipales, duracion:product.duracion,
                proyeccion:product.proyeccion, estaciones:product.estaciones, ocasiones:product.ocasiones,
                estilo:product.estilo, fuenteReferencia:product.fuenteReferencia,
                precio:Number(product.precio || 0), stock:Number(product.stock || 0), imagenUrl:product.imagenUrl,
                imagenPublicId:product.imagenPublicId, fallbackImage:product.fallbackImage || "imagen/perfumes/perfume-default.png",
                destacado:Boolean(product.destacado), activo:product.activo !== false,
                decantDisponible:product.decantDisponible !== false,
                presentaciones:(product.presentaciones || []).map((item, index) => ({id:item.id || null, mililitros:Number(item.mililitros), precio:Number(item.precio || 0), stock:Number(item.stock || 0), activo:item.activo !== false, ordenVisual:index})),
                decants:(product.decants || []).map((item, index) => ({id:item.id || null, envaseId:Number(item.envaseId), precio:Number(item.precio || 0), stock:Number(item.stock || 0), activo:item.activo !== false, ordenVisual:index}))
            };
        }
        return {
            sku:$("productSku").value,
            slug:$("productSlug").value,
            nombre:$("productName").value,
            marca:$("productBrand").value,
            categoria:$("productCategory").value,
            genero:$("productGender").value,
            concentracion:$("productConcentration").value,
            descripcion:$("productDescription").value,
            familiaOlfativa:$("productFamily").value,
            anoLanzamiento:$("productYear").value ? Number($("productYear").value) : null,
            perfumista:$("productPerfumer").value,
            notasSalida:$("productTopNotes").value,
            notasCorazon:$("productHeartNotes").value,
            notasFondo:$("productBaseNotes").value,
            acordesPrincipales:$("productAccords").value,
            duracion:$("productLongevity").value,
            proyeccion:$("productProjection").value,
            estaciones:$("productSeasons").value,
            ocasiones:$("productOccasions").value,
            estilo:$("productStyle").value,
            fuenteReferencia:$("productReference").value,
            precio:Number($("productPrice").value || 0),
            stock:Number($("productStock").value || 0),
            presentaciones:readPresentations(),
            imagenUrl:$("productImageUrl").value,
            imagenPublicId:$("productImagePublicId").value,
            fallbackImage:$("productFallback").value || "imagen/perfumes/perfume-default.png",
            destacado:$("productFeatured").checked,
            activo:$("productActive").checked,
            decantDisponible:$("productDecantAvailable").checked,
            decants:readProductDecants()
        };
    }

    $("productsTable").addEventListener("click", async event => {
        const editButton = event.target.closest("[data-edit]");
        const toggleButton = event.target.closest("[data-toggle]");
        if (editButton) {
            const product = products.find(item => String(item.id) === editButton.dataset.edit);
            if (product) fillProductForm(product);
            return;
        }
        if (toggleButton) {
            const product = products.find(item => String(item.id) === toggleButton.dataset.toggle);
            if (!product) return;
            const nextActive = !product.activo;
            if (!confirm(nextActive ? "¿Activar este producto?" : "¿Ocultar este producto del catálogo?")) return;
            try {
                const body = productRequestBody({...product, activo:nextActive});
                await ParfumAPI.request(`/productos/${product.id}`, {method:"PUT", body});
                ParfumAPI.toast(nextActive ? "Producto activado" : "Producto ocultado");
                await Promise.all([loadProducts(), loadSummary()]);
            } catch (error) {
                ParfumAPI.toast(error.message, "error");
            }
        }
    });

    $("addPresentation").addEventListener("click", () => {
        const index = document.querySelectorAll("[data-presentation-row]").length;
        $("presentationRows").insertAdjacentHTML("beforeend", presentationRow({mililitros:"", precio:0, stock:0, activo:true}, index));
        updatePresentationSummary();
    });
    $("presentationRows").addEventListener("click", event => {
        const button = event.target.closest("[data-remove-presentation]");
        if (!button) return;
        const rows = document.querySelectorAll("[data-presentation-row]");
        if (rows.length === 1) {
            ParfumAPI.toast("El producto debe conservar al menos un tamaño", "error");
            return;
        }
        button.closest("[data-presentation-row]").remove();
        updatePresentationSummary();
    });
    $("presentationRows").addEventListener("input", updatePresentationSummary);
    $("presentationRows").addEventListener("change", updatePresentationSummary);

    $("productForm").addEventListener("submit", async event => {
        event.preventDefault();
        const message = $("productMessage");
        const submit = event.currentTarget.querySelector('button[type="submit"]');
        submit.disabled = true;
        message.textContent = "Guardando…";
        message.className = "form-message";

        try {
            const file = $("productImageFile").files[0];
            if (file) {
                message.textContent = "Subiendo imagen a Cloudinary…";
                const form = new FormData();
                form.append("file", file);
                const uploaded = await ParfumAPI.request("/imagenes/upload", {method:"POST", body:form});
                $("productImageUrl").value = uploaded.url;
                $("productImagePublicId").value = uploaded.publicId;
            }

            const body = productRequestBody();
            const id = $("productId").value;
            const saved = await ParfumAPI.request(id ? `/productos/${id}` : "/productos", {
                method:id ? "PUT" : "POST",
                body
            });

            if (originalImagePublicId && originalImagePublicId !== saved.imagenPublicId) {
                ParfumAPI.request(`/imagenes?publicId=${encodeURIComponent(originalImagePublicId)}`, {method:"DELETE"}).catch(() => {});
            }

            resetProduct();
            message.textContent = "Producto guardado correctamente";
            message.className = "form-message ok";
            await Promise.all([loadProducts(), loadSummary()]);
        } catch (error) {
            message.textContent = error.message;
            message.className = "form-message error";
        } finally {
            submit.disabled = false;
        }
    });

    const PAYMENT_STATUS_LABELS = {
        PENDIENTE_VERIFICACION:"Pendiente de verificación",
        CONFIRMADO:"Pago confirmado",
        RECHAZADO:"Pago rechazado",
        SOLICITAR_NUEVO_COMPROBANTE:"Solicitar nuevo comprobante"
    };

    const PAYMENT_METHOD_LABELS = {
        YAPE:"Yape",
        TRANSFERENCIA_BCP:"Transferencia BCP"
    };

    function orderCard(order) {
        const paymentStatus = order.estadoPago || "PENDIENTE_VERIFICACION";
        const details = (order.detalles || []).map(detail => `
            <li class="${detail.regalo ? "gift-order-line" : ""}">
                <span>${Number(detail.cantidad)} × ${esc(detail.nombreProducto)} ${detail.regalo ? '<em><i class="fa-solid fa-gift"></i> REGALO</em>' : ""}</span>
                <small>${esc(detail.presentacion || (detail.mililitros ? `${detail.mililitros} ml` : ""))}</small>
                <b>${detail.regalo ? "Gratis" : ParfumAPI.money(Number(detail.precioUnitario || 0) * Number(detail.cantidad || 0))}</b>
            </li>`).join("");
        return `
            <article class="admin-order-card" data-order-card="${order.id}">
                <header>
                    <div>
                        <p class="section-kicker">Pedido #${order.id}</p>
                        <h3>${esc(order.clienteNombre || order.usuarioNombre || 'Cliente')}</h3>
                        <span>${esc((order.clienteCorreo || (String(order.usuarioEmail || '').endsWith('@parfum.local') ? 'Sin correo' : order.usuarioEmail)) || 'Sin correo')} · ${esc(dateTime(order.creadoEn))}</span>
                        <span>${esc(order.clienteTelefono || 'Sin teléfono registrado')}</span>
                    </div>
                    <strong>${ParfumAPI.money(order.total)}</strong>
                </header>
                <div class="admin-order-grid">
                    <section>
                        <h4>Productos</h4>
                        <ul class="admin-order-products">${details}</ul>
                        <p class="admin-order-address"><i class="fa-solid fa-location-dot"></i> ${esc(order.direccionEntrega)}</p>
                    </section>
                    <section class="admin-payment-review">
                        <div class="admin-payment-head">
                            <div><small>Método</small><b>${esc(PAYMENT_METHOD_LABELS[order.metodoPago] || order.metodoPago || "—")}</b></div>
                            <div><small>Operación</small><b>${esc(order.numeroOperacion || "—")}</b></div>
                        </div>
                        ${order.comprobanteUrl ? `
                            <a class="admin-proof-preview" href="${esc(order.comprobanteUrl)}" target="_blank" rel="noopener">
                                <img src="${esc(order.comprobanteUrl)}" alt="Comprobante del pedido #${order.id}"/>
                                <span><i class="fa-solid fa-up-right-from-square"></i> Abrir comprobante</span>
                            </a>` : `<div class="admin-no-proof"><i class="fa-solid fa-triangle-exclamation"></i> Sin comprobante</div>`}
                        <div class="field">
                            <label>Estado del pago</label>
                            <select data-payment-status="${order.id}">
                                ${Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => `<option value="${value}" ${value === paymentStatus ? "selected" : ""}>${label}</option>`).join("")}
                            </select>
                        </div>
                        <div class="field">
                            <label>Observación para el cliente</label>
                            <textarea rows="2" data-payment-observation="${order.id}" placeholder="Ej. La captura no permite ver el número de operación">${esc(order.observacionPago || "")}</textarea>
                        </div>
                        <button class="secondary-btn" type="button" data-save-payment="${order.id}"><i class="fa-solid fa-check"></i> Guardar revisión</button>
                    </section>
                    <section class="admin-order-state">
                        <div class="field">
                            <label>Estado del pedido</label>
                            <select data-order-status="${order.id}">
                                ${["PENDIENTE","CONFIRMADO","PREPARANDO","ENVIADO","ENTREGADO","CANCELADO"].map(status => `<option ${status === order.estado ? "selected" : ""}>${status}</option>`).join("")}
                            </select>
                        </div>
                        <p><i class="fa-solid fa-lock"></i> Para preparar o enviar, primero confirma el pago.</p>
                        <button class="danger-btn" type="button" data-order-delete="${order.id}"><i class="fa-solid fa-trash-can"></i> Eliminar pedido</button>
                    </section>
                </div>
            </article>`;
    }

    async function loadOrders() {
        try {
            orders = await ParfumAPI.request("/pedidos");
            $("ordersTable").innerHTML = orders.length
                    ? `<div class="admin-orders-list">${orders.map(orderCard).join("")}</div>`
                    : `<div class="empty-state admin-empty"><i class="fa-regular fa-folder-open"></i><p>Todavía no hay pedidos.</p></div>`;
        } catch (error) {
            $("ordersTable").innerHTML = `<p>${esc(error.message)}</p>`;
        }
    }

    $("ordersTable").addEventListener("change", async event => {
        if (!event.target.matches("[data-order-status]")) return;
        const previous = orders.find(order => String(order.id) === event.target.dataset.orderStatus)?.estado;
        try {
            await ParfumAPI.request(`/pedidos/${event.target.dataset.orderStatus}/estado`, {
                method:"PATCH",
                body:{estado:event.target.value}
            });
            ParfumAPI.toast("Estado del pedido actualizado");
            await Promise.all([loadOrders(), loadSummary()]);
        } catch (error) {
            event.target.value = previous || "PENDIENTE";
            ParfumAPI.toast(error.message, "error");
        }
    });

    $("ordersTable").addEventListener("click", async event => {

        const deleteButton = event.target.closest("[data-order-delete]");
        if (deleteButton) {
            if (!confirm("¿Eliminar definitivamente este pedido?")) return;
            try {
                await ParfumAPI.request(`/pedidos/${deleteButton.dataset.orderDelete}`, {method:"DELETE"});
                ParfumAPI.toast("Pedido eliminado");
                await Promise.all([loadOrders(), loadSummary()]);
            } catch (error) {
                ParfumAPI.toast(error.message, "error");
            }
            return;
        }
        const button = event.target.closest("[data-save-payment]");
        if (!button) return;
        const id = button.dataset.savePayment;
        const card = button.closest("[data-order-card]");
        const status = card.querySelector(`[data-payment-status="${id}"]`).value;
        const observation = card.querySelector(`[data-payment-observation="${id}"]`).value.trim();
        button.disabled = true;
        try {
            await ParfumAPI.request(`/pedidos/${id}/pago`, {
                method:"PATCH",
                body:{estadoPago:status, observacion:observation || null}
            });
            ParfumAPI.toast("Revisión del pago guardada");
            await Promise.all([loadOrders(), loadSummary()]);
        } catch (error) {
            ParfumAPI.toast(error.message, "error");
        } finally {
            button.disabled = false;
        }
    });

    async function loadUsers() {
        try {
            users = await ParfumAPI.request("/admin/usuarios");
            $("usersTable").innerHTML = table(
                ["Usuario", "Contacto", "Rol", "Estado", "Acciones"],
                users.map(user => `<tr>
                    <td><b>${esc(`${user.nombre} ${user.apellido || ""}`)}</b></td>
                    <td>${esc(user.email)}<br><span class="muted">${esc(user.telefono || "Sin teléfono")}</span></td>
                    <td><select data-user-role="${user.id}"><option ${user.rol === "USER" ? "selected" : ""}>USER</option><option ${user.rol === "ADMIN" ? "selected" : ""}>ADMIN</option></select></td>
                    <td><span class="status-pill ${user.activo ? "active" : "inactive"}">${user.activo ? "Activo" : "Desactivado"}</span></td>
                    <td><button class="secondary-btn" data-user-active="${user.id}" data-next="${!user.activo}">${user.activo ? "Desactivar" : "Activar"}</button></td>
                </tr>`),
                "No hay usuarios registrados."
            );
        } catch (error) {
            $("usersTable").innerHTML = `<p>${esc(error.message)}</p>`;
        }
    }

    $("usersTable").addEventListener("change", async event => {
        if (!event.target.matches("[data-user-role]")) return;
        try {
            await ParfumAPI.request(`/admin/usuarios/${event.target.dataset.userRole}/rol`, {method:"PATCH", body:{rol:event.target.value}});
            ParfumAPI.toast("Rol actualizado");
        } catch (error) {
            ParfumAPI.toast(error.message, "error");
            loadUsers();
        }
    });

    $("usersTable").addEventListener("click", async event => {
        const button = event.target.closest("[data-user-active]");
        if (!button) return;
        try {
            await ParfumAPI.request(`/admin/usuarios/${button.dataset.userActive}/activo`, {method:"PATCH", body:{activo:button.dataset.next === "true"}});
            await Promise.all([loadUsers(), loadSummary()]);
        } catch (error) {
            ParfumAPI.toast(error.message, "error");
        }
    });

    async function loadMessages() {
        try {
            messages = await ParfumAPI.request("/contactos");
            $("messagesTable").innerHTML = table(
                ["Fecha", "Remitente", "Asunto y mensaje", "Estado", "Acciones"],
                messages.map(message => `<tr>
                    <td>${esc(dateTime(message.creadoEn))}</td>
                    <td><b>${esc(message.nombre)}</b><br><a class="admin-mail-link" href="mailto:${encodeURIComponent(message.correo)}">${esc(message.correo)}</a></td>
                    <td><b>${esc(message.asunto)}</b><p class="admin-message-copy">${esc(message.mensaje)}</p></td>
                    <td><select data-message-status="${message.id}">${["NUEVO","EN_PROCESO","RESPONDIDO"].map(status => `<option ${status === message.estado ? "selected" : ""}>${status}</option>`).join("")}</select></td>
                    <td class="admin-actions-cell"><a class="secondary-btn" href="mailto:${encodeURIComponent(message.correo)}?subject=${encodeURIComponent(`Respuesta Parfum: ${message.asunto}`)}">Responder</a><button class="danger-btn" data-message-delete="${message.id}">Eliminar</button></td>
                </tr>`),
                "No hay mensajes de contacto."
            );
        } catch (error) {
            $("messagesTable").innerHTML = `<p>${esc(error.message)}</p>`;
        }
    }

    $("messagesTable").addEventListener("change", async event => {
        if (!event.target.matches("[data-message-status]")) return;
        try {
            await ParfumAPI.request(`/contactos/${event.target.dataset.messageStatus}/estado`, {method:"PATCH", body:{estado:event.target.value}});
            ParfumAPI.toast("Mensaje actualizado");
            loadSummary();
        } catch (error) {
            ParfumAPI.toast(error.message, "error");
        }
    });

    $("messagesTable").addEventListener("click", async event => {
        const button = event.target.closest("[data-message-delete]");
        if (!button || !confirm("¿Eliminar definitivamente este mensaje?")) return;
        try {
            await ParfumAPI.request(`/contactos/${button.dataset.messageDelete}`, {method:"DELETE"});
            await Promise.all([loadMessages(), loadSummary()]);
            ParfumAPI.toast("Mensaje eliminado");
        } catch (error) {
            ParfumAPI.toast(error.message, "error");
        }
    });

    $("deleteAnsweredMessages")?.addEventListener("click", async () => {
        if (!confirm("¿Eliminar todos los mensajes marcados como RESPONDIDO? Esta acción no se puede deshacer.")) return;
        try {
            const result = await ParfumAPI.request("/contactos?estado=RESPONDIDO", {method:"DELETE"});
            await Promise.all([loadMessages(), loadSummary()]);
            ParfumAPI.toast(`${Number(result?.eliminados || 0)} mensaje(s) eliminado(s)`);
        } catch (error) {
            ParfumAPI.toast(error.message, "error");
        }
    });

    $("clearMessages")?.addEventListener("click", async () => {
        if (!confirm("¿Vaciar definitivamente toda la bandeja de mensajes? Esta acción no elimina usuarios ni pedidos.")) return;
        try {
            const result = await ParfumAPI.request("/contactos?all=true", {method:"DELETE"});
            await Promise.all([loadMessages(), loadSummary()]);
            ParfumAPI.toast(`${Number(result?.eliminados || 0)} mensaje(s) eliminado(s)`);
        } catch (error) {
            ParfumAPI.toast(error.message, "error");
        }
    });

    async function loadActivity() {
        try {
            activities = await ParfumAPI.request("/admin/actividad?limit=300");
            renderActivity();
        } catch (error) {
            $("activityTable").innerHTML = `<p>${esc(error.message)}</p>`;
        }
    }

    function renderActivity() {
        const type = $("activityTypeFilter").value;
        const search = $("activitySearch").value.trim().toLowerCase();
        const filtered = activities.filter(item => {
            if (type && item.tipo !== type) return false;
            const text = `${item.pagina || ""} ${item.ruta || ""} ${item.productoNombre || ""} ${item.usuarioEmail || ""} ${item.detalle || ""}`.toLowerCase();
            return !search || text.includes(search);
        });
        $("activityTable").innerHTML = table(
            ["Fecha", "Actividad", "Página / producto", "Visitante", "Dispositivo", "Acciones"],
            filtered.map(item => `<tr>
                <td>${esc(dateTime(item.creadoEn))}</td>
                <td><span class="activity-type"><i class="${ACTIVITY_ICONS[item.tipo] || ACTIVITY_ICONS.OTHER}"></i>${esc(activityTitle(item))}</span></td>
                <td><b>${esc(item.productoNombre || item.pagina || "—")}</b><br><span class="muted">${esc(item.detalle || item.ruta || "")}</span></td>
                <td>${item.usuarioEmail ? `<b>${esc(item.usuarioEmail)}</b>` : '<span class="muted">Anónimo</span>'}<br><small class="muted">${esc(item.sessionId ? item.sessionId.slice(0, 12) : "Sin sesión")}</small></td>
                <td>${esc(item.dispositivo || "—")}</td>
                <td><button class="danger-btn" type="button" data-activity-delete="${esc(item.id)}"><i class="fa-solid fa-trash-can"></i> Eliminar</button></td>
            </tr>`),
            "Aún no hay actividad registrada."
        );
    }

    $("activityTypeFilter").addEventListener("change", renderActivity);
    $("activitySearch").addEventListener("input", renderActivity);
    $("refreshActivity").addEventListener("click", async () => {
        await Promise.all([loadActivity(), loadSummary()]);
        ParfumAPI.toast("Actividad actualizada");
    });

    $("activityTable").addEventListener("click", async event => {
        const button = event.target.closest("[data-activity-delete]");
        if (!button || !confirm("¿Eliminar este registro de actividad?")) return;
        try {
            await ParfumAPI.request(`/admin/actividad/${encodeURIComponent(button.dataset.activityDelete)}`, {method:"DELETE"});
            await Promise.all([loadActivity(), loadSummary()]);
            ParfumAPI.toast("Registro de actividad eliminado");
        } catch (error) {
            ParfumAPI.toast(error.message, "error");
        }
    });

    $("deleteOldActivity")?.addEventListener("click", async () => {
        if (!confirm("¿Eliminar toda la actividad con más de 30 días?")) return;
        try {
            const result = await ParfumAPI.request("/admin/actividad?olderThanDays=30", {method:"DELETE"});
            await Promise.all([loadActivity(), loadSummary()]);
            ParfumAPI.toast(`${Number(result?.eliminados || 0)} registro(s) antiguo(s) eliminado(s)`);
        } catch (error) {
            ParfumAPI.toast(error.message, "error");
        }
    });

    $("clearActivity")?.addEventListener("click", async () => {
        if (!confirm("¿Vaciar definitivamente toda la actividad del sitio? Esto no elimina usuarios, pedidos, productos ni mensajes.")) return;
        try {
            const result = await ParfumAPI.request("/admin/actividad?all=true", {method:"DELETE"});
            await Promise.all([loadActivity(), loadSummary()]);
            ParfumAPI.toast(`${Number(result?.eliminados || 0)} registro(s) eliminado(s)`);
        } catch (error) {
            ParfumAPI.toast(error.message, "error");
        }
    });

    resetDecantForm();
    loadDecantContainers().finally(() => resetProduct());
    loadSummary();
})();
