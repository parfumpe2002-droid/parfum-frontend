# Parfum — pagos por Yape y transferencia BCP

## Métodos habilitados

- Yape: 963 257 194 — William López.
- Cuenta BCP soles: 19400163266014.
- CCI BCP: 00219410016326601495.
- No existe pago contra entrega.

## Orden de publicación

### 1. Neon

Abre **SQL Editor** y ejecuta completo:

`database/migracion_metodos_pago_neon.sql`

La migración agrega al pedido:

- estado del pago;
- número de operación;
- URL y public_id del comprobante;
- observación del administrador;
- fecha de confirmación.

### 2. Backend

Reemplaza el proyecto backend y haz push a la rama `master`.
Render volverá a desplegarlo automáticamente.

Comprueba que sigan configuradas estas variables:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- variables de Neon y Atlas.

Los comprobantes se guardan en Cloudinary dentro de `parfum/comprobantes`.

### 3. Frontend

Reemplaza el frontend y haz push a `master`.
Netlify generará la nueva versión de la PWA.

Después abre Parfum y pulsa **Actualizar** cuando aparezca la notificación. También puedes usar `Ctrl + F5` una vez.

## Flujo del cliente

1. Elige Yape o transferencia BCP.
2. Visualiza los datos de pago.
3. Escribe el número de operación.
4. Adjunta una captura del comprobante.
5. Registra el pedido.
6. El pedido queda como `PENDIENTE_VERIFICACION`.

## Flujo del administrador

En **Panel → Pedidos** puede:

- abrir la captura del comprobante;
- revisar el número de operación;
- confirmar o rechazar el pago;
- solicitar un nuevo comprobante;
- escribir una observación visible para el cliente;
- cambiar el estado logístico del pedido.

El backend impide pasar un pedido a `CONFIRMADO`, `PREPARANDO`, `ENVIADO` o `ENTREGADO` mientras el pago no esté confirmado.

Si el administrador solicita otro comprobante o rechaza el pago, el cliente puede subir una nueva captura desde **Mis pedidos**.
