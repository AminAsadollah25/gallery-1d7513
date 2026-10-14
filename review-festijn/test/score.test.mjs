import test from "node:test";
import assert from "node:assert/strict";
import { score, RULES } from "../src/score.mjs";

let n = 0;
const person = (name, team = "VEG") => ({ id: name, name, team });
const sub = (stars, personId, count, review) => ({ id: "s" + n++, stars, personId, count, review });
const ok = count => ({ decision: "ok", count });
function db(people, subs) {
  return { people: Object.fromEntries(people.map(p => [p.id, p])), subs: Object.fromEntries(subs.map(s => [s.id, s])) };
}
const row = (res, id) => res.rows.find(r => r.id === id);

test("voorbeeld uit het bericht: 10 slechte (1-ster) reviews en 5 winnaars = €40 aftrek per winnaar", () => {
  const people = ["A", "B", "C", "D", "E"].map(x => person(x));
  const subs = [
    sub(5, "A", 6, ok(6)), sub(5, "B", 3, ok(3)), sub(5, "C", 2, ok(2)),
    sub(5, "D", 1, ok(1)), sub(5, "E", 4, ok(4)), sub(1, null, 10, ok(10)),
  ];
  const r = score(db(people, subs));
  assert.equal(r.totals.winners, 5);
  assert.equal(r.totals.shareCents, 4000);
  assert.equal(row(r, "A").netCents, 6 * 2000 - 4000 + 20000); // €120 - €40 + €200 = €280
  assert.equal(row(r, "B").netCents, 3 * 2000 - 4000); // €20
  assert.equal(row(r, "E").netCents, 4 * 2000 - 4000); // €40
  assert.equal(row(r, "D").netCents, 0); // €20 - €40 komt niet onder €0
  assert.deepEqual(r.leaders, ["A"]);
});

test("2-4 sterren: geen geld, wel meegeteld in aantal en gemiddelde", () => {
  const r = score(db([person("A"), person("B")], [
    sub(5, "A", 4, ok(4)), sub(4, "A", 1, ok(1)), // A: 5 reviews, (4×5 + 4) / 5 = 4,8
    sub(3, "B", 2, ok(2)), sub(2, "B", 1, ok(1)), // B: alleen neutrale reviews
  ]));
  const a = row(r, "A"), b = row(r, "B");
  assert.deepEqual([a.reviews, a.total, a.avgStars, a.earnedCents], [4, 5, 4.8, 8000]);
  assert.deepEqual([b.reviews, b.total, b.avgStars, b.netCents, b.rank], [0, 3, 2.7, 0, null]);
  assert.equal(r.totals.winners, 1); // B is geen winnaar: geen 5-sterren review
  assert.equal(r.totals.approved, 8);
});

test("gemiddelde zoals in de vraag: 4,5 ster uit een mix", () => {
  const r = score(db([person("A")], [sub(5, "A", 1, ok(1)), sub(4, "A", 1, ok(1))]));
  assert.equal(row(r, "A").avgStars, 4.5);
});

test("1-ster review met naam: telt in het gemiddelde, aftrek blijft gedeeld over alle winnaars", () => {
  const r = score(db([person("A"), person("B")], [
    sub(5, "A", 3, ok(3)), sub(5, "B", 1, ok(1)), sub(1, "B", 2, ok(2)),
  ]));
  assert.equal(r.totals.bad, 2);
  assert.equal(r.totals.shareCents, 2000); // 2 × €20 ÷ 2 winnaars
  assert.equal(row(r, "A").minusCents, 2000);
  assert.equal(row(r, "B").minusCents, 2000);
  assert.equal(row(r, "B").avgStars, Math.round((5 + 2) / 3 * 10) / 10); // 2,3
});

test("alleen goedgekeurde reviews tellen, met het goedgekeurde aantal", () => {
  const r = score(db([person("A")], [
    sub(5, "A", 3, null), // in controle
    sub(5, "A", 2, { decision: "no", count: 0 }), // afgekeurd
    sub(5, "A", 5, ok(4)), // ingestuurd 5, goedgekeurd 4
    sub(1, null, 2, null), // 1-ster nog in controle
  ]));
  assert.equal(row(r, "A").reviews, 4);
  assert.equal(row(r, "A").waiting, 3);
  assert.equal(r.totals.bad, 0);
  assert.equal(r.totals.waiting, 5);
  assert.equal(row(r, "A").netCents, 4 * 2000 + 20000);
});

test("gelijke stand: bonus van €200 wordt gedeeld en beide staan op plek 1", () => {
  const r = score(db([person("A"), person("B"), person("C")], [
    sub(5, "A", 5, ok(5)), sub(5, "B", 5, ok(5)), sub(5, "C", 2, ok(2)),
  ]));
  assert.equal(row(r, "A").bonusCents, 10000);
  assert.equal(row(r, "B").bonusCents, 10000);
  assert.deepEqual([row(r, "A").rank, row(r, "B").rank, row(r, "C").rank], [1, 1, 3]);
});

test("aftrek wordt op de cent afgerond bij 3 winnaars", () => {
  const r = score(db([person("A"), person("B"), person("C")], [
    sub(5, "A", 3, ok(3)), sub(5, "B", 2, ok(2)), sub(5, "C", 1, ok(1)), sub(1, null, 1, ok(1)),
  ]));
  assert.equal(r.totals.shareCents, 667); // €20 / 3 = €6,67
  assert.equal(row(r, "C").netCents, 2000 - 667);
});

test("oude inzendingen met kind good/bad tellen als 5 en 1 ster", () => {
  const r = score(db([person("A")], [{ id: "x", kind: "good", personId: "A", count: 2, review: ok(2) }, { id: "y", kind: "bad", count: 1, review: ok(1) }]));
  assert.equal(row(r, "A").reviews, 2);
  assert.equal(r.totals.bad, 1);
});

test("lege database en negatief saldo", () => {
  assert.equal(score({ people: {}, subs: {} }).rows.length, 0);
  const r = score(db([person("A"), person("B")], [sub(5, "A", 5, ok(5)), sub(5, "B", 1, ok(1)), sub(1, null, 4, ok(4))]), { ...RULES, noNegative: false });
  assert.equal(row(r, "B").netCents, 2000 - 4000);
});
