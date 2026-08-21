/* ============================================================
   On Device - English

   Every word the interface shows lives in a file like this one.
   To add a language, copy this file, translate the right-hand
   side of each line, and register it in i18n.js. Nothing else
   needs to change.

   {name} in a string is a placeholder that gets filled in.
   ============================================================ */

export const meta = {
  code: "en",
  name: "English",
  nativeName: "English",
  dir: "ltr",
  complete: true
};

export default {
  /* ---- Identity ----------------------------------------- */
  "app.name": "On Device",
  "app.tagline": "Nothing leaves this page.",
  "app.description":
    "Everyday file tools - PDFs, photos, QR codes, conversion - that run entirely inside your own browser. Nothing is uploaded, because there is nowhere to upload to.",

  /* ---- Navigation --------------------------------------- */
  "nav.skip": "Skip to main content",
  "nav.tools": "Tools",
  "nav.trust": "How this works",
  "nav.settings": "Settings",
  "nav.help": "Help",
  "nav.roadmap": "What is built",
  "nav.recipes": "Recipes",
  "nav.privacy": "Privacy",
  "nav.credits": "Credits",
  "nav.menu": "Menu",

  /* ---- Home --------------------------------------------- */
  "home.title": "Tools",
  "home.lede":
    "Pick a tool, or drop a file anywhere on this page and we will show you what can be done with it.",
  "home.search.label": "Search tools",
  "home.search.placeholder": "Search tools, or describe what you want to do",
  "home.search.hint": "Try “make smaller”, “remove location”, “iphone photo”",
  "home.filter.all": "All",
  "home.filter.pinned": "Pinned",
  "home.filter.recent": "Recent",
  "home.filter.ready": "Ready now",
  "home.view.grid": "Grid view",
  "home.view.list": "List view",
  "home.empty.title": "No tools match that.",
  "home.empty.body": "Try a shorter word, or clear the filters.",
  "home.empty.clear": "Clear search and filters",
  "home.count": "{built} of {total} tools built so far",
  "home.section.pinned": "Pinned",
  "home.section.recent": "Recently used",

  /* ---- Categories --------------------------------------- */
  "cat.pdf": "PDF",
  "cat.image": "Images",
  "cat.data": "Documents, data and text",
  "cat.files": "File utilities",
  "cat.count": "{n} tools",

  /* ---- Tool card ---------------------------------------- */
  "tool.pin": "Pin {name}",
  "tool.unpin": "Unpin {name}",
  "tool.notBuilt": "Not built yet",
  "tool.phase": "Phase {n}",
  "tool.ready": "Ready",
  "tool.open": "Open {name}",

  /* ---- Not-built dialog --------------------------------- */
  "notBuilt.title": "{name} is not built yet",
  "notBuilt.body":
    "This tool arrives in Phase {n}. The site is being built one phase at a time, and nothing is put on the homepage pretending to work before it does.",
  "notBuilt.seePlan": "See the full build plan",
  "notBuilt.close": "Close",

  /* ---- Drop zone ---------------------------------------- */
  "drop.title": "Drop a file here",
  "drop.body": "Or choose one. Your file stays on this device - it is not uploaded.",
  "drop.choose": "Choose files",
  "drop.veil.title": "Drop to see what you can do",
  "drop.veil.body": "Nothing is uploaded. The file is read here, on your machine.",
  "drop.reading": "Reading {name}…",
  "drop.matched.title": "What you can do with this",
  "drop.matched.none":
    "No tool here handles this kind of file yet. Here is what we could tell about it.",
  "drop.clear": "Clear",
  "drop.clearAll": "Clear all files",
  "drop.added": "{n} file added.",
  "drop.added.plural": "{n} files added.",
  "drop.tooBig":
    "{name} is {size}, which is larger than this browser is likely to handle in memory ({limit}). Opening it may crash the tab.",
  "drop.mismatch":
    "{name} is named like a {claimed} file but its contents are actually {actual}. We will treat it as {actual}.",
  "drop.unknown": "We could not identify what kind of file {name} is.",

  /* ---- Files -------------------------------------------- */
  "file.kind.pdf": "PDF document",
  "file.kind.image": "Image",
  "file.kind.heic": "iPhone photo (HEIC)",
  "file.kind.zip": "Zip archive",
  "file.kind.text": "Text",
  "file.kind.csv": "CSV spreadsheet",
  "file.kind.json": "JSON data",
  "file.kind.sheet": "Excel spreadsheet",
  "file.kind.audio": "Audio",
  "file.kind.video": "Video",
  "file.kind.unknown": "Unrecognised file",
  "file.remove": "Remove {name}",
  "file.size": "{size}",

  /* ---- Results tray ------------------------------------- */
  "tray.title": "Results",
  "tray.empty": "Finished files will appear here.",
  "tray.count": "{n} file ready",
  "tray.count.plural": "{n} files ready",
  "tray.downloadAll": "Download all as zip",
  "tray.download": "Download {name}",
  "tray.sendTo": "Send to another tool",
  "tray.clear": "Clear results",
  "tray.open": "Open results",
  "tray.collapse": "Collapse results",

  /* ---- Command palette ---------------------------------- */
  "palette.open": "Open the command palette",
  "palette.placeholder": "Search tools and settings…",
  "palette.empty": "Nothing matches “{q}”.",
  "palette.hint.move": "Move",
  "palette.hint.choose": "Choose",
  "palette.hint.close": "Close",
  "palette.group.tools": "Tools",
  "palette.group.pages": "Pages",
  "palette.group.actions": "Actions",

  /* ---- Global actions ----------------------------------- */
  "action.clearEverything": "Clear everything now",
  "action.clearEverything.confirm":
    "This removes every file currently loaded, and empties the results tray. Your settings and pinned tools are kept. This cannot be undone.",
  "action.clearEverything.done": "Everything loaded has been cleared.",
  "action.cancel": "Cancel",
  "action.confirm": "Yes, clear it",
  "action.close": "Close",
  "action.copy": "Copy",
  "action.copied": "Copied.",
  "action.copyFailed": "Your browser would not let us copy. Select the text and copy it manually.",
  "action.install": "Install",
  "action.retry": "Try again",

  /* ---- Status ------------------------------------------- */
  "status.offlineReady": "Ready to work offline. Everything you need is already on this device.",
  "status.offline": "You are offline. Everything here still works.",
  "status.installing": "Saving this site to your device so it works offline…",
  "status.installFailed":
    "This site could not be saved for offline use: {reason} You can still use it while online.",
  "status.updateReady": "A newer version of On Device has been saved. Reload to use it.",
  "status.reload": "Reload",

  /* ---- Errors ------------------------------------------- */
  "error.title": "Something went wrong",
  "error.storage":
    "This browser will not let the site remember anything on this device. Settings and pinned tools will reset when you close the tab. This usually means a private window, or storage being blocked in the browser's settings.",
  "error.noFileApi":
    "This browser is too old to read files safely. Please use a current version of Chrome, Edge, Firefox or Safari.",
  "error.readFailed": "{name} could not be read: {reason}",
  "error.unknown": "An unexpected problem occurred: {reason}",

  /* ---- Settings ----------------------------------------- */
  "settings.title": "Settings",
  "settings.lede":
    "Everything here is saved on this device only, and can be exported to a file and carried to another one.",
  "settings.group.appearance": "Appearance",
  "settings.group.layout": "Layout",
  "settings.group.behaviour": "Behaviour and defaults",
  "settings.group.shortcuts": "Keyboard",
  "settings.group.language": "Language",
  "settings.group.data": "Your data on this device",

  "settings.theme": "Theme",
  "settings.theme.hint": "“Follow system” uses Paper in daylight mode and Midnight in dark mode.",
  "settings.theme.system": "Follow system",
  "settings.theme.paper": "Paper",
  "settings.theme.midnight": "Midnight",
  "settings.theme.contrast": "High contrast",
  "settings.theme.sepia": "Sepia",
  "settings.theme.terminal": "Terminal",

  "settings.accent": "Accent colour",
  "settings.accent.hint": "Used for links, buttons and highlights.",
  "settings.accent.default": "Theme default",
  "settings.accent.custom": "Custom colour",

  "settings.density": "Density",
  "settings.density.comfortable": "Comfortable",
  "settings.density.compact": "Compact",

  "settings.textScale": "Text size",
  "settings.textScale.hint": "Currently {pct}% of the normal size.",

  "settings.font": "Font",
  "settings.font.ui": "Your system font",
  "settings.font.legible": "Extra-legible font",
  "settings.font.mono": "Monospace",
  "settings.font.hint":
    "The extra-legible option uses a dyslexia-friendly font if one is installed on this device, and a very clear fallback if not. A bundled font arrives in a later phase.",

  "settings.corners": "Corners",
  "settings.corners.rounded": "Rounded",
  "settings.corners.square": "Square",

  "settings.motion": "Animation",
  "settings.motion.system": "Follow system setting",
  "settings.motion.reduced": "Reduce animation",
  "settings.motion.full": "Full animation",

  "settings.view": "Default view",
  "settings.view.grid": "Grid",
  "settings.view.list": "List",

  "settings.homeOpensTo": "The homepage opens to",
  "settings.homeOpensTo.all": "All tools",
  "settings.homeOpensTo.favourites": "Pinned tools only",

  "settings.autoDownload": "Download results automatically",
  "settings.autoDownload.hint": "Off means finished files wait in the results tray.",
  "settings.keepHistory": "Keep a local history of what was processed",
  "settings.keepHistory.hint": "Off by default. Stored on this device only, never sent anywhere.",
  "settings.autoClearOnClose": "Clear loaded files when the tab closes",
  "settings.confirmDestructive": "Ask before anything destructive",

  "settings.imageQuality": "Default image quality",
  "settings.imageFormat": "Default image format",
  "settings.imageFormat.keep": "Keep the original format",
  "settings.pageSize": "Default page size",
  "settings.dpi": "Default resolution",
  "settings.units": "Units",
  "settings.filenamePattern": "Output filename pattern",
  "settings.filenamePattern.hint":
    "Available pieces: {name} the original name, {tool} the tool used, {date} today's date, {n} a number, {ext} the file extension.",

  "settings.language": "Language",
  "settings.language.hint": "Text you have not translated falls back to English.",

  "settings.export": "Export settings to a file",
  "settings.import": "Import settings from a file",
  "settings.imported": "Settings imported.",
  "settings.reset": "Reset everything",
  "settings.reset.confirm":
    "This wipes every setting, every pinned tool and everything this site has stored on this device. It cannot be undone.",
  "settings.reset.done": "Removed {n} stored items. Everything is back to its defaults.",
  "settings.storageUsed": "This site is using about {size} of storage on this device.",
  "settings.storageUnknown": "This browser will not tell us how much storage is in use.",

  /* ---- Trust page --------------------------------------- */
  "trust.title": "How this works, and how to check",
  "trust.monitor.title": "Live network monitor",
  "trust.stat.external": "Requests to anywhere else",
  "trust.stat.own": "Requests for this site's own files",
  "trust.stat.blocked": "Blocked attempts",
  "trust.stat.since": "Watching since you opened this page",
  "trust.log.title": "Everything this page has loaded",
  "trust.log.url": "Address",
  "trust.log.type": "Kind",
  "trust.log.size": "Size",
  "trust.log.where": "Where from",
  "trust.log.own": "This site",
  "trust.log.external": "Somewhere else",
  "trust.log.empty": "Nothing recorded yet.",
  "trust.test.button": "Try to contact another site",
  "trust.test.explain":
    "This deliberately attempts a request to example.com so you can watch it be refused.",
  "trust.test.blocked":
    "Refused, as it should be. The browser stopped it before anything was sent. Message: {message}",
  "trust.test.allowed":
    "The request was NOT refused. That is a bug and the promise on this page is not being kept. Please report it.",

  /* ---- Install / PWA ------------------------------------ */
  "install.title": "Install On Device",
  "install.body":
    "Install it and it works with the internet switched off, like any other program on this machine.",
  "install.button": "Install",
  "install.later": "Not now",
  "install.done": "Installed. It now works offline.",
  "install.unsupported":
    "This browser does not offer installation. The site still works offline once you have visited it.",

  /* ---- Tool names and descriptions ---------------------- */
  "tool.pdf-merge.name": "Merge PDFs",
  "tool.pdf-merge.desc": "Combine several PDFs and images into one, in any order you like.",
  "tool.pdf-merge.keys": "join combine append stitch together one file",

  "tool.pdf-split.name": "Split and extract pages",
  "tool.pdf-split.desc": "Take out one page, a range, or burst a PDF into separate files.",
  "tool.pdf-split.keys": "separate divide extract page range burst cut",

  "tool.pdf-organise.name": "Organise pages",
  "tool.pdf-organise.desc": "Delete, duplicate, reorder and rotate pages by dragging them.",
  "tool.pdf-organise.keys": "reorder rearrange move delete duplicate sort pages",

  "tool.pdf-compress.name": "Compress a PDF",
  "tool.pdf-compress.desc": "Make a PDF smaller, with a side-by-side look at what you lose.",
  "tool.pdf-compress.keys": "shrink smaller reduce size optimise email attachment too big",

  "tool.pdf-to-images.name": "PDF to images",
  "tool.pdf-to-images.desc": "Save each page as a PNG or JPG at the resolution you choose.",
  "tool.pdf-to-images.keys": "export png jpg picture render pages screenshot",

  "tool.images-to-pdf.name": "Images to PDF",
  "tool.images-to-pdf.desc": "Turn photos or scans into a single PDF with the page size you want.",
  "tool.images-to-pdf.keys": "photo jpg png scan combine document a4 letter",

  "tool.pdf-rotate-crop.name": "Rotate and crop pages",
  "tool.pdf-rotate-crop.desc": "Turn pages the right way up, trim the edges, straighten a scan.",
  "tool.pdf-rotate-crop.keys": "turn sideways upside down trim margins straighten deskew",

  "tool.pdf-page-numbers.name": "Page numbers and headers",
  "tool.pdf-page-numbers.desc": "Add page numbers, headers or footers, and skip the cover page.",
  "tool.pdf-page-numbers.keys": "numbering footer header stamp bates",

  "tool.pdf-watermark.name": "Watermark a PDF",
  "tool.pdf-watermark.desc": "Stamp text or a logo across pages, with opacity and tiling.",
  "tool.pdf-watermark.keys": "stamp draft confidential logo overlay",

  "tool.pdf-fill-sign.name": "Fill and sign",
  "tool.pdf-fill-sign.desc": "Type into a form, tick boxes, add a date, and draw your signature.",
  "tool.pdf-fill-sign.keys": "signature form complete write initial date tick",

  "tool.pdf-redact.name": "Redact - really",
  "tool.pdf-redact.desc": "Black out text and genuinely destroy it, not just cover it up.",
  "tool.pdf-redact.keys": "black out hide censor remove sensitive private cover",

  "tool.pdf-metadata.name": "PDF metadata",
  "tool.pdf-metadata.desc": "See and change the hidden title, author, software and dates.",
  "tool.pdf-metadata.keys": "author title properties hidden info wipe clean",

  "tool.pdf-password-add.name": "Password-protect a PDF",
  "tool.pdf-password-add.desc": "Encrypt a PDF with a password before you send it.",
  "tool.pdf-password-add.keys": "encrypt lock secure protect password",

  "tool.pdf-password-remove.name": "Remove a PDF password",
  "tool.pdf-password-remove.desc": "Decrypt a PDF you own, using the password you already have.",
  "tool.pdf-password-remove.keys": "decrypt unlock open password known",

  "tool.pdf-extract-text.name": "Extract text",
  "tool.pdf-extract-text.desc": "Pull the words out of a PDF and save or copy them.",
  "tool.pdf-extract-text.keys": "copy text words content plain txt",

  "tool.pdf-ocr.name": "Read a scanned document",
  "tool.pdf-ocr.desc": "Make a scan or photo searchable and copyable, offline.",
  "tool.pdf-ocr.keys": "ocr scan recognise handwriting searchable text photo of a document",

  "tool.pdf-nup.name": "Multiple pages per sheet",
  "tool.pdf-nup.desc": "Two or four pages a sheet, booklet order, or one page across many sheets.",
  "tool.pdf-nup.keys": "n-up booklet poster print layout fold 2up 4up",

  "tool.pdf-flatten.name": "Flatten a PDF",
  "tool.pdf-flatten.desc": "Bake in form fields and notes so nothing can be edited.",
  "tool.pdf-flatten.keys": "lock fields annotations final read only",

  "tool.image-resize.name": "Resize images",
  "tool.image-resize.desc": "By pixels, percentage, or longest side - one image or a hundred.",
  "tool.image-resize.keys": "smaller bigger dimensions scale pixels batch shrink",

  "tool.image-convert.name": "Convert images",
  "tool.image-convert.desc": "Between JPG, PNG, WebP and more - and out of iPhone HEIC.",
  "tool.image-convert.keys": "heic iphone photo jpg png webp avif change format open",

  "tool.image-compress.name": "Compress images",
  "tool.image-compress.desc": "Smaller files, with a magnified before-and-after so you can judge.",
  "tool.image-compress.keys": "smaller quality reduce size optimise email upload limit",

  "tool.image-crop.name": "Crop images",
  "tool.image-crop.desc": "Freehand, fixed ratios, or exact passport and visa photo sizes.",
  "tool.image-crop.keys": "trim cut passport visa id photo ratio square",

  "tool.image-rotate.name": "Rotate and flip",
  "tool.image-rotate.desc": "Turn, mirror and straighten a photo.",
  "tool.image-rotate.keys": "turn sideways upside down mirror straighten level",

  "tool.image-metadata.name": "Photo metadata and location",
  "tool.image-metadata.desc": "See what a photo reveals - including where it was taken - and strip it.",
  "tool.image-metadata.keys": "exif gps location remove strip privacy camera date hidden",

  "tool.image-blur.name": "Blur or pixelate",
  "tool.image-blur.desc": "Hide a face, a number plate or an address - permanently.",
  "tool.image-blur.keys": "censor hide face plate address redact anonymise",

  "tool.image-watermark.name": "Watermark an image",
  "tool.image-watermark.desc": "Add text or a logo, at any opacity and position, in bulk.",
  "tool.image-watermark.keys": "logo stamp copyright overlay brand",

  "tool.image-combine.name": "Combine images",
  "tool.image-combine.desc": "Stitch pictures into one sheet, a grid, or a long strip.",
  "tool.image-combine.keys": "merge join collage grid montage strip stitch",

  "tool.icon-generator.name": "Icon and favicon maker",
  "tool.icon-generator.desc": "One square image in, every size a site or app needs out.",
  "tool.icon-generator.keys": "favicon app icon sizes manifest pwa apple touch",

  "tool.colour-palette.name": "Colour picker and palette",
  "tool.colour-palette.desc": "Pull the main colours out of an image, with hex codes to copy.",
  "tool.colour-palette.keys": "colours hex eyedropper dominant theme swatch",

  "tool.screenshot-polish.name": "Polish a screenshot",
  "tool.screenshot-polish.desc": "Padding, rounded corners, a shadow and a clean background.",
  "tool.screenshot-polish.keys": "pretty frame background shadow mockup presentation",

  "tool.qr-generate.name": "Make a QR code",
  "tool.qr-generate.desc": "For a link, wifi network, contact card, email or plain text.",
  "tool.qr-generate.keys": "qr code wifi vcard contact link url generate barcode",

  "tool.qr-read.name": "Read a QR or barcode",
  "tool.qr-read.desc": "From a picture or your camera. The camera feed never leaves this device.",
  "tool.qr-read.keys": "scan decode camera barcode qr read",

  "tool.text-workbench.name": "Text workbench",
  "tool.text-workbench.desc": "Case, spacing, find and replace, sort, deduplicate, count.",
  "tool.text-workbench.keys": "uppercase lowercase trim clean sort duplicates word count replace",

  "tool.spreadsheet.name": "CSV, JSON and Excel",
  "tool.spreadsheet.desc": "Open a spreadsheet, convert between formats, fix broken ones.",
  "tool.spreadsheet.keys": "csv excel xlsx json convert table delimiter encoding",

  "tool.markdown.name": "Markdown preview",
  "tool.markdown.desc": "Write markdown, see it live, export it as a clean PDF or web page.",
  "tool.markdown.keys": "md preview render export html readme",

  "tool.zip.name": "Zip and unzip",
  "tool.zip.desc": "Bundle files into a zip, or open one up.",
  "tool.zip.keys": "archive compress extract unpack folder",

  "tool.checksum.name": "Checksum a file",
  "tool.checksum.desc": "SHA-256, SHA-1 or MD5, to check a download is genuine.",
  "tool.checksum.keys": "hash sha256 md5 verify integrity download check",

  "tool.file-lock.name": "Lock a file with a password",
  "tool.file-lock.desc": "Encrypt anything so it can be emailed safely - and unlock it here again.",
  "tool.file-lock.keys": "encrypt password protect secure aes decrypt unlock usb",

  "tool.file-compare.name": "Compare two files",
  "tool.file-compare.desc": "Tell whether two files are identical, byte for byte.",
  "tool.file-compare.keys": "diff identical same duplicate check match",

  "tool.media-toolkit.name": "Video and audio",
  "tool.media-toolkit.desc": "Trim, mute, convert, compress, or make a GIF. Large one-time download.",
  "tool.media-toolkit.keys": "mp4 mp3 trim cut mute gif convert compress extract audio",

  "tool.background-remover.name": "Remove a background",
  "tool.background-remover.desc": "Cut the subject out of a photo, offline.",
  "tool.background-remover.keys": "cut out transparent subject remove background png",

  /* ---- Recipes ------------------------------------------ */
  "recipes.title": "Recipes",
  "recipes.lede":
    "Save a chain of steps once. Then drop a whole folder onto it and get every finished file back in one go, without clicking through a tool forty times.",
  "recipes.saved": "Your recipes",
  "recipes.new": "New recipe",
  "recipes.import": "Import",
  "recipes.exportAll": "Export all",
  "recipes.editor": "The recipe",
  "recipes.save": "Save",
  "recipes.close": "Close",
  "recipes.name": "Name",
  "recipes.note": "Note to yourself",
  "recipes.addStep": "Add a step",
  "recipes.files": "Files to run it on",
  "recipes.run": "Run",
  "recipes.runNow": "Run the recipe",
  "recipes.stop": "Stop",
  "recipes.trayHint": "Finished files land in the results tray at the bottom of the screen.",
  "recipes.passwordNote.title": "Passwords are never saved",
  "recipes.passwordNote.body":
    "A step that needs a password asks for it each time you run the recipe. Nothing about a password is written to this device or into an exported recipe file, so a recipe you send to somebody cannot carry one.",
  "recipes.cannot": "Tools that cannot be a step, and why",
  "recipes.cannot.lede":
    "A recipe replays itself on files it has never seen. Anything that needs you to look at a particular file and make a judgement cannot be replayed, so these stay tools you drive yourself.",

  /* ---- Units and formats -------------------------------- */
  "unit.bytes": "{n} B",
  "unit.kb": "{n} KB",
  "unit.mb": "{n} MB",
  "unit.gb": "{n} GB",
  "unit.ms": "{n} ms"
};
