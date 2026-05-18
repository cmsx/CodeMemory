// Russian Snowball stemmer — a frozen, standardised algorithm
// (https://snowballstem.org/algorithms/russian/stemmer.html), vendored rather
// than depended on: it never changes and pulls no transitive surface.
//
// It strips suffixes only, so the stem is always a *prefix* of the input. That
// lets search issue a `stem*` FTS5 query against the unstemmed index and match
// every inflected form without reindexing. Non-Cyrillic input is returned
// unchanged, so mixed Russian/English queries are safe.

const VOWEL = new Set(["а", "е", "и", "о", "у", "ы", "э", "ю", "я", "ё"]);

interface Ending {
  suf: string;
  needAYa: boolean; // suffix valid only when immediately preceded by а or я
}

function mk(entries: Array<[string, boolean]>): Ending[] {
  return entries
    .map(([suf, needAYa]) => ({ suf, needAYa }))
    .sort((a, b) => b.suf.length - a.suf.length);
}

function plain(sufs: string[]): Ending[] {
  return sufs
    .map((suf) => ({ suf, needAYa: false }))
    .sort((a, b) => b.suf.length - a.suf.length);
}

const PERFECTIVE_GERUND = mk([
  ["в", true], ["вши", true], ["вшись", true],
  ["ив", false], ["ивши", false], ["ившись", false],
  ["ыв", false], ["ывши", false], ["ывшись", false],
]);

const ADJECTIVE = plain([
  "ее", "ие", "ые", "ое", "ими", "ыми", "ей", "ий", "ый", "ой", "ем", "им",
  "ым", "ом", "его", "ого", "ему", "ому", "их", "ых", "ую", "юю", "ая", "яя",
  "ою", "ею",
]);

const PARTICIPLE = mk([
  ["ем", true], ["нн", true], ["вш", true], ["ющ", true], ["щ", true],
  ["ивш", false], ["ывш", false], ["ующ", false],
]);

const REFLEXIVE = plain(["ся", "сь"]);

const VERB = mk([
  ["ла", true], ["на", true], ["ете", true], ["йте", true], ["ли", true],
  ["й", true], ["л", true], ["ем", true], ["н", true], ["ло", true],
  ["но", true], ["ет", true], ["ют", true], ["ны", true], ["ть", true],
  ["ешь", true], ["нно", true],
  ["ила", false], ["ыла", false], ["ена", false], ["ейте", false],
  ["уйте", false], ["ите", false], ["или", false], ["ыли", false],
  ["ей", false], ["уй", false], ["ил", false], ["ыл", false], ["им", false],
  ["ым", false], ["ен", false], ["ило", false], ["ыло", false], ["ено", false],
  ["ят", false], ["ует", false], ["уют", false], ["ит", false], ["ыт", false],
  ["ены", false], ["ить", false], ["ыть", false], ["ишь", false], ["ую", false],
  ["ю", false],
]);

const NOUN = plain([
  "а", "ев", "ов", "ие", "ье", "е", "иями", "ями", "ами", "еи", "ии", "и",
  "ией", "ий", "й", "иям", "ям", "ием", "ем", "ам", "ом", "о", "у", "ах",
  "иях", "ях", "ы", "ь", "ию", "ью", "ю", "ия", "ья", "я",
]);

const DERIVATIONAL = plain(["ост", "ость"]);
const SUPERLATIVE = plain(["ейш", "ейше"]);

// Region after the first vowel; the end of the word if it has no vowel.
function regionRV(w: string): number {
  for (let i = 0; i < w.length; i++) {
    if (VOWEL.has(w[i])) return i + 1;
  }
  return w.length;
}

// Region after the first non-vowel that follows a vowel, scanning from `from`.
function afterNonVowelAfterVowel(w: string, from: number): number {
  for (let i = from + 1; i < w.length; i++) {
    if (VOWEL.has(w[i - 1]) && !VOWEL.has(w[i])) return i + 1;
  }
  return w.length;
}

// First ending (longest, since lists are length-sorted) that ends `w`, lies
// fully at or after `minStart`, and satisfies its preceding-letter condition.
function find(w: string, minStart: number, endings: Ending[]): Ending | null {
  for (const e of endings) {
    const start = w.length - e.suf.length;
    if (start < minStart || !w.endsWith(e.suf)) continue;
    if (e.needAYa) {
      if (start === 0) continue;
      const p = w[start - 1];
      if (p !== "а" && p !== "я") continue;
    }
    return e;
  }
  return null;
}

function chop(w: string, e: Ending): string {
  return w.slice(0, w.length - e.suf.length);
}

function step1(w: string, rv: number): string {
  const gerund = find(w, rv, PERFECTIVE_GERUND);
  if (gerund) return chop(w, gerund);

  const reflexive = find(w, rv, REFLEXIVE);
  if (reflexive) w = chop(w, reflexive);

  const adjective = find(w, rv, ADJECTIVE);
  if (adjective) {
    w = chop(w, adjective);
    const participle = find(w, rv, PARTICIPLE);
    if (participle) w = chop(w, participle);
    return w;
  }
  const verb = find(w, rv, VERB);
  if (verb) return chop(w, verb);
  const noun = find(w, rv, NOUN);
  if (noun) return chop(w, noun);
  return w;
}

export function stemRussian(word: string): string {
  if (!/[а-яё]/i.test(word)) return word;
  let w = word.toLowerCase();
  const rv = regionRV(w);
  if (rv >= w.length) return w; // no suffix region to strip
  const r2 = afterNonVowelAfterVowel(w, afterNonVowelAfterVowel(w, 0));

  w = step1(w, rv);

  // Step 2 — drop a trailing и within RV.
  if (w.length - 1 >= rv && w.endsWith("и")) w = w.slice(0, -1);

  // Step 3 — drop a derivational ending within R2.
  const derivational = find(w, r2, DERIVATIONAL);
  if (derivational) w = chop(w, derivational);

  // Step 4 — undouble н, strip a superlative, drop a trailing ь.
  if (w.length - 2 >= rv && w.endsWith("нн")) w = w.slice(0, -1);
  const superlative = find(w, rv, SUPERLATIVE);
  if (superlative) {
    w = chop(w, superlative);
    if (w.length - 2 >= rv && w.endsWith("нн")) w = w.slice(0, -1);
  }
  if (w.length - 1 >= rv && w.endsWith("ь")) w = w.slice(0, -1);

  return w;
}
