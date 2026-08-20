/* ============================================================
   On Device - search wording

   People do not search the way menus are written. They type
   "make it smaller" and "get rid of the location". These helpers
   let both the homepage search and the command palette understand
   that.
   ============================================================ */

/* Words that carry no meaning in a search and would otherwise
   stop a perfectly good phrase from matching. */
const STOP_WORDS = new Set([
  "a", "an", "the", "my", "me", "i", "it", "its", "this", "that", "these", "those",
  "is", "are", "was", "be", "to", "of", "for", "from", "in", "on", "at", "with",
  "and", "or", "but", "how", "do", "does", "can", "want", "need", "please",
  "make", "made", "making", "get", "got", "put", "some", "any", "all", "into",
  "out", "up", "down", "off", "again", "just", "then", "than", "so",
  "rid", "please", "help", "way", "thing", "stuff", "something"
]);

/* Everyday words that mean the same thing as our wording. */
const SYNONYMS = {
  smaller: ["compress", "resize", "shrink", "reduce"],
  bigger: ["resize", "enlarge", "scale"],
  small: ["compress", "shrink", "reduce"],
  shrink: ["compress", "reduce", "smaller"],
  reduce: ["compress", "smaller"],
  location: ["gps", "metadata", "exif", "where"],
  gps: ["location", "metadata"],
  iphone: ["heic", "photo", "apple"],
  heic: ["iphone", "photo"],
  picture: ["image", "photo"],
  pictures: ["image", "photo"],
  photo: ["image", "picture"],
  photos: ["image", "picture"],
  combine: ["merge", "join"],
  merge: ["combine", "join"],
  join: ["combine", "merge"],
  delete: ["remove", "strip"],
  strip: ["remove", "delete"],
  hide: ["blur", "redact", "censor"],
  sign: ["signature", "fill"],
  lock: ["password", "encrypt"],
  unlock: ["password", "decrypt"],
  scan: ["ocr", "scanned"],
  spreadsheet: ["csv", "excel", "xlsx"],
  excel: ["spreadsheet", "csv", "xlsx"],
  barcode: ["qr"],
  quality: ["compress"],
  rotate: ["turn", "sideways"],
  turn: ["rotate"],
  page: ["pages", "pdf"],
  pdf: ["document"]
};

/* Break a query into the words that actually matter. */
export function queryWords(query) {
  const words = String(query || "")
    .toLowerCase()
    .split(/[^a-z0-9\u0900-\u097F]+/)
    .filter(Boolean);

  const meaningful = words.filter((w) => !STOP_WORDS.has(w));
  /* If someone types only stop words ("how do I"), fall back to
     everything they typed rather than matching the whole list. */
  return meaningful.length ? meaningful : words;
}

/* Does this word appear in the text, directly or through a
   word people commonly use instead? */
export function wordMatches(word, haystack) {
  if (haystack.includes(word)) return true;
  const alts = SYNONYMS[word];
  if (alts) {
    for (const alt of alts) {
      if (haystack.includes(alt)) return true;
    }
  }
  /* A trailing "s" or "es" should not stop a match. */
  if (word.length > 3) {
    if (word.endsWith("es") && haystack.includes(word.slice(0, -2))) return true;
    if (word.endsWith("s") && haystack.includes(word.slice(0, -1))) return true;
  }
  return false;
}

/* How well does a query match a piece of text? 0 means no match. */
export function matchScore(query, { name = "", desc = "", keys = "", extra = "" }) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return 0;

  const lowerName = name.toLowerCase();
  const haystack = `${lowerName} ${desc.toLowerCase()} ${keys.toLowerCase()} ${extra.toLowerCase()}`;

  if (lowerName === q) return 100;
  if (lowerName.startsWith(q)) return 82;
  if (lowerName.includes(q)) return 64;

  const words = queryWords(q);
  if (!words.length) return 0;

  let hits = 0;
  let inName = 0;
  for (const word of words) {
    if (wordMatches(word, haystack)) {
      hits++;
      if (wordMatches(word, lowerName)) inName++;
    }
  }
  if (hits === 0) return 0;

  /* Every word matching is much better than some of them, but a
     half-remembered phrase should still find the right tool. */
  const coverage = hits / words.length;
  if (coverage < 0.5 && hits < 2) return 0;

  return Math.round(coverage * 40 + inName * 8 + (keys.toLowerCase().includes(q) ? 6 : 0));
}
