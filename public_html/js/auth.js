(() => {
    "use strict";

    // Despierta Render apenas se abre login/registro para reducir el primer intento fallido.
    ParfumAPI.wakeServer?.();

    if (ParfumAPI.isLogged()) {
        location.href = ParfumAPI.isAdmin() ? "admin.html" : "perfil.html";
        return;
    }

    const show = (id, message, type = "error") => {
        const element = document.getElementById(id);
        if (!element) return;
        element.textContent = message;
        element.className = `form-message ${type}`;
    };

    async function requestWithColdStart(path, options, messageId) {
        let lastError;
        for (let attempt = 0; attempt < 4; attempt++) {
            try {
                return await ParfumAPI.request(path, options);
            } catch (error) {
                lastError = error;
                if (!ParfumAPI.isWakeError?.(error) || attempt === 3) throw error;
                show(messageId, `Render está despertando… reintentando conexión (${attempt + 1}/3).`, "ok");
                await ParfumAPI.sleep?.(12000);
            }
        }
        throw lastError;
    }

    document.getElementById("loginForm")?.addEventListener("submit", async event => {
        event.preventDefault();
        const button = event.currentTarget.querySelector('button[type="submit"]');
        button.disabled = true;
        button.textContent = "Ingresando…";
        show("formMessage", "");

        try {
            const response = await requestWithColdStart("/auth/login", {
                method:"POST",
                auth:false,
                body:{
                    email:document.getElementById("email").value,
                    password:document.getElementById("password").value
                }
            }, "formMessage");
            ParfumAPI.setSession(response);
            await window.ParfumActivity?.track("LOGIN", {detalle:`Inicio de sesión: ${response.usuario.email}`});
            await ParfumStore.syncGuest();
            show("formMessage", "Sesión iniciada", "ok");
            const next = sessionStorage.getItem("parfum_after_login");
            sessionStorage.removeItem("parfum_after_login");
            location.href = next || (response.usuario.rol === "ADMIN" ? "admin.html" : "index.html");
        } catch (error) {
            show("formMessage", error.message);
        } finally {
            button.disabled = false;
            button.textContent = "Ingresar";
        }
    });

    document.getElementById("registerForm")?.addEventListener("submit", async event => {
        event.preventDefault();
        const button = event.currentTarget.querySelector('button[type="submit"]');
        button.disabled = true;
        button.textContent = "Creando cuenta…";
        show("formMessage", "");

        try {
            const response = await requestWithColdStart("/auth/register", {
                method:"POST",
                auth:false,
                body:{
                    nombre:document.getElementById("name").value,
                    apellido:document.getElementById("lastName").value,
                    email:document.getElementById("email").value,
                    telefono:document.getElementById("phone").value,
                    password:document.getElementById("password").value
                }
            }, "formMessage");
            ParfumAPI.setSession(response);
            await window.ParfumActivity?.track("REGISTER", {detalle:`Registro: ${response.usuario.email}`});
            await ParfumStore.syncGuest();
            show("formMessage", "Cuenta creada", "ok");
            location.href = "index.html";
        } catch (error) {
            show("formMessage", error.message);
        } finally {
            button.disabled = false;
            button.textContent = "Crear cuenta";
        }
    });
})();
