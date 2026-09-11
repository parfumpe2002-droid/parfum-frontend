(() => {
    "use strict";
    try {
        const stored = localStorage.getItem("parfum_theme");
        // Parfum abre en modo claro por defecto. Solo se conserva modo noche
        // cuando el visitante lo eligió expresamente.
        const theme = stored === "dark" || stored === "light" ? stored : "light";
        document.documentElement.dataset.theme = theme;
        document.documentElement.style.colorScheme = theme;
        document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0c0d0c" : "#f7f3ec");
    } catch {
        document.documentElement.dataset.theme = "light";
    }
})();
