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
    user_data: {
      email: order.customer?.email || "",
      phone: order.customer?.phone
        ? `${order.customer.phonePrefix || "+57"}${order.customer.phone}`.replace(/[^\d+]/g, "")
        : "",
    },
  });
}
