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

// Se llama DESPUÉS de que el navegador ya subió todos los archivos
// directo a Drive (ver /api/estudio-upload-drive) — este paso final:
// 1. Hace público el archivo del MOCKUP (nunca el original ni los
//    recortes de impresión, que son internos) para que su link de
//    miniatura sirva en el sitio.
// 2. Registra el producto en Redis (catalog:products).
export async function POST(request) {
  if (!(await isAuthenticated())) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const { categoryId, mockupFileId, originalRawFileId, originalRawContentHash, printFileIds, crop, zoom } =
    await request.json().catch(() => ({}));

  if (
    !categoryId ||
    !mockupFileId ||
    !originalRawFileId ||
    !printFileIds?.["30x40"] ||
    !printFileIds?.["40x50"] ||
    !printFileIds?.["50x70"]
  ) {
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
    // originalRawFileId es la foto SIN recortar que subió el diseñador, y
    // printFileIds son los 3 recortes ya horneados (30x40/40x50/50x70,
    // cada uno con su sangrado de 1cm) — ver EstudioApp.jsx. crop/zoom se
    // guardan solo por si en el futuro se agrega una opción de
    // "regenerar" un producto sin que el diseñador repita el ajuste; hoy
    // no se leen en ningún otro flujo.
    const product = await addCatalogProduct({
      categoryId,
      mockupFileId,
      originalRawFileId,
      originalRawContentHash,
      printFileIds,
      crop,
      zoom,
    });
    return Response.json({ ok: true, product });
  } catch (err) {
    console.error("[estudio-register-product] Falló el registro en el catálogo:", err);
    return Response.json(
      { error: "El mockup quedó público en Drive pero no se pudo registrar el producto" },
      { status: 502 }
    );
  }
}
