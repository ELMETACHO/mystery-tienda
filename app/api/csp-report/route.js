// Recibe los reportes de la CSP en modo Report-Only (ver next.config.mjs)
// y deja una línea corta en los logs de Vercel por cada violación, para
// saber qué falta antes de pasar la CSP a modo bloqueante. El navegador
// los manda en segundo plano: nunca afecta la carga de la página. No
// guarda nada ni toca Redis; ignora cuerpos grandes.
const MAX_BODY_BYTES = 16 * 1024;

function summarize(report) {
  const r = report?.["csp-report"] || report?.body || report || {};
  const blocked = String(r["blocked-uri"] || r.blockedURL || "").slice(0, 200);
  const directive = String(r["effective-directive"] || r.effectiveDirective || r["violated-directive"] || "").slice(0, 60);
  let page = String(r["document-uri"] || r.documentURL || "");
  try {
    page = new URL(page).pathname;
  } catch {
    page = page.slice(0, 100);
  }
  const source = String(r["source-file"] || r.sourceFile || "").slice(0, 150);
  return `[csp-report] directive=${directive} blocked=${blocked} page=${page}${source ? ` source=${source}` : ""}`;
}

export async function POST(request) {
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return new Response(null, { status: 204 });
    const parsed = JSON.parse(text);
    const reports = Array.isArray(parsed) ? parsed.slice(0, 10) : [parsed];
    for (const report of reports) console.warn(summarize(report));
  } catch {
    // Cuerpo inválido: se ignora en silencio.
  }
  return new Response(null, { status: 204 });
}
