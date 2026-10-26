// Avisa a Bing por IndexNow de las URLs del sitemap EN VIVO.
//
//   node scripts/indexnow-submit.mjs                    → todas las URLs
//   node scripts/indexnow-submit.mjs --since 2026-10-20 → solo las que
//                                                          cambiaron desde esa fecha (lastmod)
//
// Usarlo después de fusionar un cambio de textos/plantillas (la tarea
// diaria de SEO lo corre con --since). Los diseños nuevos de /estudio ya
// se avisan solos (app/api/estudio-register-product). Misma llave que
// app/lib/indexNow.js — publicada en /<llave>.txt.
const SITE = "https://www.mysterycuadros.com";
const KEY = "cb49fd94f9c8dbae0a0bdb981089ce09";

const sinceArg = process.argv.indexOf("--since");
const since = sinceArg > -1 ? new Date(process.argv[sinceArg + 1]) : null;
if (since && Number.isNaN(since.getTime())) {
  console.error("Fecha inválida en --since (usa AAAA-MM-DD)");
  process.exit(1);
}

const xml = await (await fetch(`${SITE}/sitemap.xml`)).text();
const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, block]) => ({
  loc: block.match(/<loc>(.*?)<\/loc>/)?.[1],
  lastmod: block.match(/<lastmod>(.*?)<\/lastmod>/)?.[1],
}));
const urlList = entries
  .filter((e) => e.loc && (!since || (e.lastmod && new Date(e.lastmod) >= since)))
  .map((e) => e.loc);

if (!urlList.length) {
  console.log(`Nada que avisar (${entries.length} URLs en el sitemap, ninguna cambió desde ${since?.toISOString().slice(0, 10)}).`);
  process.exit(0);
}

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: new URL(SITE).host, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList }),
});
console.log(`IndexNow: ${response.status} ${response.statusText} — ${urlList.length} URLs enviadas.`);
if (response.status !== 200 && response.status !== 202) {
  console.log(await response.text());
  process.exit(1);
}
