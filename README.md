# On Device

**Nothing leaves this page.**

Everyday file tools — PDFs, photos, QR codes, conversions — that run entirely
inside the visitor's own browser. Nothing is uploaded, because there is nowhere
to upload to: this is a folder of static files with no server behind it.

The promise is enforced by the browser, not by us. Every page carries a Content
Security Policy that permits requests to this site's own address and refuses
every other address in the world.

Current state: **Phase 1 of 12 complete.** See [PROGRESS.md](PROGRESS.md) for an
honest account of what works, what does not, and what has not been tested.

---

## Running it on this machine

You do not need to install anything. Any static web server will do.

```bash
npx -y http-server . -p 8132 -c-1
```

Then open <http://localhost:8132> in a browser.

Opening `index.html` straight from the folder (a `file://` address) is **not**
supported — Chrome blocks JavaScript modules there for security reasons. Use the
command above instead. Once you have visited the site once, it works with the
internet switched off.

---

## The three checks before every commit

```bash
node scripts/check-no-external.mjs
```

Scans every file in the project for anything pointing at another computer. Fails
if it finds one that is not on a short allowed list with a written reason. Also
confirms every page carries the security policy.

```bash
node scripts/check-contrast.mjs
```

Reads the real colours out of `assets/css/tokens.css` and checks 23 pairings in
each of the 5 themes against WCAG AA. Fails if any pairing falls short.

```bash
node scripts/build-sw.mjs
```

Regenerates the list of files to keep on the device for offline use, and stamps a
new version so browsers pick up the change. **Run this after changing any file
and before publishing**, or visitors may keep seeing the previous version.

---

## The other scripts

```bash
node scripts/make-samples.mjs
```

Writes real test files into `samples/` — a valid multi-page PDF, a deliberately
damaged one, a PNG wearing a `.jpg` name, an empty file, awkward CSVs, a 120 MB
file for memory testing. Not part of the published site; `samples/` is ignored by
git and excluded from the offline cache.

```bash
node scripts/build-icons.mjs
```

Draws every icon and the social preview image from scratch, pixel by pixel, using
nothing but what Node already includes. No image library, no downloads.

---

## Publishing it

This is a static site. Any host that serves plain files will do, and it works
under a subpath (every link in the project is relative).

**First time:**

```bash
node scripts/build-sw.mjs
```

```bash
git add -A && git commit -m "Publish"
```

```bash
gh repo create on-device --public --source=. --push
```

Then switch on GitHub Pages for the repository, serving from the `main` branch,
root folder. The site appears at `https://<your-username>.github.io/on-device/`.

**Every time after that:**

```bash
node scripts/build-sw.mjs
```

```bash
git add -A && git commit -m "Update" && git push
```

In plain English: the first command writes the new file list so browsers know
something changed; the second saves the changes and sends them to GitHub. GitHub
publishes them within a minute or so.

---

## How it is put together

No framework, no bundler, no build step for the site itself. What is published is
exactly what you can read, which is the point — the privacy claim is only worth
something if the code can be checked.

```
index.html, trust.html, settings.html,      the pages
roadmap.html, help.html, privacy.html,
credits.html
sw.js                                        keeps the site available offline
manifest.webmanifest                         makes it installable

assets/css/tokens.css                        every colour, size and timing value
assets/css/base.css                          reset, typography, page furniture
assets/css/components.css                    buttons, cards, dialogs, tray

assets/js/netguard.js                        counts and blocks outbound requests
assets/js/preboot.js                         applies the saved theme before paint
assets/js/app.js                             shared start-up for every page
assets/js/store.js                           settings, saved on this device only
assets/js/i18n.js + strings/                 translation
assets/js/sniff.js                           identifies files by their contents
assets/js/workspace.js                       the files you have loaded
assets/js/tray.js                            finished results
assets/js/dropzone.js                        the universal drop zone
assets/js/palette.js                         Ctrl+K search
assets/js/search-terms.js                    understands everyday wording
assets/js/tools.js                           the list of all 41 tools
```

The file worth reading first is `assets/js/netguard.js`. It is short, commented in
plain English, and it is what makes the counter on the Trust page real rather than
decorative.

---

## Licence

MIT. See [LICENSE](LICENSE).
