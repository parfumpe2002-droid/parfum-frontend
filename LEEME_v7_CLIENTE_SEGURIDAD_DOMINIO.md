# Parfum Frontend v7 — Cambios solicitados por cliente + seguridad

## Cambios visuales/comerciales

- Banner nicho: Althaïr, Erba Pura y Torino 21.
- Banner diseñador: Valentino Uomo Born in Roma Intense, Y EDP, Dior Homme Intense y Stronger With You Intensely.
- Banner árabe: Khamrah, Amber Oud Gold Edition y Mandarin Sky.
- Los banners intentan usar las imágenes reales cargadas desde el Panel Admin/Cloudinary. Si Render despierta tarde, se reintenta al recuperar el catálogo.
- Marcas destacadas: 14 firmas (7 + 7 en escritorio), incluyendo Parfums de Marly, Givenchy, Mancera, Chanel, Prada y Azzaro.
- Contacto directo por WhatsApp a +51 963 257 194.
- Instagram: @parfum_pe_.
- TikTok: @Parfum_pe y @Parfum_pe2.
- Detalle de producto: frasco/perfume real visible a la izquierda y selección del decant a la derecha.

## Seguridad y dominio

- Security headers en Netlify: CSP, HSTS, anti-iframe, nosniff, Referrer-Policy y Permissions-Policy.
- Contraseñas nuevas mín. 10 caracteres.
- Tras cambiar contraseña, la sesión local se cierra para obligar a iniciar sesión nuevamente.
- Límite visual de comprobantes alineado con backend: 5 MB.
- SEO/canonical usa `https://parfum.com.pe`.
- Los precios estructurados de las páginas de producto se actualizan desde los datos reales de Neon al cargar, evitando publicar precios viejos incrustados en el HTML.
