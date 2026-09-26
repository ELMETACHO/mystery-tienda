import { markManualShipmentNoCoverage } from "./manualShipments";
import { sendNoCoverageCustomerEmail, sendNoCoverageAdminEmail } from "./email";
import { quoteCheapestShipping } from "./skydropx";

// El envío a la dirección del cliente supera el tope de costo (ver
// MAX_SHIPPING_COST_COP en app/lib/skydropx.js): no se genera guía, se
// marca el pedido como "no_coverage" y se avisa al cliente (no enviamos a
// su ciudad, devolución programada) y a Mystery (datos para devolver el
// dinero a mano).
//
// Se detecta en dos momentos:
//   - stage "payment": apenas se confirma el pago, en segundo plano (ver
//     checkShippingCoverageAfterPayment) — el fabricante nunca recibe el
//     pedido, así que no se fabrica nada.
//   - stage "guide": al generar la guía (red de seguridad, si la
//     cotización tras el pago falló) — el cuadro ya puede estar fabricado.
//
// Idempotente: los correos salen SOLO la primera vez (ver
// markManualShipmentNoCoverage). Nunca lanza.
export async function handleNoCoverage({ reference, record, error, stage = "guide" }) {
  const first = await markManualShipmentNoCoverage(reference, {
    shippingCostCOP: error.shippingCostCOP,
    carrierName: error.carrierName,
  });
  if (!first) return;

  // Contraentrega: solo pagó el anticipo (precio - saldo pendiente).
  // Pago completo por Wompi: saldoPendiente es 0, pagó el precio completo.
  // Regalo: $0, no hay nada que devolver.
  const amountPaidCOP =
    record.paymentMethod === "regalo"
      ? 0
      : Math.max(0, (record.order?.priceCOP || 0) - (record.saldoPendiente || 0));

  try {
    if (record.customer?.email && amountPaidCOP > 0) {
      await sendNoCoverageCustomerEmail({ customer: record.customer });
    }
  } catch (err) {
    console.error("[noCoverage] Falló el correo al cliente:", err);
  }

  try {
    await sendNoCoverageAdminEmail({
      reference,
      customer: record.customer,
      paymentMethod: record.paymentMethod,
      amountPaidCOP,
      shippingCostCOP: error.shippingCostCOP,
      carrierName: error.carrierName,
      stage,
    });
  } catch (err) {
    console.error("[noCoverage] Falló el aviso de devolución a Mystery:", err);
  }
}

// "Cotizar con paciencia" (decisión de Oscar, 26 sept 2026, tras el caso de
// Antonio Padilla: se rechazó un pedido que SÍ tenía un envío más barato,
// porque esa transportadora no alcanzó a responder). Como todavía no se
// fabrica nada, no hay apuro: se sigue cotizando (también si Skydropx
// falla) hasta tener una respuesta en la que TODAS las transportadoras
// respondieron, dentro de QUOTE_TOTAL_BUDGET_MS. Para rechazar hacen falta
// REQUIRED_EXPENSIVE_QUOTES cotizaciones completas por encima del tope.
//
// El presupuesto no puede ser infinito: after() vive dentro del tiempo
// máximo de la función en Vercel, que además comparte con la mejora de la
// foto con IA (upscaleImage.js, hasta ~2 min) que corre justo después. En
// la práctica una cotización se completa en 2-5 segundos.
const QUOTE_TOTAL_BUDGET_MS = 150000;
const QUOTE_MAX_WAIT_PER_ATTEMPT_MS = 60000;
const REQUIRED_EXPENSIVE_QUOTES = 2;
const QUOTE_RETRY_GAP_MS = 10000;

// Cotiza el envío apenas se confirma el pago (en segundo plano, dentro de
// after() — el cliente nunca espera ni ve nada de esto; su checkout ya
// terminó). Devuelve false SOLO cuando cotizaciones completas confirmaron
// que el envío supera el tope: en ese caso ya se manejó la devolución y el
// llamador NO debe mandar el pedido al fabricante. Si alguna cotización da
// dentro del tope, o no se logra confirmar a tiempo, devuelve true y el
// pedido sigue exactamente igual que siempre — nunca se rechaza un pedido
// sin estar seguros (el tope al generar la guía queda como red de
// seguridad). Nunca lanza.
export async function checkShippingCoverageAfterPayment({
  reference,
  order,
  customer,
  paymentMethod,
  saldoPendiente,
}) {
  const deadline = Date.now() + QUOTE_TOTAL_BUDGET_MS;
  let expensiveQuote = null;
  let completeExpensiveCount = 0;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt++;
    let quote = null;
    try {
      quote = await quoteCheapestShipping({
        order,
        customer,
        isCod: paymentMethod === "cod",
        codAmountCOP: saldoPendiente,
        maxWaitMs: Math.min(QUOTE_MAX_WAIT_PER_ATTEMPT_MS, Math.max(deadline - Date.now(), 5000)),
      });
    } catch (err) {
      console.error(`[noCoverage] ${reference}: falló la cotización ${attempt}, se reintenta:`, err);
    }

    // Una tarifa dentro del tope ya confirma cobertura, aunque falten
    // transportadoras por responder (las que falten solo podrían ser más
    // baratas).
    if (quote && !quote.exceedsCap) return true;

    if (quote) {
      console.warn(
        `[noCoverage] ${reference}: cotización ${attempt} por encima del tope (${quote.carrierName} $${quote.costCOP}, ${
          quote.isCompleted ? "completa" : "incompleta"
        }).`
      );
      if (quote.isCompleted) {
        completeExpensiveCount++;
        expensiveQuote = quote;
        if (completeExpensiveCount >= REQUIRED_EXPENSIVE_QUOTES) break;
      }
    }
    if (Date.now() + QUOTE_RETRY_GAP_MS >= deadline) break;
    await new Promise((resolve) => setTimeout(resolve, QUOTE_RETRY_GAP_MS));
  }

  if (completeExpensiveCount < REQUIRED_EXPENSIVE_QUOTES) {
    console.warn(
      `[noCoverage] ${reference}: no se pudo confirmar que el envío supere el tope — el pedido sigue normal.`
    );
    return true;
  }

  await handleNoCoverage({
    reference,
    record: { order, customer, paymentMethod, saldoPendiente },
    error: { shippingCostCOP: expensiveQuote.costCOP, carrierName: expensiveQuote.carrierName },
    stage: "payment",
  });
  return false;
}
