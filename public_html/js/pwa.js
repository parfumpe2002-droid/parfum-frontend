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

    function base64UrlToUint8Array(value) {
        const padding = "=".repeat((4 - value.length % 4) % 4);
        const base64 = (value + padding).replaceAll("-", "+").replaceAll("_", "/");
        const raw = atob(base64);
        return Uint8Array.from([...raw].map(char => char.charCodeAt(0)));
    }

    function pushContext() {
        const admin = ParfumAPI?.isAdmin?.() === true;
        return {
            mode: admin ? "admin" : "client",
            url: admin ? "/admin.html#orders" : "/pedidos.html"
        };
    }

    async function getServiceWorkerRegistration() {
        if (registration) return registration;
        if (!("serviceWorker" in navigator)) return null;
        return navigator.serviceWorker.ready;
    }

    async function syncPushContext() {
        try {
            const current = await getServiceWorkerRegistration();
            const worker = navigator.serviceWorker.controller || current?.active || current?.waiting;
            worker?.postMessage({type:"CONFIG_PUSH_CONTEXT", context:pushContext()});
        } catch (error) {
            console.warn("No se pudo sincronizar el contexto de notificaciones:", error);
        }
    }

    async function registerPushSubscription(subscription) {
        if (!subscription?.endpoint || !ParfumAPI?.isLogged?.()) return false;
        try {
            await ParfumAPI.request("/notificaciones/suscribir", {
                method:"POST",
                body:{endpoint:subscription.endpoint}
            });
            return true;
        } catch (error) {
            console.warn("No se pudo registrar la suscripción Push:", error);
            return false;
        }
    }

    async function createOrSyncPushSubscription() {
        if (!ParfumAPI?.isLogged?.() || !("PushManager" in window)) return {active:false, configured:true};

        const config = await ParfumAPI.request("/notificaciones/clave-publica", {auth:false});
        if (!config?.enabled || !config?.publicKey) return {active:false, configured:false};

        const current = await getServiceWorkerRegistration();
        if (!current) return {active:false, configured:true};

        let subscription = await current.pushManager.getSubscription();
        if (!subscription) {
            subscription = await current.pushManager.subscribe({
                userVisibleOnly:true,
                applicationServerKey:base64UrlToUint8Array(config.publicKey)
            });
        }

        const active = await registerPushSubscription(subscription);
        if (active) await syncPushContext();
        return {active, configured:true};
    }

    async function unsubscribeNotificationsAccount() {
        if (!ParfumAPI?.isLogged?.() || !("serviceWorker" in navigator)) return;
        try {
            const current = await getServiceWorkerRegistration();
            const subscription = await current?.pushManager?.getSubscription();
            if (!subscription?.endpoint) return;
            await ParfumAPI.request("/notificaciones/suscribir", {
                method:"DELETE",
                body:{endpoint:subscription.endpoint}
            });
        } catch (error) {
            console.warn("No se pudo desvincular la suscripción Push:", error);
        }
    }

    async function showLocalNotification(title, body, url) {
        if (!("Notification" in window) || Notification.permission !== "granted") return;
        const current = await getServiceWorkerRegistration();
        await current?.showNotification(title, {
            body,
            icon:"/icons/icon-192.png",
            badge:"/icons/icon-72.png",
            tag:`parfum-${url}`,
            renotify:true,
            data:{url},
            vibrate:[140, 70, 140]
        });
    }

    async function requestNotifications(statusElement = null) {
        if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
            if (statusElement) statusElement.textContent = "Este navegador no admite notificaciones.";
            ParfumAPI?.toast?.("Este navegador no admite notificaciones", "error");
            return false;
        }
        if (!ParfumAPI?.isLogged?.()) return false;

        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
            if (statusElement) statusElement.textContent = "Los avisos están desactivados en este navegador.";
            ParfumAPI?.toast?.("Permiso de notificaciones no concedido", "error");
            return false;
        }

        try {
            const result = await createOrSyncPushSubscription();
            if (!result.configured) {
                if (statusElement) statusElement.textContent = "Configuración pendiente: faltan las claves Push en el servidor.";
                ParfumAPI?.toast?.("Configuración de notificaciones pendiente", "error");
                return false;
            }
            if (!result.active) throw new Error("No se pudo registrar este dispositivo");

            const context = pushContext();
            if (statusElement) {
                statusElement.textContent = context.mode === "admin"
                    ? "Avisos activos en este dispositivo. Te notificaremos cuando entre un pedido nuevo."
                    : "Avisos activos. Te notificaremos cuando cambie el estado de tus pedidos.";
            }
            await showLocalNotification(
                "Avisos activados",
                context.mode === "admin"
                    ? "Te avisaremos cuando entre un pedido nuevo en Parfum."
                    : "Parfum te avisará cuando cambie el estado de tu pedido.",
                context.url
            );
            return true;
        } catch (error) {
            if (statusElement) statusElement.textContent = error.message || "No se pudieron activar los avisos.";
            ParfumAPI?.toast?.(error.message || "No se pudieron activar los avisos", "error");
            return false;
        }
    }

    function insertNotificationActivator() {
        if (!ParfumAPI?.isLogged?.() || !("Notification" in window)) return;
        const adminPage = document.body?.dataset?.page === "admin" && ParfumAPI.isAdmin();
        const ordersPage = document.body?.dataset?.page === "pedidos" && !ParfumAPI.isAdmin();
        if (!adminPage && !ordersPage) return;
        if (document.getElementById("parfumNotificationCard")) return;

        const anchor = adminPage
            ? document.querySelector("#orders .admin-section-heading")
            : document.querySelector(".page-hero");
        if (!anchor) return;

        const card = document.createElement("section");
        card.id = "parfumNotificationCard";
        card.className = "panel push-notification-card";
        const granted = Notification.permission === "granted";
        card.innerHTML = `
            <div class="push-notification-copy">
                <span class="push-notification-icon"><i class="fa-regular fa-bell"></i></span>
                <div>
                    <strong>${adminPage ? "Avisos de pedidos nuevos" : "Avisos de tus pedidos"}</strong>
                    <p data-push-status>${adminPage
                        ? (granted ? "El permiso ya está concedido. Sincroniza este dispositivo para recibir pedidos nuevos." : "Activa los avisos para enterarte cuando llegue una compra.")
                        : (granted ? "El permiso ya está concedido. Sincroniza este dispositivo para seguir recibiendo cambios." : "Activa los avisos para enterarte cuando cambie el estado de una compra.")}</p>
                </div>
            </div>
            <button class="secondary-btn" type="button" data-push-enable>
                <i class="fa-regular fa-bell"></i> ${granted ? "Sincronizar avisos" : "Activar avisos"}
            </button>`;

        const status = card.querySelector("[data-push-status]");
        card.querySelector("[data-push-enable]")?.addEventListener("click", async event => {
            const button = event.currentTarget;
            button.disabled = true;
            try {
                if (Notification.permission === "granted") {
                    const result = await createOrSyncPushSubscription();
                    if (!result.configured) {
                        status.textContent = "Configuración pendiente: faltan las claves Push en el servidor.";
                        return;
                    }
                    status.textContent = result.active
                        ? (adminPage ? "Avisos activos. Este dispositivo recibirá pedidos nuevos." : "Avisos activos para tus pedidos.")
                        : "No se pudo sincronizar este dispositivo.";
                } else {
                    await requestNotifications(status);
                }
            } finally {
                button.disabled = false;
                if (Notification.permission === "granted") button.innerHTML = '<i class="fa-solid fa-rotate"></i> Sincronizar avisos';
            }
        });

        if (adminPage) anchor.insertAdjacentElement("afterend", card);
        else {
            const main = document.querySelector("main");
            main?.insertAdjacentElement("afterbegin", card);
        }
    }

    async function syncExistingPushSubscription() {
        if (!ParfumAPI?.isLogged?.() || !("Notification" in window) || Notification.permission !== "granted") return;
        try {
            await createOrSyncPushSubscription();
            await syncPushContext();
        } catch (error) {
            console.warn("No se pudo sincronizar la suscripción existente:", error);
        }
    }

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
            await syncPushContext();
            setTimeout(syncExistingPushSubscription, 1200);
        } catch (error) {
            console.warn("No se pudo registrar la aplicación Parfum:", error);
        }
    }

    navigator.serviceWorker?.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        location.reload();
    });

    window.ParfumPWA = {
        promptInstall,
        syncInstallButtons,
        requestNotifications,
        createOrSyncPushSubscription,
        syncPushContext,
        unsubscribeNotificationsAccount
    };
    window.addEventListener("DOMContentLoaded", () => {
        syncInstallButtons();
        showIosInstallNotice();
        insertNotificationActivator();
        registerServiceWorker();
    });
})();
