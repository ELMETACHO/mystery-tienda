import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { buildGtmLoaderScript, GTM_BOOT_DEADLINE_MS } from "../app/lib/gtmLoader.js";

// Ventana falsa mínima para ejecutar el snippet sin navegador.
function fakeWindow({ pathname = "/", readyState = "interactive", now = 500, idle = true } = {}) {
  const listeners = {};
  const timers = [];
  const inserted = [];
  const idleCbs = [];
  const document = {
    readyState,
    getElementsByTagName: () => [{ parentNode: { insertBefore: (el) => inserted.push(el) } }],
    createElement: () => ({}),
  };
  const window = {
    location: { pathname },
    performance: { now: () => now },
    addEventListener: (t, fn) => ((listeners[t] ||= []).push(fn)),
    removeEventListener: (t, fn) => (listeners[t] = (listeners[t] || []).filter((f) => f !== fn)),
    ...(idle ? { requestIdleCallback: (fn, o) => idleCbs.push({ fn, o }) } : {}),
  };
  const ctx = {
    window,
    document,
    Date,
    setTimeout: (fn, ms) => timers.push({ fn, ms }) - 1,
    clearTimeout: () => {},
  };
  return { ctx, window, listeners, timers, inserted, idleCbs };
}

const run = (env) => vm.runInNewContext(buildGtmLoaderScript("GTM-TEST"), env.ctx);
const gtmPushes = (w) => w.dataLayer.filter((e) => e.event === "gtm.js").length;

test("fuera de /checkout no carga GTM al instante, pero conserva la cola", () => {
  const env = fakeWindow();
  env.window.dataLayer = [{ event: "view_item" }];
  run(env);
  assert.equal(env.inserted.length, 0);
  assert.deepEqual(env.window.dataLayer, [{ event: "view_item" }]);
  // tope fijo: 4 s desde el inicio de la navegación
  assert.equal(env.timers.at(-1).ms, GTM_BOOT_DEADLINE_MS - 500);
});

test("en /checkout y /checkout/confirmacion carga de inmediato", () => {
  for (const pathname of ["/checkout", "/checkout/confirmacion"]) {
    const env = fakeWindow({ pathname });
    run(env);
    assert.equal(env.inserted.length, 1);
    assert.match(env.inserted[0].src, /gtm\.js\?id=GTM-TEST$/);
    assert.equal(gtmPushes(env.window), 1);
  }
});

test("arranca con la primera interacción y solo una vez", () => {
  const env = fakeWindow();
  run(env);
  env.listeners.touchstart[0]();
  env.window.__mysteryLoadGtm();
  env.timers.forEach((t) => t.fn());
  assert.equal(env.inserted.length, 1);
  assert.equal(gtmPushes(env.window), 1);
  assert.equal((env.listeners.scroll || []).length, 0);
});

test("arranca cuando el navegador queda libre después de load", () => {
  const env = fakeWindow();
  run(env);
  env.listeners.load[0]();
  assert.equal(env.idleCbs.length, 1);
  env.idleCbs[0].fn();
  assert.equal(env.inserted.length, 1);
});

test("si React hidrató después del tope, arranca sin esperar más", () => {
  const env = fakeWindow({ now: 6000, readyState: "complete", idle: false });
  run(env);
  assert.ok(env.timers.some((t) => t.ms === 0));
});

test("el tope fijo arranca GTM aunque nadie toque nada", () => {
  const env = fakeWindow();
  run(env);
  env.timers.at(-1).fn();
  assert.equal(env.inserted.length, 1);
});
