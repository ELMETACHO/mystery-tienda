// Carga diferida de Google Tag Manager (oct 2026).
//
// GTM-M8BSXNX8 trae Meta Pixel, TikTok Pixel, Google Ads y GA4: ~750 KB de
// JavaScript de terceros que, cargado con `afterInteractive` (apenas
// hidrata React), competía en el celular con la foto principal y con el
// hilo principal justo mientras la página se pintaba (LCP/TBT).
//
// Ahora la página se pinta primero y GTM arranca en el PRIMERO de estos
// momentos:
//   1. el navegador queda libre después del evento `load`
//      (requestIdleCallback, máx. 1,5 s de espera);
//   2. la primera interacción del cliente (toque, scroll, tecla);
//   3. tope fijo: 4 s desde que empezó la navegación (o de inmediato si
//      React hidrató más tarde que eso) — así el visitante que llega de un
//      anuncio y se va rápido, sin tocar nada, igual queda medido
//      (PageView/ViewContent). Nunca arranca más tarde que antes de este
//      cambio en un celular lento, ni más de 4 s en uno rápido;
//   4. de inmediato en /checkout y /checkout/confirmacion (compra), y
//      cada vez que el sitio empuja un evento del embudo de compra
//      (add_to_cart, begin_checkout, add_payment_info, purchase) — ver
//      app/lib/gtm.js. Nada de esto toca el botón de pago ni lo demora:
//      solo inserta el <script> de GTM, que descarga en segundo plano.
//
// No se pierde ningún evento: el dataLayer existe desde el principio y
// todo lo que el sitio empuja antes de que GTM arranque (view_item,
// ads_landing, ...) queda en cola y GTM lo procesa al cargar, en orden.
// Los tags base de Meta/TikTok y los Config de Google usan el activador
// "Initialization - All Pages" (versión 6 del contenedor), que corre antes
// que cualquier evento de la cola.
export const GTM_BOOT_DEADLINE_MS = 4000;
export const GTM_IDLE_TIMEOUT_MS = 1500;
export const GTM_FUNNEL_EVENTS = ["add_to_cart", "begin_checkout", "add_payment_info", "purchase"];

export function buildGtmLoaderScript(gtmId) {
  return `(function(w,d,i){
var l='dataLayer';w[l]=w[l]||[];
if(w.__mysteryLoadGtm)return;
var started=false,timers=[],ev=['pointerdown','touchstart','keydown','scroll','wheel'],
opts={passive:true,capture:true};
function boot(){
if(started)return;started=true;
for(var k=0;k<ev.length;k++)w.removeEventListener(ev[k],boot,opts);
w.removeEventListener('load',onLoad);
for(var t=0;t<timers.length;t++)clearTimeout(timers[t]);
w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
var f=d.getElementsByTagName('script')[0],j=d.createElement('script');
j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i;
f.parentNode.insertBefore(j,f);
}
w.__mysteryLoadGtm=boot;
if(/^\\/checkout(\\/|$)/.test(w.location.pathname)){boot();return;}
for(var k=0;k<ev.length;k++)w.addEventListener(ev[k],boot,opts);
function onLoad(){
if(w.requestIdleCallback)w.requestIdleCallback(boot,{timeout:${GTM_IDLE_TIMEOUT_MS}});
else timers.push(setTimeout(boot,200));
}
if(d.readyState==='complete')onLoad();else w.addEventListener('load',onLoad);
var now=(w.performance&&w.performance.now)?w.performance.now():0;
timers.push(setTimeout(boot,Math.max(0,${GTM_BOOT_DEADLINE_MS}-now)));
})(window,document,${JSON.stringify(gtmId)});`;
}
