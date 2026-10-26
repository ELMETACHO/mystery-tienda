import { SITE_URL } from "./siteUrl";

// IndexNow (oct 2026): avisa a Bing (y de paso a Yandex, Seznam, Naver y
// Yep, que comparten el protocolo) apenas una URL nueva o cambiada existe,
// en vez de esperar a que la rastreen solos. Copilot y las respuestas con
// IA de Bing salen del mismo índice de Bing, así que indexar rápido ahí
// también es aparecer antes en esas respuestas. Google NO usa IndexNow —
// para Google sigue mandando el sitemap.
//
// La llave NO es un secreto: el protocolo exige publicarla en
// /<llave>.txt (public/cb49fd94f9c8dbae0a0bdb981089ce09.txt) para que Bing
// compruebe que el dominio es nuestro. Si se cambia, cambiar también el
// nombre y el contenido de ese archivo.
export const INDEXNOW_KEY = "cb49fd94f9c8dbae0a0bdb981089ce09";

const ENDPOINT = "https://api.indexnow.org/indexnow";

// Nunca lanza: es un aviso de cortesía a los buscadores, si falla no puede
// romper nada (se llama dentro de after() al registrar un diseño nuevo).
// Solo avisa desde producción — una URL de localhost o de un Preview de
// Vercel no le sirve a Bing y la llave no está publicada en esos dominios.
export async function submitToIndexNow(paths) {
  if (!/^https:\/\/www\.mysterycuadros\.com$/.test(SITE_URL)) {
    return { ok: false, skipped: true };
  }
  const urlList = [...new Set(paths)].map((path) =>
    path.startsWith("http") ? path : `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`
  );
  if (!urlList.length) return { ok: true, submitted: 0 };

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: new URL(SITE_URL).host,
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        // El protocolo acepta hasta 10.000 URLs por petición.
        urlList: urlList.slice(0, 10000),
      }),
    });
    // 200 = recibido, 202 = recibido y la llave se valida después.
    if (response.status !== 200 && response.status !== 202) {
      console.error("[indexnow] Respuesta inesperada:", response.status, await response.text().catch(() => ""));
      return { ok: false, status: response.status };
    }
    return { ok: true, status: response.status, submitted: urlList.length };
  } catch (err) {
    console.error("[indexnow] Falló el aviso:", err);
    return { ok: false };
  }
}
