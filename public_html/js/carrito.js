(() => {
    "use strict";

    const listElement = document.getElementById("cartList");
    const paymentSelect = document.getElementById("payment");
    const paymentInstructions = document.getElementById("paymentInstructions");
    const proofInput = document.getElementById("paymentProof");
    const proofPreview = document.getElementById("proofPreview");
    const proofPreviewImage = document.getElementById("proofPreviewImage");
    const proofFileName = document.getElementById("proofFileName");
    const checkoutButton = document.getElementById("checkoutButton");
    const checkoutForm = document.getElementById("checkoutForm");
    const guestFields = document.getElementById("guestCheckoutFields");
    const phoneInput = document.getElementById("contactPhone");
    const giftBox = document.getElementById("decantGiftBox");
    const giftSelect = document.getElementById("giftArabicProduct");
    const giftPreview = document.getElementById("giftPreview");

    let items = [];
    let giftProducts = [];

    const keyOf = item => ParfumStore.cartKeyOf(item);

    const PAYMENT_DATA = Object.freeze({
        YAPE: {
            body: `
                <div class="payment-method-card yape-card">
                    <div class="payment-method-heading"><i class="fa-solid fa-mobile-screen-button"></i><div><b>Paga con Yape</b><small>Escanea el QR o usa el número.</small></div></div>
                    <img class="payment-qr" src="imagen/pagos/yape-william-lopez.png" alt="Código QR de Yape de William López"/>
                    <dl class="payment-data-list">
                        <div><dt>Número Yape</dt><dd><span>963 257 194</span><button type="button" data-copy="963257194" aria-label="Copiar número Yape"><i class="fa-regular fa-copy"></i></button></dd></div>
                        <div><dt>Titular</dt><dd><span>William López</span></dd></div>
                    </dl>
                </div>`
        },
        TRANSFERENCIA_BCP: {
            body: `
                <div class="payment-method-card bcp-card">
                    <div class="payment-method-heading"><i class="fa-solid fa-building-columns"></i><div><b>Transferencia BCP en soles</b><small>Transfiere el total exacto de tu pedido.</small></div></div>
                    <dl class="payment-data-list">
                        <div><dt>Cuenta BCP soles</dt><dd><span>19400163266014</span><button type="button" data-copy="19400163266014" aria-label="Copiar cuenta BCP"><i class="fa-regular fa-copy"></i></button></dd></div>
                        <div><dt>CCI</dt><dd><span>00219410016326601495</span><button type="button" data-copy="00219410016326601495" aria-label="Copiar CCI"><i class="fa-regular fa-copy"></i></button></dd></div>
                        <div><dt>Titular</dt><dd><span>William López</span></dd></div>
                    </dl>
                </div>`
        }
    });

    function renderPaymentInstructions() {
        paymentInstructions.innerHTML = (PAYMENT_DATA[paymentSelect.value] || PAYMENT_DATA.YAPE).body;
    }

    function updateGuestFields(logged) {
        guestFields.hidden = logged;
        document.getElementById("guestName").required = !logged;
        document.getElementById("guestEmail").required = false;
    }

    async function copyText(value) {
        try {
            await navigator.clipboard.writeText(value);
            ParfumAPI.toast("Dato copiado");
        } catch {
            const input = document.createElement("textarea");
            input.value = value;
            input.style.position = "fixed";
            input.style.opacity = "0";
            document.body.appendChild(input);
            input.select();
            document.execCommand("copy");
            input.remove();
            ParfumAPI.toast("Dato copiado");
        }
    }

    function decantUnits() {
        return items.filter(item => String(item.tipoItem || "BOTELLA").toUpperCase() === "DECANT")
            .reduce((sum, item) => sum + Number(item.cantidad || 0), 0);
    }

    function itemImage(item) {
        return item.imagenUrl || (String(item.tipoItem).toUpperCase() === "DECANT"
            ? "imagen/decants/decant-10ml-premium.png"
            : ParfumAPI.image(ParfumAPI.fallbackById(item.productoId || item.sku || item.slug)));
    }

    function renderGift() {
        const eligible = decantUnits() >= 3;
        giftBox.hidden = !eligible;
        if (!eligible) {
            giftSelect.value = "";
            giftPreview.innerHTML = "";
            return;
        }
        if (!giftProducts.length) {
            giftSelect.innerHTML = '<option value="">Aún no hay decants árabes de 3 ml con stock</option>';
            giftSelect.disabled = true;
            giftPreview.innerHTML = '<p class="muted">El regalo se habilitará cuando el administrador configure stock de 3 ml en los perfumes árabes.</p>';
            return;
        }
        const previous = giftSelect.value;
        giftSelect.disabled = false;
        giftSelect.innerHTML = '<option value="">Selecciona tu regalo</option>' + giftProducts.map(product =>
            `<option value="${Number(product.id)}">${ParfumAPI.escapeHtml(product.nombre)} · ${ParfumAPI.escapeHtml(product.marca)}</option>`).join("");
        if (giftProducts.some(product => String(product.id) === previous)) giftSelect.value = previous;
        renderGiftPreview();
    }

    function renderGiftPreview() {
        const product = giftProducts.find(item => String(item.id) === String(giftSelect.value));
        giftPreview.innerHTML = product ? `
            <img src="imagen/decants/decant-3ml.png" alt="Decant de 3 ml de ${ParfumAPI.escapeHtml(product.nombre)}">
            <div><b>${ParfumAPI.escapeHtml(product.nombre)}</b><small>${ParfumAPI.escapeHtml(product.marca)} · Decant 3 ml gratis</small></div>` : "";
    }

    async function loadGiftProducts() {
        try {
            giftProducts = await ParfumAPI.request("/decants/regalos-arabes", {auth:false});
        } catch {
            giftProducts = [];
        }
        renderGift();
    }

    function render() {
        const total = items.reduce((sum, item) => sum + Number(item.precio || 0) * Number(item.cantidad || 0), 0);
        document.getElementById("subtotal").textContent = ParfumAPI.money(total);
        document.getElementById("total").textContent = ParfumAPI.money(total);
        listElement.innerHTML = items.length ? `
            <div class="cart-list-panel">
                <div class="cart-list-heading"><div><p class="section-kicker">Tu selección</p><h2>${items.length} ${items.length === 1 ? "producto" : "productos"}</h2></div><a href="productos.html" class="text-button">Seguir comprando</a></div>
                ${items.map(item => {
                    const type = String(item.tipoItem || "BOTELLA").toUpperCase();
                    return `<article class="cart-item" data-key="${ParfumAPI.escapeHtml(keyOf(item))}">
                        <img src="${ParfumAPI.escapeHtml(itemImage(item))}" alt="${ParfumAPI.escapeHtml(item.nombre)}">
                        <div class="cart-item-info">
                            <div class="cart-type-row"><span class="tag ${type === "DECANT" ? "decant-tag" : ""}">${type === "DECANT" ? "DECANT" : "BOTELLA"}</span></div>
                            <h3>${ParfumAPI.escapeHtml(item.nombre)}</h3>
                            <p class="muted">${ParfumAPI.escapeHtml(item.marca || "Parfum")}</p>
                            <span class="cart-presentation"><i class="fa-solid ${type === "DECANT" ? "fa-vial" : "fa-bottle-droplet"}"></i> ${ParfumAPI.escapeHtml(item.presentacion || (item.mililitros ? `${item.mililitros} ml` : "Presentación estándar"))}</span>
                            <strong>${ParfumAPI.escapeHtml(ParfumAPI.priceLabel(item.precio))}</strong>
                        </div>
                        <div class="cart-item-actions">
                            <div class="quantity">
                                <button data-action="minus" aria-label="Disminuir cantidad">−</button>
                                <input value="${Number(item.cantidad || 1)}" readonly aria-label="Cantidad">
                                <button data-action="plus" aria-label="Aumentar cantidad">+</button>
                            </div>
                            <button class="danger-btn" data-action="remove">Eliminar</button>
                        </div>
                    </article>`;
                }).join("")}
            </div>` : `
            <div class="empty-state cart-empty-state">
                <i class="fa-solid fa-bag-shopping"></i>
                <h3>Tu carrito está vacío</h3>
                <p>Agrega una botella o pide cualquier perfume en decant.</p>
                <a class="primary-btn" href="productos.html">Ver perfumes</a>
            </div>`;
        renderGift();
    }

    async function load() {
        items = await ParfumStore.cart();
        render();
        renderPaymentInstructions();
        updateGuestFields(ParfumAPI.isLogged());
        await loadGiftProducts();
        if (ParfumAPI.isLogged()) {
            try {
                const user = await ParfumAPI.request("/usuarios/me");
                document.getElementById("deliveryAddress").value = user.direccion || "";
                phoneInput.value = user.telefono || "";
            } catch {}
        }
    }

    listElement.addEventListener("click", async event => {
        const button = event.target.closest("[data-action]");
        if (!button) return;
        const card = button.closest(".cart-item");
        const item = items.find(entry => keyOf(entry) === card.dataset.key);
        if (!item) return;
        try {
            if (button.dataset.action === "remove") {
                await ParfumStore.removeCart(item);
                items = items.filter(entry => keyOf(entry) !== card.dataset.key);
            } else {
                const quantity = Math.max(1, Number(item.cantidad) + (button.dataset.action === "plus" ? 1 : -1));
                await ParfumStore.updateCart(item, quantity);
                item.cantidad = quantity;
            }
            render();
        } catch (error) {
            ParfumAPI.toast(error.message, "error");
        }
    });

    paymentSelect.addEventListener("change", renderPaymentInstructions);
    giftSelect.addEventListener("change", renderGiftPreview);
    paymentInstructions.addEventListener("click", event => {
        const button = event.target.closest("[data-copy]");
        if (button) copyText(button.dataset.copy);
    });

    proofInput.addEventListener("change", () => {
        const file = proofInput.files[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            proofInput.value = "";
            ParfumAPI.toast("Selecciona una imagen válida", "error");
            return;
        }
        if (file.size > 8 * 1024 * 1024) {
            proofInput.value = "";
            ParfumAPI.toast("El comprobante no puede superar 8 MB", "error");
            return;
        }
        proofFileName.textContent = file.name;
        proofPreviewImage.src = URL.createObjectURL(file);
        proofPreview.hidden = false;
    });

    document.getElementById("removeProof").addEventListener("click", () => {
        if (proofPreviewImage.src?.startsWith("blob:")) URL.revokeObjectURL(proofPreviewImage.src);
        proofInput.value = "";
        proofPreviewImage.removeAttribute("src");
        proofPreview.hidden = true;
        proofFileName.textContent = "Seleccionar captura (opcional)";
    });

    checkoutForm.addEventListener("submit", async event => {
        event.preventDefault();
        const message = document.getElementById("checkoutMessage");
        const proof = proofInput.files[0];
        const operationNumber = document.getElementById("operationNumber").value.trim();
        const deliveryAddress = document.getElementById("deliveryAddress").value.trim();
        const logged = ParfumAPI.isLogged();

        if (!items.length) return showError(message, "Agrega productos al carrito");
        if (items.some(item => !/^\d+$/.test(String(item.productoId ?? "")))) {
            return showError(message, "El catálogo todavía se está actualizando. Recarga la página antes de finalizar el pedido.");
        }
        if (!deliveryAddress) return showError(message, "Ingresa la dirección de entrega");
        if (!phoneInput.value.trim()) {
            showError(message, "Ingresa un número de celular para coordinar el pedido");
            phoneInput.focus();
            return;
        }
        if (decantUnits() >= 3 && giftProducts.length && !giftSelect.value) {
            showError(message, "Elige tu decant árabe gratuito de 3 ml");
            giftSelect.focus();
            return;
        }

        checkoutButton.disabled = true;
        checkoutButton.innerHTML = '<span class="spinner"></span> Registrando pedido…';
        message.textContent = proof ? "Subiendo comprobante de pago…" : "Creando tu pedido…";
        message.className = "form-message";

        try {
            let uploaded = {url:null, publicId:null};
            if (proof) {
                const proofForm = new FormData();
                proofForm.append("file", proof);
                uploaded = await ParfumAPI.request("/pedidos/comprobante", {
                    method:"POST", body:proofForm, auth:logged, timeout:90000
                });
            }

            const order = await ParfumAPI.request("/pedidos", {
                method:"POST",
                auth:logged,
                body:{
                    items:items.map(item => ({
                        productoId:Number(item.productoId),
                        presentacionId:String(item.tipoItem || "BOTELLA").toUpperCase() === "DECANT" ? null : (item.presentacionId == null ? null : Number(item.presentacionId)),
                        productoDecantId:String(item.tipoItem || "BOTELLA").toUpperCase() === "DECANT" ? Number(item.productoDecantId) : null,
                        tipoItem:String(item.tipoItem || "BOTELLA").toUpperCase(),
                        cantidad:Number(item.cantidad)
                    })),
                    regaloProductoId:giftSelect.value ? Number(giftSelect.value) : null,
                    metodoPago:paymentSelect.value,
                    numeroOperacion:operationNumber || null,
                    comprobanteUrl:uploaded.url,
                    comprobantePublicId:uploaded.publicId,
                    direccionEntrega:deliveryAddress,
                    nombreCliente:logged ? null : document.getElementById("guestName").value.trim(),
                    correoCliente:logged ? null : (document.getElementById("guestEmail").value.trim() || null),
                    telefonoContacto:phoneInput.value.trim()
                }
            });

            message.textContent = proof
                ? `Pedido #${order.id} registrado. El pago quedó pendiente de verificación.`
                : `Pedido #${order.id} registrado. El administrador te contactará para coordinar el pago.`;
            message.className = "form-message ok";
            window.ParfumActivity?.track("ORDER", {detalle:`Pedido #${order.id} · ${ParfumAPI.money(order.total)}`});
            items = [];
            render();
            ParfumStore.updateBadges();
            checkoutForm.reset();
            proofPreview.hidden = true;
            proofPreviewImage.removeAttribute("src");
            proofFileName.textContent = "Seleccionar captura (opcional)";
            setTimeout(() => location.href = logged ? "pedidos.html" : "index.html", 1400);
        } catch (error) {
            showError(message, error.message);
        } finally {
            checkoutButton.disabled = false;
            checkoutButton.innerHTML = '<i class="fa-solid fa-lock"></i> Registrar pedido';
        }
    });

    function showError(element, message) {
        element.textContent = message;
        element.className = "form-message error";
    }

    load().catch(error => {
        listElement.innerHTML = `<div class="empty-state"><p>${ParfumAPI.escapeHtml(error.message)}</p></div>`;
    });
})();
