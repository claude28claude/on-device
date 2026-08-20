# On Device — progress

An honest record of what is built, what is verified, and what is known to be
imperfect. Updated at the end of every phase.

Last updated: **20 August 2026**, end of Phase 2.

---

## Where things stand

| Phase | What it covers | State |
|---|---|---|
| 0 | Plan, name, honest warnings | **Done** |
| 1 | The shell: homepage, drop zone, results tray, settings, offline, trust page | **Done** — see below |
| 2 | Images core: resize, convert, compress, crop, rotate, metadata | **Done** |
| 3 | PDF core | Next |
| 4 | PDF advanced | Not started |
| 5 | Privacy specials | Not started |
| 6 | Text, data and utilities | Not started |
| 7 | Extraction (text + OCR) | Not started |
| 8 | Recipes and power features | Not started |
| 9 | Customisation and languages | Not started |
| 10 | Hardening | Not started |
| 11 | Optional extras | Not started |

**Tools built: 6 of 41.** Every unbuilt tool on the homepage is marked "Not built
yet" with the phase it arrives in, and pressing one says so rather than doing
nothing.

---

## Phase 1 — what is built and verified

Everything in this section was tested in Chrome on Windows against real files, not
mocked data.

### The promise (the whole point)

- **Content Security Policy** on all 7 pages. Verified by an automated scan
  (`node scripts/check-no-external.mjs`) which also fails the build if any file
  anywhere in the project points at another computer.
- **Network guard** (`assets/js/netguard.js`) wraps `fetch`, `XMLHttpRequest`,
  `WebSocket`, `EventSource` and `sendBeacon`, refuses anything not on this site,
  and records every attempt.
- **Live monitor on the Trust page.** Verified showing 0 external requests,
  0 blocked attempts, and a full list of the 19–20 own-site files loaded.
- **"Try to contact another site" button** verified: the attempt to
  `example.com` is refused, the counter goes to 1, and the message explains what
  happened.
- **Zero third-party code.** Not one line of this project came from anyone else,
  and no font, icon or script is loaded from another server.

### Offline

- **Verified by stopping the web server entirely and reloading.** The homepage
  loaded with all 41 tools, the drop zone and the results tray. Every other page
  (trust, settings, roadmap, help, privacy, credits), the manifest and the icons
  all served from the on-device cache. 45 files cached.
- A request for something genuinely not cached returns a plain-English message
  rather than a browser error page.

### The shell

- **Homepage**: 41 tools in 4 categories, search, category and state filters,
  grid/list toggle, pinning, recently used.
- **Search understands plain language.** Verified: "make smaller", "make it
  smaller", "shrink my photos", "get rid of the location", "how do i open an
  iphone photo", "sign a document" all return the right tool first in the command
  palette.
- **Command palette** on <kbd>Ctrl</kbd>+<kbd>K</kbd> and <kbd>/</kbd>, with
  arrow-key navigation and correct ranking.
- **Universal drop zone**, working anywhere on any page, with a tap-based
  alternative.
- **File identification by contents, not filename.** Verified against real files:
  - `sample-3-page.pdf` → PDF document
  - `actually-a-png.jpg` → identified as PNG, flagged "named .jpg, actually png"
  - `not-really.pdf` → identified as text, with an explanatory message
  - `signature-only.heic` → identified as a HEIC photo
  - `empty.txt` → refused with "it contains no data at all"
  - `large-120mb.bin` → "We could not identify this file", explained plainly
- **Memory warning verified with a real 420 MB file**: "needs roughly 1680 MB of
  memory, and this browser is likely to allow about 1434 MB."
- **Results tray** built and wired — see *Known imperfect* below.
- **Workspace survives a refresh** (IndexedDB), with auto-clear on close.
- **"Clear everything now"** in the header, with a confirmation step.

### Mobile and keyboard

- **Checked at 375 x 812 (iPhone-sized), in a real touch-emulating viewport.**
  No horizontal scrolling anywhere; the tool grid collapses to one column; the
  header wraps rather than squeezing.
- **Touch targets enlarged** after measuring them: pin buttons and navigation
  links were 30 and 23 pixels tall, now 44. Chips, small buttons, theme swatches
  and checkbox rows all sized up on touch screens.
- **Keyboard-only pass done.** The skip link is the first stop, focus order runs
  wordmark, navigation, search, filters, tools. A tool card can be reached and
  activated with the keyboard; the dialog that opens is labelled, takes focus,
  closes with Escape and is removed from the page afterwards.
- Two live regions are present for screen-reader announcements (one polite, one
  urgent).

### Settings

Verified working and persisting across reloads: all 5 themes plus follow-system,
accent colour (with automatically derived hover/text/soft shades), density, text
size, font, corners, animation, default view, homepage behaviour, all five
behaviour switches, the tool defaults, export, import and reset.

- **Contrast is machine-checked, not assumed.** `node scripts/check-contrast.mjs`
  tests 23 colour pairings in each of the 5 themes — 115 checks — against WCAG AA.
  All pass. It caught 3 real failures during Phase 1 (border colours in Paper,
  Midnight and Sepia), which were fixed.
- **Custom accent colours are checked too**: if you pick one with poor contrast,
  the page says so with the actual number rather than letting you make the site
  unreadable.

### Translation

- English complete. Hindi complete for every string, loaded as a separate file,
  switchable live. Verified: the whole settings page renders in Hindi and the
  choice persists.
- Missing lines fall back to English automatically.

### What testing actually caught

Listing these because "we tested it" means nothing without saying what the
testing found. Every one of these was a real defect, found by looking, and fixed.

1. **The page could hang forever on start-up.** If this device's storage was
   locked by another tab, the browser's database call never returned and never
   failed — so the interface sat at "Checking…" indefinitely, which is precisely
   the never-ending spinner the brief forbids. Now it gives up after six seconds
   and says, in plain words, what is wrong and that everything else still works.
   Verified: the message appears at exactly 6.0 seconds.

2. **Loading files waited on saving them.** Dropping files took six seconds to
   show anything when storage was struggling, because the list waited for the
   save to finish. Saving is only there so a refresh does not lose your work, so
   it now happens in the background. Files appear in **14 milliseconds** instead
   of 6,000, and if the save later fails you are told then.

3. **The site held its database open forever**, so a second tab clearing or
   updating it would block indefinitely. It now steps aside when another tab
   needs it.

4. **Three colour pairings failed the accessibility standard** — control borders
   in Paper, Midnight and Sepia, between 2.41:1 and 2.78:1 where 3:1 is required.
   Found by the contrast script, not by eye. Fixed and re-verified.

5. **The memory estimate was too optimistic.** Chrome reports the same 4 GB limit
   on a small laptop as on a large workstation, so the warning would rarely have
   fired where it mattered. It now takes the smaller of what the browser claims
   and what the machine's actual memory suggests.

6. **Search did not understand how people type.** "make smaller", "shrink my
   photos" and "get rid of the location" all returned nothing or the wrong tool.
   Now handled properly, with everyday synonyms.

7. **Touch targets were too small.** Measured at 375 pixels wide: pin buttons
   30 pixels, navigation links 23. Both now 44.

8. **An unidentifiable file said nothing at all.** It now explains that the
   contents match no known format and that no tool will offer to open it.

Tested under deliberately broken storage as a final check: the site loads
completely, all 41 tools appear, files are identified correctly in 14 ms, and
three honest messages explain the empty file, the misnamed file and the storage
failure. Zero external requests throughout.

---

## Phase 2 — images

Six tools, all tested against real files in Chrome on Windows.

| Tool | State |
|---|---|
| Resize images | Working — by longest side, percentage, width, height or exact size |
| Convert images | Working — JPEG, PNG, WebP; AVIF where the browser can write it |
| Compress images | Working — with a magnified three-level before-and-after |
| Crop images | Working — freehand, fixed ratios, official photo sizes |
| Rotate and flip | Working — turn, mirror, straighten a crooked scan |
| Photo metadata | Working — reads everything, removes it without re-saving |

### The part worth caring about

**Metadata is removed losslessly, and this is proven rather than claimed.** Most
sites that "remove EXIF" redraw the picture and save it again, which re-compresses
your photograph and costs quality every time. On Device cuts the metadata sections
out of the file and leaves the compressed picture data alone.

Measured on a real 374,115-byte JPEG: 704 bytes of metadata removed, GPS gone, and
**372,486 bytes of picture data verified byte-for-byte identical** to the original.
Not "looks the same" — the same bytes.

**The metadata reader was written for this project**, from the format
specifications, rather than borrowed. To test it honestly, a JPEG was built with
known values (`scripts/add-exif.mjs`) and the reader was asked to recover them. It
returned every one exactly: GPS to six decimal places, altitude, camera make and
model, lens, camera serial number, all three timestamps, exposure 1/250, f/2.8,
ISO 400, 35 mm.

**The location warning is blunt on purpose.** A photo carrying GPS gets a red
panel with the coordinates as plain numbers, a copy button, and a sentence saying
that if it was taken at home, anyone you send it to can find your front door. No
map is loaded — that would tell a mapping company where you live, which is the
opposite of the point.

### Everything else built

- **Batch mode on every tool.** A queue that runs one file at a time deliberately
  (four large photographs decoded at once is how a browser tab dies), with per-file
  progress and per-file skip, retry and cancel, plus "retry all failed".
- **The work runs on a background thread**, so the interface never freezes. Where a
  browser will not provide one, the page says so and carries on.
- **The results tray is now genuinely exercised** — Phase 1 could only show it
  empty. Finished files land in it with sensible names and download correctly.
- **Capability detection is honest.** The site asks the browser what it can
  actually decode and encode, and switches off what it cannot deliver instead of
  offering it and failing. On this machine: WebP yes, AVIF no — and the AVIF option
  is disabled and labelled, not hidden.
- **Resize shows what will happen before it happens**, per file, with real numbers.
- **Still no third-party code at all.** Zero dependencies after two phases.

### What testing caught in Phase 2

Four real defects, all found by looking and all fixed:

1. **The capability probe was blocked by our own security policy.** It used
   `fetch()` on a `data:` URL to test WebP support, which `connect-src 'self'`
   correctly refuses — so the site always concluded the browser could not read
   WebP, *and* those refusals were counted on the Trust page as blocked attempts.
   The probe now decodes the bytes directly and touches nothing.

2. **Previews lied about rotated photos.** A portrait photo is often stored
   sideways with a flag saying "turn me". The size shown came from the file header,
   so resize predicted 800 × 600 while actually producing 600 × 800. Reported sizes
   now account for the rotation flag; prediction and result were re-tested and match
   exactly.

3. **Crop distorted official photos.** The selection is held as fractions of the
   width and of the height — different lengths — so a 35 × 45 mm passport shape was
   applied as though those fractions were pixels. The selection came out the wrong
   shape and the face inside it would have been stretched. Now converted into pixel
   space: a passport crop measures 0.7775 against a target of 0.7778, and a square
   is exactly 1.0000.

4. **`-metadata.jpg` was a terrible name** for a file with the metadata removed.
   Outputs are now named `-clean`, `-resized`, `-cropped` and so on.

### One scare that turned out to be my own testing

While checking Phase 2, the offline cache appeared to contain **nothing** after a
fresh visit, which would have meant offline was broken. It was chased properly
rather than waved away, and the cause was the test, not the site: after
registering and unregistering a byte-identical worker many times in one browser
profile, Chrome stops re-installing it, so no install ever ran and nothing was
cached.

Proved by changing one file so the worker genuinely differed, then watching the
whole sequence — installing, installed, activating, activated — and confirming
all 65 files cached. Recorded here because "it turned out to be fine" is only
worth anything if you say how you know.

### Offline, re-proved with images

The web server was stopped completely, then a tool page was loaded and a
photograph was resized from 600 × 400 to 200 × 133 — decode, resize, re-encode,
all of it — with no server running at all. Zero external requests.

### Verified numbers

- Passport preset produces exactly **413 × 531 pixels** (35 × 45 mm at 300 dpi).
- Rotate 90° plus 5° straighten on a 1600 × 1200 photo produces **1335 × 1699**,
  matching the trigonometry exactly.
- Compression at quality 45 / 70 / 90 gives **70% / 59% / 28%** smaller.
- Resize to 800 px longest side: **78% smaller**; PNG stays PNG, JPEG stays JPEG.
- Zero external requests and zero blocked attempts throughout.

---

## Known imperfect — read this part

1. **The Hindi translation has not been checked by a native speaker.** It is
   labelled as such in the language menu and on the Settings page. It exists to
   prove the mechanism, which it does. If Hindi is not the second language you
   want, swapping it is a one-file change.

2. **HEIC photos depend entirely on your browser.** On Device does not bundle a
   HEIC decoder, so it asks the browser to open them. Safari usually can; Chrome,
   Edge and Firefox usually cannot. When it cannot, that file fails with a specific
   explanation and the rest of the batch carries on. **This is the biggest gap in
   Phase 2**, and it is a licence decision rather than a technical one — see
   item 11.

3. **"Download all as zip" is disabled**, with a tooltip saying it arrives with the
   Zip tool in Phase 6. Better than a button that fails.

4. **Safari and iOS are completely untested.** This was built on Windows; Safari
   cannot be run here at all. Chrome was tested thoroughly. Firefox and Edge are
   expected to work but have not been exercised beyond a smoke test. **These boxes
   stay unticked until someone tests them on a real Mac and a real phone.**
   The mobile layout was checked in a 375-pixel touch-emulating viewport, which
   catches layout and target-size problems but is not the same as a real phone.

5. **Opening the site from a folder on disk (`file://`) is untested.** Chrome
   blocks JavaScript modules on `file://`, so it is unlikely to work there; Firefox
   may. The supported route is: visit once, then it works offline forever. A
   one-command local server is documented in the README.

6. **The memory estimate is an estimate.** It takes the smaller of what the browser
   reports and what the device's RAM suggests, and is deliberately pessimistic. It
   has been verified to fire correctly on a 16 GB desktop. It has not been checked
   on a phone.

7. **Renaming, reordering and hiding tools, and the optional sidebar,** are listed
   in the brief for Phase 9 and are not built. The Settings page says so plainly in
   place of showing controls that do nothing.

8. **Rebindable keyboard shortcuts** are Phase 8. The cheat sheet is there and
   accurate; the keys are fixed for now.

9. **Some tool defaults are still unread.** Image quality and format are now used
   by the image tools. Page size, DPI and units are saved but nothing reads them
   until the PDF tools exist. The Settings page says so.

10. **No real iPhone photo has ever been tested.** The HEIC sample has a genuine
    header, so it proves the site identifies HEIC and produces the right error —
    but it contains no real encoded image, so nothing here proves On Device can
    *decode* a real one. **A photo straight off an iPhone is still needed.** Until
    then the honest claim is only "we ask your browser, and report what it says".

11. **The licence for a bundled HEIC decoder is still unresolved.** The best-known
    browser decoder is LGPL, which breaks the permissive-licences-only promise.
    Phase 2 shipped without bundling anything rather than quietly including it.
    Bundling one remains your decision.

12. **AVIF cannot be saved in every browser.** This machine's Chrome cannot. The
    option is disabled and labelled rather than hidden, so the limitation is
    visible and is the browser's, not ours.

13. **Crop shows the first image when several are selected.** The same framing is
    applied proportionally to all of them, which is genuinely useful for a series,
    but you cannot frame each one individually within a batch.

14. **There is no "undo" or "revert to original".** Originals are never modified —
    every tool writes a new file to the results tray — so nothing is ever
    destroyed. But there is no button that walks a change back.

15. **No accessibility audit with a real screen reader yet.** Live regions, labels,
    focus order and contrast are all built in, and contrast is machine-verified,
    but nobody has driven it with NVDA or VoiceOver. That is Phase 10.

---

## How to check any of this yourself

```bash
node scripts/check-no-external.mjs
```

```bash
node scripts/check-contrast.mjs
```

```bash
node scripts/make-samples.mjs
```

```bash
node scripts/add-exif.mjs
```

The first fails if anything in the project points at another computer. The second
fails if any colour pairing in any theme falls below the accessibility standard.
The third writes real test files into `samples/`. The fourth builds a JPEG whose
hidden information is known in advance, so the metadata reader can be checked
against a correct answer rather than merely observed not to crash.
