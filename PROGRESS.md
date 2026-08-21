# On Device — progress

An honest record of what is built, what is verified, and what is known to be
imperfect. Updated at the end of every phase.

Last updated: **20 August 2026**, end of Phase 7.

Each phase section below describes the state **at the end of that phase**. Where a
later phase changed something, it says so. The "Known imperfect" list at the bottom
is always current.

---

## Where things stand

| Phase | What it covers | State |
|---|---|---|
| 0 | Plan, name, honest warnings | **Done** |
| 1 | The shell: homepage, drop zone, results tray, settings, offline, trust page | **Done** — see below |
| 2 | Images core: resize, convert, compress, crop, rotate, metadata | **Done** |
| 3 | PDF core: merge, split, organise, to images, from images, rotate and crop | **Done** |
| 4 | PDF advanced, plus image watermark | **Done** — 9 of 9 |
| 5 | Privacy specials: redaction, blur, fill and sign, file locking | **Done** |
| 6 | Text, data, utilities, plus the remaining image tools | **11 of 12** — only the QR reader missing, deliberately |
| 7 | Extraction: PDF text, and offline text recognition | **Done** |
| 8 | Recipes and power features | **Done** |
| 9 | Customisation and languages | **Done** |
| 10 | Hardening | **Done** |
| 11 | Optional extras | **Background removal built.** Video and audio, deliberately not |
| 12 | The QR generator, finally checked | **Done** — three real faults found and fixed |

**Tools built: 39 of 41.** Every unbuilt tool on the homepage is marked "Not built
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
- **Still no third-party code at all** at this point. Zero dependencies after two
  phases. (Phase 3 changed this: the PDF tools use pdf-lib and pdf.js.)

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

## Phase 3 — PDFs

Six tools, all tested against real PDFs with the results verified by reopening the
output and counting what came back.

| Tool | State |
|---|---|
| Merge PDFs | Working — PDFs and pictures, in any order |
| Split and extract | Working — a range, every N pages, or one file per page |
| Organise pages | Working — reorder, rotate, duplicate, delete, visually |
| PDF to images | Working — PNG or JPG at 72, 150 or 300 dpi |
| Images to PDF | Working — page size, orientation, margins |
| Rotate and crop | Working — with a shaded preview of what gets trimmed |

### The honest change: this phase uses borrowed code

Phases 1 and 2 had no dependencies at all. Phase 3 does, and pretending otherwise
would be worse than the dependency. Writing a PDF renderer from scratch is not a
sensible thing to attempt, so two libraries are used:

- **pdf-lib 1.17.1** (MIT) — creating and editing
- **pdf.js 5.4.149** (Apache 2.0) — reading, drawing pages, extracting text

Both are permissive, as promised. Neither is loaded from anyone else's server: they
are stored in this repository and served from this site like every other file.

**They are shipped compressed, so instead of asking anyone to read them, every
borrowed file has a published SHA-256 fingerprint** (`assets/vendor/VENDOR.json`,
and on the Credits page). Download the same version from npm, hash it, compare.
Verified during this phase: all three files are byte-for-byte identical to the
published npm releases.

`node scripts/check-vendor.mjs` re-checks those fingerprints and fails if a
borrowed file has changed. `check-no-external.mjs` now names the borrowed files it
skips rather than skipping them quietly.

And it changes nothing about the promise: borrowed code is bound by the same
security policy, so it cannot reach anything either. That protection does not
depend on trusting the library, which is the point of having it.

### They are not part of the first visit

The libraries come to about 4.5 MB. Downloading that onto somebody who only wants
to resize a photograph would be rude, so they are **excluded from the first-visit
cache entirely** and fetched the first time a PDF tool is opened, behind a progress
bar that counts real bytes. After that they are kept, and work offline.

First visit: 82 files. Borrowed files held back: 195.

### Verified numbers

Every one of these was checked by reopening the produced file, not by trusting the
tool that made it:

- **Merge**: a 3-page PDF + a 1-page PDF + one PNG produced exactly **5 pages**.
- **Extract "1,3"** from a 3-page document produced a file with exactly **2 pages**.
- **Burst** produced **3 single-page files**.
- **Organise**: deleted page 2, duplicated page 1, turned everything right →
  **3 pages, every one rotated 90°**.
- **PDF to images** at 150 dpi produced **1239 × 1754** pixels, and the estimate
  shown beforehand now says exactly that.
- **Rotate and crop**: 10% off the top and 5% off the left of a 595 × 842 page
  produced **565 × 758**, rotated 90°.
- **Images to PDF**: two landscape pictures produced two landscape A4 pages, and
  the HEIC in the same batch was refused with an explanation rather than failing
  silently.

### What testing caught in Phase 3

1. **The page-range parser returned the wrong shape when the box was empty.** It
   handed back a bare array instead of `{ pages, problems }`, so every tool that
   read a range broke the moment someone left the field blank — which is the
   default. Fixed, and covered by a run of twelve inputs including `5-2`, `abc`,
   `12-` and `-3`.

2. **"12-" on a 10-page document said "counts backwards".** It does not; it starts
   past the end. Now says so.

3. **The pixel-size estimate disagreed with the file produced** — 1240 predicted,
   1239 delivered, because the estimate rounded where the renderer floors. Exactly
   the same class of bug as Phase 2's rotated-photo preview, so the fix was to make
   both call one shared function rather than to adjust a number.

4. **Three pages of the site still claimed zero third-party code.** The Credits,
   Privacy and Trust pages all had to be corrected the moment the libraries landed.


---

## Phase 4 — PDF advanced

Eight tools. All eight were run against real documents and the output reopened to
confirm it was what the tool claimed.

| Tool | State |
|---|---|
| Password: add | Working — AES-256, with printing and copying controls |
| Password: remove | Working — with the correct password, and only then |
| Watermark | Working — text, colour, angle, opacity, tiling, page ranges |
| Page numbers and headers | Working — {n} and {total}, skip-first, six positions |
| PDF metadata | Working — read, edit, or erase everything |
| Flatten | Working — bakes in form fields |
| Several pages per sheet | Working — 2-up, 4-up and fold-ready booklet order |
| Compress | Working — two methods, both honest about their cost |

### Passwords

Uses **qpdf 0.0.2** (Apache 2.0), compiled to WebAssembly, added to the vendored
set with a recorded fingerprint like the others. It is about 1.3 MB and only
downloads the first time a password tool is used.

Verified: a document encrypted here refuses to open without its password, opens
with it, and after removal opens freely again with all three pages intact. A wrong
password fails cleanly.

**Stated on the tool page and meant:** On Device cannot guess, crack or bypass a
password, does not try, and never will. The remove tool decrypts using a password
you supply, for a document you already own.

The "add" tool also refuses to double-encrypt an already-protected file, and warns
unmissably that a forgotten password cannot be recovered by anyone — because there
is no server that ever saw it.

### Compress, and being straight about it

This is the tool I flagged in Phase 0 as half-possible, and it turned out exactly
as expected. There are two honest methods and both are offered:

- **Tidy up** — rewrites the file structure. Completely safe. On the test document
  it saved **26%** (1719 → 1275 bytes). On many files it saves almost nothing, and
  the tool says so rather than implying failure.
- **Flatten to pictures** — every page becomes an image. On a scan this saves a
  great deal. On the text-based test document it made the file **24 times larger**
  (1719 → 41,815 bytes).

That last number is the point. Most sites do the second method, call it
"compression", and never mention that it destroys selectable text or that it can
make a text document enormously bigger. On Device checks whether the document has
selectable text before you choose, says so, and offers a "try both and compare"
button that runs each and shows the real sizes.

### What testing caught in Phase 4

1. **`isEncrypted` only looked at the start of the file.** The reference that marks
   a PDF as encrypted lives in the trailer, at the *end*. Since the remove tool now
   refuses to run on an unencrypted file, this would have wrongly refused real
   locked documents. Now checks both ends.

2. **This build of qpdf prints no error messages at all** — only an exit code, and
   a wrong password and a corrupt file both return the same one. So the reason is
   worked out here instead: encrypted plus failure means wrong password; not
   encrypted means nothing to remove. Verified by running each case.

3. **The compress tool would have called a 24× size increase "no difference".**
   The check was `percent <= 0`, which lumps "made it worse" in with "made no
   change". Now says plainly that the file got bigger, by how much, and why.


---

## Phase 5 — the privacy specials

The four tools the whole site exists to justify.

| Tool | State |
|---|---|
| Redact, properly | Working — and provably destroys content |
| Blur or pixelate | Working — with honest warnings about weak settings |
| Fill and sign | Working — drawn into the page, not as movable notes |
| Lock a file with a password | Working — AES-256-GCM, verified round trip |

### Redaction: the proof

Most tools draw a black rectangle over words that are still in the file. This one
paints the marked areas onto a picture of the page, throws the original page away,
and rebuilds from the picture. Pages you did not mark are copied across untouched.

Verified on a real document by three separate measurements:

- **Text extraction**: page 2 of the output returns an empty string. Pages 1 and 3
  still return their text, because they were not marked.
- **Raw bytes**: the phrase "Page two" does not appear anywhere in the output file.
  "Page one" and "Page three" do — correctly, since those pages were untouched.
- **Ink measurement**: page 2 went from 0.41% dark pixels to 27.22%, proving the
  page still has its content plus the black box, rather than being wiped.

The tool also offers to check for you: type a phrase, and after redacting it reads
the finished file back and reports whether that text can still be found. A
redaction tool that cannot demonstrate its own claim is asking to be believed,
which is the thing this site refuses to do.

### File locking

Uses the browser's own AES-256-GCM with PBKDF2 (310,000 rounds). No encryption
library — nothing to trust beyond what the browser already does for banking.

Verified: a locked file round-trips **byte-for-byte identical**; the encrypted
bytes match the original in 9 places out of 2000, which is what random chance
looks like; a wrong password is rejected; and a single flipped byte in the middle
of the file is **detected and refused**, because GCM authenticates as well as
encrypts.

The file format is documented in full in `assets/js/lock.js` so that anyone could
write their own unlocker if this site vanished tomorrow.

### Blur and pixelate

Verified by measuring pixel variance inside the marked region: original 2245, a
solid block **exactly 0**, pixelation 1364, blur 871. Areas outside the region are
untouched.

The tool is honest that **blur and light pixelation can sometimes be reversed** —
this has been done to recover faces and read blurred text — and says which side of
that line the current setting falls on. A solid block is the default.

### What testing caught in Phase 5

**The serious one:** the first version of the redaction tool produced a
**completely blank page** where the redacted page should have been. It destroyed
the whole page rather than the marked area — and it looked like it had worked,
because the text extraction check showed the text was gone.

It was caught by rendering the output and counting the dark pixels: 0.00%. The
cause was assembling redacted pages in one document and then trying to embed them
into another, which pdf-lib does not support that way. Rebuilt as a single pass in
page order.

That is exactly the failure mode a redaction tool must never have, and it is only
caught by checking what came out rather than what went in.


---

## Phase 6 — text, data and utilities

**A correction first.** When this section was first written it said "seven of
eight". That was wrong: phase 6 has twelve tools, not eight — five image tools
(watermark, combine, icon maker, colour palette, screenshot polish) were listed
under phases 4 and 6 and had not been built. The miscount was found by counting
the registry rather than trusting the note, the five tools were then built, and
this paragraph is here rather than a quiet edit.

**Eleven of the twelve are built.** The twelfth is deliberately not shipped, and
that is the most important thing in this section.

| Tool | State |
|---|---|
| Make a QR code | Working — text, links, wifi, contacts, email, phone |
| Read a QR code | **Not shipped** — see below |
| Text workbench | Working — case, tidying, sorting, dedupe, find and replace, counts |
| CSV, JSON and Excel | Working — including encoding and delimiter repair |
| Markdown preview | Working — live, sanitised, exports a self-contained page |
| Zip and unzip | Working — including password-protected archives |
| Checksum | Working — SHA-256/384/512, SHA-1 and MD5 |
| Compare two files | Working — byte for byte, reports where they first differ |

### The QR reader is not shipped, and why

The QR **generator** was written for this project, because the usual library ships
no ready-to-use browser build. It is verified as thoroughly as I know how:

- Its Reed-Solomon error correction reproduces the **specification's own published
  worked example** byte for byte (`a5 24 d4 c1 ed 36 c7 87 2c 55`).
- Its generator polynomial matches the known coefficients for 10 check bytes.
- Its format bits compute and place correctly, verified by reading them back.
- Its rendering matches its matrix exactly — 0 mismatching modules.
- A reader written independently recovers "HELLO" from the finished matrix, with
  the right mode and length.

The **reader** was to use jsQR (Apache 2.0). During testing jsQR decoded **nothing
at all** — not one code, at any size, quiet zone, error-correction level or mask,
with or without noise. Since the generator matches the specification's own test
vectors, the weight of evidence says the fault is not in the codes.

I could not determine why, and I will not ship a tool I have never seen work. The
library was removed from the project rather than left in unused, and the QR reader
stays marked "not built".

**What this means for you:** the generator is very probably correct, but the one
test that settles it is the one I cannot run here — point a phone camera at a code
it produces. The tool says exactly that on the page. If a code does not scan, the
generator should be pulled too.

### The five image tools that were missed

Built after the miscount was found, and verified:

- **Watermark**: a corner watermark changes 1.28% of a 1600 x 1200 photo, a tiled
  one 3.96% — measured by comparing every pixel against the original.
- **Combine**: four pictures into a 1830 x 1380 grid, two into a 1830 x 695 row.
- **Icon maker**: all nine sizes produced (16 to 512), plus maskable versions and
  the HTML and manifest lines to reference them.
- **Colour palette**: on a test image containing exactly two colours it reported
  exactly those two — `#faf9f7` at 56.5% and `#1750c8` at 43%.
- **Screenshot polish**: 900 x 600 becomes 1020 x 720 at 10% padding, with rounded
  corners and a shadow.

### Everything else

- **Checksums verified against known values**: SHA-256, SHA-1 and MD5 of "abc" all
  match their published digests. MD5 is written into the site because browsers no
  longer provide it, and it passes **all seven RFC 1321 test vectors**. It is
  labelled as broken for security, and offered only for checking downloads.
- **Zip round-trips verified**, including a password-protected archive, with a
  wrong password correctly rejected. 1600 bytes of text compressed to 450.
- **Spreadsheets**: CSV → rows → XLSX → back again, intact. The tool works out the
  delimiter itself, and detects when a file is not UTF-8 — reading it as
  Windows-1252 instead, which is what older Excel produces, and saying so.
- **Markdown is sanitised before display**: verified that a `<script>` tag in the
  source is stripped and never reaches the page.
- **The text workbench keeps an undo history** and reports honestly when a search
  pattern is invalid instead of silently doing nothing.


---

## Phase 7 — extraction

| Tool | State |
|---|---|
| Extract text | Working — and honest when a PDF has no text to extract |
| Read a scanned document | Working — offline text recognition, English |

### Text extraction

Verified against the three-page sample: each page returns its own text, correctly.

When a PDF turns out to be a scan — a picture of words rather than words — the tool
says exactly that instead of returning an empty file, and points at the recognition
tool. It also counts how many pages had no text, so a mixed document is not
silently half-extracted.

### Text recognition, entirely offline

Uses Tesseract (Apache 2.0) compiled to WebAssembly. **The English language data is
stored in this site**, because by default the library fetches it from someone else's
server — which is exactly what this site does not do, and which the security policy
would refuse anyway. That is why it is a 10 MB one-time download.

Verified by rendering text of known content and asking the engine to read it back:

- "The quick brown fox jumps" — read exactly
- "over the lazy dog." — read exactly
- "Invoice number 12345" — read exactly, digits included
- "Total: 47.90 pounds" — read exactly, decimal included

Four out of four, nothing missed, **95% confident, in 0.6 seconds**.

The tool reports its own confidence rather than presenting a guess as a transcript:
above 85% it says the read is good, between 65 and 85 it warns that there will be
mistakes in numbers and names, and below that it says to treat the result as a rough
guess and explains what would scan better.

### One defect found and fixed

The vendored Tesseract build puts everything on its default export rather than
exporting names, so the first attempt failed with "createWorker is not a function".
The loader now accepts either shape, and says plainly that a mismatch is a bug here
rather than a problem with the visitor's file.

---

## Phase 8 — Recipes, and keys you can change

The brief called recipes the headline feature: a visitor saves a named chain of
steps, drops 40 photos on it, and gets 40 finished files in one action. That is
what this phase builds, plus the two smaller power features that go with it:
rebindable keyboard shortcuts, and recipes that can be carried to another device.

### What a recipe is

A recipe is a name and a list of steps. You drop files in at the top; whatever
comes out of one step goes into the next; whatever comes out of the last step
lands in the results tray. Nothing asks you anything while it runs — that is the
whole point, and it is also the constraint that decides which tools can be a step
and which cannot.

There are **23 steps**, covering pictures, PDFs, and anything at all:

- **Pictures** — resize, change format, make smaller, turn or mirror, remove
  hidden information, stamp text on.
- **PDFs** — join, split, keep only some pages, turn every page, add page
  numbers, stamp text on, wipe the document details, freeze form fields, two or
  four pages per sheet, tidy up, turn pages into pictures, make a PDF from
  pictures, pull the text out, put a password on, take a password off.
- **Anything** — rename to a pattern, bundle into a zip.

Three examples ship with it, added as ordinary editable recipes rather than
untouchable presets: *Photos for email*, *Scans into one numbered PDF*, and
*Send this PDF safely*.

### Sixteen tools deliberately cannot be a step

A recipe replays itself on files it has never seen, so anything needing a human
judgement about a particular file cannot be replayed. Cropping, blurring,
redaction, filling in a form, reading a scan, combining pictures into a layout,
and every tool that reports something rather than producing a file are all
excluded — and the Recipes page lists all sixteen **with the reason for each**,
rather than quietly leaving them out and letting you hunt for them.

### Two decisions worth stating plainly

**Passwords are never saved.** A step that needs one asks every time the recipe
runs. The password never reaches this device's storage and never reaches an
exported recipe file — and this is enforced where a recipe is saved, not merely
avoided by the interface. It was tested by saving a recipe with a password typed
into it, then reading the raw storage and the exported file back: neither
contains it. That means a recipe file you send to somebody cannot leak a
password, ever.

**A recipe is checked before it runs, not during.** The chain is followed on
paper first: what kind of file each step would be handed, and whether any
required text has been left empty. A recipe that would fail at step four is
refused at step zero, with the reason, rather than doing three minutes of work
first. If a step does fail anyway, the run stops there and says which file and
why — nothing half-finished is added to the tray, and your originals are never
touched.

### Keyboard shortcuts you can change

Settings now has a row for each action: press Change, press the keys you want,
done. Two guards sit behind it:

- **Reserved combinations are refused.** Ctrl+Shift+T reopens a closed tab and
  Ctrl+Shift+R forces a reload; somebody who has just lost a tab will not thank
  us for showing them a results tray instead. About twenty browser-owned
  combinations are refused by name, with an explanation rather than a shrug.
- **Clashes are refused.** Binding a combination another action already uses says
  which action has it, rather than silently stealing it.

The shipped defaults moved into the **Alt+Shift** space, which no major browser
claims, so a fresh install never fights the browser. Ctrl+K keeps the command
palette, because that is what everybody's fingers already expect it to be.

Which key was pressed is read from its **position** on the keyboard rather than
from the character it produced. On a Mac, Option and H together produce a special
character, not “H” — reading the character would record a shortcut that could
never be typed again.

### What testing caught in Phase 8

1. **The finish time was a clock reading, not a duration.** "Finished in
   05:30:00 AM" — the shared helper turns a moment into a time of day, and it had
   been handed a number of milliseconds. There is now a separate one that says
   “2.5 seconds” or “3 minutes 15 seconds”, and a comment on each explaining why
   they are not the same function.

2. **The step picker ran off the side of its own dialog.** Long descriptions did
   not wrap, so the list of steps scrolled sideways.

3. **The default shortcuts were fighting the browser.** Ctrl+Shift+R and
   Ctrl+Shift+T were chosen before checking what they already do. Both are now
   refused outright, and the defaults moved to Alt+Shift.

4. **Reading the character rather than the key position** would have broken every
   Alt-based shortcut on a Mac. Found by reasoning about it rather than by
   testing, because there is no Mac here to test on — which is exactly why it is
   worth writing down.

### How this was proved

Every one of the 23 steps was run on real files.

- Through the interface, end to end: the *Photos for email* example on three real
  photographs. Three files in, three out, 374 KB down to 200 KB each, and the
  location, camera and timestamps confirmed **gone** from the output — checked by
  reading the finished file's own metadata back, not by trusting the tool.
- The other steps run individually on the sample PDFs and photographs, each
  producing a file of a sensible size and a name that shows what happened to it.
- The password steps round-tripped: lock a PDF, confirm it really is encrypted,
  unlock it with the right password — and confirm the **wrong** password is
  refused with a readable message rather than producing a broken file.
- Saved recipes survive a reload, appear in the command palette, and open
  straight from it.
- Rebinding was driven with real key presses: Ctrl+Alt+P bound to the palette,
  then pressed, and the palette opened. Ctrl+Shift+T was refused as already
  taken by the results tray.

---

## Phase 9 — the site arranged your way, in your language

Two things this phase had to fix, both of them promises the site was
making and not keeping.

### Your tool list

Settings could hide a tool but gave you no way to hide one, and the
homepage read a list of renamed tools that nothing could write to. All
three are now real, in one place under Settings — Layout:

- **Rename** anything. Type over the name and it changes on the
  homepage, in the search box, and in the sidebar. The name it ships
  with stays searchable, so renaming “Merge PDFs” to “Glue PDFs
  together” does not make it impossible to find by typing “merge”.
- **Reorder** within a category, with up and down buttons that work
  from the keyboard. Moving a PDF tool under Images is not offered,
  because the grid is grouped by category and it would simply look
  like a bug.
- **Hide** the ones you never use. A hidden tool disappears from the
  homepage and from the command palette — the palette had to be taught
  this, or it would have quietly undone the hiding — and its own page
  still works if you have it bookmarked.
- **Put it all back** with one button, which asks first.

One file now answers “what is this tool called and should it be
shown”, so a rename cannot show up in one place and not another.

### The optional sidebar

Off unless you turn it on. On a wide screen it is a column down the
left with the categories, your pinned tools and your recipes; below
about 960 pixels it stacks above the tools instead of squeezing them.

### The homepage can step out of the way

“The homepage opens to” now has a third choice: straight into one
tool, for somebody who only ever uses one. It fires **once per browser
session**, and that is not an arbitrary limit. This site sends no
referrer by design, so there is no way to tell “I typed the address”
from “I pressed Tools in the menu”. Without the once-only rule,
pressing Tools would bounce you straight back into the tool and you
could never reach the homepage again to switch the setting off. Coming
back a second time is taken to mean you wanted the homepage.

### Defaults that were doing nothing

Four settings under “Behaviour and defaults” were saved and then
never read by anything: resolution, page size, units, and picture
format outside one tool. They now reach the tools that have a matching
control — PDF to images, Make a PDF smaller, Images to PDF, Several
pages per sheet, Convert an image, Make an image smaller — and changing
one inside a tool writes it back as the new default.

Each setting on that page now names the tools it actually reaches. A
tool that does not offer the exact figure you picked keeps its own,
rather than being forced to something it cannot do.

**Units** was the awkward one. A PDF page has a real physical size, so
“8.3 by 11.7 inches” is a true statement about it. A photograph does
not — a 1600-pixel-wide picture is as big as whatever you print it on
— so asking for its width in millimetres is a question with no answer.
Units therefore applies to page sizes, and photographs are always
measured in pixels, and the setting says so.

### The second language, honestly measured

Hindi was already complete as far as the language file went. What the
language file did not cover was every page heading, which had been
typed into the HTML by hand — so switching to Hindi translated the
menus and left the page you were reading in English.

Every tool page heading and breadcrumb, and the heading and opening
paragraph of all six main pages, now come from the language files.
Switching to Hindi renames all 38 tool pages.

Settings now carries a **coverage table counted from the language files
themselves** every time you open it, so it cannot drift into a lie. It
currently reads: Hindi, 370 of 370 lines, of which 350 differ from the
English — the other 20 are things like “PDF” and “KB” that do not
change. Next to it, in as many words, is what those lines do **not**
cover: the explanatory writing inside each tool page, which is still
English everywhere. That is the largest remaining translation job and
it is not pretended otherwise.

### What testing caught in Phase 9

1. **The escape hatch from “open straight into one tool” did not work.**
   It checked whether you had arrived from inside the site — but the
   site sets “no referrer” on every page on purpose, so that check
   could never be true, and pressing Tools would have trapped you in
   the tool forever. Replaced with the once-per-session rule above.
   Found by testing it, not by reading it.

2. **The quality caption disagreed with the quality slider.** The
   caption was written into the HTML by hand and only matched by luck;
   once the slider could start from a saved default it read “90 out of
   100” above a slider sitting at 61. Four tools now paint it from the
   control itself.

3. **Translating the homepage would have deleted a link.** Translating
   an element replaces its text outright, and the opening paragraph had
   “See how to check that for yourself” as a link inside it. The link
   is now its own element, and a check across all 46 pages confirms no
   translated element contains anything that would be lost.

### How this was proved

- Renamed one tool, hid another and moved a third to the top, then
  looked at the homepage: new name shown, hidden one gone, new order
  kept. Searched the palette for the new name (found) and for the
  shipped name (also found) and for the hidden tool (correctly absent).
- Turned the sidebar on and measured the layout: a 224-pixel column
  beside a 781-pixel grid at 1100 pixels wide, stacked below that.
- Set the homepage to open into the QR tool, visited the homepage and
  landed in the QR tool — then visited the homepage again and stayed
  there, which is the escape hatch working.
- Set resolution to 300, format to JPEG, quality to 61 and units to
  inches, then opened PDF to images: all four had taken, and dropping a
  real PDF in read “3 pages, about 8.3 by 11.7 inches each. At 300 dots
  per inch each page comes out 2479 by 3508 pixels.”
- Switched to Hindi and opened a tool page: heading, breadcrumb and
  menus in Hindi, with the options panel still in English, exactly as
  the coverage note says.
- Pressed “Put the whole list back to normal” and confirmed every
  setting returned to empty.

---

## Phase 10 — hardening

### The background-tab defect, found in Phase 8 and fixed here

Drawing a PDF page used to stop when you switched tabs. Limitation 16
described it honestly and left it. This phase fixed it.

The cause: the PDF library draws a page in chunks and asks the
browser's **painting clock** to schedule each one. Browsers slow that
clock right down, or stop it altogether, for a tab nobody is looking
at. A long export would crawl or never finish.

Two wrong turns before the right one, both worth recording:

1. **Taking over the scheduling.** The library exposes an
   `onContinue` hook that looks made for this. It is not: what it
   hands you is the library's own scheduler, so calling it goes
   straight back to the painting clock. This made things **worse**,
   not better, and only testing showed it.

2. **Posting a message instead of setting a timer.** Timers really are
   slowed to about one a second in a hidden tab, and a posted message
   is not — so this looked like the answer. It made no difference,
   because the wait was never on a timer to begin with.

The fix that worked: the library has three drawing intents, and the
“print” one schedules itself rather than waiting for the screen —
which makes sense, since a document being printed is not being
watched. Measured with the painting clock deliberately stopped:

| Intent | Result |
|---|---|
| display | never finished |
| any | never finished |
| print | finished in 16 ms |

Three pages at 150 dots per inch, in a tab that was not being painted:
**18,713 ms before, 186 ms after**, with byte-for-byte identical
output. The one real consequence — an annotation the file marks “do
not print” will not appear, and one marked “print only” will — is
written next to the code. Filled-in form values were checked
specifically and do still appear.

Redaction was re-tested afterwards, because it is the one place where
losing content would matter most: blacking out page one removed its
text entirely, left pages two and three untouched, and the built-in
verification confirmed the words were gone.

### A fifth check: `check-a11y.mjs`

The site could already prove it contacts nobody and that its colours
are readable. It can now also prove, across all 46 pages, that:

- there is exactly one first-level heading and no skipped levels;
- every control has something that names it;
- every label points at a control that exists, and every `aria-`
  reference points at something real;
- no identifier is used twice;
- every drawing is either marked as decoration or given a name;
- the landmarks and the skip link are present and correct;
- nothing is forced out of the natural tab order.

It found three real faults, now fixed: an unnamed drawing on the
homepage, an unnamed file picker in Settings, and — from Phase 9, my
own — a sidebar switch that was the only checkbox on the site not
wrapped in a label, making it an 18-pixel tap target on a phone.

**Writing the check found a fault in the check twice**, which is worth
saying: first it did not understand that a checkbox inside a label is
properly named, and reported thirty things that were fine. The rule is
the same as everywhere else here — a test that cries wolf is worse
than no test, because you learn to ignore it.

It prints, every time it passes, that it checks structure only and is
not a substitute for a real screen reader. Which still has not
happened.

### The phone pass

Every page was measured at 375 pixels wide, the width of a small
phone:

- **Nothing scrolls sideways** on any page checked.
- **Every tap target is at least 32 pixels**, and the checkbox rows
  are 44 — except one, now fixed.
- Links inside a sentence are left as they are: they are text, not
  buttons, and stretching them would be worse.

An attempt to check every page at once by loading them into a frame
was refused — by our own security policy, which forbids this site
being framed at all. That is the policy working.

### No silent failures

The brief forbids swallowing an error quietly. Every `catch` in the
project was checked by machine: **none is empty and unexplained**.
Where one deliberately does nothing — storage being unavailable, a
tidy-up that does not matter — there is a comment saying why.

### Help that matches what was built

The Help page now covers recipes, changing the keyboard shortcuts, and
arranging the tool list, including the parts that do not work the
obvious way: that passwords are never saved into a recipe, that
sixteen tools cannot be steps, and that a renamed tool is still found
under the name it came with.

---

## Phase 11 — removing a background, and a bug it uncovered

### What was built, and what it will not do

The background remover works by **colour**. You point at the
background and every pixel close enough to that colour becomes
see-through. It does not know what a person or a dog is.

That is a deliberate choice, not a shortcut. The tools that genuinely
understand a photograph are neural networks of tens of megabytes, and
bundling one would break two promises this site makes: that a first
visit is small, and that every borrowed thing is permissively licensed
with its fingerprint published. Several of the best background-removal
models are licensed for non-commercial use only, which is worse than
large.

So the honest scope is:

| Kind of picture | How it does |
|---|---|
| Product on a white sweep, a logo, a signature on paper | Excellent |
| A studio backdrop, slightly uneven | Good, with the tolerance raised |
| Hair, fur, smoke, glass | Cuts straight through them |
| A person against a busy street | Cannot, and says so |

**It says which of those you have before you touch anything.** On
loading a picture it looks at the ring of pixels round the edge and
reports “This should work well”, “This will need some help”, or “This
is not a picture this tool can do on its own”. A real photograph from
the samples folder is correctly told it is the third.

Beyond that it has: two ways of choosing pixels (“only the outside”,
which keeps the hole in a letter O, and “anywhere”, which is right for
a logo); tolerance, edge softness and edge trim; a click on the picture
to add a background colour, as many as you like; a brush to erase or
restore by hand; and a choice of a see-through background or a flat
colour.

It also reports what it did. If 99% of the picture was removed, it says
that the subject matched the background rather than pretending success.

### The bug this uncovered, which mattered more than the feature

While wiring the Run button, the shared scaffolding fought back: the
button already had a handler that ran every chosen file through the
standard picture pipeline. Investigating that turned up a real fault in
**six tools that were already shipped**.

Those tools — blur, watermark, combine, icons, colour palette, polish
— do their own work and hand the shared pipeline a job that does
nothing. But the shared handler still ran. So on the blur tool:

**Load a photograph, mark nothing, press Run, and you got a file called
`photo-plain-hidden.jpg` sitting in the results tray with nothing
hidden in it.**

On a privacy tool that is not a cosmetic bug. Somebody could have sent
out a file whose name says it was redacted, and it was the original.

Fixed at the source rather than six times over: a tool can now say it
takes the Run button itself, and the shared handler stands aside.
Verified both ways — pressing Run with nothing marked now saves
nothing and says “Mark something first”; marking a box and pressing
Run still produces exactly one correctly blurred file.

### How the new tool was proved

- On a made-up product shot: the corner of the saved PNG is fully
  see-through, the subject keeps its exact colour at full opacity, and
  the file comes out at the original 600 — 450 rather than the size of
  the preview.
- “Only the outside” keeps an enclosed hole; “anywhere” clears it;
  the ring around it survives both.
- The brush clears the hole by hand without touching the ring.
- Replacing the background with a colour puts that exact colour in the
  corner.
- A white disc on a white background is correctly reported as a
  failure rather than silently returning an empty picture.
- A real photograph is correctly judged as one this tool cannot do.

---

## Phase 12 — the QR codes did not work, and now do

This one is uncomfortable, so it goes near the top of what to read.

### What was wrong

The QR generator was written here from the specification rather than
borrowed. An earlier session tried to check it with a decoding library,
the library read nothing, and the question was left open: was the
generator wrong, or the reader? The note said a phone camera should be
pointed at one, and if it failed, the generator should be pulled.

It was the generator. **Every QR code this site produced was
unreadable by a real scanner.** Three separate faults:

1. **The format information had its rows and columns swapped.** The
   fifteen bits that tell a scanner which mask and which
   error-correction level were used were written transposed.

2. **The second copy of the format information was written in the
   opposite order to the first**, and one of its bits was written over
   the “dark module” — a square the standard requires always to be
   black.

3. **The table of alignment-square positions had a spurious blank row
   at the front.** So every version from 2 upwards used the positions
   belonging to the version below it, and version 2 got none at all.
   Version 31's row was missing from the table entirely.

Any one of these is fatal. A scanner finds the code, reads the format,
gets the wrong mask, unmasks the data with it, and the error correction
then fails on nonsense.

### Why nothing caught it

Because the only thing that had ever read these codes was our own
code, which made the same mistakes in reverse and therefore agreed
with itself perfectly. The earlier session's “self-decode” passed for
exactly that reason. It is the oldest trap in testing: a program
compared against itself always agrees.

### How it was found and fixed

By decoding with **ZXing** — the library Android's camera and most
scanning apps are built on — and separately by comparing our grid,
one square at a time, against a second independent encoder.

That turned a vague “it might be broken” into an exact answer within
minutes: ZXing reported a checksum failure rather than “no code
found”, which said the shape was right and the contents were wrong,
which pointed straight at the format bits and the masking.

Each fault was then fixed and re-checked in turn, and the fix for one
exposed the next:

| After fixing | Codes ZXing could read |
|---|---|
| nothing | 0 of 13 |
| the transposed format bits | version 1 only |
| the alignment table | 10 of 13 |
| the second format copy | all of them |

The last three “failures” turned out to be my own test harness: the
reference encoder's own codes failed in exactly the same way at those
sizes, which proved the harness was at fault and the codes were not.

### Where it stands now

- **Ten codes, covering versions 1 to 11, all four correction levels,
  URLs, wifi credentials, a vCard, accented text and Chinese, all read
  back correctly by ZXing.**
- **All ten grids are identical, module for module, to a second
  independent encoder.**
- The code the tool actually draws on screen was checked against the
  generator square by square: no difference, with a correct four-square
  quiet zone.

### A sixth check, so this cannot happen again

`node scripts/check-qr.mjs` does all of the above on demand. It needs
two packages that are deliberately not part of the site and never
shipped with it, and if they are missing it **says so and stops**
rather than passing quietly and letting you believe something was
verified.

### What I would still like

A phone. Every check here is another program reading our output, and
the programs agree. That is strong, and it is not the same as a camera
in a hand in ordinary light. Point one at a code from the tool; it
should work now, and if it does not I want to know.

---

## The offline check — run with the server switched off

The whole point of On Device is that it does not need a server once you have it.
That was tested properly rather than assumed.

A fresh visit was made with nothing saved, and the site saved itself: **145 files**
on the first visit, growing to **155** after two tools had pulled in the extra
libraries they need. The web server was then **stopped completely** — a request to
it from outside the browser gets no answer at all.

With the server dead, in the same browser:

- The scanned-document page loaded, with its correct title, its correct
  heading and its file drop area in place. (It was checked by reading the
  page's own contents rather than by eye: the preview window was not being
  displayed at the time, so no screenshot was possible.)
- The homepage, Trust, Help, Settings, the QR maker, the zip tool and the
  spreadsheet tool all loaded from the copy on the device.
- Text recognition read a picture of the words *Nothing leaves this page* back
  correctly, at 95% confidence — with no server and no network.
- Merging a one-page PDF with a three-page PDF produced a genuine four-page PDF
  of 1,535 bytes, beginning with the `%PDF-` marker that says it is a real
  document — again with no server.
- Asking for something that had never been saved returned the honest message the
  site is meant to give: *"This part of On Device is not saved on your device yet,
  and there is no connection to fetch it with. Reconnect once and it will be saved
  for good."* No fake success, no blank screen.

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
    then the honest claim is only “we ask your browser, and report what it says”.

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

15. **No accessibility audit with a real screen reader yet.** Structure is now
    machine-checked on every page as well as contrast — see Phase 10 — and three
    real faults were found and fixed that way. But nobody has still driven this
    site with NVDA or VoiceOver, and a passing structural check is not the same
    thing. This is the largest honest gap that remains.

16. ~~**PDF page-drawing pauses while the tab is in the background.**~~
    **Fixed in Phase 10.** It was real, it is written up above, and a
    three-page export in a tab that is not being painted went from
    18,713 milliseconds to 186. Left here rather than deleted, so the
    record of what was once broken stays honest.

17. **A recipe is a straight line, with no choices in it.** Steps run in order,
    every file goes through every step, and there is no “if this one is a PDF do
    that instead”. A mixed pile of PDFs and photographs needs two recipes rather
    than one clever one. That is a deliberate limit for now — branching is easy
    to add and very easy to make incomprehensible.

18. **Steps cannot be dragged into a new order.** There are up and down buttons,
    which work with the keyboard, but no dragging.

19. **The check before a run reads file types, not file contents.** It knows a
    scanned-in PDF is a PDF, so it cannot warn you in advance that “pull the text
    out” will find nothing in it. That failure is caught when the step runs, and
    explained then.

20. **Recipes live on one device in one browser.** There is no account and no
    syncing, so a recipe travels the only way anything travels here: as a file
    you export and import. Importing never overwrites — a recipe with a name you
    already have arrives as “(2)”.

21. **A shortcut is remembered by key position, not by the letter on the key.**
    On anything other than a QWERTY layout, the name written beside the shortcut
    may not match your keycap. The key you pressed is always the key that works;
    only the label can be wrong.

22. ~~**“Turn pages into pictures” inside a recipe inherits limitation 16.**~~
    **Fixed in Phase 10** along with limitation 16 itself.

23. **The tool list is arranged in Settings, not on the homepage.** There is no
    right-click menu on a tool card to rename or hide it where you are standing.
    Everything works, but it is a trip to Settings and back.

24. **Reordering is up and down buttons, not dragging** — the same limit the
    recipe steps have, for the same reason.

25. **A tool can only move within its own category.** The grid is grouped by
    category, so a PDF tool sitting under Images would look like a fault rather
    than a preference.

26. **The writing inside each tool page is English only.** Menus, headings,
    breadcrumbs, tool names and descriptions, and the error messages are
    translated; the options, hints and “what this tool cannot do” notes on all 38
    tool pages are not. Settings says so in as many words, and counts what is
    covered rather than claiming it.

27. **The Hindi is still unchecked by a native speaker.** More of it exists now,
    which makes that more important rather than less.

28. **Page titles in the browser tab stay English** in every language. The tab
    title is set before any translation runs, and moving it would mean loading a
    language file before the page draws — which would slow every page down for
    everybody to fix something small.

29. **The three intents are not identical on documents with annotations.** Drawing
    a page now asks for it as it would print. On ordinary content, scans, text and
    filled-in forms this changes nothing, and that was measured. On a document
    with an annotation marked “do not print”, that annotation will not appear in
    an exported picture. No such document was to hand to test with.

30. **The phone pass was measured, not held.** Every page was checked at 375
    pixels in a desktop browser told to be that size. Nobody has used this on an
    actual phone, where the keyboard covers half the screen and the memory runs
    out sooner.

31. **The background remover cuts through hair, fur and glass.** Colour cannot
    tell a strand of hair from the wall behind it. Nothing here will fix that;
    it needs a tool that understands what it is looking at.

32. **Video and audio are still not built, and that is the recommendation.** The
    brief made Phase 11 conditional on everything else being perfect. It is not:
    nobody has driven this site with a screen reader or used it on a real phone.
    Two more tools would be worth less than closing either of those.

33. **The QR codes made before this were all unreadable.** If you saved one from
    this site before Phase 12, it does not scan. Make it again. This is written
    here rather than quietly fixed because anyone who printed one deserves to
    know.

34. **No camera has yet read a code from this tool.** Three separate programs
    agree the codes are correct, which is strong evidence and not the same as a
    phone in ordinary light.

---

## How to check any of this yourself

```bash
node scripts/check-no-external.mjs
```

```bash
node scripts/check-contrast.mjs
```

```bash
node scripts/check-a11y.mjs
```

```bash
node scripts/check-qr.mjs
```

```bash
node scripts/make-samples.mjs
```

```bash
node scripts/add-exif.mjs
```

The first fails if anything in the project points at another computer. The second
fails if any colour pairing in any theme falls below the accessibility standard.
The third checks that every page can be read out and moved through without a mouse
or without sight — structure only, which it says so itself every time it passes.
The fourth decodes our QR codes with the library phone cameras use, and compares
every square against a second encoder.
The fifth writes real test files into `samples/`. The sixth builds a JPEG whose
hidden information is known in advance, so the metadata reader can be checked
against a correct answer rather than merely observed not to crash.
