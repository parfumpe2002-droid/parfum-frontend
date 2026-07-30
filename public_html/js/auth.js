(() => {
    "use strict";

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

    document.getElementById("loginForm")?.addEventListener("submit", async event => {
        event.preventDefault();
        const button = event.currentTarget.querySelector('button[type="submit"]');
        button.disabled = true;
        button.textContent = "Ingresando…";
        show("formMessage", "");

        try {
            const response = await ParfumAPI.request("/auth/login", {
                method:"POST",
                auth:false,
                body:{
                    email:document.getElementById("email").value,
                    password:document.getElementById("password").value
                }
            });
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
            const response = await ParfumAPI.request("/auth/register", {
                method:"POST",
                auth:false,
                body:{
                    nombre:document.getElementById("name").value,
                    apellido:document.getElementById("lastName").value,
                    email:document.getElementById("email").value,
                    telefono:document.getElementById("phone").value,
                    password:document.getElementById("password").value
                }
            });
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
