import { cookies } from "next/headers";
import { ESTUDIO_COOKIE_NAME, getEstudioSessionToken } from "../../lib/estudioAuth";
import { findProductByContentHash } from "../../lib/catalog";

// Protegido con la misma cookie de sesión que /estudio.
async function isAuthenticated() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ESTUDIO_COOKIE_NAME)?.value;
  const expectedToken = getEstudioSessionToken();
  return Boolean(expectedToken) && sessionCookie === expectedToken;
}

// Se llama apenas el diseñador selecciona un archivo en /estudio (antes
// de ajustar/subir nada) — el navegador ya calculó el SHA-256 del
// archivo crudo (ver EstudioApp.jsx) y solo pregunta si ya existe un
// producto con ese mismo hash, en cualquier categoría. Es un aviso NO
// bloqueante: el diseñador puede seguir de todas formas si de verdad
// quiere volver a subir el mismo diseño.
export async function POST(request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const { contentHash } = await request.json().catch(() => ({}));

  if (!contentHash) {
    return Response.json({ error: "Falta contentHash" }, { status: 400 });
  }

  try {
    const existing = await findProductByContentHash(contentHash);
    return Response.json({
      duplicate: Boolean(existing),
      category: existing?.category || null,
    });
  } catch (err) {
    console.error("[estudio-check-duplicate] No se pudo consultar el catálogo:", err);
    // Nunca bloquea la subida por un fallo de esta verificación —
    // simplemente no se muestra el aviso esta vez.
    return Response.json({ duplicate: false, category: null });
  }
}
