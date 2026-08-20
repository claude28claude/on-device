# On Device — progress

An honest record of what is built, what is verified, and what is known to be
imperfect. Updated at the end of every phase.

Last updated: **20 August 2026**, end of Phase 6.

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
| 4 | PDF advanced: compress, watermark, numbers, metadata, passwords, flatten, n-up | **Done** |
| 5 | Privacy specials: redaction, blur, fill and sign, file locking | **Done** |
| 6 | Text, data and utilities: QR, text, spreadsheets, markdown, zip, checksum, compare | **Done** — 7 of 8 |
| 7 | Extraction (text + OCR) | Next |
| 8 | Recipes and power features | Not started |
| 9 | Customisation and languages | Not started |
| 10 | Hardening | Not started |
| 11 | Optional extras | Not started |

**Tools built: 31 of 41.** Every unbuilt tool on the homepage is marked "Not built
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

Seven of the eight built. The eighth is deliberately not shipped, and that is the
most important thing in this section.

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
