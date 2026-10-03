(() => {
    "use strict";

    const SESSION_KEY = "parfum_visitor_session_v1";
    const CONSENT_KEY = "parfum_privacy_consent_v1";

    function analyticsAllowed() {
        try {
            const consent = JSON.parse(localStorage.getItem(CONSENT_KEY) || "null");
            return consent?.analytics === true;
        } catch {
            return false;
        }
    }

    function createSessionId() {
        if (window.crypto?.randomUUID) return window.crypto.randomUUID();
        return `pv-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    }

    function getSessionId() {
        if (!analyticsAllowed()) return null;
        let id = localStorage.getItem(SESSION_KEY);
        if (!id) {
            id = createSessionId();
            localStorage.setItem(SESSION_KEY, id);
        }
        return id;
    }

    function deviceType() {
        const width = window.innerWidth;
        if (width <= 680) return "Móvil";
        if (width <= 1024) return "Tablet";
        return "Escritorio";
    }

    function cleanDetails(details = {}) {
        return {
            tipo: String(details.tipo || "OTHER").toUpperCase(),
            pagina: details.pagina || document.body.dataset.page || document.title || "Página",
            ruta: details.ruta || `${location.pathname}${location.search}`,
            sessionId: getSessionId(),
            productoId: Number.isFinite(Number(details.productoId)) ? Number(details.productoId) : null,
            productoNombre: details.productoNombre || null,
            detalle: details.detalle || null,
            dispositivo: deviceType()
        };
    }

    function track(type, details = {}) {
        if (!window.ParfumAPI || !analyticsAllowed()) return Promise.resolve();
        return ParfumAPI.request("/actividad", {
            method: "POST",
            auth: ParfumAPI.isLogged(),
            timeout: 10000,
            body: cleanDetails({...details, tipo:type})
        }).catch(() => null);
    }

    window.ParfumActivity = Object.freeze({track, getSessionId, analyticsAllowed});

    window.addEventListener("DOMContentLoaded", () => {
        if (analyticsAllowed()) track("PAGE_VIEW");
    }, {once:true});

    window.addEventListener("parfum:privacy-consent", event => {
        if (event.detail?.analytics === true) track("PAGE_VIEW");
        if (event.detail?.analytics === false) localStorage.removeItem(SESSION_KEY);
    });
})();
