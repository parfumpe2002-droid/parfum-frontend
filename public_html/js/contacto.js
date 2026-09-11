(() => {
    "use strict";

    const user = ParfumAPI.getUser();
    if (user) {
        document.getElementById("name").value = user.nombre || "";
        document.getElementById("email").value = user.email || "";
    }

    document.getElementById("contactForm").addEventListener("submit", async event => {
        event.preventDefault();
        const output = document.getElementById("contactMessage");
        const button = event.currentTarget.querySelector("button");
        button.disabled = true;
        button.textContent = "Enviando…";

        try {
            const subject = document.getElementById("subject").value;
            await ParfumAPI.request("/contactos", {
                method:"POST",
                auth:false,
                body:{
                    nombre:document.getElementById("name").value,
                    correo:document.getElementById("email").value,
                    asunto:subject,
                    mensaje:document.getElementById("message").value
                }
            });
            window.ParfumActivity?.track("CONTACT", {detalle:`Asunto: ${subject}`});
            output.textContent = "Mensaje enviado. Te responderemos pronto.";
            output.className = "form-message ok";
            event.currentTarget.reset();
            if (user) {
                document.getElementById("name").value = user.nombre || "";
                document.getElementById("email").value = user.email || "";
            }
        } catch (error) {
            output.textContent = error.message;
            output.className = "form-message error";
        } finally {
            button.disabled = false;
            button.textContent = "Enviar mensaje";
        }
    });
})();
