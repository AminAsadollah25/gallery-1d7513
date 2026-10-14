import test from "node:test";
import assert from "node:assert/strict";
import { score, RULES } from "../src/score.mjs";

let n = 0;
const person = (name, team = "VEG") => ({ id: name, name, team });
const sub = (kind, personId, count, review) => ({ id: "s" + n++, kind, personId, count, review });
const ok = count => ({ decision: "ok", count });
function db(people, subs) {
  return { people: Object.fromEntries(people.map(p => [p.id, p])), subs: Object.fromEntries(subs.map(s => [s.id, s])) };
}
const row = (res, id) => res.rows.find(r => r.id === id);

test("voorbeeld uit het bericht: 10 slechte reviews en 5 winnaars = €40 aftrek per winnaar", () => {
  const people = ["A", "B", "C", "D", "E"].map(x => person(x));
  const subs = [
    sub("good", "A", 6, ok(6)), sub("good", "B", 3, ok(3)), sub("good", "C", 2, ok(2)),
    sub("good", "D", 1, ok(1)), sub("good", "E", 4, ok(4)), sub("bad", null, 10, ok(10)),
  ];
  const r = score(db(people, subs));
  assert.equal(r.totals.winners, 5);
  assert.equal(r.totals.shareCents, 4000);
  assert.equal(row(r, "A").netCents, 6 * 2000 - 4000 + 20000); // €200: 120 - 40 + 200
  assert.equal(row(r, "B").netCents, 3 * 2000 - 4000); // €20
  assert.equal(row(r, "E").netCents, 4 * 2000 - 4000); // €40
  assert.equal(row(r, "D").netCents, 0); // €20 - €40 komt niet onder €0
  assert.deepEqual(r.leaders, ["A"]);
  assert.equal(row(r, "A").rank, 1);
});

test("alleen goedgekeurde reviews tellen, met het goedgekeurde aantal", () => {
  const r = score(db([person("A")], [
    sub("good", "A", 3, null), // in controle
    sub("good", "A", 2, { decision: "no", count: 0 }), // afgekeurd
    sub("good", "A", 5, ok(4)), // ingestuurd 5, goedgekeurd 4
    sub("bad", null, 2, null), // slechte review nog in controle
  ]));
  assert.equal(row(r, "A").reviews, 4);
  assert.equal(row(r, "A").waiting, 3);
  assert.equal(r.totals.bad, 0);
  assert.equal(r.totals.waiting, 5);
  assert.equal(row(r, "A").netCents, 4 * 2000 + 20000);
});

test("gelijke stand: bonus van €200 wordt gedeeld en beide staan op plek 1", () => {
  const r = score(db([person("A"), person("B"), person("C")], [
    sub("good", "A", 5, ok(5)), sub("good", "B", 5, ok(5)), sub("good", "C", 2, ok(2)),
  ]));
  assert.equal(row(r, "A").bonusCents, 10000);
  assert.equal(row(r, "B").bonusCents, 10000);
  assert.equal(row(r, "C").bonusCents, 0);
  assert.deepEqual([row(r, "A").rank, row(r, "B").rank, row(r, "C").rank], [1, 1, 3]);
});

test("aftrek wordt op de cent afgerond bij 3 winnaars", () => {
  const r = score(db([person("A"), person("B"), person("C")], [
    sub("good", "A", 3, ok(3)), sub("good", "B", 2, ok(2)), sub("good", "C", 1, ok(1)), sub("bad", null, 1, ok(1)),
  ]));
  assert.equal(r.totals.shareCents, 667); // €20 / 3 = €6,67
  assert.equal(row(r, "C").netCents, 2000 - 667);
});

test("deelnemers zonder reviews krijgen geen aftrek en geen bonus", () => {
  const r = score(db([person("A"), person("Z")], [sub("good", "A", 1, ok(1)), sub("bad", null, 3, ok(3))]));
  const z = row(r, "Z");
  assert.deepEqual([z.minusCents, z.bonusCents, z.netCents, z.rank], [0, 0, 0, null]);
  assert.equal(r.totals.winners, 1);
  assert.equal(row(r, "A").netCents, Math.max(0, 2000 - 6000 + 20000));
});

test("lege database geeft een lege ranglijst", () => {
  const r = score({ people: {}, subs: {} });
  assert.equal(r.rows.length, 0);
  assert.equal(r.totals.potCents, 0);
  assert.deepEqual(r.leaders, []);
});

test("negatief saldo kan aan worden gezet", () => {
  const r = score(db([person("A"), person("B")], [sub("good", "A", 5, ok(5)), sub("good", "B", 1, ok(1)), sub("bad", null, 4, ok(4))]),
    { ...RULES, noNegative: false });
  assert.equal(row(r, "B").netCents, 2000 - 4000);
});
