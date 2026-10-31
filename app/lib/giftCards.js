import crypto from "crypto";
import Redis from "ioredis";
import { createGiftCode } from "./giftCodes";
import { generateGiftCardCode, verifyGiftCardTransaction } from "./giftFeatures";
import { sendGiftCardEmails } from "./email";

// Compra de tarjetas regalo (apagada por defecto, ver giftFeatures.js).
// Flujo: /api/gift-card/start guarda la compra con el monto calculado en
// el servidor → el cliente paga en Wompi → /api/gift-card/confirm (al
// volver) y/o /api/wompi-webhook (aunque cierre la pestaña) llaman a
// issueGiftCardForTransaction, que verifica estado/monto/moneda/
// referencia y emite UN código (idempotente con SET NX).
//
// Claves: giftcard-purchase:{ref} (JSON, 30 días) y
// giftcard-issued:{ref} (lock de emisión, 400 días).

let redisClient;
function getRedisClient() {
  if (!process.env.REDIS_URL) return null;
  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 3000 });
    redisClient.on("error", (err) => console.error("[giftCards] Error de conexión a Redis:", err));
  }
  return redisClient;
}

const PURCHASE_TTL = 60 * 60 * 24 * 30;
const ISSUED_TTL = 60 * 60 * 24 * 400;
const purchaseKey = (ref) => `giftcard-purchase:${ref}`;
const issuedKey = (ref) => `giftcard-issued:${ref}`;

export function newGiftCardReference() {
  const suffix = crypto.randomBytes(6).toString("hex").slice(0, 6);
  return `giftcard-${Date.now()}-${suffix}`;
}

export async function saveGiftCardPurchase(purchase) {
  const client = getRedisClient();
  if (!client) throw new Error("REDIS_URL no está configurado.");
  const ok = await client.set(purchaseKey(purchase.reference), JSON.stringify(purchase), "EX", PURCHASE_TTL, "NX");
  if (ok !== "OK") throw new Error("Referencia repetida.");
}

export async function getGiftCardPurchase(reference) {
  const client = getRedisClient();
  if (!client) return null;
  const raw = await client.get(purchaseKey(reference));
  return raw ? JSON.parse(raw) : null;
}

// Devuelve { ok, alreadyIssued?, reason? }. Lanza solo si falla algo
// transitorio (Redis/Resend) para que el webhook de Wompi reintente.
export async function issueGiftCardForTransaction(transaction) {
  const client = getRedisClient();
  if (!client) throw new Error("REDIS_URL no está configurado.");

  const purchase = await getGiftCardPurchase(transaction?.reference);
  const check = verifyGiftCardTransaction(transaction, purchase);
  if (!check.ok) {
    if (check.reason === "amount" || check.reason === "currency") {
      console.error(
        `[giftCards] ALERTA: pago de tarjeta regalo no coincide (${check.reason}) ref=${transaction?.reference} tx=${transaction?.id}`
      );
    }
    return { ok: false, reason: check.reason };
  }

  const locked = await client.set(issuedKey(purchase.reference), transaction.id || "1", "EX", ISSUED_TTL, "NX");
  if (locked !== "OK") return { ok: true, alreadyIssued: true };

  try {
    // Si un intento anterior ya creó el código pero falló el correo, se
    // reutiliza el mismo (nunca dos códigos por una compra).
    let code = purchase.code;
    if (!code) {
      code = generateGiftCardCode(crypto.randomBytes);
      await createGiftCode({ maxUses: 1, code, source: "tarjeta-regalo" });
      await client.set(
        purchaseKey(purchase.reference),
        JSON.stringify({ ...purchase, code, transactionId: transaction.id || null }),
        "EX",
        ISSUED_TTL
      );
    }
    const issued = { ...purchase, code, transactionId: transaction.id || null };
    await sendGiftCardEmails({ purchase: issued, code });
    await client.set(
      purchaseKey(purchase.reference),
      JSON.stringify({ ...issued, emailedAt: new Date().toISOString() }),
      "EX",
      ISSUED_TTL
    );
    return { ok: true, alreadyIssued: false };
  } catch (err) {
    // Se libera el lock para que el reintento (webhook o recarga de la
    // página de gracias) vuelva a intentar el envío con el mismo código.
    await client.del(issuedKey(purchase.reference)).catch(() => {});
    throw err;
  }
}
