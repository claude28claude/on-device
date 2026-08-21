/* ============================================================
   On Device - हिन्दी (Hindi)

   This file exists to prove the translation mechanism works end
   to end: every line the English file has, this file has too.

   It has NOT been checked by a native Hindi speaker. It should be
   before anyone relies on it. Anything removed from this file
   falls back to English automatically.
   ============================================================ */

export const meta = {
  code: "hi",
  name: "Hindi",
  nativeName: "हिन्दी",
  dir: "ltr",
  complete: true,
  reviewed: false,
  reviewNote:
    "यह अनुवाद यह दिखाने के लिए है कि अनुवाद व्यवस्था काम करती है। इसे अभी किसी " +
    "मूल हिन्दी वक्ता ने जाँचा नहीं है। जो पंक्तियाँ अनुवादित नहीं हैं, वे अंग्रेज़ी में दिखेंगी।"
};

export default {
  "app.name": "ऑन डिवाइस",
  "app.tagline": "कुछ भी इस पेज से बाहर नहीं जाता।",
  "app.description":
    "रोज़मर्रा के फ़ाइल उपकरण - PDF, तस्वीरें, QR कोड, फ़ॉर्मेट बदलना - जो पूरी तरह आपके अपने ब्राउज़र में चलते हैं। कुछ भी अपलोड नहीं होता, क्योंकि अपलोड करने की कोई जगह ही नहीं है।",

  "nav.skip": "मुख्य सामग्री पर जाएँ",
  "nav.tools": "उपकरण",
  "nav.trust": "यह कैसे काम करता है",
  "nav.settings": "सेटिंग्स",
  "nav.help": "सहायता",
  "nav.roadmap": "क्या बन चुका है",
  "nav.recipes": "रेसिपी",
  "nav.privacy": "निजता",
  "nav.credits": "श्रेय",
  "nav.menu": "मेन्यू",

  "home.title": "उपकरण",
  "home.lede":
    "कोई उपकरण चुनें, या इस पेज पर कहीं भी फ़ाइल छोड़ दें - हम बता देंगे कि उसके साथ क्या किया जा सकता है।",
  "home.search.label": "उपकरण खोजें",
  "home.search.placeholder": "उपकरण खोजें, या बताइए आप क्या करना चाहते हैं",
  "home.search.hint": "जैसे “छोटा करें”, “लोकेशन हटाएँ”, “आईफ़ोन फ़ोटो”",
  "home.filter.all": "सभी",
  "home.filter.pinned": "पिन किए हुए",
  "home.filter.recent": "हाल के",
  "home.filter.ready": "अभी तैयार",
  "home.view.grid": "ग्रिड दृश्य",
  "home.view.list": "सूची दृश्य",
  "home.empty.title": "इससे कोई उपकरण मेल नहीं खाता।",
  "home.empty.body": "छोटा शब्द आज़माएँ, या फ़िल्टर हटाएँ।",
  "home.empty.clear": "खोज और फ़िल्टर हटाएँ",
  "home.count": "अब तक {total} में से {built} उपकरण बने हैं",
  "home.section.pinned": "पिन किए हुए",
  "home.section.recent": "हाल में उपयोग किए गए",

  "cat.pdf": "PDF",
  "cat.image": "तस्वीरें",
  "cat.data": "दस्तावेज़, डेटा और टेक्स्ट",
  "cat.files": "फ़ाइल उपयोगिताएँ",
  "cat.count": "{n} उपकरण",

  "tool.pin": "{name} को पिन करें",
  "tool.unpin": "{name} से पिन हटाएँ",
  "tool.notBuilt": "अभी बना नहीं",
  "tool.phase": "चरण {n}",
  "tool.ready": "तैयार",
  "tool.open": "{name} खोलें",

  "notBuilt.title": "{name} अभी बना नहीं है",
  "notBuilt.body":
    "यह उपकरण चरण {n} में आएगा। यह साइट एक-एक चरण करके बनाई जा रही है, और कोई चीज़ काम करने का दिखावा करते हुए होमपेज पर नहीं रखी जाती।",
  "notBuilt.seePlan": "पूरी निर्माण योजना देखें",
  "notBuilt.close": "बंद करें",

  "drop.title": "फ़ाइल यहाँ छोड़ें",
  "drop.body": "या चुनें। आपकी फ़ाइल इसी डिवाइस पर रहती है - वह अपलोड नहीं होती।",
  "drop.choose": "फ़ाइलें चुनें",
  "drop.veil.title": "छोड़िए और देखिए क्या किया जा सकता है",
  "drop.veil.body": "कुछ भी अपलोड नहीं होता। फ़ाइल यहीं, आपकी मशीन पर पढ़ी जाती है।",
  "drop.reading": "{name} पढ़ी जा रही है…",
  "drop.matched.title": "इसके साथ आप यह कर सकते हैं",
  "drop.matched.none":
    "इस तरह की फ़ाइल के लिए अभी कोई उपकरण नहीं है। इसके बारे में हम इतना बता सकते हैं।",
  "drop.clear": "हटाएँ",
  "drop.clearAll": "सारी फ़ाइलें हटाएँ",
  "drop.added": "{n} फ़ाइल जोड़ी गई।",
  "drop.added.plural": "{n} फ़ाइलें जोड़ी गईं।",
  "drop.tooBig":
    "{name} का आकार {size} है, जो इस ब्राउज़र की अनुमानित क्षमता ({limit}) से बड़ा है। इसे खोलने पर टैब बंद हो सकता है।",
  "drop.mismatch":
    "{name} का नाम {claimed} जैसा है, पर उसकी सामग्री असल में {actual} है। हम इसे {actual} मानकर चलेंगे।",
  "drop.unknown": "हम पहचान नहीं पाए कि {name} किस तरह की फ़ाइल है।",

  "file.kind.pdf": "PDF दस्तावेज़",
  "file.kind.image": "तस्वीर",
  "file.kind.heic": "आईफ़ोन फ़ोटो (HEIC)",
  "file.kind.zip": "ज़िप संग्रह",
  "file.kind.text": "टेक्स्ट",
  "file.kind.csv": "CSV स्प्रेडशीट",
  "file.kind.json": "JSON डेटा",
  "file.kind.sheet": "एक्सेल स्प्रेडशीट",
  "file.kind.audio": "ऑडियो",
  "file.kind.video": "वीडियो",
  "file.kind.unknown": "अपरिचित फ़ाइल",
  "file.remove": "{name} हटाएँ",
  "file.size": "{size}",

  "tray.title": "परिणाम",
  "tray.empty": "तैयार फ़ाइलें यहाँ दिखेंगी।",
  "tray.count": "{n} फ़ाइल तैयार",
  "tray.count.plural": "{n} फ़ाइलें तैयार",
  "tray.downloadAll": "सब कुछ ज़िप में डाउनलोड करें",
  "tray.download": "{name} डाउनलोड करें",
  "tray.sendTo": "दूसरे उपकरण में भेजें",
  "tray.clear": "परिणाम हटाएँ",
  "tray.open": "परिणाम खोलें",
  "tray.collapse": "परिणाम समेटें",

  "palette.open": "कमांड पैलेट खोलें",
  "palette.placeholder": "उपकरण और सेटिंग्स खोजें…",
  "palette.empty": "“{q}” से कुछ मेल नहीं खाता।",
  "palette.hint.move": "चुनें",
  "palette.hint.choose": "खोलें",
  "palette.hint.close": "बंद करें",
  "palette.group.tools": "उपकरण",
  "palette.group.pages": "पेज",
  "palette.group.actions": "क्रियाएँ",

  "action.clearEverything": "सब कुछ अभी हटाएँ",
  "action.clearEverything.confirm":
    "इससे अभी लोड की गई हर फ़ाइल हट जाएगी और परिणाम खाली हो जाएँगे। आपकी सेटिंग्स और पिन किए उपकरण बने रहेंगे। यह वापस नहीं किया जा सकता।",
  "action.clearEverything.done": "लोड की गई हर चीज़ हटा दी गई है।",
  "action.cancel": "रद्द करें",
  "action.confirm": "हाँ, हटाएँ",
  "action.close": "बंद करें",
  "action.copy": "कॉपी करें",
  "action.copied": "कॉपी हो गया।",
  "action.copyFailed": "ब्राउज़र ने कॉपी करने नहीं दिया। टेक्स्ट चुनकर स्वयं कॉपी करें।",
  "action.install": "इंस्टॉल करें",
  "action.retry": "फिर कोशिश करें",

  "status.offlineReady": "बिना इंटरनेट काम करने के लिए तैयार। ज़रूरी सब कुछ इस डिवाइस पर है।",
  "status.offline": "आप ऑफ़लाइन हैं। यहाँ सब कुछ फिर भी काम करता है।",
  "status.installing": "यह साइट आपके डिवाइस पर सहेजी जा रही है ताकि बिना इंटरनेट चले…",
  "status.installFailed":
    "यह साइट ऑफ़लाइन उपयोग के लिए सहेजी नहीं जा सकी: {reason} ऑनलाइन रहते हुए यह फिर भी काम करेगी।",
  "status.updateReady": "ऑन डिवाइस का नया संस्करण सहेजा जा चुका है। उपयोग के लिए पेज दोबारा लोड करें।",
  "status.reload": "दोबारा लोड करें",

  "error.title": "कुछ गड़बड़ हो गई",
  "error.storage":
    "यह ब्राउज़र इस साइट को इस डिवाइस पर कुछ भी याद रखने नहीं देगा। टैब बंद करते ही सेटिंग्स और पिन किए उपकरण मिट जाएँगे। आमतौर पर इसका कारण निजी विंडो होती है, या ब्राउज़र सेटिंग्स में स्टोरेज बंद होना।",
  "error.noFileApi":
    "यह ब्राउज़र फ़ाइलें सुरक्षित रूप से पढ़ने के लिए बहुत पुराना है। कृपया Chrome, Edge, Firefox या Safari का नया संस्करण उपयोग करें।",
  "error.readFailed": "{name} पढ़ी नहीं जा सकी: {reason}",
  "error.unknown": "एक अनपेक्षित समस्या हुई: {reason}",

  "settings.title": "सेटिंग्स",
  "settings.lede":
    "यहाँ सब कुछ केवल इसी डिवाइस पर सहेजा जाता है, और एक फ़ाइल में निर्यात करके दूसरे डिवाइस पर ले जाया जा सकता है।",
  "settings.group.appearance": "रूप-रंग",
  "settings.group.layout": "ख़ाका",
  "settings.group.behaviour": "व्यवहार और डिफ़ॉल्ट",
  "settings.group.shortcuts": "कीबोर्ड",
  "settings.group.language": "भाषा",
  "settings.group.data": "इस डिवाइस पर आपका डेटा",

  "settings.theme": "थीम",
  "settings.theme.hint": "“सिस्टम के अनुसार” दिन में पेपर और रात के मोड में मिडनाइट उपयोग करता है।",
  "settings.theme.system": "सिस्टम के अनुसार",
  "settings.theme.paper": "पेपर",
  "settings.theme.midnight": "मिडनाइट",
  "settings.theme.contrast": "उच्च कंट्रास्ट",
  "settings.theme.sepia": "सीपिया",
  "settings.theme.terminal": "टर्मिनल",

  "settings.accent": "मुख्य रंग",
  "settings.accent.hint": "लिंक, बटन और हाइलाइट के लिए उपयोग होता है।",
  "settings.accent.default": "थीम का अपना रंग",
  "settings.accent.custom": "अपना रंग",

  "settings.density": "घनत्व",
  "settings.density.comfortable": "आरामदायक",
  "settings.density.compact": "सघन",

  "settings.textScale": "अक्षरों का आकार",
  "settings.textScale.hint": "अभी सामान्य आकार का {pct}%।",

  "settings.font": "फ़ॉन्ट",
  "settings.font.ui": "आपके सिस्टम का फ़ॉन्ट",
  "settings.font.legible": "अधिक सुपाठ्य फ़ॉन्ट",
  "settings.font.mono": "मोनोस्पेस",
  "settings.font.hint":
    "अधिक सुपाठ्य विकल्प डिस्लेक्सिया-अनुकूल फ़ॉन्ट उपयोग करता है यदि वह इस डिवाइस पर मौजूद हो, वरना एक बहुत स्पष्ट विकल्प। साथ में आने वाला फ़ॉन्ट आगे के चरण में जुड़ेगा।",

  "settings.corners": "कोने",
  "settings.corners.rounded": "गोल",
  "settings.corners.square": "चौकोर",

  "settings.motion": "एनिमेशन",
  "settings.motion.system": "सिस्टम सेटिंग के अनुसार",
  "settings.motion.reduced": "एनिमेशन कम करें",
  "settings.motion.full": "पूरा एनिमेशन",

  "settings.view": "डिफ़ॉल्ट दृश्य",
  "settings.view.grid": "ग्रिड",
  "settings.view.list": "सूची",

  "settings.homeOpensTo": "होमपेज खुलता है",
  "settings.homeOpensTo.all": "सभी उपकरणों पर",
  "settings.homeOpensTo.favourites": "केवल पिन किए उपकरणों पर",

  "settings.autoDownload": "परिणाम अपने आप डाउनलोड करें",
  "settings.autoDownload.hint": "बंद रहने पर तैयार फ़ाइलें परिणाम ट्रे में रुकी रहती हैं।",
  "settings.keepHistory": "क्या-क्या संसाधित हुआ, इसका स्थानीय इतिहास रखें",
  "settings.keepHistory.hint": "डिफ़ॉल्ट रूप से बंद। केवल इसी डिवाइस पर, कहीं नहीं भेजा जाता।",
  "settings.autoClearOnClose": "टैब बंद होने पर लोड की गई फ़ाइलें हटाएँ",
  "settings.confirmDestructive": "कोई भी अपरिवर्तनीय काम करने से पहले पूछें",

  "settings.imageQuality": "डिफ़ॉल्ट चित्र गुणवत्ता",
  "settings.imageFormat": "डिफ़ॉल्ट चित्र फ़ॉर्मेट",
  "settings.imageFormat.keep": "मूल फ़ॉर्मेट बनाए रखें",
  "settings.pageSize": "डिफ़ॉल्ट पृष्ठ आकार",
  "settings.dpi": "डिफ़ॉल्ट रिज़ॉल्यूशन",
  "settings.units": "इकाइयाँ",
  "settings.filenamePattern": "आउटपुट फ़ाइल-नाम का ढाँचा",
  "settings.filenamePattern.hint":
    "उपलब्ध हिस्से: {name} मूल नाम, {tool} उपयोग किया गया उपकरण, {date} आज की तारीख़, {n} एक संख्या, {ext} फ़ाइल एक्सटेंशन।",

  "settings.language": "भाषा",
  "settings.language.hint": "जो पंक्तियाँ अनुवादित नहीं हैं, वे अंग्रेज़ी में दिखेंगी।",

  "settings.export": "सेटिंग्स एक फ़ाइल में निर्यात करें",
  "settings.import": "फ़ाइल से सेटिंग्स आयात करें",
  "settings.imported": "सेटिंग्स आयात हो गईं।",
  "settings.reset": "सब कुछ रीसेट करें",
  "settings.reset.confirm":
    "इससे हर सेटिंग, हर पिन किया उपकरण, और इस साइट द्वारा इस डिवाइस पर रखी गई हर चीज़ मिट जाएगी। यह वापस नहीं किया जा सकता।",
  "settings.reset.done": "{n} संग्रहीत वस्तुएँ हटाई गईं। सब कुछ अपने डिफ़ॉल्ट पर लौट आया है।",
  "settings.storageUsed": "यह साइट इस डिवाइस पर लगभग {size} जगह ले रही है।",
  "settings.storageUnknown": "यह ब्राउज़र नहीं बताएगा कि कितनी जगह उपयोग में है।",

  "trust.title": "यह कैसे काम करता है, और आप कैसे जाँच सकते हैं",
  "trust.monitor.title": "सजीव नेटवर्क निगरानी",
  "trust.stat.external": "कहीं और भेजे गए अनुरोध",
  "trust.stat.own": "इसी साइट की अपनी फ़ाइलों के अनुरोध",
  "trust.stat.blocked": "रोके गए प्रयास",
  "trust.stat.since": "जब से आपने यह पेज खोला, तब से निगरानी",
  "trust.log.title": "इस पेज ने अब तक जो कुछ लोड किया",
  "trust.log.url": "पता",
  "trust.log.type": "प्रकार",
  "trust.log.size": "आकार",
  "trust.log.where": "कहाँ से",
  "trust.log.own": "इसी साइट से",
  "trust.log.external": "कहीं और से",
  "trust.log.empty": "अभी कुछ दर्ज नहीं हुआ।",
  "trust.test.button": "दूसरी साइट से संपर्क करके देखें",
  "trust.test.explain":
    "यह जानबूझकर example.com से संपर्क करने की कोशिश करता है ताकि आप उसे रुकते हुए देख सकें।",
  "trust.test.blocked":
    "जैसा होना चाहिए, वैसा ही - रोक दिया गया। कुछ भी भेजे जाने से पहले ब्राउज़र ने रोक दिया। संदेश: {message}",
  "trust.test.allowed":
    "अनुरोध रोका नहीं गया। यह एक बग है और इस पेज का वादा पूरा नहीं हो रहा। कृपया इसकी सूचना दें।",

  "install.title": "ऑन डिवाइस इंस्टॉल करें",
  "install.body":
    "इंस्टॉल करने पर यह इंटरनेट बंद होने पर भी चलता है, इस मशीन के किसी भी दूसरे प्रोग्राम की तरह।",
  "install.button": "इंस्टॉल करें",
  "install.later": "अभी नहीं",
  "install.done": "इंस्टॉल हो गया। अब यह ऑफ़लाइन भी चलता है।",
  "install.unsupported":
    "यह ब्राउज़र इंस्टॉल करने की सुविधा नहीं देता। एक बार देखने के बाद साइट फिर भी ऑफ़लाइन चलती है।",

  "tool.pdf-merge.name": "PDF जोड़ें",
  "tool.pdf-merge.desc": "कई PDF और तस्वीरें अपनी मनचाही क्रम में एक फ़ाइल में मिलाएँ।",
  "tool.pdf-merge.keys": "जोड़ना मिलाना एक फ़ाइल merge combine",

  "tool.pdf-split.name": "पन्ने अलग करें",
  "tool.pdf-split.desc": "एक पन्ना, एक श्रेणी, या पूरी PDF को अलग-अलग फ़ाइलों में बाँटें।",
  "tool.pdf-split.keys": "बाँटना अलग निकालना पन्ना split extract",

  "tool.pdf-organise.name": "पन्ने व्यवस्थित करें",
  "tool.pdf-organise.desc": "पन्ने खींचकर हटाएँ, दोहराएँ, क्रम बदलें और घुमाएँ।",
  "tool.pdf-organise.keys": "क्रम बदलना हटाना घुमाना organise reorder",

  "tool.pdf-compress.name": "PDF छोटी करें",
  "tool.pdf-compress.desc": "PDF का आकार घटाएँ, और साथ-साथ देखें कि क्या खोया।",
  "tool.pdf-compress.keys": "छोटा आकार कम ईमेल compress shrink",

  "tool.pdf-to-images.name": "PDF से तस्वीरें",
  "tool.pdf-to-images.desc": "हर पन्ना अपनी चुनी हुई गुणवत्ता में PNG या JPG के रूप में सहेजें।",
  "tool.pdf-to-images.keys": "png jpg तस्वीर निर्यात pages",

  "tool.images-to-pdf.name": "तस्वीरों से PDF",
  "tool.images-to-pdf.desc": "फ़ोटो या स्कैन को मनचाहे पृष्ठ आकार की एक PDF में बदलें।",
  "tool.images-to-pdf.keys": "फ़ोटो स्कैन दस्तावेज़ a4 letter",

  "tool.pdf-rotate-crop.name": "पन्ने घुमाएँ और काटें",
  "tool.pdf-rotate-crop.desc": "पन्ने सीधे करें, किनारे काटें, टेढ़ा स्कैन ठीक करें।",
  "tool.pdf-rotate-crop.keys": "घुमाना काटना सीधा rotate crop",

  "tool.pdf-page-numbers.name": "पृष्ठ संख्या और शीर्षक",
  "tool.pdf-page-numbers.desc": "पृष्ठ संख्या, हेडर या फ़ुटर जोड़ें, और पहला पन्ना छोड़ें।",
  "tool.pdf-page-numbers.keys": "संख्या हेडर फ़ुटर numbering",

  "tool.pdf-watermark.name": "PDF पर वॉटरमार्क",
  "tool.pdf-watermark.desc": "पन्नों पर टेक्स्ट या लोगो लगाएँ, पारदर्शिता और दोहराव के साथ।",
  "tool.pdf-watermark.keys": "मोहर लोगो गोपनीय watermark",

  "tool.pdf-fill-sign.name": "भरें और हस्ताक्षर करें",
  "tool.pdf-fill-sign.desc": "फ़ॉर्म भरें, टिक लगाएँ, तारीख़ डालें, और हस्ताक्षर बनाएँ।",
  "tool.pdf-fill-sign.keys": "हस्ताक्षर फ़ॉर्म भरना signature",

  "tool.pdf-redact.name": "सचमुच मिटाएँ",
  "tool.pdf-redact.heading": "रेडैक्ट — सचमुच",
  "tool.pdf-redact.desc": "टेक्स्ट काला करें और उसे सचमुच नष्ट करें, केवल ढकें नहीं।",
  "tool.pdf-redact.keys": "काला छिपाना गोपनीय redact",

  "tool.pdf-metadata.name": "PDF मेटाडेटा",
  "tool.pdf-metadata.desc": "छिपा हुआ शीर्षक, लेखक, सॉफ़्टवेयर और तारीख़ें देखें और बदलें।",
  "tool.pdf-metadata.keys": "लेखक शीर्षक छिपा जानकारी metadata",

  "tool.pdf-password-add.name": "PDF पर पासवर्ड लगाएँ",
  "tool.pdf-password-add.desc": "भेजने से पहले PDF को पासवर्ड से सुरक्षित करें।",
  "tool.pdf-password-add.keys": "पासवर्ड ताला सुरक्षा encrypt",

  "tool.pdf-password-remove.name": "PDF का पासवर्ड हटाएँ",
  "tool.pdf-password-remove.desc": "अपनी PDF का पासवर्ड, जो आपके पास पहले से है, उससे हटाएँ।",
  "tool.pdf-password-remove.keys": "पासवर्ड हटाना खोलना decrypt",

  "tool.pdf-extract-text.name": "टेक्स्ट निकालें",
  "tool.pdf-extract-text.desc": "PDF से शब्द निकालें और सहेजें या कॉपी करें।",
  "tool.pdf-extract-text.keys": "टेक्स्ट शब्द कॉपी txt",

  "tool.pdf-ocr.name": "स्कैन किया दस्तावेज़ पढ़ें",
  "tool.pdf-ocr.desc": "स्कैन या फ़ोटो को खोजने और कॉपी करने योग्य बनाएँ, ऑफ़लाइन।",
  "tool.pdf-ocr.keys": "ocr स्कैन पहचान searchable",

  "tool.pdf-nup.name": "एक शीट पर कई पन्ने",
  "tool.pdf-nup.heading": "एक शीट पर कई पृष्ठ",
  "tool.pdf-nup.desc": "दो या चार पन्ने प्रति शीट, बुकलेट क्रम, या एक पन्ना कई शीटों पर।",
  "tool.pdf-nup.keys": "बुकलेट पोस्टर प्रिंट n-up",

  "tool.pdf-flatten.name": "PDF समतल करें",
  "tool.pdf-flatten.desc": "फ़ॉर्म और टिप्पणियाँ पक्की कर दें ताकि कुछ बदला न जा सके।",
  "tool.pdf-flatten.keys": "फ़ॉर्म पक्का अंतिम flatten",

  "tool.image-resize.name": "तस्वीरों का आकार बदलें",
  "tool.image-resize.desc": "पिक्सेल, प्रतिशत या सबसे लंबी भुजा से - एक या सौ तस्वीरें।",
  "tool.image-resize.keys": "छोटा बड़ा आकार पिक्सेल resize",

  "tool.image-convert.name": "तस्वीर का फ़ॉर्मेट बदलें",
  "tool.image-convert.desc": "JPG, PNG, WebP आदि के बीच - और आईफ़ोन के HEIC से बाहर।",
  "tool.image-convert.keys": "heic आईफ़ोन jpg png webp फ़ॉर्मेट",

  "tool.image-compress.name": "तस्वीरें छोटी करें",
  "tool.image-compress.desc": "छोटी फ़ाइलें, और पहले-बाद की बड़ी करके तुलना।",
  "tool.image-compress.keys": "छोटा गुणवत्ता आकार compress",

  "tool.image-crop.name": "तस्वीर काटें",
  "tool.image-crop.desc": "मनचाहा, तय अनुपात, या पासपोर्ट और वीज़ा फ़ोटो के सही माप।",
  "tool.image-crop.keys": "काटना पासपोर्ट वीज़ा फ़ोटो crop",

  "tool.image-rotate.name": "घुमाएँ और पलटें",
  "tool.image-rotate.desc": "तस्वीर घुमाएँ, दर्पण करें और सीधा करें।",
  "tool.image-rotate.keys": "घुमाना पलटना सीधा rotate flip",

  "tool.image-metadata.name": "फ़ोटो मेटाडेटा और लोकेशन",
  "tool.image-metadata.heading": "आपकी तस्वीर क्या छिपा रही है",
  "tool.image-metadata.desc": "देखें फ़ोटो क्या बताती है - कहाँ खींची गई सहित - और मिटाएँ।",
  "tool.image-metadata.keys": "exif gps लोकेशन निजता कैमरा",

  "tool.image-blur.name": "धुँधला या पिक्सेल करें",
  "tool.image-blur.desc": "चेहरा, नंबर प्लेट या पता हमेशा के लिए छिपाएँ।",
  "tool.image-blur.keys": "धुँधला चेहरा छिपाना blur pixelate",

  "tool.image-watermark.name": "तस्वीर पर वॉटरमार्क",
  "tool.image-watermark.desc": "टेक्स्ट या लोगो किसी भी पारदर्शिता और जगह पर, कई तस्वीरों में।",
  "tool.image-watermark.keys": "लोगो मोहर कॉपीराइट watermark",

  "tool.image-combine.name": "तस्वीरें मिलाएँ",
  "tool.image-combine.desc": "तस्वीरों को एक शीट, ग्रिड या लंबी पट्टी में जोड़ें।",
  "tool.image-combine.keys": "जोड़ना ग्रिड कोलाज combine",

  "tool.icon-generator.name": "आइकन और फ़ेविकॉन बनाएँ",
  "tool.icon-generator.desc": "एक चौकोर तस्वीर दें, हर ज़रूरी आकार पाएँ।",
  "tool.icon-generator.keys": "favicon आइकन आकार manifest",

  "tool.colour-palette.name": "रंग चुनें और पैलेट बनाएँ",
  "tool.colour-palette.desc": "तस्वीर के मुख्य रंग निकालें, कॉपी करने योग्य कोड के साथ।",
  "tool.colour-palette.keys": "रंग hex पैलेट colour",

  "tool.screenshot-polish.name": "स्क्रीनशॉट सँवारें",
  "tool.screenshot-polish.desc": "हाशिया, गोल कोने, छाया और साफ़ पृष्ठभूमि।",
  "tool.screenshot-polish.keys": "स्क्रीनशॉट छाया पृष्ठभूमि",

  "tool.qr-generate.name": "QR कोड बनाएँ",
  "tool.qr-generate.desc": "लिंक, वाईफ़ाई, संपर्क कार्ड, ईमेल या सादे टेक्स्ट के लिए।",
  "tool.qr-generate.keys": "qr वाईफ़ाई लिंक संपर्क बारकोड",

  "tool.qr-read.name": "QR कोड पढ़ें",
  "tool.qr-read.desc": "कोई कदम उठाने से पहले देखें कि कोड में क्या लिखा है।",
  "tool.qr-read.keys": "स्कैन qr कोड पढ़ना लिंक",

  "tool.text-workbench.name": "टेक्स्ट कार्यशाला",
  "tool.text-workbench.desc": "अक्षर का रूप, खाली जगह, खोज-बदल, क्रम, दोहराव हटाना, गिनती।",
  "tool.text-workbench.keys": "टेक्स्ट क्रम गिनती बदलना दोहराव",

  "tool.spreadsheet.name": "CSV, JSON और एक्सेल",
  "tool.spreadsheet.desc": "स्प्रेडशीट खोलें, फ़ॉर्मेट बदलें, टूटी हुई ठीक करें।",
  "tool.spreadsheet.keys": "csv excel xlsx json तालिका",

  "tool.markdown.name": "मार्कडाउन पूर्वावलोकन",
  "tool.markdown.desc": "मार्कडाउन लिखें, तुरंत देखें, साफ़ PDF या वेब पेज बनाएँ।",
  "tool.markdown.keys": "md पूर्वावलोकन html readme",

  "tool.zip.name": "ज़िप बनाएँ और खोलें",
  "tool.zip.desc": "फ़ाइलों को ज़िप में बाँधें, या कोई ज़िप खोलें।",
  "tool.zip.keys": "ज़िप संग्रह खोलना zip",

  "tool.checksum.name": "फ़ाइल का चेकसम",
  "tool.checksum.desc": "SHA-256, SHA-1 या MD5, यह जाँचने के लिए कि डाउनलोड असली है।",
  "tool.checksum.keys": "hash sha256 md5 जाँच",

  "tool.file-lock.name": "फ़ाइल पर पासवर्ड लगाएँ",
  "tool.file-lock.desc": "कुछ भी सुरक्षित करें ताकि ईमेल किया जा सके - और यहीं खोलें।",
  "tool.file-lock.keys": "पासवर्ड सुरक्षा encrypt aes",

  "tool.file-compare.name": "दो फ़ाइलों की तुलना",
  "tool.file-compare.desc": "बताएँ कि दो फ़ाइलें बाइट-दर-बाइट एक जैसी हैं या नहीं।",
  "tool.file-compare.keys": "तुलना समान diff",

  "tool.media-toolkit.name": "वीडियो और ऑडियो",
  "tool.media-toolkit.desc": "काटें, आवाज़ हटाएँ, बदलें, छोटा करें, या GIF बनाएँ। बड़ा एकबारगी डाउनलोड।",
  "tool.media-toolkit.keys": "mp4 mp3 काटना gif ऑडियो",

  "tool.background-remover.name": "पृष्ठभूमि हटाएँ",
  "tool.background-remover.desc": "रंग के आधार पर विषय को अलग करें और पारदर्शी पृष्ठभूमि के साथ सहेजें।",
  "tool.background-remover.keys": "पृष्ठभूमि पारदर्शी काटना png लोगो",

  /* ---- Recipes ------------------------------------------ */
  "recipes.title": "रेसिपी",
  "recipes.lede":
    "चरणों की एक शृंखला एक बार सहेजें। फिर पूरा फ़ोल्डर उस पर डालें और हर तैयार फ़ाइल एक ही बार में वापस पाएँ।",
  "recipes.saved": "आपकी रेसिपी",
  "recipes.new": "नई रेसिपी",
  "recipes.import": "आयात करें",
  "recipes.exportAll": "सब निर्यात करें",
  "recipes.editor": "रेसिपी",
  "recipes.save": "सहेजें",
  "recipes.close": "बंद करें",
  "recipes.name": "नाम",
  "recipes.note": "अपने लिए टिप्पणी",
  "recipes.addStep": "एक चरण जोड़ें",
  "recipes.files": "जिन फ़ाइलों पर चलाना है",
  "recipes.run": "चलाएँ",
  "recipes.runNow": "रेसिपी चलाएँ",
  "recipes.stop": "रोकें",
  "recipes.trayHint": "तैयार फ़ाइलें स्क्रीन के नीचे परिणाम ट्रे में आती हैं।",
  "recipes.passwordNote.title": "पासवर्ड कभी नहीं सहेजे जाते",
  "recipes.passwordNote.body":
    "जिस चरण को पासवर्ड चाहिए, वह हर बार चलाने पर पूछता है। पासवर्ड न इस डिवाइस पर लिखा जाता है और न निर्यात की गई रेसिपी फ़ाइल में, इसलिए किसी को भेजी गई रेसिपी उसे साथ नहीं ले जा सकती।",
  "recipes.cannot": "जो उपकरण चरण नहीं बन सकते, और क्यों",
  "recipes.cannot.lede":
    "रेसिपी उन फ़ाइलों पर दोहराई जाती है जिन्हें उसने पहले कभी नहीं देखा। जिस काम में किसी ख़ास फ़ाइल को देखकर निर्णय लेना पड़ता है, वह दोहराया नहीं जा सकता।",

  /* ---- The main pages ----------------------------------- */
  "page.home.title": "रोज़मर्रा के फ़ाइल उपकरण, जो कभी कुछ अपलोड नहीं करते",
  "page.home.lede": "PDF, तस्वीरें, QR कोड, रूपांतरण। इनमें से हर एक इसी ब्राउज़र टैब में, इसी मशीन पर चलता है। आपकी फ़ाइलें कहीं नहीं भेजी जातीं, क्योंकि भेजने के लिए कोई जगह ही नहीं — इस साइट के पीछे कोई सर्वर नहीं है।",
  "page.home.checkLink": "खुद जाँचने का तरीका देखें।",
  "page.trust.title": "यह कैसे काम करता है, और जाँच कैसे करें",
  "page.trust.lede": "फ़ाइलों को संभालने वाली हर साइट कहती है कि वह आपकी निजता का सम्मान करती है। कहने में कुछ नहीं जाता। यह पृष्ठ इसलिए है कि आपको हमारी बात पर भरोसा न करना पड़े।",
  "page.help.title": "सहायता",
  "page.help.lede": "सीधे जवाब, बिना भारी शब्दों के। यहाँ कुछ गलत या अस्पष्ट हो तो वह जानने योग्य है।",
  "page.privacy.title": "निजता",
  "page.privacy.lede": "छोटा उत्तर: हम कुछ भी इकट्ठा नहीं करते। कोई “हम” है ही नहीं। कोई सर्वर नहीं है।",
  "page.credits.title": "श्रेय और लाइसेंस",
  "page.credits.lede": "यह साइट जो कुछ भी इस्तेमाल करती है वह साइट के भीतर रखा गया है और उसी पते से आता है। किसी और के सर्वर से कुछ नहीं मंगाया जाता — यही कारण है कि यह ऑफ़लाइन भी चलती है।",
  "page.roadmap.title": "क्या बन चुका है, और क्या नहीं",
  "page.roadmap.lede": "यह साइट एक-एक चरण करके बनाई जा रही है। कोई भी चीज़ काम करने से पहले मुखपृष्ठ पर काम करने का दिखावा नहीं करती।",

  "unit.bytes": "{n} B",
  "unit.kb": "{n} KB",
  "unit.mb": "{n} MB",
  "unit.gb": "{n} GB",
  "unit.ms": "{n} ms"
};
