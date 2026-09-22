import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, getAdminSessionToken } from "../../lib/adminAuth";
import { getPaidBackup } from "../../lib/paidBackup";

// Descarga la imagen de impresión guardada en el respaldo de un pedido.
export async function GET(request) {
  const cookieStore = await cookies();
  const expected = getAdminSessionToken();
  if (!expected || cookieStore.get(ADMIN_COOKIE_NAME)?.value !== expected) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const reference = new URL(request.url).searchParams.get("ref");
  const backup = reference ? await getPaidBackup(reference) : null;
  const dataUrl = backup?.order?.printImage;
  const match = /^data:image\/(\w+);base64,(.+)$/.exec(dataUrl || "");
  if (!match) return Response.json({ error: "Sin imagen en este respaldo" }, { status: 404 });

  const ext = match[1] === "jpeg" ? "jpg" : match[1];
  return new Response(Buffer.from(match[2], "base64"), {
    headers: {
      "Content-Type": `image/${match[1]}`,
      "Content-Disposition": `attachment; filename="${reference}.${ext}"`,
      "Cache-Control": "no-store",
    },
  });
}
