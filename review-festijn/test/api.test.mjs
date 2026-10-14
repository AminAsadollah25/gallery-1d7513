import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BlobsServer } from "@netlify/blobs/server";
import { getStore } from "@netlify/blobs";
import { handle } from "../src/handler.mjs";

const env = { LOCKED: "on", EMPLOYEE_SUBMIT: "on", TEAM_CODE: "team123", ADMIN_CODES: "Amin:baas1, Arber:baas2", REVIEW_LINK: "VEG=https://g.page/r/veg/review,TEG=https://g.page/r/teg/review" };
const IMG = "data:image/png;base64,iVBORw0KGg==";
let server, store;

test.before(async () => {
  server = new BlobsServer({ directory: mkdtempSync(join(tmpdir(), "blobs-")), token: "tok" });
  const { port } = await server.start();
  store = getStore({ name: "test", siteID: "site", token: "tok", edgeURL: `http://localhost:${port}`, uncachedEdgeURL: `http://localhost:${port}`, consistency: "strong" });
});
test.after(() => server.stop());

async function call(path, { body, team = "team123", admin, method } = {}) {
  const headers = { "content-type": "application/json" };
  if (team) headers["x-team-code"] = team;
  if (admin) headers["x-admin-code"] = admin;
  const res = await handle(new Request("http://x/api/" + path, { method: method || (body ? "POST" : "GET"), headers, body: body ? JSON.stringify(body) : undefined }), { store, env });
  const type = res.headers.get("content-type") || "";
  return { status: res.status, data: type.includes("json") ? await res.json() : await res.arrayBuffer() };
}
const good = extra => ({ stars: 5, count: 1, date: "2026-10-14", nameInReview: true, image: IMG, device: "dev1", byName: "Sanne", ...extra });

test("zonder teamcode geen toegang", async () => {
  assert.equal((await call("state", { team: "fout" })).status, 401);
  assert.equal((await call("team", { body: { code: "team123" }, team: null })).status, 200);
});

test("insturen, controleren en de ranglijst", async () => {
  let r = await call("submit", { body: good({ newName: "Sanne", team: "TEG", count: 3, link: "https://g.co/abc" }) });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const sanne = r.data.personId, subId = r.data.id;

  // Zelfde link nog eens: geweigerd
  r = await call("submit", { body: good({ personId: sanne, link: "https://www.g.co/abc/" }) });
  assert.equal(r.status, 409);
  // Zonder printscreen / zonder naam-vinkje / buiten oktober: geweigerd
  assert.equal((await call("submit", { body: good({ personId: sanne, image: null }) })).status, 400);
  assert.equal((await call("submit", { body: good({ personId: sanne, nameInReview: false }) })).status, 400);
  assert.equal((await call("submit", { body: good({ personId: sanne, date: "2026-11-01" }) })).status, 400);

  let st = (await call("state?d=dev1")).data;
  assert.equal(st.score.totals.approved, 0);
  assert.equal(st.score.totals.waiting, 3);
  assert.equal(st.subs[0].mine, true);

  // Medewerker kan niet goedkeuren
  assert.equal((await call("decide", { body: { id: subId, decision: "ok", count: 3 } })).status, 403);
  // Beheerder keurt 2 van de 3 goed
  assert.equal((await call("decide", { body: { id: subId, decision: "ok", count: 2 }, admin: "baas2" })).status, 200);
  st = (await call("state")).data;
  const row = st.score.rows.find(x => x.id === sanne);
  assert.equal(row.reviews, 2);
  assert.equal(row.netCents, 2 * 2000 + 20000);
  assert.equal(st.subs.find(s => s.id === subId).review.by, "Arber");
  assert.equal(st.reviewLinks.TEG, "https://g.page/r/teg/review");

  // Beheerder voert zelf in: direct goedgekeurd, printscreen optioneel
  r = await call("submit", { body: good({ newName: "Mo", image: null, count: 4 }), admin: "baas1" });
  assert.equal(r.status, 200);
  assert.equal(r.data.approved, true);
  // Slechte review, goedgekeurd
  // 4 sterren: geen geld, wel in aantal en gemiddelde
  r = await call("submit", { body: good({ personId: sanne, stars: 4 }), admin: "baas1" });
  assert.equal(r.status, 200);
  // 2-5 sterren zonder medewerker: geweigerd; 1 ster zonder medewerker: mag
  assert.equal((await call("submit", { body: { stars: 3, count: 1, date: "2026-10-10", image: IMG, nameInReview: true } })).status, 400);
  r = await call("submit", { body: { stars: 1, count: 2, date: "2026-10-10", image: IMG, device: "dev2" } });
  assert.equal(r.status, 200);
  await call("decide", { body: { id: r.data.id, decision: "ok", count: 2 }, admin: "baas1" });

  st = (await call("state")).data;
  const mo = st.score.rows.find(x => x.name === "Mo"), sa = st.score.rows.find(x => x.id === sanne);
  assert.equal(st.score.totals.shareCents, 2000); // 2 × €20 / 2 winnaars
  assert.equal(mo.netCents, 4 * 2000 - 2000 + 20000);
  assert.equal(sa.netCents, 2 * 2000 - 2000);
  assert.deepEqual([sa.reviews, sa.total, sa.avgStars], [2, 3, 4.7]);

  // Foto toevoegen en verwijderen
  assert.equal((await call("person", { body: { action: "photo", id: sanne, image: IMG } })).status, 403);
  assert.equal((await call("person", { body: { action: "photo", id: sanne, image: IMG }, admin: "baas1" })).status, 200);
  st = (await call("state")).data;
  assert.ok(st.people.find(p => p.id === sanne).photo);
  assert.equal((await call("avatar/" + sanne + "?t=team123", { team: null })).status, 200);
  await call("person", { body: { action: "photo", id: sanne, image: null }, admin: "baas1" });
  assert.equal((await call("state")).data.people.find(p => p.id === sanne).photo, undefined);

  // Printscreen ophalen met teamcode in de URL
  const img = await call("img/" + subId + "?t=team123", { team: null });
  assert.equal(img.status, 200);
});

test("melden en eigen inzending verwijderen", async () => {
  const r = await call("submit", { body: good({ newName: "Lotte", device: "devL" }) });
  assert.equal((await call("flag", { body: { id: r.data.id, on: true, device: "x1" } })).status, 200);
  assert.equal((await call("flag", { body: { id: r.data.id, on: true, device: "x2" } })).status, 200);
  let s = (await call("state?d=x1")).data.subs.find(x => x.id === r.data.id);
  assert.equal(s.flags, 2); assert.equal(s.flagged, true);
  assert.equal((await call("delete", { body: { id: r.data.id, device: "iemand-anders" } })).status, 403);
  assert.equal((await call("delete", { body: { id: r.data.id, device: "devL" } })).status, 200);
  s = (await call("state")).data.subs.find(x => x.id === r.data.id);
  assert.equal(s, undefined);
});

// De lokale BlobsServer controleert ETags niet atomair, Netlify Blobs zelf wel.
// Daarom test deze geheugen-store met atomaire ETag-checks de retry-logica onder gelijktijdige schrijfacties.
class MemoryStore {
  constructor() { this.m = new Map(); this.v = 0; }
  async tick() { await new Promise(r => setTimeout(r, Math.random() * 3)); }
  async getWithMetadata(k) { await this.tick(); const e = this.m.get(k); return e ? { data: structuredClone(e.data), etag: e.etag, metadata: e.meta } : null; }
  async get(k) { const e = await this.getWithMetadata(k); return e ? e.data : null; }
  async getMetadata(k) { const e = this.m.get(k); return e ? { etag: e.etag, metadata: e.meta } : null; }
  async list({ prefix }) { return { blobs: [...this.m].filter(([k]) => k.startsWith(prefix)).map(([key, e]) => ({ key, etag: e.etag })) }; }
  async delete(k) { this.m.delete(k); }
  async set(k, data, o = {}) { return this.setJSON(k, data, o); }
  async setJSON(k, data, o = {}) {
    await this.tick();
    const cur = this.m.get(k);
    if (o.onlyIfNew && cur) return { modified: false };
    if (o.onlyIfMatch && (!cur || cur.etag !== o.onlyIfMatch)) return { modified: false };
    const etag = '"' + (++this.v) + '"';
    this.m.set(k, { data: structuredClone(data), etag, meta: o.metadata || {} });
    return { modified: true, etag };
  }
}

test("40 gelijktijdige inzendingen gaan allemaal goed (geen verloren updates)", async () => {
  const mem = new MemoryStore();
  const send = (body, admin) => handle(new Request("http://x/api/submit", { method: "POST", headers: { "content-type": "application/json", "x-team-code": "team123", ...(admin ? { "x-admin-code": admin } : {}) }, body: JSON.stringify(body) }), { store: mem, env });
  const results = await Promise.all(Array.from({ length: 40 }, (_, i) => send(good({ newName: "Team" + (i % 4), device: "d" + i }))));
  assert.deepEqual([...new Set(results.map(r => r.status))], [200]);
  const st = await (await handle(new Request("http://x/api/state", { headers: { "x-team-code": "team123" } }), { store: mem, env })).json();
  assert.equal(st.subs.length, 40);
  assert.equal(st.people.length, 4);
  assert.equal(st.score.totals.waiting, 40);
});

test("standaard kunnen alleen beheerders invoeren", async () => {
  const closed = { ...env, EMPLOYEE_SUBMIT: "" };
  const send = admin => handle(new Request("http://x/api/submit", { method: "POST", headers: { "content-type": "application/json", "x-team-code": "team123", ...(admin ? { "x-admin-code": admin } : {}) }, body: JSON.stringify(good({ newName: "Kim" })) }), { store, env: closed });
  assert.equal((await send()).status, 403);
  assert.equal((await send("baas2")).status, 200);
});

test("linkvoorbeeld: browser slaat PNG op, /og.png geeft hem publiek terug", async () => {
  const get = () => handle(new Request("http://x/og.png"), { store, env });
  const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  assert.equal((await call("og", { body: { image: "data:image/png;base64," + png, fp: "x1" } })).status, 403); // LOCKED: alleen beheerders
  assert.equal((await call("og", { body: { image: "data:image/png;base64," + png, fp: "x1" }, admin: "baas1" })).status, 200);
  const r = await get();
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "image/png");
  assert.equal((await call("state")).data.ogFp, "x1");
});

test("beheerder kan deelnemers vooraf toevoegen", async () => {
  const add = (name, admin) => call("person", { body: { action: "add", name, team: "KEG" }, admin });
  assert.equal((await add("Vera")).status, 403);
  assert.equal((await add("Vera", "baas1")).status, 200);
  assert.equal((await add("vera", "baas1")).status, 409);
  const st = (await call("state")).data;
  const row = st.score.rows.find(r => r.name === "Vera");
  assert.deepEqual([row.team, row.reviews, row.netCents], ["KEG", 0, 0]);
});

test("open modus (standaard): iedereen voert in en het telt meteen mee", async () => {
  const open = { ADMIN_CODES: "Amin:baas1" };
  const mem = new MemoryStore();
  const req = (path, body) => handle(new Request("http://x/api/" + path, { method: body ? "POST" : "GET", headers: { "content-type": "application/json" }, body: body && JSON.stringify(body) }), { store: mem, env: open });
  let r = await req("submit", { stars: 5, count: 2, date: "2026-10-14", nameInReview: true, newName: "Kim", byName: "Kim" });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).approved, true);
  assert.equal((await req("person", { action: "add", name: "Bo", team: "TEG" })).status, 200);
  const st = await (await req("state")).json();
  assert.equal(st.open, true);
  const kim = st.score.rows.find(x => x.name === "Kim");
  assert.equal(kim.netCents, 2 * 2000 + 20000);
  assert.equal(st.subs[0].byName, "Kim");
});

test("open modus: verwijderen alleen via beheerderslink, eigen invoer kort ongedaan maken", async () => {
  const open = { ADMIN_CODES: "Amin:baas1" };
  const mem = new MemoryStore();
  const req = (path, body, admin) => handle(new Request("http://x/api/" + path, { method: "POST", headers: { "content-type": "application/json", ...(admin ? { "x-admin-code": admin } : {}) }, body: JSON.stringify(body) }), { store: mem, env: open });
  const a = await (await req("submit", { stars: 5, count: 1, date: "2026-10-14", nameInReview: true, newName: "Kim", device: "phoneA" })).json();
  const b = await (await req("submit", { stars: 5, count: 1, date: "2026-10-14", nameInReview: true, personId: a.personId, device: "phoneA" })).json();
  assert.equal((await req("delete", { id: a.id, device: "phoneB" })).status, 403); // iemand anders
  assert.equal((await req("delete", { id: a.id, device: "phoneA" })).status, 200); // eigen, net ingevoerd
  assert.equal((await req("person", { action: "delete", id: a.personId })).status, 403);
  assert.equal((await req("person", { action: "update", id: a.personId, name: "X" })).status, 403);
  assert.equal((await req("person", { action: "add", name: "Bo" })).status, 200);
  assert.equal((await req("delete", { id: b.id, device: "phoneB" }, "baas1")).status, 200); // beheerder
});

test("beheerder inloggen", async () => {
  assert.equal((await call("login", { body: { code: "baas1" }, team: null })).data.admin, "Amin");
  assert.equal((await call("login", { body: { code: "nee" }, team: null })).status, 401);
});
