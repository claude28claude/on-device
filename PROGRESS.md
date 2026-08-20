# On Device — progress

An honest record of what is built, what is verified, and what is known to be
imperfect. Updated at the end of every phase.

Last updated: **20 August 2026**, end of Phase 1.

---

## Where things stand

| Phase | What it covers | State |
|---|---|---|
| 0 | Plan, name, honest warnings | **Done** |
| 1 | The shell: homepage, drop zone, results tray, settings, offline, trust page | **Done** — see below |
| 2 | Images core: resize, convert (incl. HEIC), compress, crop, rotate, metadata | Next |
| 3 | PDF core | Not started |
| 4 | PDF advanced | Not started |
| 5 | Privacy specials | Not started |
| 6 | Text, data and utilities | Not started |
| 7 | Extraction (text + OCR) | Not started |
| 8 | Recipes and power features | Not started |
| 9 | Customisation and languages | Not started |
| 10 | Hardening | Not started |
| 11 | Optional extras | Not started |

**Tools built: 0 of 41.** Phase 1 deliberately contains no tools. Every tool on the
homepage is marked "Not built yet" with the phase it arrives in, and pressing one
says so rather than doing nothing.

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

## Known imperfect — read this part

1. **The Hindi translation has not been checked by a native speaker.** It is
   labelled as such in the language menu and on the Settings page. It exists to
   prove the mechanism, which it does. If Hindi is not the second language you
   want, swapping it is a one-file change.

2. **The results tray can only be seen empty.** It is fully built — add, remove,
   download, persistence, auto-download — but nothing produces a result until
   Phase 2, so the only state you can see today is "Finished files will appear
   here." Its real behaviour gets verified in Phase 2.

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

9. **Tool defaults (image quality, page size, DPI, units, filename pattern) save
   but nothing reads them yet**, because no tool exists. The Settings page says
   exactly this rather than implying they do something.

10. **The HEIC sample file is signature-only.** It has a genuine HEIC header, so it
    proves identification works, but it contains no real encoded image, so it
    cannot prove decoding. **Phase 2 must not be signed off without a real photo
    straight off an iPhone.**

11. **The licence for the HEIC decoder is unresolved.** The best-known browser
    decoder is LGPL, which breaks the permissive-licences-only promise. This is
    flagged on the Credits page and must be settled before Phase 2 ships.

12. **No accessibility audit with a real screen reader yet.** Live regions,
    labels, focus order and contrast are all built in and contrast is
    machine-verified, but nobody has driven it with NVDA or VoiceOver. That is
    Phase 10.

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

The first fails if anything in the project points at another computer. The second
fails if any colour pairing in any theme falls below the accessibility standard.
The third writes real test files into `samples/`.
