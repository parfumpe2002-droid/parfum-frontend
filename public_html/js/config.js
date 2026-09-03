(() => {
    "use strict";

    const localHosts = new Set(["localhost", "127.0.0.1", ""]);
    const isLocal = localHosts.has(window.location.hostname);
    const RENDER_API = "https://parfum-backend-jvcw.onrender.com/api";

    const configuredApi = window.PARFUM_API_BASE || (
        isLocal ? "http://localhost:8080/api" : RENDER_API
    );

    window.PARFUM_CONFIG = Object.freeze({
        API_BASE: String(configuredApi).replace(/\/+$/, ""),
        API_TIMEOUT_MS: 90000,
        CATALOG_CACHE_HOURS: 6,
        CATALOG_EXPECTED_COUNT: 86,
        CATALOG_RETRY_MS: 15000,
        CATALOG_RETRY_ATTEMPTS: 14
    });
})();
