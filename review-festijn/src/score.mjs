// Spelregels van het Review Festijn. Alle bedragen in centen, zodat er geen afrondingsfouten ontstaan.
export const RULES = {
  perReviewCents: 2000, // €20 per goedgekeurde review
  penaltyCents: 2000, // €20 per slechte review, verdeeld over alle winnaars
  bonusCents: 20000, // €200 voor de nummer 1 (bij gelijke stand gedeeld)
  noNegative: true, // niemand komt onder €0 uit
  start: "2026-10-01",
  end: "2026-10-31",
  teams: ["VEG", "TEG", "KEG"],
};

/**
 * Berekent de ranglijst uit de database.
 * - Alleen goedgekeurde inzendingen tellen; het goedgekeurde aantal (review.count) is leidend.
 * - Winnaar = iemand met minstens 1 goedgekeurde review.
 * - Aftrek per winnaar = (aantal slechte reviews × €20) ÷ aantal winnaars.
 * - Bonus = €200 voor wie de meeste reviews heeft; bij gelijke stand gedeeld.
 */
export function score(db, rules = RULES) {
  const people = db.people || {};
  const good = {}, waiting = {};
  let bad = 0, waitingBad = 0;

  for (const s of Object.values(db.subs || {})) {
    const r = s.review;
    if (r && r.decision === "ok") {
      const n = r.count;
      if (s.kind === "bad") bad += n;
      else if (people[s.personId]) good[s.personId] = (good[s.personId] || 0) + n;
    } else if (!r) {
      if (s.kind === "bad") waitingBad += s.count;
      else if (people[s.personId]) waiting[s.personId] = (waiting[s.personId] || 0) + s.count;
    }
  }

  const rows = Object.values(people).map(p => ({
    id: p.id, name: p.name, team: p.team,
    reviews: good[p.id] || 0, waiting: waiting[p.id] || 0,
  }));
  const winners = rows.filter(r => r.reviews > 0);
  const top = winners.reduce((m, r) => Math.max(m, r.reviews), 0);
  const leaders = winners.filter(r => r.reviews === top);
  const shareCents = winners.length ? Math.round(bad * rules.penaltyCents / winners.length) : 0;
  const bonusEachCents = leaders.length ? Math.round(rules.bonusCents / leaders.length) : 0;

  for (const r of rows) {
    r.earnedCents = r.reviews * rules.perReviewCents;
    r.minusCents = r.reviews > 0 ? shareCents : 0;
    r.bonusCents = r.reviews > 0 && r.reviews === top ? bonusEachCents : 0;
    const raw = r.earnedCents - r.minusCents + r.bonusCents;
    r.netCents = rules.noNegative ? Math.max(0, raw) : raw;
  }

  rows.sort((a, b) => b.reviews - a.reviews || b.waiting - a.waiting || a.name.localeCompare(b.name, "nl"));
  // Gedeelde plekken: 1, 1, 3, …
  let rank = 0, prev = -1;
  rows.forEach((r, i) => {
    if (r.reviews !== prev) { rank = i + 1; prev = r.reviews; }
    r.rank = r.reviews > 0 ? rank : null;
  });

  const waitingTotal = Object.values(waiting).reduce((s, n) => s + n, 0);
  return {
    rows,
    leaders: leaders.map(r => r.id),
    top,
    totals: {
      approved: winners.reduce((s, r) => s + r.reviews, 0),
      waiting: waitingTotal + waitingBad,
      bad,
      waitingBad,
      winners: winners.length,
      penaltyCents: bad * rules.penaltyCents,
      shareCents,
      bonusEachCents,
      potCents: rows.reduce((s, r) => s + r.netCents, 0),
    },
  };
}
