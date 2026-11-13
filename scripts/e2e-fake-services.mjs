// Prueba de punta a punta SIN tocar producción ni gastar plata (oct 2026):
// Redis en memoria (RESP, :6390) y Resend falso (:6391) que guarda cada correo
// en $E2E_OUT/emails (por defecto %TEMP%/mystery-e2e) en vez de enviarlo.
// Uso: ver BITACORA.md, sesión del 25 oct 2026.
import net from "node:net";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Correos, volcado de Redis y log de comandos: fuera del repo (datos de prueba).
const DIR = process.env.E2E_OUT || path.join(os.tmpdir(), "mystery-e2e");
const EMAIL_DIR = path.join(DIR, "emails");
fs.mkdirSync(EMAIL_DIR, { recursive: true });
const DUMP = path.join(DIR, "redis-dump.json");
const LOG = path.join(DIR, "redis-cmds.log");

const db = new Map(); // key -> {type, v, exp}
const now = () => Date.now();
function live(k) {
  const e = db.get(k);
  if (!e) return null;
  if (e.exp && e.exp <= now()) { db.delete(k); return null; }
  return e;
}
const enc = {
  ok: () => "+OK\r\n",
  str: (s) => (s === null || s === undefined ? "$-1\r\n" : `$${Buffer.byteLength(String(s))}\r\n${s}\r\n`),
  int: (n) => `:${n}\r\n`,
  err: (m) => `-ERR ${m}\r\n`,
  arr: (a) => (a === null ? "*-1\r\n" : `*${a.length}\r\n` + a.map((x) => (Array.isArray(x) ? enc.arr(x) : typeof x === "number" ? enc.int(x) : x && x.__raw ? x.__raw : enc.str(x))).join("")),
};
const raw = (s) => ({ __raw: s });
function glob(p) { return new RegExp("^" + p.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$"); }
function list(k, create) { let e = live(k); if (!e && create) { e = { type: "list", v: [] }; db.set(k, e); } return e ? e.v : []; }
function hash(k, create) { let e = live(k); if (!e && create) { e = { type: "hash", v: {} }; db.set(k, e); } return e ? e.v : {}; }
function idx(i, len) { i = Number(i); return i < 0 ? len + i : i; }

function run(cmd, a) {
  const C = cmd.toUpperCase();
  switch (C) {
    case "PING": return "+PONG\r\n";
    case "INFO": return enc.str("# Server\r\nredis_version:7.2.0\r\nloading:0\r\n");
    case "SELECT": case "CLIENT": case "QUIT": return enc.ok();
    case "GET": { const e = live(a[0]); return enc.str(e ? e.v : null); }
    case "SET": {
      let exp = null, nx = false, xx = false, get = false;
      for (let i = 2; i < a.length; i++) {
        const o = a[i].toUpperCase();
        if (o === "EX") exp = now() + Number(a[++i]) * 1000;
        else if (o === "PX") exp = now() + Number(a[++i]);
        else if (o === "NX") nx = true; else if (o === "XX") xx = true; else if (o === "GET") get = true;
        else if (o === "KEEPTTL") exp = live(a[0])?.exp ?? null;
      }
      const prev = live(a[0]);
      if ((nx && prev) || (xx && !prev)) return get ? enc.str(prev?.v ?? null) : "$-1\r\n";
      db.set(a[0], { type: "string", v: a[1], exp });
      return get ? enc.str(prev?.v ?? null) : enc.ok();
    }
    case "GETSET": { const p = live(a[0]); db.set(a[0], { type: "string", v: a[1] }); return enc.str(p ? p.v : null); }
    case "MGET": return enc.arr(a.map((k) => live(k)?.v ?? null));
    case "DEL": { let n = 0; for (const k of a) if (live(k)) { db.delete(k); n++; } return enc.int(n); }
    case "EXISTS": return enc.int(a.filter((k) => live(k)).length);
    case "EXPIRE": { const e = live(a[0]); if (!e) return enc.int(0); e.exp = now() + Number(a[1]) * 1000; return enc.int(1); }
    case "TTL": { const e = live(a[0]); if (!e) return enc.int(-2); return enc.int(e.exp ? Math.ceil((e.exp - now()) / 1000) : -1); }
    case "INCR": case "INCRBY": case "DECR": case "DECRBY": {
      const d = C === "INCR" ? 1 : C === "DECR" ? -1 : C === "INCRBY" ? Number(a[1]) : -Number(a[1]);
      const e = live(a[0]); const v = (e ? Number(e.v) : 0) + d;
      db.set(a[0], { type: "string", v: String(v), exp: e?.exp ?? null }); return enc.int(v);
    }
    case "HSET": { const h = hash(a[0], true); let n = 0; for (let i = 1; i < a.length; i += 2) { if (!(a[i] in h)) n++; h[a[i]] = a[i + 1]; } return enc.int(n); }
    case "HSETNX": { const h = hash(a[0], true); if (a[1] in h) return enc.int(0); h[a[1]] = a[2]; return enc.int(1); }
    case "HGET": return enc.str(hash(a[0])[a[1]] ?? null);
    case "HEXISTS": return enc.int(a[1] in hash(a[0]) ? 1 : 0);
    case "HGETALL": return enc.arr(Object.entries(hash(a[0])).flat());
    case "HINCRBY": { const h = hash(a[0], true); h[a[1]] = String(Number(h[a[1]] || 0) + Number(a[2])); return enc.int(Number(h[a[1]])); }
    case "RPUSH": { const l = list(a[0], true); l.push(...a.slice(1)); return enc.int(l.length); }
    case "LPUSH": { const l = list(a[0], true); for (const x of a.slice(1)) l.unshift(x); return enc.int(l.length); }
    case "LLEN": return enc.int(list(a[0]).length);
    case "LRANGE": { const l = list(a[0]); const s = Math.max(0, idx(a[1], l.length)); const e = Math.min(l.length - 1, idx(a[2], l.length)); return enc.arr(s > e ? [] : l.slice(s, e + 1)); }
    case "LSET": { const l = list(a[0]); const i = idx(a[1], l.length); if (i < 0 || i >= l.length) return enc.err("index out of range"); l[i] = a[2]; return enc.ok(); }
    case "LTRIM": { const e = live(a[0]); if (!e) return enc.ok(); const l = e.v; const s = Math.max(0, idx(a[1], l.length)); const en = idx(a[2], l.length); e.v = l.slice(s, en + 1); return enc.ok(); }
    case "KEYS": { const r = glob(a[0]); return enc.arr([...db.keys()].filter((k) => live(k) && r.test(k))); }
    case "SCAN": {
      let m = "*"; for (let i = 1; i < a.length; i++) if (a[i].toUpperCase() === "MATCH") m = a[++i];
      const r = glob(m); return enc.arr(["0", [...db.keys()].filter((k) => live(k) && r.test(k))]);
    }
    default: return enc.err(`unknown command '${cmd}' (fake)`);
  }
}

function parse(buf) {
  // Devuelve [comandos, resto]
  const out = []; let i = 0;
  while (i < buf.length) {
    if (buf[i] !== 42) { const nl = buf.indexOf("\r\n", i); if (nl < 0) break; out.push(buf.slice(i, nl).toString().split(" ")); i = nl + 2; continue; }
    const nl = buf.indexOf("\r\n", i); if (nl < 0) break;
    const n = Number(buf.slice(i + 1, nl).toString()); let j = nl + 2; const args = []; let ok = true;
    for (let k = 0; k < n; k++) {
      const nl2 = buf.indexOf("\r\n", j); if (nl2 < 0) { ok = false; break; }
      const len = Number(buf.slice(j + 1, nl2).toString()); const s = nl2 + 2;
      if (s + len + 2 > buf.length) { ok = false; break; }
      args.push(buf.slice(s, s + len).toString()); j = s + len + 2;
    }
    if (!ok) break; out.push(args); i = j;
  }
  return [out, buf.slice(i)];
}

net.createServer((sock) => {
  let pending = Buffer.alloc(0); let multi = null;
  sock.on("data", (d) => {
    pending = Buffer.concat([pending, d]);
    const [cmds, rest] = parse(pending); pending = rest;
    for (const [c, ...a] of cmds) {
      const C = c.toUpperCase();
      fs.appendFileSync(LOG, `${C} ${a.map((x) => (x.length > 80 ? x.slice(0, 80) + "…" : x)).join(" ")}\n`);
      if (C === "MULTI") { multi = []; sock.write(enc.ok()); continue; }
      if (C === "EXEC") { const r = multi || []; multi = null; sock.write(`*${r.length}\r\n` + r.map(([cc, aa]) => run(cc, aa)).join("")); continue; }
      if (C === "DISCARD") { multi = null; sock.write(enc.ok()); continue; }
      if (multi) { multi.push([c, a]); sock.write("+QUEUED\r\n"); continue; }
      try { sock.write(run(c, a)); } catch (e) { sock.write(enc.err(e.message)); }
    }
  });
  sock.on("error", () => {});
}).listen(6390, "127.0.0.1", () => console.log("fake redis :6390"));

let n = 0;
http.createServer((req, res) => {
  let body = ""; req.on("data", (c) => (body += c));
  req.on("end", () => {
    if (req.url === "/__dump") { // vuelca Redis a JSON para inspección
      const o = {}; for (const k of db.keys()) { const e = live(k); if (e) o[k] = e.v; }
      fs.writeFileSync(DUMP, JSON.stringify(o, null, 1)); res.end("ok"); return;
    }
    const id = `fake-${++n}`;
    let j = {}; try { j = JSON.parse(body || "{}"); } catch {}
    const items = Array.isArray(j) ? j : [j];
    for (const [k, it] of items.entries()) {
      const base = path.join(EMAIL_DIR, `${String(n).padStart(2, "0")}${items.length > 1 ? "-" + k : ""}`);
      const meta = { method: req.method, url: req.url, from: it.from, to: it.to, cc: it.cc, bcc: it.bcc, subject: it.subject, scheduledAt: it.scheduledAt ?? it.scheduled_at, attachments: (it.attachments || []).map((x) => ({ filename: x.filename, size: (x.content || "").length })) };
      fs.writeFileSync(base + ".json", JSON.stringify(meta, null, 1));
      if (it.html) fs.writeFileSync(base + ".html", it.html);
      console.log("EMAIL", req.method, req.url, JSON.stringify(meta.to), meta.subject);
    }
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(Array.isArray(j) ? { data: items.map((_, k) => ({ id: id + "-" + k })) } : { id, object: "email" }));
  });
}).listen(6391, "127.0.0.1", () => console.log("fake resend :6391"));
