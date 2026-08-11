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
- **Precios** (`app/lib/order.js`, `SIZES`): 30x40 = $65.000, 40x50 = $89.000, 50x70 = $149.000 COP — precios definitivos.
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

**Pendiente / placeholder:**
- **El sitio ya está publicado en producción en Vercel** y se probó el flujo completo end-to-end en vivo (catálogo, compras, correos) — deja de ser un ítem pendiente.
- Quitar `eruda`/`app/DevTools.js`/`allowedDevOrigins` de `next.config.mjs` antes de producción (confirmar si ya se hizo en el deploy actual).
- Catálogo real para Home (Recientes/Más vendidos/testimonios son contenido de ejemplo, marcado en el código).
- Aplicar el código de descuento `MYSTERY10%` en un pago real (hoy solo se muestra el mensaje al cliente recurrente, no hay lógica de canje).
- Miniatura de imagen en el correo al cliente (se quitó por incompatibilidad de `cid:` en Gmail; pendiente resolver con una URL pública si se quiere).
- Link real de Instagram (hoy `href="#"` en Home y en confirmación).
- Mejora con IA para fotos de baja resolución (mencionada en el FAQ, no implementada).
- Revisar el mensaje del FAQ sobre "100px/cm" contra los valores reales de `SIZES` en `app/lib/order.js`.
- Confirmar en variables de Vercel si la integración quedó como "Redis" (Upstash) — si cambia de nombre, `REDIS_URL` podría necesitar ajuste.
- **Guía Skydropx automática para pagos completos por Wompi**: hoy `createCodShipment`/`createShipment` (`app/lib/skydropx.js`) solo se dispara para pedidos contraentrega, desde `/api/confirm-cod-order`. Los pagos completos (`confirmApprovedOrder.js` / `/api/confirm-order` / `/api/wompi-webhook`) no generan ninguna guía automática todavía — si se construye ese flujo, enganchar ahí también `sendShippingNotificationEmail()` (`app/lib/email.js`), igual que ya está hecho para contraentrega.
# Contexto adicional — Mystery Tienda

> Pega el contenido de este archivo al final de tu CLAUDE.md existente en el
> proyecto. Claude Code lo lee automáticamente al inicio de cada sesión, sin
> gastar tokens de conversación para explicarlo.

## Decisiones de precio (definitivas, agosto 2026)

- 30x40 cm: **$65.000 COP** (fabricante $12.000)
- 40x50 cm: **$89.000 COP** (fabricante $18.000) — badge "Más elegido"
- 50x70 cm: **$149.000 COP** (fabricante $28.000)
- Todos con envío incluido ("envío gratis" como estrategia de conversión,
  en vez de cobrarlo aparte).
- Lógica de precios: aplicamos psicología de precios (anclaje con el 50x70
  como ancla premium, precios encantadores terminados en 900/000 redondos
  fáciles de recordar, y el 40x50 —históricamente el tamaño más pedido—
  recibe el mejor balance margen/precio de los tres para que el tamaño más
  vendido también sea el más rentable en agregado).

## Limitación conocida: el catálogo (/estudio → Drive → producto comprable)
solo soporta 40x50 por ahora

Cuando un diseño se sube en `/estudio`, el recorte (zoom/posición que elige
el hermano) y el sangrado de 1cm se calculan y "hornean" en el archivo de
portafolio UNA SOLA VEZ, específicamente para la proporción de 40x50
(ratio ~4:5). Este archivo ya recortado es el que se sube a Drive y el que
se usa para imprimir cuando alguien compra desde el catálogo.

**Por qué esto bloquea vender otros tamaños desde el catálogo sin más
trabajo**: cada tamaño tiene una proporción distinta:
- 30x40 → 3:4 (más cuadrado)
- 40x50 → 4:5 (el que ya tenemos)
- 50x70 → 5:7 (más alargado)

No es simplemente "estirar" el archivo existente — cambia qué parte de la
composición queda visible. Ofrecer los 3 tamaños desde catálogo hoy
produciría recortes feos/inconsistentes en 30x40 y 50x70.

**Dos caminos para resolverlo cuando se aborde esta tarea:**

1. **Opción robusta (recomendada)**: modificar `/estudio` para que además
   del archivo recortado, se guarde (a) la foto original SIN recortar, y
   (b) los valores exactos de zoom/posición elegidos por el hermano. Con
   eso, el sitio puede recalcular el recorte al vuelo para cualquier
   tamaño en el momento de la compra — mismo principio que ya usa `/crear`
   con clientes que suben su propia foto. Requiere cambiar el modelo de
   datos de `catalog:products` en Redis y el flujo de subida de `/estudio`.
   Los productos ya subidos ANTES de este cambio no tendrían el dato nuevo
   (originales sin recortar) y quedarían limitados a 40x50 salvo que se
   vuelvan a subir.

2. **Opción rápida (compromiso, menor calidad)**: re-recortar el archivo
   de 40x50 ya existente hacia las otras proporciones. Funciona sin tocar
   `/estudio`, pero puede cortar partes del diseño que el hermano centró a
   propósito para 4:5, viéndose peor en 30x40/50x70.

Mientras no se resuelva esto, el catálogo debe seguir vendiendo
ÚNICAMENTE en 40x50 a precio fijo ($89.000), sin mostrar "Desde $65.000"
ni selector de tamaño en `/producto/[id]` — sería engañoso mostrar un
precio de un tamaño que no se puede producir correctamente desde ese flujo
todavía.

## Lecciones técnicas aprendidas (para no repetir errores)

### Vercel tiene un límite de payload (~4.5MB) en funciones serverless
Cualquier endpoint que reciba archivos pesados (imágenes en alta
resolución) directamente en el body de una petición POST va a fallar en
producción con `413 Content Too Large`, aunque funcione perfecto en
`localhost` (ahí no hay límite). Síntoma: funciona en dev, falla en
Vercel. Solución aplicada: subida resumible directo desde el navegador
hacia el destino final (Google Drive), donde el servidor solo genera una
URL de sesión autorizada (payload pequeño, solo metadata) y el archivo
pesado nunca pasa por la función de Vercel.

### Cuentas de servicio de Google NO tienen cuota de Drive propia
Una cuenta de servicio (service account) de Google Cloud puede CREAR
archivos en una carpeta que se le comparta, pero como esos archivos "le
pertenecen" a ella, necesita cuota de almacenamiento propia — que solo
existe dentro de Unidades Compartidas (Shared Drives), una función
EXCLUSIVA de Google Workspace (cuentas de empresa/pago). En un Google
Drive personal (Gmail gratuito), la subida falla con:
`Service Accounts do not have storage quota`.
Solución aplicada: usamos OAuth2 delegado a la cuenta personal real
(oscarmetacho@gmail.com) en vez de cuenta de servicio — los archivos se
suben usando la cuota de Drive del usuario real, y sigue funcionando
independientemente de si hay o no una suscripción de Workspace activa.

### Subida resumible de Drive + CORS
Para que un navegador pueda hacer PUT directo a la URL de sesión de
subida resumible de Google (sin pasar por nuestro servidor), la petición
POST que INICIA esa sesión (hecha server-side) debe incluir el header
`Origin` con el dominio real desde el que se hará la subida
(`http://localhost:3000` en dev, `https://tienda.elmetacho.com` en
producción). Sin ese header en la inicialización, Google nunca autoriza
el origen para el PUT posterior, y el navegador falla con
`Failed to fetch` / `net::ERR_FAILED` sin más detalle (síntoma clásico
de bloqueo CORS silencioso).

### Skydropx: los códigos postales oficiales (DANE) no siempre coinciden
con su catálogo interno
Confirmado por soporte de Skydropx: sus cotizaciones (`POST
/api/v1/quotations`) validan contra un catálogo propio de códigos
"canónicos" por ciudad, que NO siempre coincide con los códigos DANE
oficiales de Colombia. Confirmados hasta ahora:
- Bogotá D.C.: `111611`
- Cali: `760001`
Medellín y Barranquilla probados con varios códigos DANE estándar, todos
rechazados con `{"postal_code":["no existe"]}`. Esperando que soporte
entregue la lista completa (ticket #47432505243). NO adivinar códigos
nuevos sin necesidad — cada intento fallido consume el límite de
solicitudes de la cuenta de producción.

## Estructura de Google Drive (categorías del catálogo)

Carpeta raíz "Mystery - Diseños", con subcarpetas por categoría:
Abstracto, Ánime, Deportes, Iconic, Música, Películas y Series.

Dentro de cada categoría, dos subcarpetas (creadas automáticamente por
código si no existen): "Mockups (Instagram)" y "Original (Portafolio)".

## Variables de entorno relevantes (nombres, no valores)

- `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`,
  `GOOGLE_OAUTH_REFRESH_TOKEN` — auth Drive (OAuth2, no cuenta de
  servicio)
- `ESTUDIO_PASSWORD` — acceso a /estudio
- `SKYDROPX_CLIENT_ID`, `SKYDROPX_CLIENT_SECRET`, `SKYDROPX_ENV`,
  `SKYDROPX_BASE_URL` (fijo en `https://pro.skydropx.com`)
- `SKYDROPX_COD_ENABLED` — flag para activar creación real de guías
  (hoy en `false`, pendiente de la lista de códigos postales)
- Variables de Wompi, Resend y Redis/Upstash ya documentadas en el
  CLAUDE.md original del proyecto.

**Recuerda siempre**: cualquier variable nueva en `.env.local` también
debe agregarse manualmente en Vercel (Settings → Environment Variables)
+ Redeploy — Vercel nunca lee `.env.local`, es exclusivo de tu máquina.
