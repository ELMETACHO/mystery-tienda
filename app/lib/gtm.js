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
  });
}
