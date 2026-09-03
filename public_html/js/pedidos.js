(() => {
    "use strict";
    if (!ParfumAPI.requireLogin()) return;

    const box = document.getElementById("ordersList");
    const esc = ParfumAPI.escapeHtml;

    const PAYMENT_LABELS = {
        PENDIENTE_VERIFICACION: "Pago por verificar",
        CONFIRMADO: "Pago confirmado",
        RECHAZADO: "Pago rechazado",
        SOLICITAR_NUEVO_COMPROBANTE: "Nuevo comprobante requerido"
    };

    const METHOD_LABELS = {
        YAPE: "Yape",
        TRANSFERENCIA_BCP: "Transferencia BCP"
    };

    function paymentBadge(status) {
        const normalized = status || "PENDIENTE_VERIFICACION";
        return `<span class="payment-status ${esc(normalized)}">${esc(PAYMENT_LABELS[normalized] || normalized)}</span>`;
    }

    function canReplaceProof(order) {
        return ["RECHAZADO", "SOLICITAR_NUEVO_COMPROBANTE"].includes(order.estadoPago)
                && !["ENTREGADO", "CANCELADO"].includes(order.estado);
    }

    function renderOrder(order) {
        const observation = order.observacionPago
                ? `<div class="payment-observation"><i class="fa-solid fa-comment-dots"></i><div><b>Observación de pago</b><p>${esc(order.observacionPago)}</p></div></div>`
                : "";
        const replacement = canReplaceProof(order) ? `
            <form class="replace-proof-form" data-proof-form="${order.id}">
                <div class="field"><label>Nueva operación</label><input name="numeroOperacion" maxlength="80" required value="${esc(order.numeroOperacion || "")}"/></div>
                <div class="field"><label>Nuevo comprobante</label><input name="file" type="file" accept="image/jpeg,image/png,image/webp" required/></div>
                <button class="secondary-btn" type="submit"><i class="fa-solid fa-cloud-arrow-up"></i> Enviar nuevamente</button>
                <p class="form-message" data-proof-message></p>
            </form>` : "";

        return `
            <article class="order-card">
                <header class="order-head">
                    <div>
                        <b>Pedido #${order.id}</b>
                        <p class="muted">${new Date(order.creadoEn).toLocaleString("es-PE")}</p>
                    </div>
                    <div class="order-status-stack">
                        <span class="badge ${esc(order.estado)}">${esc(order.estado)}</span>
                        ${paymentBadge(order.estadoPago)}
                        <strong>${ParfumAPI.money(order.total)}</strong>
                    </div>
                </header>
                <div class="order-body">
                    <div class="order-products-list">
                        ${(order.detalles || []).map(detail => `
                            <div class="order-product ${detail.regalo ? "gift-order-product" : ""}">
                                <span>${Number(detail.cantidad)} × ${esc(detail.nombreProducto)}
                                    ${detail.regalo ? '<em><i class="fa-solid fa-gift"></i> Regalo</em>' : ""}
                                    <small class="order-size">${esc(detail.presentacion || (detail.mililitros ? `${detail.mililitros} ml` : ""))}</small>
                                </span>
                                <b>${detail.regalo ? "Gratis" : ParfumAPI.money(Number(detail.precioUnitario) * Number(detail.cantidad))}</b>
                            </div>`).join("")}
                    </div>
                    <div class="order-payment-summary">
                        <div><span>Método</span><b>${esc(METHOD_LABELS[order.metodoPago] || order.metodoPago)}</b></div>
                        <div><span>Operación</span><b>${esc(order.numeroOperacion || "—")}</b></div>
                        <div><span>Entrega</span><b>${esc(order.direccionEntrega)}</b></div>
                        ${order.comprobanteUrl ? `<a class="secondary-btn proof-link" href="${esc(order.comprobanteUrl)}" target="_blank" rel="noopener"><i class="fa-solid fa-receipt"></i> Ver comprobante</a>` : ""}
                    </div>
                    ${observation}
                    ${replacement}
                </div>
            </article>`;
    }

    async function load() {
        box.innerHTML = '<div class="status-line"><span class="spinner"></span> Cargando pedidos…</div>';
        try {
            const orders = await ParfumAPI.request("/pedidos/me");
            box.innerHTML = orders.length
                    ? orders.map(renderOrder).join("")
                    : `<div class="empty-state"><i class="fa-solid fa-box-open"></i><h3>Aún no tienes pedidos</h3><a class="primary-btn" href="productos.html">Comprar perfumes</a></div>`;
        } catch (error) {
            box.innerHTML = `<div class="empty-state"><p>${esc(error.message)}</p></div>`;
        }
    }

    box.addEventListener("submit", async event => {
        const form = event.target.closest("[data-proof-form]");
        if (!form) return;
        event.preventDefault();
        const message = form.querySelector("[data-proof-message]");
        const file = form.elements.file.files[0];
        const operation = form.elements.numeroOperacion.value.trim();
        const button = form.querySelector('button[type="submit"]');

        if (!file || !operation) return;
        if (file.size > 8 * 1024 * 1024) {
            message.textContent = "El comprobante no puede superar 8 MB";
            message.className = "form-message error";
            return;
        }

        button.disabled = true;
        message.textContent = "Subiendo nuevo comprobante…";
        message.className = "form-message";
        try {
            const body = new FormData();
            body.append("file", file);
            body.append("numeroOperacion", operation);
            await ParfumAPI.request(`/pedidos/${form.dataset.proofForm}/comprobante`, {
                method: "POST",
                body,
                timeout: 90000
            });
            ParfumAPI.toast("Comprobante enviado para nueva verificación");
            await load();
        } catch (error) {
            message.textContent = error.message;
            message.className = "form-message error";
        } finally {
            button.disabled = false;
        }
    });

    load();
})();
