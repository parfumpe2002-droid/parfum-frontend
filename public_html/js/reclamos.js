(() => {
    "use strict";
    const form = document.getElementById("claimsForm");
    const output = document.getElementById("claimsMessage");
    if (!form || !output) return;

    form.addEventListener("submit", async event => {
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        output.textContent = "Registrando tu solicitud…";
        output.className = "form-message";
        try {
            const result = await ParfumAPI.request("/reclamos", {
                method:"POST",
                auth:false,
                body:{
                    tipo:document.getElementById("claimType").value,
                    nombre:document.getElementById("claimName").value.trim(),
                    documento:document.getElementById("claimDocument").value.trim(),
                    correo:document.getElementById("claimEmail").value.trim(),
                    telefono:document.getElementById("claimPhone").value.trim(),
                    pedidoReferencia:document.getElementById("claimOrder").value.trim() || null,
                    detalle:document.getElementById("claimDetail").value.trim(),
                    pedidoConsumidor:document.getElementById("claimRequest").value.trim()
                }
            });
            output.textContent = `Registro recibido. Código: ${result.id}. Conserva este código para seguimiento.`;
            output.className = "form-message ok";
            form.reset();
        } catch (error) {
            output.textContent = error.message || "No pudimos registrar tu solicitud.";
            output.className = "form-message error";
        } finally {
            button.disabled = false;
        }
    });
})();
