# Bitácora de sesiones — Mystery Tienda

> Resumen de trabajo real hecho sesión por sesión, para que una sesión
> nueva de Claude Code (después de un `/clear`, o en otra máquina) tenga
> el contexto sin tener que releer toda la conversación. Se agrega una
> sección nueva al final cada vez que termina una sesión larga — nunca se
> reescribe lo viejo, solo se suma. Este archivo se importa automático
> desde CLAUDE.md (`@BITACORA.md`), así que Claude Code lo lee siempre al
> arrancar, sin que el usuario tenga que pedirlo.
>
> Para el contexto de campañas de ads (TikTok/Meta/Google), la referencia
> completa es `ADS.md`, no este archivo — solo se linkea acá.

---

## Sesión del 19-23 sept 2026 — inventario, resiliencia de pagos, píxel de ads, sangrado, chatbot

### 1. Inventario físico (`/admin/inventario` + panel de Cris en `/fabricante`)
- Redis (`app/lib/inventory.js`): stock por `{tamaño}:{premium|tradicional}`
  + `soportes` (solo los Tradicional gastan un soporte, sin importar
    tamaño; los Premium no llevan soporte).
- Se descuenta solo con ventas reales confirmadas (Wompi completo, COD,
  regalo), de forma **diferida con `after()`** — nunca frena ni demora el
  checkout, nunca lo ve el cliente.
- Cada cambio (venta automática o ajuste manual) queda en un historial con
  quién, cuándo y qué — visible en ambos paneles (comparten el mismo
  componente `InventoryPanel.jsx`).
- Alerta por correo a `contacto@elmetacho.com` cuando una referencia cruza
  su umbral (3 para cuadros, 5 para soportes) o llega a 0.
- Stock inicial sembrado (sept 2026): 40x50 Premium 12, 40x50 Tradicional
  11, 30x40 Premium 6, 30x40 Tradicional 5, soportes 15. 50x70 no se
  rastrea todavía.

### 2. Checkout: nunca debe frenarse por algo interno
- `/checkout`: si Wompi aprobó el pago en el navegador, el cliente
  **siempre** llega a la pantalla final — aunque la confirmación interna
  (correos, inventario, etc.) falle o tarde. Antes eso sí podía mostrarle
  un error pese a haber pagado.
- **Respaldo permanente** (`app/lib/paidBackup.js`, 1 año): copia de cada
  pedido pagado con datos de entrega + imagen, por si algo falla en la
  cadena normal. Ver `/admin/respaldos`.
- **Conciliación automática**: el cron horario que ya existía (antes solo
  para "carrito abandonado") ahora también revisa cada pedido pendiente
  contra Wompi directamente — si el pago está aprobado y nunca se
  confirmó (webhook caído, navegador atascado, etc.), lo confirma solo.
- **Causa real de 3 pagos "perdidos" (18-21 sept)**: la URL de eventos de
  Wompi (Desarrollo → Programadores) estaba vacía en producción — el
  webhook nunca tuvo dónde avisar. Ya se configuró
  (`https://www.mysterycuadros.com/api/wompi-webhook`) y se confirmó
  funcionando con una compra de prueba real.

### 3. BUG REAL corregido — sobrecobro en pedidos contraentrega (Skydropx)
**El hallazgo más importante de esta sesión.** Desde que existe la guía
manual de Skydropx, todo pedido contraentrega declaraba/cobraba el
**precio TOTAL** del cuadro al entregar, encima del anticipo de $20.000 ya
pagado por Wompi — confirmado contra el propio panel de Skydropx
(`app/lib/skydropx.js`, función `createShipment`/`createQuotation` usaban
`order.priceCOP` en vez del saldo pendiente).

**Corregido** (`getCodAmount()` en `skydropx.js` + `app/api/generate-shipment/route.js`
+ `app/api/fabricante-generate-shipment/route.js`): ahora, para pedidos
`isCod=true`, se declara/cobra `record.saldoPendiente` (precio − anticipo),
no el precio total. Pedidos de pago completo por Wompi no cambian.

- Oscar ya devolvió $20.000 a los 3 clientes contraentrega afectados
  (Zamir Sierra, Arle Medina Pérez x2) y les avisó que pagan el valor
  completo al recibir, ya que sus guías se generaron ANTES del fix.
- **Pendiente de confirmar en vivo**: el próximo pedido donde Cris genere
  la guía (Juan Pablo García Aponte, 30x40, saldoPendiente=$45.000,
  referencia `mystery-cod-1790031223089`, guía se genera ~24 sept) debe
  mostrar $45.000 en el panel "Contra entrega" de Skydropx, no $65.000. Si
  sale bien, el fix queda 100% confirmado de punta a punta.

### 4. Sangrado con espejo (pedido de Cris)
- **Sin sangrado arriba** en ningún pedido nuevo — el borde superior del
  archivo de impresión coincide con el borde superior del cuadro, para
  que Cris alinee las esquinas de arriba y recorte el excedente de los
  otros tres lados.
- Izquierda/derecha/abajo: 1cm de sangrado, ahora con **reflejo** en vez
  de estirar 1px (`drawWithMirrorEdges` en `app/crear/cropImage.js`) —
  elimina las rayas horizontales que dejaba el método viejo.
- Aplica a pedidos nuevos de `/crear`/`/ads` y a lo que se suba nuevo en
  `/estudio`. Los diseños de catálogo ya subidos y pedidos viejos NO se
  actualizan solos.

### 5. Píxel de TikTok/Meta corregido (GTM, no código del sitio)
Diagnóstico de TikTok (sept 2026) marcaba 4 críticos: falta `content_id`
en 100% de eventos, falta correo/teléfono en 58%, teléfono inválido 8%,
y falta el embudo completo (solo llegaban `InitiateCheckout`/`Purchase`).

- **Corregido en GTM** (Versión 4, publicada 22 sept 18:49): variables
  nuevas (`DLV - content_id/email/phone`), tags de TikTok/Meta editados
  con `contents`/`content_ids` + Advanced Matching (`ttq.identify`,
  `fbq('init', ...)`), y 4 tags nuevos (`ViewContent`/`AddToCart` en
  ambas plataformas) con triggers `view_item`/`add_to_cart`.
- **Corregido en código** (`app/lib/gtm.js`, `app/components/CrearFlow.jsx`):
  se agregaron `trackViewContent()` (al entrar a `/crear` o `/ads`) y
  `trackAddToCart(order)` (al confirmar foto+tamaño) — antes el embudo
  solo tenía 2 señales. `trackPurchase` ahora también manda
  `user_data.email/phone`.
- Todo probado con datos reales en Vista previa de GTM antes de publicar
  (ver hilo completo para el paso a paso si hay que repetirlo en otra
  cuenta).
- **Pendiente**: revisar el Diagnóstico de TikTok 24-48h después de
  publicar (23-24 sept) para confirmar que los 4 críticos bajaron. Con
  eso se decide el presupuesto/videos de la Campaña 2 — ver `ADS.md`,
  que ya tiene todo el análisis de campaña 1, los 8 videos evaluados
  (ganadores: 5.MOV + 6.MOV + 1.MOV) y el plan completo.

### 6. Chatbot: botones de acceso rápido (`app/components/ChatWidget.jsx`)
- **📦 Estado de mi pedido**: pide correo o celular, responde con datos
  reales de Redis (nunca por IA) — busca en `manual-shipment:*` de los
  últimos 30 días. Dice si está en producción o ya despachado (con
  número de guía).
- **💰 Tamaños y precios / 🚚 Tiempos de envío / ↩️ Devoluciones**: mandan
  una pregunta ya escrita al bot normal.
- Endpoint `/api/chat-order-status`, límite de 8 consultas/min por IP.

### 7. Pedidos especiales atendidos a mano en esta sesión
Estos 3 se armaron manualmente (imagen mejorada con Replicate + sangrado
espejo + correo a Cris disparado con las mismas funciones que un pedido
real), porque su pago no pasó por el flujo normal del sitio:
- **Juan Pablo García Aponte** (`mystery-cod-1790031223089`) — 30x40
  Premium, luego cambiado a 100x140 con Nequi aparte (ver Antonio abajo,
  es la misma persona/pedido reconsiderado — **verificar cuál de las dos
  versiones quedó vigente si se retoma este caso**).
- **Rodrigo Jose Canchila Jaraba** (`rcanchila@gmail.com`) — pago
  aprobado en Wompi el 18 sept que nunca se confirmó (causa: webhook sin
  URL, ver punto 2). Reconstruido manualmente con foto que el cliente
  reenvió por WhatsApp.
- **Antonio Padilla** (`mystery-cod-1789827192038`, Barranquilla) — pagó
  $20.000 anticipo por Wompi, luego $150.000 más por Nequi (fuera del
  sistema) por un cambio a 100x140. Pedido armado con
  `priceCOP: 320000`, `saldoPendiente: 150000` — Skydropx va a
  declarar/cobrar solo $150.000 al entregar (ya con el fix del punto 3).
  **Nota técnica**: se agregó `CUSTOM_SIZE_SPECS` en `skydropx.js` para
  que el tamaño 100x140 (fuera del catálogo normal) pueda generar guía
  sin romper — no aparece como opción de compra en el sitio, solo sirve
  para este tipo de pedido especial cotizado a mano.

### Comandos/patrones útiles descubiertos esta sesión
- Para correr funciones de `app/lib/*.js` sueltas desde Node (fuera de
  Next), hace falta un loader que resuelva imports sin extensión — ver
  patrón `ext-loader.mjs` usado varias veces en el hilo.
- `npx next build` puede quedarse colgado si hay procesos `node.exe`
  viejos compitiendo — matar por PID real (`Get-Process node | Where
  Path -like '*Program Files\nodejs*'`) antes de reintentar, mismo
  criterio que ya documentaba CLAUDE.md para `next dev`.
- Redis (Upstash) rechaza un único valor si pesa demasiado ("OOM command
  not allowed") — no es que la base esté llena, es un límite por
  comando. Pasó al intentar guardar un PNG de 88MB sin comprimir
  (upscale de un pedido 100x140) — la solución fue convertir a JPEG de
  alta calidad antes de guardar/enviar.

---

## Sesión del 23-24 sept 2026 — Servientrega vetada, cancelar/regenerar guías, links localhost, perfil sRGB

### 1. Servientrega vetada en la elección de transportadora (`app/lib/skydropx.js`)
- **Antes**: se cotizaba y se tomaba la tarifa más barata (en contraentrega,
  solo entre `COD_CARRIERS`). Servientrega salía cuando era la más barata.
- **Problema**: Servientrega empezó a exigir protección adicional, caja y
  valor declarado, y devolvió pedidos que no cumplían.
- **Ahora** (`pickRate`): la más barata que NO sea Servientrega. Solo si
  Servientrega es la ÚNICA opción se usa, y `createManualShipment` devuelve
  `requiresExtraProtection: true` → correo `sendExtraProtectionEmail`
  (`app/lib/email.js`, al fabricante + contacto@, con el valor comercial del
  cuadro) + banner en la página de resultado de `/api/generate-shipment` +
  mensaje en `/fabricante` al regenerar.

### 2. Valor declarado — decisión pendiente con Skydropx
- Pedidos pagados completos por Wompi: ya declaran el valor comercial
  (`order.priceCOP`). Sin cambios.
- Contraentrega: NO se cambió. En esta API, Skydropx usa el valor declarado
  como MONTO A COBRAR al entregar (ver fix de sobrecobro del 22 sept); declarar
  el valor comercial volvería a cobrar de más. **Pendiente**: preguntar a
  soporte de Skydropx si existe un campo aparte para el monto COD
  (`cod_amount` o similar). Mientras, el valor comercial va en el correo de
  Servientrega para que Cris lo reporte a mano.

### 3. Botón "generar guía" apuntando a localhost:3000 — caso aislado, ya blindado
- Pasó solo con el pedido de Rodrigo Canchila (reconstruido a mano corriendo
  el código desde la máquina local, donde `.env.local` tiene
  `SITE_URL=http://localhost:3000`). Los pedidos normales corren en Vercel y
  usan el dominio real. Cris lo resolvió pegando la ruta en el dominio real.
- **Blindaje**: `EMAIL_SITE_URL` en `app/lib/siteUrl.js` — todos los links
  de correos (`email.js`) caen a `https://www.mysterycuadros.com` si
  `SITE_URL` es localhost.

### 4. Cancelar / regenerar guía desde `/fabricante`
- Flujo: Cris cancela en su panel (NO desde el correo) → Skydropx cancela y
  reembolsa → aparece "Generar guía nueva" → nueva guía (ya sin Servientrega).
- Arreglos: el botón "Generar guía nueva" ahora aparece apenas se cancela
  (antes había que recargar); si Skydropx rechaza la cancelación, se muestra
  el motivo real (`fabricante-cancel-shipment/route.js`).
- **Pendiente de confirmar en vivo** (Cris lo prueba el 24 sept): cancelar y
  regenerar las 3 guías Servientrega devueltas, todas en estado "created" en
  Skydropx (nunca escaneadas → cancelables), pestaña Premium:
  - Juan Pablo García Aponte `mystery-cod-1790031223089` — COD, 30x40, cobra
    $45.000 (no se le devolvió anticipo).
  - Arle Medina Pérez `mystery-cod-1789582057832` — COD, 40x50. **Se le
    devolvió el anticipo de $20.000**, así que su `saldoPendiente` en
    `manual-shipment:*` se subió a mano a **$89.000** (valor completo, con
    campo `nota` explicándolo). Corrección a la sesión anterior: Arle compró
    UNA sola vez — el "x2" de la bitácora del 19-23 sept era un error.
  - Juan Sebastián Galindo `mystery-1789530352469` — pagado completo por
    Wompi, no cobra nada al entregar.
  - Verificar: transportadora nueva de cada una, reembolso de las 3 en el
    saldo de Skydropx, y monto "Contra entrega" correcto en las 2 COD.

### 5. Perfil de color sRGB en TODOS los archivos de impresión
- Cris confirmó que el archivo con perfil sRGB (antes solo lo tenían las
  fotos mejoradas con IA, `upscaleImage.js`) imprimía con color mucho mejor.
- **Ahora** `embedSrgbProfile` (`app/lib/printColorProfile.js`) se aplica en
  `sendOrderEmails` al adjunto del fabricante, para cualquier pedido (foto
  propia, catálogo, regalo, IA fallida). JPEG: inserta el APP2 ICC sin
  recomprimir; PNG: reescritura sin pérdida conservando densidad. Probado:
  píxeles idénticos y densidad física intacta. Si ya trae perfil, no se toca.
- No cubre: descarga desde `/admin/respaldos` ni los originales en Drive.
- **Pendiente**: que Cris confirme el color en la próxima impresión.

Commits: `795c493` (Servientrega/localhost/cancelar), `47ead09` (sRGB).

---

## Sesión del 24 sept 2026 — tope de envío, Servientrega de vuelta, doble clic, guías duplicadas

### 1. Regeneración de las 3 guías Servientrega — verificada OK
Cris canceló y regeneró las 3 (Juan Pablo → Envía 014163948168; Arle →
Coordinadora 58104007148; Galindo → Envía 014163948194). Cancelar resta la
comisión y regenerar la vuelve a sumar (`markManufacturerOrderCancelled` /
`markManufacturerOrderRegenerated`): queda $15.000 una sola vez por cuadro.
**Fix de sobrecobro COD confirmado de punta a punta**: la guía física de
Juan Pablo dice "Valor a recaudar $45.000" (saldo, no el total).

### 2. Guías duplicadas por doble clic — causa raíz + limpieza
- Dos clics seguidos en el botón del correo creaban DOS guías en Skydropx
  (números consecutivos) y sumaban la comisión dos veces. El sistema solo
  guardaba una, así que la gemela quedaba activa y cobrada sin que nadie la
  viera. Casos: Arle 2259223771 (gemela de …772), Juan Pablo 2259224221
  (gemela de …222, 1 segundo de diferencia).
- Las 2 gemelas se cancelaron desde acá (reembolsadas, $36.921).
- Saldo de Cris corregido a mano de $90.000 → $75.000 (sobraban $15.000 del
  doble registro de Juan Pablo del 23 sept). Sin pagos registrados aún.
- **Blindaje** (`acquireShipmentGenerationLock` en `manualShipments.js`,
  SET NX 90s por pedido): generar (correo), regenerar y cancelar (panel)
  solo dejan pasar una petición a la vez y releen el estado tras tomar el
  candado. `markManufacturerBalancePaid` ahora usa GETSET atómico.
- Revisados el resto de botones del sitio (checkout, regalo, reseñas,
  referidos, chat, /estudio, admin): todos se deshabilitan al primer toque y
  el pago se confirma de forma idempotente por transacción de Wompi. El
  problema era exclusivo del formulario HTML plano del correo.

### 3. Tope de costo de envío: $26.000 (`MAX_SHIPPING_COST_COP`, `skydropx.js`)
- Motivo: guía Coordinadora a Maicao (Arle, COD) costó $64.913 — pérdida.
  Servientrega cotizaba ~$24.400 al mismo destino.
- **Servientrega vuelve a competir por precio** (se elige la más barata,
  incluida ella); si gana, sigue el aviso de protección extra a Cris.
- Si la tarifa más barata > $26.000: no se genera guía. Si la guía final
  sale por encima aunque la cotización no, se cancela sola.
- **Cotización apenas se paga** (`checkShippingCoverageAfterPayment` en
  `app/lib/noCoverage.js`, dentro del `after()` de `confirmApprovedOrder` /
  `confirmApprovedCodOrder`): invisible para el cliente (pedido explícito de
  Oscar — el checkout NUNCA debe frenarse ni mostrar nada). Si supera el
  tope: el pedido NO se le manda a Cris, no se descuenta inventario, estado
  `no_coverage` en `manual-shipment:*`, correo al cliente ("no enviamos a tu
  ciudad, devolución programada") y aviso a contacto@ con el monto a
  devolver. **La devolución la hace Oscar a mano** (Wompi/Nequi). Si la
  cotización falla, el pedido sigue normal y queda el tope al generar guía
  como red de seguridad. Pedidos de regalo solo pasan por esa segunda red.
- Probado en vivo solo la cotización (Maicao COD → Servientrega $24.605).
  **Pendiente**: ver el primer caso real "sin cobertura" de punta a punta.
- Decisión de precios: NO subir precios ni cobrar envío en checkout (la
  mayoría de guías cuestan $8.700–$13.700, envío gratis se mantiene).

### 4. Animación "Estoy generando la guía…"
Pedido de Cris: la página del botón del correo quedaba en blanco 10-30s.
Ahora muestra overlay con spinner y pasos cada 5s; "Generar guía nueva" en
`/fabricante` muestra el mismo aviso.

### Pendientes abiertos
- Cris debe preguntar en Servientrega qué empaque exigen (caja plana a
  medida con las mismas medidas declaradas en Skydropx, para evitar
  "Cargos extra").
- Opcional: pedir a soporte Skydropx (ticket #47432505243) rebaja de la
  guía Coordinadora 58104007148 ($64.913, ya en tránsito, no cancelable).
- Sigue pendiente de sesiones anteriores: campo aparte para monto COD vs.
  valor declarado en Skydropx; confirmar color sRGB en impresión.

Commits: `c72e16a` (tope + Servientrega), `21c10b0` (cotizar al pagar),
`b5f46da` (doble clic), `1f1ed43` (animación), `95ea7aa` (GETSET finanzas).
