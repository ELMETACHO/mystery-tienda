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
