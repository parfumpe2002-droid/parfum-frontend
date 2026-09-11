# Parfum — cambio a decants + SEO

## Catálogo
- 86 fragancias cargadas desde Libro1.xlsx.
- Precios del cliente aplicados a 3, 5, 10, 20 y 30 ml.
- 74 fragancias tienen precios configurados.
- 12 fragancias de mujer quedan visibles con precio pendiente porque el Excel no incluye precios.
- Nombres obvios corregidos para catálogo/SEO (French Riviera, MYSLF, Lattafa, Armaf, Khamrah Qahwa, CK IN2U, Yellow Diamond, etc.).

## Flujo comercial
- El decant es ahora la compra principal.
- El carrito/favoritos trabajan con la variante de decant seleccionada.
- El frasco completo ya no se compra como variante normal: abre WhatsApp +51 963 257 194 con el nombre y marca del perfume incluidos en el mensaje.
- Contenedores soportados: 3 / 5 / 10 / 20 / 30 ml.

## SEO
- URLs estáticas limpias: /decants/<slug>/
- 86 páginas de producto con title, meta description y canonical propios.
- Product structured data para productos con precios.
- robots.txt y sitemap.xml.
- Home y catálogo reescritos alrededor de “decants de perfumes originales en Perú”.
- Dominio configurado en SEO: https://parfum.com.pe. Si finalmente se usa otro dominio, reemplazarlo antes de publicar.

## Imágenes
- Se conservan las imágenes locales que ya existían.
- 64 productos nuevos/sin imagen local usan perfume-default.png para no inventar imágenes incorrectas.

## Verificación realizada
- JSON de catálogo: 86 slugs y 86 SKU únicos.
- Cada producto tiene las 5 variantes de ml.
- Sitemap XML válido.
- JavaScript principal validado con `node --check`.
- No fue posible ejecutar Maven en este entorno porque Maven/mvnw no está instalado; revisar build de Render/GitHub tras el push.
