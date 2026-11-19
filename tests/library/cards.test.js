// The Library's cards, read out of the shipped app file (library/app/index.html), so what is tested is what people open.
// Checks the rules the cards are written by (the plan is in the project's library-plan.md):
//   every card in both languages, every picture with a grade and a drawing that draws in both languages,
//   every source cited exists and every source listed is cited, the {specialist's terms} balanced and matched,
//   report never advise (FORBIDDEN), card text in the third person, no « on » in French card text,
//   and Canadian French punctuation.
//   node tests/library/cards.test.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const FILE = path.join(__dirname, '..', '..', 'library', 'app', 'index.html');
const html = fs.readFileSync(FILE, 'utf8');
let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) pass++; else { fail++; console.log('FAIL ' + name + (detail ? '\n     ' + String(detail).slice(0, 400) : '')); } }

// the card block, from the visual alphabet to the end of the cards, run on its own with the two helpers it uses
const a = html.indexOf('/* ==== COLOURS'), b = html.indexOf('/* ==== end of CARDS ==== */');
ok('the card block is marked in the app file', a > 0 && b > a);
const S = { lang: 'en' };
const ctx = { S, esc: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) };
vm.createContext(ctx);
vm.runInContext(html.slice(a, b) + '\n;this.out={C,COLOURS,SRC,GRADE,SECTIONS,CARDS,RX};', ctx);
const { C, COLOURS, SRC, GRADE, SECTIONS, CARDS, RX } = ctx.out;
ok('a card that marks where its basics end keeps at least 3 basics and some details after', CARDS.filter(c => 'basics' in c).every(c => Number.isInteger(c.basics) && c.basics >= 3 && c.basics < c.f.length));
ok('a card about stimulants carries the fixed line on medicines', CARDS.filter(c => /stimulant/i.test(JSON.stringify(c.f.map(f => f[1])))).every(c => c.drug === true));

// words the apps never use (report, never advise)
const FORBIDDEN = { en: /\b(safe|safely|unsafe|avoid|avoids|avoided|should|trigger|triggers|triggered|healthy|unhealthy)\b/i,
  fr: /(^|[^a-zà-ÿ])(sécuritaire|sécuritaires|évite|éviter|évitez|devrait|devraient|devrais|devriez|devrions|déclencheur|déclencheurs|déclencheuse|malsain|malsaine|sain|saine|sains|saines)(?![a-zà-ÿ])/i };
const YOU = { en: /\b(you|your|yours|yourself)\b/i, fr: /(^|[^A-Za-zÀ-ÿ’'])(tu|ton|ta|tes|toi|te|t’[a-zà-ÿ]+)(?![A-Za-zÀ-ÿ])/i };
const ON = /(^|[\s(’'])on\s/i;
function frPunct(s) { const bad = [];
  if (/ [?!;]/.test(s)) bad.push('a space before ? ! or ;');
  if (/[^ ]:/.test(s.replace(/https?:\/\/\S+/g, ''))) bad.push('a colon without a no-break space before it');
  if (/[^ ]%/.test(s)) bad.push('% without a no-break space before it');
  if (/«(?! )|(?<! )»/.test(s)) bad.push('guillemets without no-break spaces inside');
  return bad; }
const braces = s => (s.match(/\{[^{}]+\}/g) || []).length, balanced = s => !/[{}]/.test(s.replace(/\{[^{}]+\}/g, ''));
function textRules(where, pair, cardText) {
  const [en, fr] = pair;
  ok(`${where}: English and French both written`, typeof en === 'string' && typeof fr === 'string' && en.trim() && fr.trim(), JSON.stringify(pair));
  if (typeof en !== 'string' || typeof fr !== 'string') return;
  ok(`${where}: braces balanced`, balanced(en) && balanced(fr), en + ' | ' + fr);
  ok(`${where}: the same number of {terms} in both languages`, braces(en) === braces(fr), en + ' | ' + fr);
  ok(`${where}: no forbidden word (English)`, !FORBIDDEN.en.test(en), en);
  ok(`${where}: no forbidden word (French)`, !FORBIDDEN.fr.test(fr), fr);
  const p = frPunct(fr); ok(`${where}: Canadian French punctuation`, !p.length, p.join(', ') + ' — ' + fr);
  if (cardText) {
    ok(`${where}: third person (English)`, !YOU.en.test(en), en);
    ok(`${where}: third person (French)`, !YOU.fr.test(fr), fr);
    ok(`${where}: no « on » in French card text`, !ON.test(fr), fr);
  } }

textRules('the fixed line on medicine cards', RX, false);
ok('six sections', SECTIONS.length === 6 && SECTIONS.map(s => s.n).join('') === '123456');
for (const s of SECTIONS) { textRules(`section ${s.id} name`, s.t, true); textRules(`section ${s.id} line`, s.d, true); }
for (const [k, p] of COLOURS) { ok(`colour ${k} exists`, !!C[k]); textRules(`colour ${k}`, p, true); }

const ids = new Set(), cited = new Set();
for (const c of CARDS) {
  ok(`card ${c.id}: a unique id that works as an address`, !ids.has(c.id) && /^[a-z0-9-]+$/.test(c.id)); ids.add(c.id);
  ok(`card ${c.id}: its section exists`, SECTIONS.some(s => s.id === c.sec));
  textRules(`card ${c.id} title`, c.t, true); textRules(`card ${c.id} line`, c.d, true);
  ok(`card ${c.id}: at least three pictures`, c.f.length >= 3);
  ok(`card ${c.id}: a precise version`, Array.isArray(c.more) && c.more.length >= 1);
  c.more.forEach((p, i) => textRules(`card ${c.id} precise ${i + 1}`, p, true));
  ok(`card ${c.id}: sources`, Array.isArray(c.src) && c.src.length >= 1);
  for (const k of c.src) { ok(`card ${c.id}: source ${k} exists`, !!SRC[k]); cited.add(k); }
  c.f.forEach(([t, cap, g, draw], i) => {
    const W = `card ${c.id} picture ${i + 1}`;
    textRules(W + ' title', t, true); textRules(W + ' caption', cap, true);
    ok(W + ': a grade', !!GRADE[g], g);
    for (const lang of ['en', 'fr']) { S.lang = lang; let out = '';
      try { out = draw((en, fr) => lang === 'fr' ? fr : en); } catch (e) { out = 'ERROR ' + e.message; }
      ok(`${W}: draws in ${lang}`, typeof out === 'string' && out.length > 40 && !/undefined|NaN|ERROR/.test(out), out.slice(0, 200));
      if (lang === 'fr') { const labels = [...out.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(m => m[1]); for (const l of labels) { const p = frPunct(l.replace(/&#39;/g, '’')); ok(`${W}: French label punctuation (${l})`, !p.length, p.join(', ')); } }
    }
  });
  ok(`card ${c.id}: the last picture is graded`, !!GRADE[c.f[c.f.length - 1][2]]);
}
for (const k of Object.keys(SRC)) { ok(`source ${k} is cited by a card`, cited.has(k)); ok(`source ${k}: https link and both names`, /^https:\/\//.test(SRC[k].u) && SRC[k].l[0] && SRC[k].l[1]); }
// a key written twice in SRC silently keeps only the last one, so the check reads the source text, not the object
{ const s = html.indexOf('const SRC={'), e = html.indexOf('/* the fixed line on every card');
  const keys = (html.slice(s, e).match(/^\s+([A-Za-z0-9_]+)\s*:\s*\{\s*l\s*:/gm) || []).map(m => m.trim().split(/\s*:/)[0]);
  const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
  ok('the source list is found', s > 0 && e > s && keys.length === Object.keys(SRC).length, keys.length + ' written, ' + Object.keys(SRC).length + ' kept');
  ok('no source key is written twice', !dup.length, dup.join(', ')); }

console.log(fail ? `${fail} failed, ${pass} passed` : `ok ${pass} checks, ${CARDS.length} cards, ${CARDS.reduce((n, c) => n + c.f.length, 0)} pictures`);
process.exit(fail ? 1 : 0);
