// Empuja un evento al dataLayer de Google Tag Manager (ver contenedor en
// app/layout.js). Los tags de Meta/TikTok/Google Ads viven DENTRO del panel
// web de GTM (tagmanager.google.com), no en este código — este helper solo
// dispara los eventos que esas tags usan como trigger. Nunca lanza (el
// dataLayer puede no existir todavía, o el navegador puede tener bloqueado
// GTM por un adblocker), y nunca debe interrumpir el flujo de compra si algo
// sale mal.
export function pushToDataLayer(event) {
  try {
    if (typeof window === "undefined") return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(event);
  } catch (err) {
    console.error("[gtm] No se pudo empujar el evento:", err);
  }
}

// Vista del "producto" (la página de personalización, /crear o el flujo
// embebido en /ads) — sin esto, TikTok/Meta solo tenían 2 señales
// (InitiateCheckout y Purchase) para todo el embudo, muy poca información
// para decidir a quién mostrarle el anuncio. No lleva tamaño/precio
// todavía (el cliente recién está empezando), solo marca que alguien
// llegó a interactuar con el producto real, no solo con la landing.
export function trackViewContent() {
  pushToDataLayer({
    event: "view_item",
    ecommerce: {
      currency: "COP",
      items: [{ item_id: "cuadro-personalizado", item_name: "Cuadro personalizado Mystery" }],
    },
  });
}

// Equivalente a "agregar al carrito": se dispara justo cuando el cliente
// confirma foto + tamaño y ve la pantalla "Tu cuadro está listo" — la
// señal de intención más fuerte antes de llegar al checkout. sizeId viaja
// como item_id, el mismo campo que el tag de TikTok en GTM debe mapear a
// `content_id` (ver ADS.md, auditoría del píxel).
export function trackAddToCart(order) {
  if (!order?.sizeId) return;
  pushToDataLayer({
    event: "add_to_cart",
    ecommerce: {
      currency: "COP",
      value: order.priceCOP,
      items: [
        {
          item_id: order.sizeId,
          item_name: `Cuadro personalizado ${order.sizeLabel || order.sizeId}`,
          price: order.priceCOP,
          quantity: 1,
        },
      ],
    },
  });
}

export function trackBeginCheckout(order) {
  if (!order) return;
  pushToDataLayer({
    event: "begin_checkout",
    ecommerce: {
      currency: "COP",
      value: order.priceCOP,
      items: [
        {
          item_id: order.sizeId,
          item_name: `Cuadro personalizado ${order.sizeLabel || order.sizeId}`,
          price: order.priceCOP,
          quantity: 1,
        },
      ],
    },
  });
}

// Correo/celular en el formato que exigen TikTok/Meta (Advanced
// Matching): correo en minúsculas sin espacios, celular en E.164
// ("+57" + 10 dígitos). El prefijo es un campo editable en /checkout, así
// que puede llegar como "57", "+57 " o vacío — sin normalizar, TikTok lo
// marcaba como "teléfono inválido" en el Diagnóstico del píxel.
function buildUserData(customer) {
  const prefixDigits = String(customer?.phonePrefix || "").replace(/\D/g, "") || "57";
  const phoneDigits = String(customer?.phone || "").replace(/\D/g, "");
  return {
    email: String(customer?.email || "").trim().toLowerCase(),
    phone: phoneDigits ? `+${prefixDigits}${phoneDigits}` : "",
  };
}

// El cliente tocó "Pagar" (completo o anticipo contraentrega) con el
// formulario ya lleno — primer punto del embudo donde sí hay correo y
// celular, así que acá viaja user_data (a diferencia de begin_checkout,
// que se dispara al cargar /checkout, antes de que el cliente escriba).
export function trackAddPaymentInfo(order, customer, paymentType) {
  if (!order) return;
  pushToDataLayer({
    event: "add_payment_info",
    ecommerce: {
      currency: "COP",
      value: order.priceCOP,
      payment_type: paymentType,
      items: [
        {
          item_id: order.sizeId,
          item_name: `Cuadro personalizado ${order.sizeLabel || order.sizeId}`,
          price: order.priceCOP,
          quantity: 1,
        },
      ],
    },
    user_data: buildUserData(customer),
  });
}

export function trackPurchase(order) {
  if (!order?.payment?.reference) return;
  pushToDataLayer({
    event: "purchase",
    ecommerce: {
      transaction_id: order.payment.reference,
      currency: "COP",
      value: order.priceCOP,
      items: [
        {
          item_id: order.sizeId,
          item_name: `Cuadro personalizado ${order.sizeLabel || order.sizeId}`,
          price: order.priceCOP,
          quantity: 1,
        },
      ],
    },
    // Correo/celular del comprador (sin hashear — TikTok/Meta lo hashean
    // ellos mismos en el navegador antes de mandarlo, nunca viaja en
    // texto plano a sus servidores) — ver ADS.md, auditoría del píxel:
    // TikTok reporta -13% de CPA cuando esto llega completo y válido
    // ("Advanced Matching"). Solo disponible en `purchase` (acá el
    // formulario del cliente ya está lleno); en `begin_checkout` el
    // cliente puede no haberlo escrito todavía.
    user_data: buildUserData(order.customer),
  });
}
