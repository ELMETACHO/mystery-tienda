# Mystery Cuadros — Guía de pauta digital (TikTok / Meta / Google Ads)

> Investigación hecha en septiembre 2026 (Reddit, foros de PPC, guías de
> agencias, benchmarks 2026). Este archivo se relee antes de tocar
> cualquier tema de campañas — actualizar cuando cambie algo real
> (presupuesto, resultados, nuevas campañas).

## Contexto del negocio (para no perder de vista el margen)

- Precios: 30x40 = $65.000 COP, 40x50 = $89.000 COP (badge "Más
  elegido"), 50x70 = $149.000 COP. Envío incluido.
- Ganancia neta real por venta (ya con costos de fabricación, envío,
  pasarela, etc. descontados): **$17.000 – $27.000 COP**.
- Regla de oro: el CPA (costo por venta) NUNCA debe superar el 30-50%
  de esa ganancia, o la campaña le está regalando plata a Meta/TikTok/
  Google en vez de generarle utilidad al negocio.
  → **CPA máximo objetivo: $5.000 – $13.500 COP por venta.**
- Presupuesto disponible: $50.000 COP ya cargados en Google Ads +
  $500.000 COP totales a repartir (tarjeta de crédito, NO débito —
  ver sección "Tarjeta: crédito vs débito").
- 8 videos verticales (9:16) ya grabados y editados, listos para usar.

---

## 1. TikTok Ads

### Estructura de cuentas
Campaña (objetivo + presupuesto) → Grupo de anuncios (audiencia,
ubicación, presupuesto diario, evento de optimización) → Anuncio
(creativo + copy). Un grupo de anuncios puede tener varios anuncios
(varios videos) compitiendo por el mismo presupuesto.

### Objetivo correcto
**"Conversiones en el sitio web" / "Website Conversions"** — es el
único objetivo que optimiza de verdad para compra, no para clics. Elegir
"Tráfico" es el error #1 — TikTok te trae visitantes baratos que nunca
compran.

### Requisito previo: píxel
El píxel de TikTok (`DAGVFF3C77U70STH790G`) ya está instalado vía GTM y
confirmado disparando `InitiateCheckout`/`CompletePayment` — este
requisito ya está resuelto, no hay que tocar nada de tracking.

### Presupuesto y fase de aprendizaje
- El algoritmo necesita aproximadamente **25 conversiones por grupo de
  anuncios, por semana**, para salir de la "fase de aprendizaje" (donde
  el costo por resultado es más alto e inestable).
- Con nuestro CPA objetivo ($5.000-13.500 COP), eso equivale a
  **$125.000 – $340.000 COP por semana, por un solo grupo de anuncios**
  — una parte importante de todo nuestro presupuesto total.
- Recomendación de la comunidad: **menos grupos de anuncios, mejor
  financiados** — 1 solo grupo de anuncios bien financiado rinde más
  que 3-4 grupos con el presupuesto dividido en migajas.

### Errores más comunes (evitar)
1. Lanzar con un solo video — TikTok necesita 3-5 creativos distintos
   para poder comparar cuál engancha más. **Tenemos 8, perfecto.**
2. Presupuesto tan bajo que nunca sale de aprendizaje.
3. Editar la campaña (cambiar presupuesto, copy, targeting) durante los
   primeros 7 días o antes de las primeras conversiones — cada edición
   estructural **reinicia** la fase de aprendizaje.
4. Elegir mal el objetivo (Tráfico en vez de Conversiones).

### Plan de nombres de grupo (convención)
`Frio_CO_Amplio_18-45` — así de claro, para saber de un vistazo qué
público/etapa es cada uno.

---

## 2. Meta Ads (Facebook + Instagram)

### Objetivo correcto
**"Ventas" ("Sales")** con **Advantage+ Shopping Campaign** activado —
es el equivalente moderno de Meta a "optimizar para compra real", no
solo tráfico o interacción.

### Estructura recomendada 2026
- **Advantage+ Campaign Budget (antes "CBO")**: un solo presupuesto a
  nivel de campaña, y Meta reparte automáticamente entre los distintos
  anuncios/públicos según cuál está rindiendo mejor en tiempo real.
  Recomendado para presupuestos chicos — menos trabajo manual, la IA de
  Meta decide dónde rinde mejor cada peso.
- Alternativa (ABO): presupuesto fijo por grupo de anuncios — da más
  control, pero exige más gestión manual y más presupuesto para
  aprender bien cada grupo por separado. Con presupuesto ajustado, mejor
  usar Advantage+ (CBO).

### Requisito previo
- Píxel de Meta (`1401211724671605`) con evento `Purchase` — ya
  confirmado funcionando (disparó por última vez el 9 de sept 2026, ver
  sesión de configuración de GTM).
- Meta recomienda **10-20 variaciones de creativo** para que el
  aprendizaje de la IA sea óptimo — tenemos 8 videos, un poco por debajo
  del ideal pero suficiente para empezar.

### Fase de aprendizaje
Igual que TikTok, se necesitan del orden de ~50 eventos de optimización
(compras) para salir completamente de aprendizaje — con nuestro CPA
objetivo, eso son $250.000-$675.000 COP, más que todo nuestro
presupuesto total. **Expectativa realista: en esta primera ronda no
vamos a "madurar" completamente el algoritmo, solo vamos a recolectar
señal inicial real.**

### Pasos de creación (resumen)
1. Ads Manager → Campañas → **+ Crear**.
2. Objetivo: **Ventas**.
3. Activar **Advantage+ Campaign Budget**.
4. Evento de conversión primario: **Compra (Purchase)**.
5. Subir los creativos (videos) al nivel de anuncio.
6. Definir presupuesto diario/total y lanzar.

---

## 3. Google Ads

### Search vs Performance Max — decisión clave
- **Search funciona con cualquier presupuesto** (la comunidad reporta
  resultados desde $500 USD/mes, sin mínimo de conversiones) y tiene
  mejor ROAS promedio (5.17:1 vs 2.57:1 de PMax en benchmarks 2026).
- **Performance Max necesita 30+ conversiones/mes y ~$3.000 USD/mes**
  para que su machine learning tenga suficiente presupuesto para
  aprender — completamente fuera de nuestro alcance ahora.
- **Conclusión: SOLO Search por ahora. Nada de Performance Max hasta
  que el negocio tenga volumen real de conversiones y presupuesto
  mucho mayor.**

### Errores más comunes (evitar)
1. Palabras clave demasiado amplias ("broad match") sin control —
   quema presupuesto en búsquedas irrelevantes.
2. Mandar el tráfico pagado a la home genérica en vez de una página
   específica del producto/oferta — ya resuelto, en nuestro caso el
   flujo natural es `/crear` o el catálogo, ambos con intención clara.
3. No tener conversión configurada antes de lanzar — ya resuelto (GTM +
   Google Ads conversión "Compra" configurada y probada).
4. Presupuesto tan bajo que ni siquiera junta datos en varios días.

### Tipo de concordancia de palabras clave
Empezar con **concordancia de frase y exacta** (control alto), no
concordancia amplia — recién cuando haya resultados estables vale la
pena probar concordancia amplia. Armar una lista de **palabras clave
negativas** desde el día 1 (igual de importante que las positivas).

### Presupuesto
Con nuestro contexto local (CPC estimado $800-1.500 COP en este nicho,
investigado en la sesión de agosto/septiembre), Search es viable incluso
con presupuestos chicos tipo $10.000-20.000 COP/día — no necesitamos los
$20-30 USD/día que mencionan las guías (esas son para mercados con CPC
en dólares, no aplican 1:1 a Colombia).

---

## 4. ¿Vale la pena repartir el presupuesto entre las 3 plataformas?

**Consenso claro de la comunidad (Reddit, foros de PPC): NO, con
presupuesto chico.**

- Para presupuestos bajo ~$50 USD/día totales, la recomendación
  repetida es **mantener la estructura simple y concentrar el
  presupuesto en una sola plataforma** — reparte poco y no junta
  suficiente señal en ninguna.
- "Con un presupuesto muy chico casi no hay margen para 'aprender' la
  plataforma — mejor enfocarse en una, optimizar, y reinvertir las
  ganancias para expandirse a otros canales después."
- Aplicado a nuestros números: $500.000 COP repartidos entre 3 = ~$166.000
  COP cada una — ni siquiera alcanza para que UNA plataforma sola salga
  de su fase de aprendizaje (necesitan $125.000-675.000 COP solo para
  eso), mucho menos las 3 a la vez.

**Ver PLAN.md / sección de presupuesto en la conversación para la
decisión final de cómo repartir esto en la práctica.**

---

## Fuentes consultadas

- [TikTok Ads Manager: Complete Practical Guide 2026](https://tikadtools.com/blog/tiktok-ads-manager/)
- [TikTok Conversion Tracking: Pixel, Events API 2026](https://theadspend.com/blog/tiktok-conversion-tracking)
- [TikTok Campaign Objectives: Bidding, Placements & Optimization 2026](https://www.mbadv.agency/tiktok-ads/campaign-objectives)
- [CBO vs ABO: Meta ads budget strategy for 2026](https://superscale.ai/learn/cbo-vs-abo-advantage-plus/)
- [Meta Advantage+ Sales Campaigns: Complete 2026 Guide](https://blog.adnabu.com/facebook/meta-advantage-plus-sales-campaigns/)
- [Meta Advantage+ Shopping Campaigns Guide](https://conversion.studio/blog/meta-advantage-plus)
- [Google Ads for Small Businesses in 2026](https://arachnidworks.com/google-ads-for-small-businesses-in-2026/)
- [Performance Max vs Search Campaign: 2026 Comparison](https://blog.adnabu.com/google-ads/performance-max-vs-search-campaigns/)
- [PMax vs Search: Google Ads Budget Reallocation 2026](https://jetfuel.agency/performance-max-vs-search-how-should-ecommerce-brands-reallocate-google-ads-budget-in-2026/)
- [Reddit Ads Minimum Spend / small budget consensus](https://www.stackmatix.com/blog/reddit-ads-minimum-spend)
- [Credit vs debit card fraud protection for ad spend](https://www.moneycrashers.com/credit-vs-debit-fraud-protection)

---

## Campaña 1 — TikTok "Mystery - Ventas - Sep2026" (resultados reales, 14–22 sept 2026)

- **Gasto total:** $400.000 COP. **Conversiones reportadas por TikTok:** 7.
  **CPA real:** $57.142,86 COP/venta (dato de TikTok, coincide exacto con
  400.000/7).
- **Cruce contra pedidos reales del sitio** (Redis, excluyendo compras de
  prueba del propio dueño): 7 pedidos reales confirmados en la misma
  ventana (14–22 sept) — el número de TikTok coincide con ventas reales,
  no son conversiones fantasma.
  - Ingreso total de esas 7 ventas: **$543.000 COP** (mezcla de 30x40/
    40x50/50x70, Premium y Tradicional).
  - Ganancia neta real de esas 7 ventas (margen $17.000-27.000/venta, ver
    tabla de arriba): **≈$150.000-190.000 COP**.
  - Resultado: **el gasto publicitario ($400.000) fue 2-2.5x más grande
    que TODA la ganancia neta de lo que vendió** — la campaña no se pagó
    sola. Pérdida neta de la ronda: **≈$210.000-250.000 COP**.
  - CPA real ($57.143) está **4-11x por encima** del CPA objetivo
    ($5.000-13.500) definido arriba.

### Auditoría técnica del píxel (TikTok Events Manager, revisado 22 sept 2026)
Diagnóstico "Crítico" en 4 puntos — TODOS con impacto de CPA cuantificado
por el propio TikTok:
1. **Falta `content_id` en el 100% de los eventos** (11 días de
   antigüedad) — TikTok reporta -8% de CPA en Video Shopping Ads cuando
   este campo llega bien. `app/lib/gtm.js` sí manda `item_id` (el sizeId,
   ej. "30x40") dentro de `ecommerce.items[0]` en cada evento — el
   problema está del lado del TAG de TikTok dentro de GTM (tagmanager.
   google.com), que no está mapeando esa variable al parámetro
   `content_id` que espera TikTok. **Revisar en GTM la configuración del
   tag de TikTok Pixel → Content ID → apuntar a la variable de capa de
   datos `ecommerce.items.0.item_id`.**
2. **Falta correo/teléfono en 58% de los eventos, y el teléfono llega
   inválido en 8%** — TikTok reporta -13% de CPA promedio cuando llegan
   completos y válidos (esto es "Advanced Matching": permite a TikTok
   reconocer al mismo usuario entre dispositivos). El teléfono debe ir en
   formato E.164 (`+57...`, solo dígitos tras el +) para no marcarse como
   inválido.
3. **"Eventos ausentes" — falta el embudo completo**: hoy solo llegan
   señales de `PageView`/`InitiateCheckout`/`Purchase`. No hay
   `ViewContent` (ver un diseño del catálogo), `AddToCart` (equivalente:
   confirmar tamaño en `/crear`), `AddPaymentInfo`, ni
   `CompleteRegistration`. TikTok reporta -5.7% a -7.7% de CPA cuando el
   embudo completo está instrumentado — con solo 2 señales, el algoritmo
   tiene mucha menos información para decidir a quién mostrarle el
   anuncio.
4. **Sin catálogo conectado al píxel** — bloquea el "product match" (que
   TikTok pueda mostrar el diseño específico que alguien vio, no solo un
   anuncio genérico) para remarketing dinámico más adelante.

**Ninguno de estos 4 puntos es un problema del código del sitio** (el
`dataLayer` ya manda lo necesario) — son configuración pendiente dentro
del contenedor de GTM (tagmanager.google.com), específicamente en el tag
del píxel de TikTok. Corregirlos no cuesta presupuesto de pauta, solo
tiempo de configuración, y TikTok mismo cuantifica la mejora esperada.

### Decisión para la Campaña 2
- **Arreglar los 4 puntos del píxel ANTES de recargar presupuesto** — es
  la mejora de más alto impacto por menor esfuerzo disponible ahora
  mismo, y no cuesta nada de pauta.
- **Seguir solo en TikTok por ahora** — Meta se suma después como capa de
  RETARGETING (remarketing a quien ya vio el video o inició checkout sin
  pagar), no como una segunda campaña fría paralela — es el modelo que
  reporta mejor resultado combinado según la investigación (TikTok para
  descubrimiento, Meta para volver a impactar a quien ya mostró interés).
  Repartir el presupuesto entre las dos desde cero, con este tamaño de
  presupuesto, diluye la señal de ambas (ver sección 4 arriba).
- **Concentrar en menos videos, mejor elegidos**: en vez de rotar los 8
  videos parejo, dejar correr esta ronda 5-7 días sin tocar nada, medir
  cuál tuvo mejor "hook rate" (retención de los primeros 3 segundos) y
  quedarse con 2-3 ganadores para la siguiente tanda — coincide con el
  patrón "escribe 11 variaciones de gancho, prueba 5, escala 2" que
  reporta la comunidad.
- **Fórmula de guion recomendada para nuevas piezas** (gancho 0-3s →
  problema 3-10s → producto como solución 10-20s → CTA final 3-5s,
  20-34s de duración total, nunca mencionar la marca en los primeros 3
  segundos): probada por la comunidad como la estructura que más
  convierte en UGC de TikTok — ver fuentes.

## Fuentes consultadas (ronda 2, sept 2026)
- [TikTok Ads Conversion Rate: 10 Signs It's Working — Darkroom](https://www.darkroomagency.com/observatory/10-signs-of-good-tiktok-ad-conversions-and-how-to-achieve-them)
- [2026 TikTok Conversion Ads That Actually Lower Your CPA — TikAdTools](https://tikadtools.com/blog/tiktok-conversion-ads/)
- [UGC Script Templates: 10 Proven Structures & 20 Hook Formulas (2026) — Reloop](https://reloop.so/blog/article/ugc-script-templates/)
- [The First 3 Seconds: UGC Ad Hooks — Hustler Marketing](https://www.hustlermarketing.com/blog/how-to-write-ugc-ad-hooks-that-stop-the-scroll-on-meta-and-tiktok/)
- [Facebook Ads vs TikTok Ads: Which Platform Wins in 2026? — AdManage](https://admanage.ai/blog/facebook-ads-vs-tiktok-ads)
- [TikTok Ads vs. Facebook Ads — Triple Whale](https://www.triplewhale.com/blog/tiktok-ads-vs-facebook-ads)

---

## Corrección del píxel — completada y publicada (22 sept 2026)

Los 4 puntos críticos del diagnóstico (ver sección anterior) ya se
corrigieron en GTM y se probaron uno por uno con datos reales antes de
publicar — **Versión 4 del contenedor** (`GTM-M8BSXNX8`), publicada el
22 sept 2026 a las 18:49 por oscarmetacho@gmail.com.

### Qué se cambió
- **Variables nuevas** (Variable de capa de datos): `DLV - content_id`
  (`ecommerce.items.0.item_id`), `DLV - email` (`user_data.email`),
  `DLV - phone` (`user_data.phone`).
- **`TikTok Pixel - CompletePayment`**: se agregó `ttq.identify({email,
  phone_number})` antes del track, y `contents: [{content_id,
  content_type:'product', quantity:1}]` al evento.
- **`TikTok Pixel - InitiateCheckout`**: se agregó el mismo bloque
  `contents` con `content_id` (sin `identify`, porque en ese punto el
  cliente puede no haber llenado el formulario todavía).
- **`Meta Pixel - Purchase`**: se agregó `fbq('init', PIXEL_ID, {em, ph})`
  justo antes del track (Advanced Matching de Meta), más `content_ids:
  [content_id]` y `content_type:'product'`.
- **`Meta Pixel - InitiateCheckout`**: se agregó `content_ids`/
  `content_type`.
- **4 tags nuevos** (con sus activadores nuevos `view_item` y
  `add_to_cart`, evento personalizado): `TikTok Pixel - ViewContent`,
  `TikTok Pixel - AddToCart`, `Meta Pixel - ViewContent`, `Meta Pixel -
  AddToCart` — cierran el hueco de "eventos ausentes" que reportaba
  TikTok.
- **Código del sitio** (`app/lib/gtm.js`, `app/components/CrearFlow.jsx`):
  se agregaron `trackViewContent()` (dispara al montar `/crear` o el
  flujo embebido en `/ads`) y `trackAddToCart(order)` (dispara justo
  cuando el cliente confirma foto+tamaño, pantalla "Tu cuadro está
  listo") — antes del embudo solo tenía 2 señales (`begin_checkout` y
  `purchase`). `trackPurchase(order)` también se amplió para mandar
  `user_data.email`/`phone` del cliente (viene de `order.customer`, solo
  disponible en la pantalla de confirmación, no antes).

### Validado en Vista previa de GTM con datos reales
- `add_to_cart` confirmado con `item_id:"30x40"` real (vía
  `dataLayer.filter(e => e.event === "add_to_cart")` en consola).
- Los 4 tags nuevos dispararon "Activada"/"Completada" en la sesión de
  prueba.
- `purchase` (simulado por consola con una referencia real,
  `mystery-cod-1790120019176`, porque el navegador se quedó atascado en
  la pantalla de Wompi sin volver al sitio — el pedido igual se confirmó
  solo, vía el webhook ya corregido) mostró `TikTok Pixel -
  CompletePayment` y `Meta Pixel - Purchase` como "Completada", con
  `content_id`/`value`/`email`/`phone` reales.

### Siguiente paso: confirmar la mejora
Esperar 24-48h desde la publicación y volver a revisar TikTok Events
Manager → Diagnóstico — buscar que bajen/desaparezcan los 4 puntos
críticos originales. Recién con eso confirmado se decide el presupuesto
de la Campaña 2 (no antes — ver tabla de decisión en la sección
anterior: CPA real <$25k → escalar; $25k-$40k → no recargar, seguir
optimizando; >$40k → pausar).

## Resultado por video — Campaña 1 (9-22 sept 2026, revisado a nivel Anuncio)

| Video | Gasto | Impresiones | CTR | CPA | Conversiones |
|---|---|---|---|---|---|
| 5.MOV | $254.894 (64% del total) | 55.027 | 1,34% | $50.979 | 5 |
| 8.MOV | $77.032 | 25.175 | 0,75% | $77.032 | 1 |
| 6.MOV | $24.173 | 7.802 | 1,06% | **$24.173 (mejor CPA)** | 1 |
| 7.MOV | $15.737 | 16.588 | 0,55% | — | 0 |
| 1.MOV | $13.333 | 4.299 | 1,14% | — | 0 |
| 2.MOV | $6.288 | 2.204 | **1,18% (mejor CTR)** | — | 0 |
| 3.MOV | $4.710 | 1.349 | 0,37% (el peor) | — | 0 |
| 4.MOV | $3.833 | 1.340 | 0,67% | — | 0 |

- **TikTok mismo ya "votó" por 5.MOV**, asignándole el 64% de todo el
  presupuesto por su cuenta — es la señal más confiable de cuál
  funciona, más que cualquier lectura manual.
- **6.MOV es la sorpresa**: con solo 6% del presupuesto, sacó el mejor
  CPA de la ronda (casi la mitad que 5.MOV) — candidato fuerte a que se
  sostenga con más volumen.
- **1.MOV y 2.MOV tuvieron mejor CTR que 5.MOV** pero con tan poco gasto
  que nunca llegaron a convertir — no están descartados, solo sin probar
  a fondo.
- **3.MOV, 4.MOV, 7.MOV y 8.MOV quedan fuera de la Campaña 2** (peor
  CTR/CPA de la tanda, sin señal positiva que los sostenga).

**Decisión para la Campaña 2 (videos)**: **5.MOV + 6.MOV + 1.MOV**
(1.MOV elegido sobre 2.MOV por tener más impresiones detrás de un CTR
parecido — dato más confiable con esa muestra tan chica).

## Aviso de Search Console (no relacionado con ads) — resuelto, era falsa alarma
"Duplicada: el usuario no ha indicado ninguna versión canónica" en 12
páginas de `/producto/[id]`, con fecha de rastreo del 31 ago-10 sept.
Verificado en vivo (22 sept): esas páginas SÍ tienen `<link
rel="canonical">` correcto hoy — el aviso reflejaba el estado de hace 3
semanas, antes de que Google volviera a rastrearlas. Acción: pulsar
"Validar corrección" en Search Console para pedir un recrawl, sin tocar
código. No afecta tráfico pagado ni conversiones, solo indexación
orgánica.

---

## Ronda 3 de investigación (24 sept 2026) — temporada, presupuesto, rentabilidad, contenido

### El problema real de la Campaña 1 NO fue el costo del tráfico
Embudo reconstruido con los datos por video (tabla de arriba):
~114.000 impresiones → CPM ≈ $3.500 COP (rango normal Colombia: $1.500–4.000)
→ ~1.190 clics (CPC ≈ $336) → 7 compras = **conversión clic→compra ≈ 0,6 %**.
Benchmark TikTok optimizado a conversión: ~1,9 %. Con el MISMO tráfico, subir
la conversión a ~1,8 % baja el CPA de $57.000 a ~$19.000 (punto de
equilibrio ≈ $20.000). **La palanca es la landing/oferta, no el presupuesto.**

### Datos reales de pedidos (Redis `completed-orders`, 24 sept)
- 12 pedidos reales de clientes (sin contar pruebas ni armados a mano).
- **9 de 12 (75 %) fueron contraentrega** → "Paga al recibir" es el
  argumento de venta #1. Debe aparecer en el anuncio (texto en pantalla/
  CTA), no solo en la landing.
- Ticket promedio ≈ $75.000 (sin el especial de 100x140). El más vendido
  es el más barato: 30x40 Tradicional $55.000 (4 de 12).
- Límite de datos: Redis solo guarda el final del embudo. Visitas a `/ads`,
  subidas de foto y abandono por paso hay que sacarlos de GA4 (Explorar →
  Exploración de embudo: page_view `/ads` → view_item → add_to_cart →
  begin_checkout → add_payment_info → purchase; view_item/add_to_cart
  existen solo desde el 22 sept, add_payment_info desde el 24 sept).

### Riesgo en `/ads`: urgencia falsa
`CountdownBanner` (reinicia cada hora, no hay oferta real detrás) y
`ViewersCounter` (número aleatorio 20–100) son urgencia simulada. Riesgo
doble: políticas de anuncios de TikTok (landing engañosa) y Estatuto del
Consumidor (Ley 1480, publicidad engañosa — la vigila la SIC). Además
puede restar confianza al comprador colombiano, que ya desconfía de
comprar en línea (por eso gana la contraentrega). Pendiente decidir: reemplazar por urgencia REAL
(ej. "Pide antes del 12 dic y llega antes de Navidad").

### Temporada y presupuesto
- Amor y Amistad ya pasó (19 sept). Octubre = valle de regalos en Colombia
  y el mes de CPM más caro del Q4 (dato EE.UU. 2024: oct $5,84 > nov $5,11
  > dic $4,90). **Temporada fuerte: mediados de nov → ~12-15 dic**
  (Navidad + prima de diciembre + CPM bajando; corte por tiempos de
  producción/envío).
- Octubre = prueba chica: $20.000–30.000/día, 7–10 días
  ($150.000–250.000), videos 5/6/1.MOV. **Regla de corte: video que gaste
  $60.000 (3× CPA de equilibrio) sin venta → se apaga.**
- Escalar en nov-dic SOLO si el CPA de octubre quedó < ~$25.000; subir de
  a 30–40 % por vez.
- No hace falta "salir de aprendizaje" (50 ventas) para ser rentable — lo
  que manda es CPA vs. margen. Opción para aprender más rápido con poco
  volumen: grupo aparte optimizado a InitiateCheckout/AddToCart, juzgado
  por costo por VENTA real, no por evento.
- Margen por venta usado para decisiones: ~$20.000 (dentro del rango
  $17.000–27.000 de arriba).

### Orgánico + pago
- Simultáneos se ayudan: el orgánico es el laboratorio gratis de
  creativos; el que retenga y genere comentarios de compra se pauta como
  **Spark Ad** (reportado: −37 % CPA, +24 % conversión vs. anuncio normal).
- Pago: un solo canal (TikTok). Orgánico: mismo video en TikTok + Reels,
  exportado SIN marca de agua de TikTok, texto/portada nativos de cada red.
- Meta: CPM 30–50 % más caro que TikTok para <35 años en Colombia, pero
  público mayor (mamás 30–50, comprador fuerte de regalos). Entra en
  noviembre como RETARGETING (vieron video / checkout sin pagar), no en frío.

### Guion: fórmula "Grefg" (video de Lord Draugr, dic 2020) adaptada a 20-30s
Principios del análisis que siguen vigentes (la retención sigue siendo lo
que el algoritmo premia): objetivo claro al inicio → "escalera" de
intensidad con altibajos (le pasan cosas buenas y malas) → clímax → cierre
que vuelve al concepto inicial. Lo épico = lo DIFÍCIL (mostrar el
obstáculo). Música que sube, se corta en un tropiezo y explota recién en
el clímax. Cambios de plano/zoom para tensión.
Lo que NO aplica a un anuncio de 20-30s: el "bloque de comunidad"
(sorteo/anuncio) y el teaser — no hay tiempo; el acto 1 se comprime al
gancho de 0-2s. Sí aplica al orgánico largo (60-90s, storytime, sorteos).
Adaptación: foto difícil/dañada/borrosa (obstáculo) → proceso con
tropiezo (IA, impresión, empaque) → revelación/reacción de quien lo recibe
(clímax) → cierre + CTA "paga al recibir".

### Fuentes (ronda 3)
- [TikTok Ads Cost 2026 — AdManage](https://admanage.ai/blog/tiktok-ads-cost)
- [How to Start TikTok Ads with a Small Budget — Coinis](https://coinis.com/how-to/start-tiktok-ads-with-small-budget)
- [TikTok Spark Ads 2026 — TikAdTools](https://tikadtools.com/blog/tiktok-spark-ads/)
- [Spark Ads e-commerce 2026 — SearchTheTrend](https://www.searchthetrend.com/blog/spark-ads-tiktok)
- [Ecommerce Benchmarks 2026 — Triple Whale](https://www.triplewhale.com/blog/ecommerce-benchmarks)
- [Cuánto cuesta Meta Ads en Colombia 2026 — Consolidación Digital](https://www.consolidaciondigital.com/blog/performance-marketing/cuanto-cuesta-meta-ads-colombia)
- [TikTok Ads para empresas en Colombia 2026 — Sense Digital](https://sense-digital.co/blog/posts/2026-05-05-tiktok-ads-publicidad-empresas-colombia-2026.html)
- [GREFG Y LA NARRATIVA ÉPICA EN YOUTUBE — Lord Draugr](https://www.youtube.com/watch?v=dsjTrNesgKE)
- [TikTok Ad Creative Best Practices 2026 — Stackmatix](https://www.stackmatix.com/blog/tiktok-ad-creative-best-practices-2026)
- [11 TikTok video ideas for merchants — Practical Ecommerce](https://www.practicalecommerce.com/11-tiktok-video-ideas-for-merchants)
