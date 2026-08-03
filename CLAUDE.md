@AGENTS.md

# Mystery — resumen del proyecto

Tienda online de cuadros personalizados en vinilo sobre madera (marca "Mystery"). El cliente sube una foto, la ajusta dentro de un marco, elige tamaño, paga, y recibe el cuadro impreso en casa. Colombia como mercado principal (Servientrega, COP, Wompi).

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19**, JavaScript (sin TypeScript).
- **Tailwind CSS v4** (`@theme inline` en `app/globals.css`, tokens de color propios: `--background`, `--foreground`, `--accent`, `--accent-soft`).
- Sin base de datos relacional. Persistencia de sesión del pedido en **IndexedDB** (vía `idb-keyval`, ver `app/lib/order.js`) porque `sessionStorage` no soporta las imágenes en base64 (pueden pesar varios MB).
- **Redis (Upstash, vía integración "Redis" de Vercel)** con **`ioredis`** para el historial simple de pedidos por correo (detección de cliente recurrente). *Nota: se probó primero `@vercel/kv`, pero está deprecado y Vercel solo ofreció la integración Redis/Upstash (variable `REDIS_URL`), así que se migró a `ioredis`.*
- **Wompi** (Web Checkout / Widget JS) para pagos — sandbox con llaves `pub_test_`/`prv_test_`.
- **Resend** para el envío de correos transaccionales (HTML compatible con clientes de correo: tablas, estilos inline, sin CSS moderno).
- **react-easy-crop** para el editor de recorte/zoom de la foto.
- **pdfjs-dist** para convertir la primera página de un PDF subido a imagen.
- **heic2any** para convertir fotos HEIC/HEIF (iPhone) a JPEG en el navegador antes de procesarlas.
- **canvas-confetti** para la animación de celebración en la confirmación de pago.
- **eruda** + `app/DevTools.js`: panel de consola visible en móvil, **solo en desarrollo** (`NODE_ENV === "development"`) — recordar quitarlo (junto con la dependencia y `allowedDevOrigins` en `next.config.mjs`) antes de producción.

## Estructura de páginas

- **`/` (Home)** — landing con navbar fija, hero con imagen de estilo de vida (`/images/mockups/head.png`), sección "Cuadros personalizados" con CTA, categorías emocionales con foto de fondo, "Cómo funciona", grids de producto "Recientes"/"Más vendidos" (**contenido de catálogo de ejemplo**, marcado explícitamente en el código para reemplazar), prueba social con testimonios de ejemplo, FAQ tipo acordeón (`<details>`), y footer. Link discreto a "vender" (sin funcionalidad, placeholder).
- **`/crear`** — editor del cuadro, en 3 estados dentro de la misma página:
  1. **Subida**: dropzone con drag&drop + `<label htmlFor="file-upload">` (un solo `<input type="file">` compartido — el patrón `label`+`for` es el que sí funciona de forma confiable en móvil; `.click()` programático desde JS falla en algunos navegadores). Layout de dos columnas (carga | mockup de referencia con foto de ejemplo del catálogo superpuesta sobre `/images/mockups/icon1.png`).
  2. **Edición**: layout asimétrico ~65/35 (lienzo con `react-easy-crop` | panel de control: cambiar foto, zoom, tarjetas de tamaño con silueta de persona a escala real y precio). Indicador de progreso de 3 pasos arriba.
  3. **"Tu cuadro está listo"**: composición del recorte final del usuario sobre `/images/mockups/mockup1.png` (foto de sillón negro con pared vacía calibrada a mano — ver `MOCKUP.zone` y `getMockupOverlayStyle` en `app/crear/page.js`), con tamaño proporcional real entre 30x40/40x50/50x70 (`MOCKUP_MAX_ZONE_FILL`). Botón para confirmar y pasar a `/checkout`.
- **`/checkout`** — formulario de datos (nombre, correo, celular con prefijo país) + dirección adaptada a Servientrega (dirección, selector Casa/Apartamento con campos condicionales — edificio/torre/apto o indicaciones adicionales —, barrio, ciudad). Resumen de pedido tipo "producto premium" (miniatura, tamaño, precio). Integración con el widget de Wompi, con **firma de integridad generada server-side** (`/api/wompi-signature`). Dos botones de pago (arriba y abajo del formulario, mismo handler) para que siempre esté accesible en móvil.
- **`/checkout/confirmacion`** — confirmación con animación de check, confeti (gatillado solo si `order.payment.status === "APPROVED"`, nunca solo por llegar a la página), resumen del pedido, línea de tiempo (Pago confirmado → En producción → Envío), bloque de regalo por fidelidad (cliente recurrente, fade-in retrasado ~2.5s), y CTAs.

## Integraciones y flujo de pago/pedido

1. `/crear` genera dos imágenes al confirmar: `croppedImage` (la que ve el cliente en todo el sitio) y `printImage` (con **1cm de sangrado por lado**, escalado proporcional a la densidad real del recorte — no un valor fijo de píxeles — con extensión de borde/edge-clamp si el sangrado se sale de los límites de la imagen original). Ver `app/crear/cropImage.js`.
2. El pedido se guarda en IndexedDB (`app/lib/order.js`) y viaja entre páginas leyendo/escribiendo esa misma clave.
3. En `/checkout`, al pagar: se pide la firma de integridad al servidor, se abre el widget de Wompi, y en el callback se llama a `/api/confirm-order`.
4. **`/api/confirm-order`** (server-side, nunca confía en el resultado del navegador):
   - Verifica la transacción directamente contra la API de Wompi con `WOMPI_PRIVATE_KEY` (`app/lib/wompi.js`).
   - Si está `APPROVED`: registra el pedido en Redis por correo del cliente y detecta si es cliente recurrente (`app/lib/loyalty.js`, nunca lanza excepción si Redis falla — el pedido sigue su curso).
   - Envía los dos correos con Resend (`app/lib/email.js`): al cliente (sin adjuntos, sin imagen — un `cid:` de adjunto no renderiza en Gmail; queda pendiente resolver una miniatura vía URL pública si se quiere mostrar la foto) y al fabricante/admin (con `printImage` adjunta, datos de envío completos priorizados arriba, banner de estado de pago, nota de sangrado).
   - Devuelve el estado verificado + `isReturningCustomer` al cliente, que los guarda en el pedido (`cliente_recurrente`) para que `/checkout/confirmacion` los use.

## Decisiones de diseño importantes

- **Paleta**: fondo oscuro (`#0a0a0f`), acento morado (`#a855f7` / `#c084fc` claro) — elegido para diferenciarse de otras marcas del mismo dueño (elmetacho.com). En correos se usa un morado más oscuro (`#7c3aed`) para texto sobre fondo blanco por contraste.
- **Estilo visual "premium"** consistente en `/crear` y `/checkout`: glow radial sutil de fondo, tarjetas con bordes redondeados y sombra con tinte morado, inputs con foco en anillo morado, botones con gradiente + glow en hover.
- **Todo mobile-first**: la mayoría de clientes compran desde el celular. Patrones repetidos: `<label htmlFor>` en vez de `.click()` para inputs de archivo, `100dvh` con fallback `100vh` para el canvas del confeti (Safari iOS con barra dinámica), sliders con thumb ampliado para el dedo, resúmenes colapsables (`<details>`) en móvil.
- **Nunca confiar en el cliente para confirmar pagos**: la verificación real siempre ocurre server-side contra la API de Wompi antes de disparar correos o marcar el pedido como pagado.
- **Precios** (`app/lib/order.js`, `SIZES`): 30x40 = $80.000, 40x50 = $110.000, 50x70 = $150.000 COP — **placeholders**, pendientes de ajustar a precios reales.
- **Validación de resolución mínima**: referencia visible al usuario en el FAQ ("100px/cm"), aunque los valores reales de `SIZES.minWidth/minHeight` usan una densidad menor (~40px/cm) — no bloquea el flujo, solo muestra un aviso; "se mejorará con IA" es una promesa de producto **aún no implementada**.

## Variables de entorno (`.env.local`, no versionado)

| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_WOMPI_PUBLIC_KEY` | Llave pública del widget Wompi (cliente) |
| `WOMPI_PRIVATE_KEY` | Verificación server-side de transacciones (nunca al cliente) |
| `WOMPI_INTEGRITY_SECRET` | Firma de integridad del checkout Wompi (`/api/wompi-signature`) |
| `RESEND_API_KEY` | Envío de correos |
| `RESEND_FROM_EMAIL` | Remitente (ya verificado: `pedidos@elmetacho.com`) |
| `MANUFACTURER_EMAIL` | Copia del correo de pedido al fabricante |
| `REDIS_URL` | Conexión Upstash Redis para historial de clientes recurrentes |

## Completo vs. pendiente

**Completo y funcional (en modo local/sandbox):**
- Flujo completo subir foto → ajustar/recortar → elegir tamaño → checkout → pago Wompi (sandbox) → confirmación.
- Verificación server-side del pago, correos transaccionales con diseño de marca, sangrado de impresión, detección de cliente recurrente vía Redis.
- Responsive completo, HEIC/PDF, validaciones de formulario y resolución.

**Pendiente / placeholder — a resolver antes de producción:**
- **Nunca se ha hecho un `deploy` real** — todo el trabajo hasta ahora es local.
- Quitar `eruda`/`app/DevTools.js`/`allowedDevOrigins` de `next.config.mjs` antes de producción.
- Precios reales (hoy son de ejemplo).
- Catálogo real para Home (Recientes/Más vendidos/testimonios son contenido de ejemplo, marcado en el código).
- Aplicar el código de descuento `MYSTERY10%` en un pago real (hoy solo se muestra el mensaje al cliente recurrente, no hay lógica de canje).
- Miniatura de imagen en el correo al cliente (se quitó por incompatibilidad de `cid:` en Gmail; pendiente resolver con una URL pública si se quiere).
- Link real de Instagram (hoy `href="#"` en Home y en confirmación).
- Mejora con IA para fotos de baja resolución (mencionada en el FAQ, no implementada).
- Revisar el mensaje del FAQ sobre "100px/cm" contra los valores reales de `SIZES` en `app/lib/order.js`.
- Confirmar en variables de Vercel si la integración quedó como "Redis" (Upstash) — si cambia de nombre, `REDIS_URL` podría necesitar ajuste.
