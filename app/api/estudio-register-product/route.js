import { cookies } from "next/headers";
import { ESTUDIO_COOKIE_NAME, getEstudioSessionToken } from "../../lib/estudioAuth";
import { getCategoryFolderId } from "../../lib/estudioCategories";
import { makeFilePublic } from "../../lib/googleDrive";
import { addCatalogProduct } from "../../lib/catalog";

// Protegido con la misma cookie de sesión que /estudio.
async function isAuthenticated() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ESTUDIO_COOKIE_NAME)?.value;
  const expectedToken = getEstudioSessionToken();
  return Boolean(expectedToken) && sessionCookie === expectedToken;
}

// Se llama DESPUÉS de que el navegador ya subió los dos archivos
// directo a Drive (ver /api/estudio-upload-drive) — este paso final:
// 1. Hace público el archivo del MOCKUP (nunca el original/portafolio,
//    que es interno) para que su link de miniatura sirva en el sitio.
// 2. Registra el producto en Redis (catalog:products).
export async function POST(request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const { categoryId, mockupFileId, originalFileId } = await request.json().catch(() => ({}));

  if (!categoryId || !mockupFileId || !originalFileId) {
    return Response.json({ error: "Datos incompletos" }, { status: 400 });
  }

  // Mismo catálogo conocido de categorías que ya usa /api/estudio-upload-drive.
  if (!getCategoryFolderId(categoryId)) {
    return Response.json({ error: "Categoría inválida" }, { status: 400 });
  }

  try {
    await makeFilePublic(mockupFileId);
  } catch (err) {
    console.error("[estudio-register-product] Falló al hacer público el mockup:", err);
    return Response.json(
      { error: "No se pudo hacer público el mockup en Drive" },
      { status: 502 }
    );
  }

  try {
    // originalFileId SIEMPRE debe ser el archivo de "Original
    // (Portafolio)" — la imagen que subió el diseñador, recortada a
    // resolución completa + sangrado — nunca el mockup. Ese mapeo ya lo
    // garantiza el cliente (ver handleSendToDrive en EstudioApp.jsx); acá
    // solo se guarda tal cual llega.
    const product = await addCatalogProduct({ categoryId, mockupFileId, originalFileId });
    return Response.json({ ok: true, product });
  } catch (err) {
    console.error("[estudio-register-product] Falló el registro en el catálogo:", err);
    return Response.json(
      { error: "El mockup quedó público en Drive pero no se pudo registrar el producto" },
      { status: 502 }
    );
  }
}
