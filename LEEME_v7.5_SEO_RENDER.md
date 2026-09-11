# Parfum frontend v7.5 - SEO dinámico + ayuda para Render

## Sitemap
- `sitemap.xml` se conserva como respaldo estático.
- `sitemap-live.xml` se sirve desde el backend por proxy de Netlify.
- `robots.txt` anuncia ambos sitemaps.
- Los productos creados desde Admin aparecen automáticamente en `sitemap-live.xml` porque se lee Neon en tiempo real.

## Panel Admin / Render
En Resumen aparece **Mantener Render activo**. Al activarlo:
- envía una petición liviana a `/api/health` cada 9 minutos;
- solo corre mientras la pestaña de Admin está abierta;
- se detiene al apagar el botón o cerrar la pestaña.

No garantiza disponibilidad 24/7. Para evitar cold starts a todos los clientes la solución correcta sigue siendo un plan de Render que no haga spin down.
