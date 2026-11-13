import { checkRateLimit, rateLimitResponse } from "../../lib/rateLimit";
import {
  normalizeReminderInput,
  saveDateReminder,
  deleteDateReminder,
  isValidReminderCancelToken,
} from "../../lib/dateReminders";
import { SITE_URL } from "../../lib/siteUrl";

// POST: el cliente pide, desde la confirmación, que le recordemos una
// fecha especial el año siguiente (ver app/lib/dateReminders.js). Solo se
// guarda la referencia del pedido + ocasión + día/mes: el correo de destino
// NUNCA viene del navegador, sale del pedido real al momento de enviar.
export async function POST(request) {
  const { limited, retryAfter } = await checkRateLimit(request, "date-reminder", { limit: 5, windowSeconds: 600 });
  if (limited) return rateLimitResponse(retryAfter);

  const body = await request.json().catch(() => ({}));
  const reference = typeof body.reference === "string" ? body.reference.trim().slice(0, 80) : "";
  const reminder = normalizeReminderInput(body);

  if (!/^mystery-[\w-]+$/.test(reference) || !reminder) {
    return Response.json({ ok: false, error: "Revisa la ocasión y la fecha." }, { status: 400 });
  }

  const saved = await saveDateReminder(reference, reminder);
  if (!saved) {
    return Response.json({ ok: false, error: "No pudimos guardarlo ahora. Intenta más tarde." }, { status: 503 });
  }
  return Response.json({ ok: true });
}

// GET: link "No quiero más recordatorios" del correo (?ref=...&token=...).
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const reference = searchParams.get("ref") || "";
  const token = searchParams.get("token") || "";

  const ok = isValidReminderCancelToken(reference, token) && (await deleteDateReminder(reference));
  const message = ok
    ? "Listo, no te enviaremos más recordatorios de esta fecha."
    : "Este link no es válido o ya fue usado.";

  return new Response(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Recordatorios — Mystery</title></head><body style="font-family:system-ui,sans-serif;background:#f4efe3;color:#1b2a4a;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:16px;text-align:center"><div><p style="font-size:18px;font-weight:600">${message}</p><p><a href="${SITE_URL}" style="color:#7c3aed">Ir a Mystery Cuadros</a></p></div></body></html>`,
    { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
