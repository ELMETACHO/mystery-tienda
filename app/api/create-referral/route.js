import { createReferral } from "../../lib/referrals";

export async function POST(request) {
  const { name, whatsapp } = await request.json().catch(() => ({}));

  if (!name?.trim() || !whatsapp?.trim()) {
    return Response.json({ error: "Faltan nombre o WhatsApp" }, { status: 400 });
  }

  try {
    const referral = await createReferral({
      name: name.trim(),
      whatsapp: whatsapp.trim(),
    });
    return Response.json({ code: referral.code, name: referral.name });
  } catch (err) {
    console.error("[create-referral] No se pudo generar el código:", err);
    return Response.json(
      { error: "No se pudo generar tu código. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
