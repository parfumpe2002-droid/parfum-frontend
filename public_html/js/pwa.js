(() => {
    "use strict";

    let deferredInstallPrompt = null;
    let registration = null;
    let refreshing = false;

    const ensureNoticeHost = () => {
        let host = document.getElementById("appNotices");
        if (!host) {
            host = document.createElement("div");
            host.id = "appNotices";
            host.className = "app-notices";
            document.body.appendChild(host);
        }
        return host;
    };

    const removeNotice = type => document.querySelector(`[data-app-notice="${type}"]`)?.remove();

    function showInstallNotice() {
        if (!deferredInstallPrompt || window.matchMedia("(display-mode: standalone)").matches) return;
        const host = ensureNoticeHost();
        if (host.querySelector('[data-app-notice="install"]')) return;
        host.insertAdjacentHTML("beforeend", `
            <aside class="app-notice install-notice" data-app-notice="install" role="status">
                <img src="icons/icon-72.png" alt="" width="48" height="48">
                <div><b>Instala Parfum</b><span>Accede más rápido desde tu celular o computadora.</span></div>
                <button class="notice-primary" type="button" data-install-app>Instalar</button>
                <button class="notice-close" type="button" data-notice-close="install" aria-label="Cerrar"><i class="fa-solid fa-xmark"></i></button>
            </aside>`);
    }

    function showIosInstallNotice() {
        const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
        const standalone = window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
        if (!isIos || standalone || localStorage.getItem("parfum_ios_install_tip") === "dismissed") return;
        const host = ensureNoticeHost();
        if (host.querySelector('[data-app-notice="ios"]')) return;
        host.insertAdjacentHTML("beforeend", `
            <aside class="app-notice install-notice" data-app-notice="ios" role="status">
                <img src="icons/icon-72.png" alt="" width="48" height="48">
                <div><b>Agrega Parfum a tu iPhone</b><span>Pulsa Compartir y luego “Agregar a pantalla de inicio”.</span></div>
                <button class="notice-primary" type="button" data-notice-close="ios">Entendido</button>
            </aside>`);
    }

    function showUpdateNotice(worker) {
        const host = ensureNoticeHost();
        removeNotice("update");
        host.insertAdjacentHTML("beforeend", `
            <aside class="app-notice update-notice" data-app-notice="update" role="status">
                <span class="notice-icon"><i class="fa-solid fa-arrows-rotate"></i></span>
                <div><b>Nueva versión disponible</b><span>Actualiza para obtener los últimos cambios de Parfum.</span></div>
                <button class="notice-primary" type="button" data-pwa-update>Actualizar</button>
                <button class="notice-close" type="button" data-notice-close="update" aria-label="Cerrar"><i class="fa-solid fa-xmark"></i></button>
            </aside>`);
        host.querySelector("[data-pwa-update]")?.addEventListener("click", () => {
            worker?.postMessage({type:"SKIP_WAITING"});
        });
    }

    async function promptInstall() {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice.catch(() => null);
        deferredInstallPrompt = null;
        removeNotice("install");
        document.querySelectorAll("[data-install-app]").forEach(button => button.hidden = true);
    }

    function syncInstallButtons() {
        const visible = Boolean(deferredInstallPrompt) && !window.matchMedia("(display-mode: standalone)").matches;
        document.querySelectorAll("[data-install-app]").forEach(button => {
            button.hidden = !visible;
        });
        if (visible) showInstallNotice();
    }

    window.addEventListener("beforeinstallprompt", event => {
        event.preventDefault();
        deferredInstallPrompt = event;
        syncInstallButtons();
    });

    window.addEventListener("appinstalled", () => {
        deferredInstallPrompt = null;
        removeNotice("install");
        document.querySelectorAll("[data-install-app]").forEach(button => button.hidden = true);
    });

    document.addEventListener("click", event => {
        const close = event.target.closest("[data-notice-close]");
        if (close) {
            if (close.dataset.noticeClose === "ios") localStorage.setItem("parfum_ios_install_tip", "dismissed");
            removeNotice(close.dataset.noticeClose);
        }
        if (event.target.closest("[data-install-app]")) promptInstall();
    });

    async function registerServiceWorker() {
        if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
        try {
            registration = await navigator.serviceWorker.register("/service-worker.js", {scope:"/", updateViaCache:"none"});
            if (registration.waiting) showUpdateNotice(registration.waiting);
            registration.addEventListener("updatefound", () => {
                const worker = registration.installing;
                worker?.addEventListener("statechange", () => {
                    if (worker.state === "installed" && navigator.serviceWorker.controller) showUpdateNotice(worker);
                });
            });
            setTimeout(() => registration.update().catch(() => {}), 3000);
            setInterval(() => registration?.update().catch(() => {}), 60 * 60 * 1000);
        } catch (error) {
            console.warn("No se pudo registrar la aplicación Parfum:", error);
        }
    }

    navigator.serviceWorker?.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        location.reload();
    });

    window.ParfumPWA = {promptInstall, syncInstallButtons};
    window.addEventListener("DOMContentLoaded", () => {
        syncInstallButtons();
        showIosInstallNotice();
        registerServiceWorker();
    });
})();
