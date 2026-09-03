# PARFUM — PRESENTACIONES, PWA, MODO NOCHE Y RESPONSIVE

## Qué se agregó

- Presentaciones por mililitros para cada perfume.
- Precio y stock independientes por tamaño.
- El tamaño elegido se guarda en carrito y pedidos.
- El administrador puede agregar, editar, activar o eliminar tamaños.
- Los 43 perfumes incluyen presentaciones referenciales con precio y stock inicial en 0.
- Categorías nuevas, como Árabe, se pueden escribir directamente en el panel.
- Modo noche persistente.
- Menú hamburguesa corregido y adaptado a celular.
- Aplicación web instalable (PWA) con icono Parfum.
- Aviso para instalar la aplicación.
- Aviso “Nueva versión disponible” cuando Netlify publica cambios.
- Funcionamiento básico sin conexión para las páginas ya visitadas.
- Favicon e iconos para Android, iPhone, Windows y escritorio.

## Orden de publicación

### 1. Neon

En Neon > SQL Editor ejecuta completo:

`SQL/migracion_presentaciones_neon.sql`

El script crea `producto_presentaciones`, agrega los tamaños a los 43 productos y añade los campos de presentación al detalle del pedido.

Comprueba con:

```sql
SELECT p.nombre, pp.mililitros, pp.precio, pp.stock
FROM producto_presentaciones pp
JOIN productos p ON p.id = pp.producto_id
ORDER BY p.nombre, pp.mililitros;
```

Todos comienzan con precio y stock 0 para que el administrador coloque los valores reales.

### 2. MongoDB Atlas

El carrito anterior tenía un índice que permitía un solo registro por producto. Ahora debe permitir el mismo perfume en 75 ml y 125 ml como artículos distintos.

Ejecuta con mongosh:

```bash
mongosh "TU_URI_DE_ATLAS" --file migracion_carrito_presentaciones_atlas.js
```

El script utiliza la base `Parfum` con P mayúscula, igual que la configuración actual del proyecto.

### 3. Backend

Reemplaza el proyecto backend, luego:

```bash
git add .
git commit -m "Agrega presentaciones por ml, precio y stock"
git push origin master
```

Espera a que Render muestre `Deploy succeeded`.

Prueba:

- `/api/productos`
- `/api/productos/destacados`

Cada producto debe incluir un arreglo llamado `presentaciones`.

### 4. Frontend

Reemplaza el frontend, luego:

```bash
git add .
git commit -m "Agrega tamaños, PWA, modo noche y mejoras responsive"
git push origin master
```

Netlify publicará los cambios automáticamente. El archivo `netlify.toml` ejecuta `build-pwa.sh`; ese paso cambia la versión del service worker en cada commit para que aparezca el aviso de actualización. No borres ese script ni dejes un comando manual diferente en Netlify.

## Cómo usar el panel

1. Inicia sesión como administrador.
2. Abre `Administración > Productos`.
3. Elige un perfume y pulsa `Editar`.
4. En “Presentaciones, precios y stock” completa, por ejemplo:
   - 75 ml — S/ 349 — stock 5.
   - 125 ml — S/ 449 — stock 3.
5. Puedes agregar otro tamaño con `Agregar tamaño`.
6. Guarda el producto.

El precio general se calcula automáticamente usando el menor precio activo. El stock general es la suma del stock de todas las presentaciones activas.

## Pedidos

El cliente elige el tamaño en el detalle del perfume. El carrito, la vista de pedidos del cliente y el panel administrativo muestran los mililitros solicitados.

## Aplicación instalable

La instalación aparece únicamente cuando el navegador confirma que la PWA cumple sus requisitos. En Chrome/Android también puede aparecer en el menú del navegador como “Instalar aplicación” o “Agregar a pantalla de inicio”.

Cuando publiques cambios nuevos, el service worker detectará la versión y mostrará “Nueva versión disponible”. El usuario pulsa `Actualizar` para aplicar los archivos nuevos.

## Modo noche

El botón de luna/sol aparece en la cabecera, el menú móvil y el menú de la cuenta. La preferencia se conserva en el dispositivo.

## Nota sobre los tamaños

Los tamaños precargados son presentaciones comerciales referenciales. Pueden variar por país, año, disponibilidad, edición o distribuidor. El administrador puede corregirlos sin modificar código.
