import { getFabricantesByAccessCode } from "../../lib/fabricantes";
import { getInventory, getInventoryLog, updateInventory } from "../../lib/inventory";

// Mismo código de acceso que /api/fabricante-status. Cristhian ve y
// actualiza el mismo inventario que el admin (una sola fuente de verdad);
// cada cambio queda registrado con su nombre.
async function snapshot() {
  return { items: await getInventory(), log: await getInventoryLog() };
}

export async function GET(request) {
  const code = new URL(request.url).searchParams.get("code");
  if (getFabricantesByAccessCode(code).length === 0) {
    return Response.json({ error: "Código incorrecto" }, { status: 401 });
  }
  return Response.json(await snapshot());
}

export async function POST(request) {
  const { code, field, set, add, threshold } = await request.json().catch(() => ({}));
  if (getFabricantesByAccessCode(code).length === 0) {
    return Response.json({ error: "Código incorrecto" }, { status: 401 });
  }
  const ok = await updateInventory({
    field,
    set: set == null ? undefined : Number(set),
    add: add == null ? undefined : Number(add),
    threshold: threshold == null ? undefined : Number(threshold),
    by: "Cristhian (fabricante)",
  });
  if (!ok) return Response.json({ error: "No se pudo actualizar" }, { status: 400 });
  return Response.json({ ok: true, ...(await snapshot()) });
}
