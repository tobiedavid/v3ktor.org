// Two made-up people, six weeks each, for the Threshold Log walkthrough test. Everything here is decided by a seeded
// random number, so every run plays the same six weeks. The effects follow hidden rules (below), so the screens have
// something to show; the test never checks that the app "finds" a rule, only that every count on screen is the count
// of what was entered.
'use strict';
const { holds, plus, nothing, dayOf, dayPlus } = require('./oracle.js');

function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const MIN = 60e3;

// ---------- a steady eater, who used the Food Trial Log first (English, day starts at 4 a.m.) ----------
function steady() {
  const R = rng(20261121), N = 42, roll = 4, T = (i, h, mi) => new Date(2026, 10, 21 + i, h, mi || 0).getTime(), now = T(41, 20, 30), plan = [];
  const EGG = 130, POTATO = 2506, OAT = 1414, CHICKEN = 920001, RICE = 4523, BROC = 2375, FISH = 3037, BRICE = 4497, KALE = 2105, BEEF = 920002, SQUASH = 2306, CHOP = 1787, TOFU = 3404, BUTTER = 118, MAG = 920104, VITD = 920106, BROTH = 'Bone broth';
  const oatFull = new Set([5, 12, 20, 27, 34, 40]), oatHalf = new Set([9, 16, 23, 30, 37]), sameDay = {};   // sameDay[i] = an effect that belongs to day i was reported before the evening
  for (let i = 0; i < N; i++) {
    const b = [[EGG, 2], [POTATO, 1]]; if (oatFull.has(i)) b.push([OAT, 1]); if (oatHalf.has(i)) b.push([OAT, 0.5]);
    plan.push({ k: 'meal', t: T(i, 7, 30), items: b, via: i % 3 === 0 ? 'mine' : i % 3 === 1 ? 'search' : 'recent' });
    if ((oatFull.has(i) && R() < 0.85) || (oatHalf.has(i) && R() < 0.2)) { plan.push({ k: 'fx', t: T(i, 9, 40), codes: ['gut'] }); sameDay[i] = true; }      // hidden rule: a full packet of oatmeal, gut discomfort about two hours later
    const lunch = i % 3 === 2 ? [[FISH, 1], [BRICE, 1], [KALE, 1]] : [[CHICKEN, 1.5], [RICE, 1], [BROC, 1]];
    plan.push(Object.assign({ k: 'meal', t: T(i, 12, 15), items: lunch, via: 'mine' }, i % 7 === 3 ? { logAt: T(i, 13, 40) } : {}));                           // some lunches are entered late, with the time set back
    if (i % 4 === 1) plan.push({ k: 'meal', t: T(i, 15, 30), items: [[BROTH, 1]], via: 'search' });
    if (R() < 0.06 || i === 25) { plan.push({ k: 'fx', t: T(i, 15, 0), codes: ['lowen'] }); sameDay[i] = true; }
    const heavy = i % 5 === 4, dinner = heavy ? [[CHOP, 2], [BUTTER, 2], [POTATO, 1]] : [[[BEEF, 1], [POTATO, 1], [SQUASH, 1]], [[CHOP, 1.5], [RICE, 1], [BROC, 1]], [[TOFU, 1], [BRICE, 1], [KALE, 1]]][i % 3];
    if (i === 9) plan.push({ k: 'meal', t: T(i, 18, 30), items: dinner, via: 'search', logAt: T(i + 1, 7, 20) });                                             // forgotten, entered the next morning under "Yesterday"
    else plan.push({ k: 'meal', t: T(i, 18, 30), items: dinner, via: heavy ? 'group' : 'mine' });
    if (i === 14 || i === 31) { plan.push({ k: 'fx', t: T(i, 20, 0), codes: [], own: [{ tab: 'phys', word: 'itchy skin' }] }); sameDay[i] = true; }           // an effect in her own words
    plan.push({ k: 'meal', t: T(i, 21, 0), items: [[MAG, 1], [VITD, 1]], via: 'group' });                                                                     // pills are entered like foods
    const badNight = heavy && R() < 0.65 && i + 1 < N;                                                                                                        // hidden rule: a fatty dinner, poor sleep that night
    if (!sameDay[i]) { if (R() < 0.93) plan.push({ k: 'none', at: T(i, 21, 30), day: i, from: 'today' }); else if (!badNight && R() < 0.5 && i + 1 < N) plan.push({ k: 'none', at: T(i + 1, 7, 25), day: i, from: 'yesterday' }); }
    if (badNight) plan.push({ k: 'fx', t: T(i + 1, 7, 5), codes: ['sleep'] });
  }
  const dayKey = i => dayOf(T(i, 12), roll);
  for (const a of plan) if (a.k === 'none') a.day = dayKey(a.day);
  plan.push({ k: 'script', at: T(15, 19, 0), do: 'addToMeal', target: T(15, 12, 15), item: [BUTTER, 1] });       // opens a meal from Home and adds a food to it
  plan.push({ k: 'script', at: T(22, 16, 0), do: 'effectUndoRemove', code: 'naus' });                           // reports an effect, removes it, undoes, removes it again
  plan.push({ k: 'script', at: T(25, 16, 0), do: 'moveEffect', from: T(25, 15, 0), to: T(25, 14, 10) });         // changes an effect's time
  plan.push({ k: 'script', at: T(30, 19, 30), do: 'conclusions', bar: 'fib', food: OAT, text: 'Half a packet is where it starts for me.' });
  plan.push({ k: 'script', at: T(33, 16, 0), do: 'removeMeal', target: T(33, 15, 30) });                         // removes a meal from History
  closeFirstOpenDay(plan, N, T, dayKey, roll, new Set());
  return { name: 'steady', lang: 'en', roll, now, start: T(0, 6, 0), gut: 'gut-after-two-trials.json', T, dayKey,
    labels: [{ n: BROTH, s: '1 cup (250 ml)', kcal: 40, fat: 0.5, carb: 0.5, fib: 0, sug: null, prot: 9, lact: 0, h: false }], listAdd: [BROTH],
    plan: plan.filter(a => (a.logAt || a.at || a.t) <= now).sort((x, y) => (x.logAt || x.at || x.t) - (y.logAt || y.at || y.t)) };
}

// ---------- a varied eater, who starts here without the Food Trial Log (French, day starts at midnight) ----------
function varied(table) {
  const R = rng(20261004), N = 42, roll = 0, T = (i, h, mi) => new Date(2026, 9, 4 + i, h, mi || 0).getTime(), now = T(41, 20, 30), plan = [], KOMB = 'Kombucha';
  const labels = [{ n: KOMB, s: '1 bouteille (355 ml)', kcal: 50, fat: 0, carb: 12, fib: 0, sug: 10, prot: 0, lact: 0, h: true, t: ['flav'] }];      // its ingredient list names a flavour: ticked on the label form
  const rec = ref => typeof ref === 'number' ? table[ref] : labelRecord(labels.find(l => l.n === ref));
  const breakfasts = [[[3671, 1], [28, 1], [2873, 1], [136, 1]], [[1242, 1.5], [61, 1], [1704, 1]], [[502158, 1], [501819, 1], [1620, 1]], [[130, 2], [5407, 1], [4066, 2], [118, 1]], [[1256, 1], [113, 1.5]]];
  const lunches = [[[501975, 1], [1696, 1]], [[501976, 1], [4407, 1]], [[4962, 2], [5288, 1]], [[4617, 1], [2185, 1], [5288, 1]], [[1055, 1], [4066, 1]], [[4650, 1], [2926, 1]], [[4903, 1], [130, 1]], [[3081, 1], [4067, 2], [2460, 1]]];
  const dinners = [[[4464, 1], [2462, 1], [40, 1]], [[4963, 1], [4066, 1]], [[920004, 1], [4523, 1], [2375, 1]], [[501999, 1]], [[3203, 1], [4067, 2], [2201, 1]], [[2696, 1], [2506, 1], [2850, 2]], [[502357, 1], [1185, 2]], [[5684, 1], [109, 1.5], [4066, 2], [2850, 2]], [[2201, 1], [1185, 2], [2506, 1]]];
  const snacks = [[[4163, 1]], [[4163, 2]], [[4186, 1]], [[4407, 1]], [[3893, 1]], [[2943, 2]], [[910001, 1]], [[509001, 1]], [[70, 1]], [[KOMB, 1]], [[930001, 2]], [[930003, 1]]];      // water and flavoured sparkling water, each entered alone
  const pick = list => list[Math.floor(R() * list.length)], skipped = new Set([17, 29]), meals = [], fx = [], amOf = items => { const a = nothing(); for (const [ref, q] of items) plus(a, holds(rec(ref), q)); return a; };
  const dayOfIdx = t => Math.round((new Date(new Date(t).getFullYear(), new Date(t).getMonth(), new Date(t).getDate()).getTime() - T(0, 0)) / 864e5);   // which of the 42 days a time falls on
  for (let i = 0; i < N; i++) {
    const wk = new Date(T(i, 12)).getDay(), weekend = wk === 0 || wk === 6, today = [];
    today.push({ t: T(i, weekend ? 9 : 7, weekend ? 15 : 45), items: pick(breakfasts), via: 'search' });
    today.push(Object.assign({ t: T(i, 12, 30), items: pick(lunches), via: 'group' }, i % 6 === 2 ? { logAt: T(i, 14, 10) } : {}));
    if (R() < 0.5) today.push({ t: T(i, 15, 30), items: pick(snacks), via: 'search' });
    today.push({ t: T(i, 19, 0), items: pick(dinners), via: i % 2 ? 'search' : 'recent' });
    if (R() < 0.3) today.push({ t: T(i, 21, 15), items: pick(snacks), via: 'recent' });
    if (i === 8 || i === 26) today.push({ t: T(i + 1, 0, 40), items: [[4407, 1], [2943, 1]], via: 'search' });       // a snack after midnight: it belongs to the next day
    const r = Array.from({ length: 12 }, () => R());                                                                // the same draws whether or not the day is skipped, so a change to one day never reshuffles the others
    if (skipped.has(i)) continue;
    let sugars = 0, alcohol = 0;
    for (const m of today) { const am = amOf(m.items); sugars += am.sugars; alcohol += am.alcohol; meals.push(m);
      const u = rng(m.t / MIN | 0), h = am.hist >= 2.5 ? 0.75 : am.hist >= 1 ? 0.3 : 0.03, l = am.lactose >= 12 ? 0.8 : am.lactose >= 4 ? 0.25 : 0.02;
      if (u() < h) fx.push({ t: m.t + (60 + Math.floor(u() * 140)) * MIN, codes: ['head'], own: u() < 0.3 ? [{ tab: 'psy', word: 'confusion' }] : [] });     // hidden rule: histamine food, headache one to three hours later
      if (u() < l) fx.push({ t: m.t + (50 + Math.floor(u() * 120)) * MIN, codes: u() < 0.5 ? ['gut', 'loose'] : ['gut'] });                                           // hidden rule: lactose, gut discomfort
      }
    if (sugars >= 110 && r[0] < 0.6 && i + 1 < N && !skipped.has(i + 1)) fx.push({ t: T(i + 1, 10, 0), codes: ['lowen'] });
    if (alcohol >= 25 && r[1] < 0.7 && i + 1 < N && !skipped.has(i + 1)) { fx.push({ t: T(i + 1, 7, 40), codes: ['sleep'] }); if (r[2] < 0.4) fx.push({ t: T(i + 1, 14, 0), codes: ['nomot'] }); }
    if (r[3] < 0.04) fx.push({ t: T(i, 17, 0), codes: ['edgy'] });
    if (r[4] < 0.03) fx.push({ t: T(i, 8, 0), codes: ['joint'] });
  }
  for (const m of meals) plan.push(Object.assign({ k: 'meal' }, m));
  for (const e of fx) { const i = dayOfIdx(e.t); if (i >= 0 && i < N && !skipped.has(i)) plan.push(Object.assign({ k: 'fx' }, e)); }
  // closing a day: at 22:00, when no effect belongs to it yet
  const dayKey = i => dayOf(T(i, 12), roll), c = rng(77);
  for (let i = 0; i < N; i++) { const draw = [c(), c()]; if (skipped.has(i)) continue; const k = dayKey(i);
    const has = plan.some(a => a.k === 'fx' && a.t <= T(i, 22, 0) && a.codes.concat((a.own || []).map(() => 'own')).some(code => (code === 'sleep' ? dayPlus(dayOf(a.t, roll), -1) : dayOf(a.t, roll)) === k));
    if (!has && draw[0] < 0.88) plan.push({ k: 'none', at: T(i, 22, 0), day: k, from: 'today' }); }
  closeFirstOpenDay(plan, N, T, dayKey, roll, skipped);
  return { name: 'varied', lang: 'fr', roll, now, start: T(0, 6, 0), gut: null, T, dayKey, labels, listAdd: [],
    plan: plan.filter(a => (a.logAt || a.at || a.t) <= now).sort((x, y) => (x.logAt || x.at || x.t) - (y.logAt || y.at || y.t)) };
}

// three days after the first day a person left open, they close it from History ("No effects that day")
function closeFirstOpenDay(plan, N, T, dayKey, roll, skipped) {
  const belongsTo = a => a.codes.concat((a.own || []).map(() => 'own')).map(code => code === 'sleep' ? dayPlus(dayOf(a.t, roll), -1) : dayOf(a.t, roll));
  for (let i = 0; i < N - 4; i++) { const k = dayKey(i), at = T(i + 3, 12, 5); if (skipped.has(i) || skipped.has(i + 3)) continue;
    if (plan.some(a => (a.k === 'none' && a.day === k) || (a.k === 'fx' && a.t <= at && belongsTo(a).includes(k)))) continue;
    plan.push({ k: 'script', at, do: 'closeOldest' }); return; }
}

// a food a person added from its label, in the shape of a table row
function labelRecord(l) { return { label: true, en: l.n, fr: l.n, kcal: l.kcal, prot: l.prot, fat: l.fat, carb: l.carb, sugars: l.sug, fibre: l.fib, lactose: l.lact || 0, alcohol: 0, histFood: !!l.h, hist: null, micro: null, noFigure: [], carries: Object.fromEntries((l.t || []).map(k => [k, 1])) }; }

// what the app should hold after the plan is played: the same rules a person would expect, written out plainly
function expected(person, table) {
  const out = [], rec = ref => typeof ref === 'number' ? table[ref] : labelRecord(person.labels.find(l => l.n === ref)), roll = person.roll;
  const belongs = e => e.c === 'sleep' ? dayPlus(dayOf(e.t, roll), -1) : dayOf(e.t, roll);
  for (const a of person.plan) {
    if (a.k === 'meal') out.push({ k: 'meal', t: a.t, items: a.items.map(([ref, q]) => ({ ref, food: rec(ref), q })) });
    else if (a.k === 'fx') { const codes = a.codes.concat((a.own || []).map(o => 'o:' + o.word)), made = codes.map((c, i) => ({ k: 'fx', t: a.t + i, c }));
      const days = new Set(made.map(belongs)); for (let i = out.length - 1; i >= 0; i--) if (out[i].k === 'none' && days.has(out[i].d)) out.splice(i, 1);   // a day with an effect is no longer a day with none
      out.push(...made); }
    else if (a.k === 'none') { const i = out.findIndex(e => e.k === 'none' && e.d === a.day); if (i >= 0) out.splice(i, 1); else if (!out.some(e => e.k === 'fx' && belongs(e) === a.day)) out.push({ k: 'none', d: a.day }); }
    else if (a.do === 'addToMeal') { const m = out.find(e => e.k === 'meal' && e.t === a.target); m.items.push({ ref: a.item[0], food: rec(a.item[0]), q: a.item[1] }); }
    else if (a.do === 'moveEffect') { out.find(e => e.k === 'fx' && e.t === a.from).t = a.to; }
    else if (a.do === 'removeMeal') { out.splice(out.findIndex(e => e.k === 'meal' && e.t === a.target), 1); }
    else if (a.do === 'closeOldest') { const today = dayOf(a.at, roll), days = [...new Set(out.filter(e => e.k === 'meal').map(e => dayOf(e.t, roll)))].sort();
      const open = days.filter(k => k < today && !out.some(e => (e.k === 'none' && e.d === k) || (e.k === 'fx' && belongs(e) === k))); a.day = open[0] || null; if (a.day) out.push({ k: 'none', d: a.day }); }
  }
  return out;
}
module.exports = { steady, varied, expected, labelRecord, rng };
