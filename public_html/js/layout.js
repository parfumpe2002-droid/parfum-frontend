(() => {
    "use strict";

    const user = ParfumAPI.getUser();
    const activePage = document.body.dataset.page || "";
    const headerRoot = document.getElementById("appHeader");
    const footerRoot = document.getElementById("appFooter");
    const isOffers = activePage === "ofertas" || new URLSearchParams(location.search).get("ofertas") === "1";

    const navLink = (href, label, key, icon) => {
        const active = key === "ofertas" ? isOffers : activePage === key && !isOffers;
        return `<a class="${active ? "active" : ""}" href="${href}"><i class="${icon}" aria-hidden="true"></i><span>${label}</span></a>`;
    };

    const theme = () => document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    const setTheme = value => {
        const next = value === "dark" ? "dark" : "light";
        document.documentElement.dataset.theme = next;
        document.documentElement.style.colorScheme = next;
        localStorage.setItem("parfum_theme", next);
        document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "dark" ? "#0c0d0c" : "#f7f3ec");
        syncThemeControls();
    };
    const syncThemeControls = () => {
        const dark = theme() === "dark";
        document.querySelectorAll("[data-theme-toggle]").forEach(button => {
            button.setAttribute("aria-pressed", String(dark));
            button.setAttribute("aria-label", dark ? "Cambiar a modo claro" : "Cambiar a modo noche");
            button.innerHTML = `<i class="fa-solid fa-${dark ? "sun" : "moon"}"></i><span>${dark ? "Modo claro" : "Modo noche"}</span>`;
        });
    };

    if (headerRoot) {
        headerRoot.innerHTML = `
            <div class="announcement-bar">
                <p><i class="fa-solid fa-truck-fast" aria-hidden="true"></i> Envío gratis desde S/ 299</p>
                <div class="announcement-links">
                    <button class="announcement-app" type="button" data-install-app hidden><i class="fa-solid fa-mobile-screen-button"></i> Descargar app</button>
                    <a href="contacto.html">Contacto</a>
                    <a href="pedidos.html">Seguimiento de pedido</a>
                </div>
            </div>
            <header class="site-header">
                <button id="menuButton" class="menu-button" type="button" aria-label="Abrir menú" aria-controls="mainNav" aria-expanded="false"><i class="fa-solid fa-bars"></i></button>
                <a class="brand" href="index.html" aria-label="Parfum, inicio">
                    <span class="brand-mark"><img src="icons/icon-48.png" alt="" width="32" height="32"></span>
                    <span class="brand-copy"><strong>PARFUM</strong><small>PERFUMERÍA SELECTA</small></span>
                </a>
                <nav id="mainNav" class="main-nav" aria-label="Navegación principal">
                    <div class="mobile-nav-head">
                        <a class="mobile-nav-brand" href="index.html"><img src="icons/icon-72.png" alt=""><span><b>PARFUM</b><small>PERFUMERÍA SELECTA</small></span></a>
                        <button id="closeMenuButton" type="button" aria-label="Cerrar menú"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="main-nav-links">
                        ${navLink("index.html", "Inicio", "inicio", "fa-solid fa-house")}
                        ${navLink("productos.html", "Perfumes", "productos", "fa-solid fa-spray-can-sparkles")}
                        ${navLink("ofertas.html", "Ofertas", "ofertas", "fa-solid fa-tags")}
                        ${navLink("contacto.html", "Contacto", "contacto", "fa-solid fa-envelope")}
                    </div>
                    <div class="mobile-nav-tools">
                        <button type="button" data-theme-toggle></button>
                        <button type="button" data-install-app hidden><i class="fa-solid fa-download"></i><span>Instalar Parfum</span></button>
                        ${user ? `<a href="perfil.html"><i class="fa-solid fa-user"></i><span>Mi cuenta</span></a>${ParfumAPI.isAdmin() ? '<a href="admin.html"><i class="fa-solid fa-chart-line"></i><span>Administración</span></a>' : ''}` : '<a href="login.html"><i class="fa-solid fa-right-to-bracket"></i><span>Iniciar sesión</span></a>'}
                    </div>
                </nav>
                <div class="header-actions">
                    <button id="searchButton" class="header-action" type="button" aria-label="Buscar"><i class="fa-solid fa-magnifying-glass"></i></button>
                    <button class="header-action desktop-theme-button" type="button" data-theme-toggle></button>
                    <div class="account-menu">
                        <button id="accountButton" class="account-trigger" type="button" aria-label="Cuenta" aria-expanded="false"><i class="fa-regular fa-user"></i></button>
                        <div id="accountDropdown" class="account-dropdown">
                            ${user ? `<div class="account-name">Sesión iniciada como<b>${ParfumAPI.escapeHtml(user.nombre || user.email || "Cliente")}</b></div><a href="perfil.html"><i class="fa-regular fa-user"></i> Mi perfil</a><a href="pedidos.html"><i class="fa-solid fa-box"></i> Mis pedidos</a>${ParfumAPI.isAdmin() ? '<a href="admin.html"><i class="fa-solid fa-chart-line"></i> Administración</a>' : ''}<button type="button" data-theme-toggle></button><button type="button" data-install-app hidden><i class="fa-solid fa-download"></i> Instalar aplicación</button><button id="logoutButton" type="button"><i class="fa-solid fa-arrow-right-from-bracket"></i> Cerrar sesión</button>` : '<a href="login.html"><i class="fa-solid fa-right-to-bracket"></i> Iniciar sesión</a><a href="registro.html"><i class="fa-solid fa-user-plus"></i> Crear cuenta</a><button type="button" data-theme-toggle></button><button type="button" data-install-app hidden><i class="fa-solid fa-download"></i> Instalar aplicación</button>'}
                        </div>
                    </div>
                    <a class="header-action" href="favoritos.html" aria-label="Favoritos"><i class="fa-regular fa-heart"></i><em class="action-badge" data-fav-count>0</em></a>
                    <a class="header-action" href="carrito.html" aria-label="Carrito"><i class="fa-solid fa-bag-shopping"></i><em class="action-badge" data-cart-count>0</em></a>
                </div>
            </header>
            <div id="menuBackdrop" class="menu-backdrop"></div>
            <div id="searchPanel" class="search-panel" hidden>
                <form id="searchForm" role="search">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <label class="sr-only" for="searchInput">Buscar perfume</label>
                    <input id="searchInput" type="search" autocomplete="off" placeholder="Busca por perfume, marca, notas o categoría…">
                    <button id="closeSearch" type="button" aria-label="Cerrar búsqueda"><i class="fa-solid fa-xmark"></i></button>
                </form>
            </div>`;
    }

    if (footerRoot) {
        footerRoot.innerHTML = `
            <section class="shared-service-strip">
                <div class="layout-shell">
                    <article><i class="fa-brands fa-whatsapp"></i><div><b>¿No sabes qué elegir?</b><p>Te ayudamos a encontrar tu fragancia ideal.</p><a href="contacto.html">Escríbenos</a></div></article>
                    <article><i class="fa-solid fa-truck"></i><div><b>Envíos a todo el Perú</b><p>Entrega segura y seguimiento del pedido.</p></div></article>
                    <article><i class="fa-solid fa-shield-halved"></i><div><b>Pagos seguros</b><p>Yape y transferencia BCP.</p></div></article>
                    <article><i class="fa-solid fa-rotate"></i><div><b>Atención postventa</b><p>Te acompañamos antes y después de comprar.</p></div></article>
                </div>
            </section>
            <footer class="site-footer">
                <div class="footer-grid layout-shell">
                    <div class="footer-brand">
                        <a class="brand light" href="index.html"><span class="brand-mark"><img src="icons/icon-48.png" alt="" width="32" height="32"></span><span class="brand-copy"><strong>PARFUM</strong><small>PERFUMERÍA SELECTA</small></span></a>
                        <p>Perfumes nicho, de diseñador y árabes seleccionados para ayudarte a encontrar una firma personal.</p>
                        <button class="footer-install" type="button" data-install-app hidden><i class="fa-solid fa-download"></i> Instalar aplicación</button>
                    </div>
                    <div><h3>Información</h3><a href="index.html">Inicio</a><a href="contacto.html">Contacto</a><a href="pedidos.html">Seguimiento de pedido</a></div>
                    <div><h3>Comprar</h3><a href="productos.html">Perfumes</a><a href="ofertas.html">Ofertas</a><a href="favoritos.html">Favoritos</a><a href="carrito.html">Carrito</a></div>
                    <div><h3>Mi cuenta</h3><a href="perfil.html">Perfil</a><a href="pedidos.html">Mis pedidos</a><a href="login.html">Iniciar sesión</a></div>
                    <div class="newsletter"><h3>Síguenos</h3><div class="socials"><a href="#" aria-label="Instagram"><i class="fa-brands fa-instagram"></i></a><a href="#" aria-label="TikTok"><i class="fa-brands fa-tiktok"></i></a><a href="#" aria-label="Facebook"><i class="fa-brands fa-facebook-f"></i></a></div><p>Únete a nuestra newsletter y recibe promociones.</p><form id="newsletterForm"><label class="sr-only" for="newsletterEmail">Correo electrónico</label><input id="newsletterEmail" type="email" placeholder="Tu correo electrónico"><button type="submit" aria-label="Suscribirme"><i class="fa-solid fa-arrow-right"></i></button></form></div>
                </div>
                <div class="footer-bottom layout-shell"><span>© 2026 Parfum. Todos los derechos reservados.</span><span>Perfumes originales · Atención personalizada</span></div>
            </footer>`;
    }

    const menuButton = document.getElementById("menuButton");
    const closeMenuButton = document.getElementById("closeMenuButton");
    const mainNav = document.getElementById("mainNav");
    const backdrop = document.getElementById("menuBackdrop");
    const closeMenu = () => {
        mainNav?.classList.remove("open");
        backdrop?.classList.remove("open");
        document.body.classList.remove("menu-open");
        menuButton?.setAttribute("aria-expanded", "false");
        if (mainNav && window.innerWidth <= 900) mainNav.setAttribute("aria-hidden", "true");
        if (menuButton) menuButton.innerHTML = '<i class="fa-solid fa-bars"></i>';
    };
    const openMenu = () => {
        mainNav?.classList.add("open");
        backdrop?.classList.add("open");
        document.body.classList.add("menu-open");
        menuButton?.setAttribute("aria-expanded", "true");
        mainNav?.setAttribute("aria-hidden", "false");
        if (menuButton) menuButton.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        closeMenuButton?.focus({preventScroll:true});
    };

    if (mainNav && window.innerWidth <= 900) mainNav.setAttribute("aria-hidden", "true");
    menuButton?.addEventListener("click", () => mainNav?.classList.contains("open") ? closeMenu() : openMenu());
    closeMenuButton?.addEventListener("click", closeMenu);
    backdrop?.addEventListener("click", closeMenu);
    mainNav?.querySelectorAll("a").forEach(link => link.addEventListener("click", closeMenu));
    window.addEventListener("resize", () => { if (innerWidth > 900) closeMenu(); });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeMenu();
            document.getElementById("searchPanel")?.setAttribute("hidden", "");
            document.getElementById("accountDropdown")?.classList.remove("open");
        }
    });

    const searchPanel = document.getElementById("searchPanel");
    const searchInput = document.getElementById("searchInput");
    document.getElementById("searchButton")?.addEventListener("click", () => {
        searchPanel.hidden = false;
        setTimeout(() => searchInput?.focus(), 20);
    });
    document.getElementById("closeSearch")?.addEventListener("click", () => searchPanel.hidden = true);
    document.getElementById("searchForm")?.addEventListener("submit", event => {
        event.preventDefault();
        const term = searchInput?.value.trim();
        location.href = term ? `productos.html?q=${encodeURIComponent(term)}` : "productos.html";
    });

    const accountButton = document.getElementById("accountButton");
    const accountDropdown = document.getElementById("accountDropdown");
    accountButton?.addEventListener("click", event => {
        event.stopPropagation();
        const open = !accountDropdown?.classList.contains("open");
        accountDropdown?.classList.toggle("open", open);
        accountButton.setAttribute("aria-expanded", String(open));
    });
    accountDropdown?.addEventListener("click", event => event.stopPropagation());
    document.addEventListener("click", () => {
        accountDropdown?.classList.remove("open");
        accountButton?.setAttribute("aria-expanded", "false");
    });

    document.querySelectorAll("[data-theme-toggle]").forEach(button => {
        button.addEventListener("click", event => {
            event.preventDefault();
            setTheme(theme() === "dark" ? "light" : "dark");
        });
    });
    syncThemeControls();

    document.getElementById("logoutButton")?.addEventListener("click", async () => {
        try { await ParfumAPI.request("/auth/logout", {method:"POST"}); } catch {}
        ParfumAPI.clearSession();
        location.href = "index.html";
    });

    document.getElementById("newsletterForm")?.addEventListener("submit", event => {
        event.preventDefault();
        const input = document.getElementById("newsletterEmail");
        if (!input?.value.trim()) return;
        ParfumAPI.toast("Gracias por suscribirte");
        input.value = "";
    });

    ParfumStore.updateBadges();
    setTimeout(() => window.ParfumPWA?.syncInstallButtons(), 0);
})();
