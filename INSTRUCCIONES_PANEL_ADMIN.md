# Panel administrador Parfum

## 1. Publicar el backend

1. Descomprime `Parfum_Backend_Admin_Completo.zip`.
2. Reemplaza el contenido del repositorio `parfum-backend`.
3. Haz commit y push a la rama `master`.
4. Render desplegará el backend automáticamente.
5. Comprueba:
   - `https://parfum-backend-jvcw.onrender.com/api/health`
   - `https://parfum-backend-jvcw.onrender.com/api/productos`

No se agregan nuevas variables obligatorias. Conserva las actuales de Neon, Atlas y Cloudinary.

## 2. Publicar el frontend

1. Descomprime `Parfum_Frontend_Admin_Completo.zip`.
2. Reemplaza el contenido del repositorio `parfum-frontend`.
3. Haz commit y push a `master`.
4. Netlify desplegará automáticamente desde `public_html`.
5. Recarga con `Ctrl + F5`.

El archivo `public_html/js/config.js` ya apunta a:

`https://parfum-backend-jvcw.onrender.com/api`

## 3. Crear la primera cuenta administradora en Neon

Método recomendado:

1. Registra una cuenta normal en la página pública.
2. Abre Neon > proyecto Parfum > SQL Editor.
3. Abre `SQL/crear_admin_neon.sql`.
4. Reemplaza `TU_CORREO_ADMIN@GMAIL.COM` por el correo registrado.
5. Ejecuta el script.
6. Cierra sesión en Parfum y vuelve a iniciar sesión.
7. En el menú de cuenta aparecerá `Administración`.

Este método conserva la contraseña cifrada con BCrypt. No se debe insertar una contraseña en texto plano desde SQL.

## 4. Alternativa: crear el administrador desde Render

El backend también admite estas variables:

- `APP_ADMIN_EMAIL`
- `APP_ADMIN_PASSWORD`
- `APP_ADMIN_NAME`

Al reiniciar, si la cuenta no existe la crea como ADMIN; si ya existe, la promueve a ADMIN. La contraseña debe guardarse como secreto de Render.

## 5. Funciones del panel

- Resumen con usuarios, productos, pedidos, ventas, mensajes y visitas.
- Gráfico de visitas y visitantes únicos de los últimos 7 días.
- Actividad reciente y registro de navegación en MongoDB Atlas.
- Crear productos nuevos, incluidos perfumes árabes y categorías nuevas.
- Editar nombre, marca, categoría, descripción, notas, duración, precio y stock.
- Subir o reemplazar imágenes mediante Cloudinary.
- Activar u ocultar productos.
- Cambiar estados de pedidos.
- Activar/desactivar usuarios y asignar roles USER o ADMIN.
- Leer, responder, clasificar y eliminar mensajes de contacto.

## 6. MongoDB Atlas

La colección `actividad_sitio` se crea automáticamente cuando alguien visita la web después del despliegue. No debes importarla manualmente.

Los datos registrados no incluyen la IP exacta del visitante. Se almacena una sesión anónima, página, acción, dispositivo y, si inició sesión, su correo/ID.
