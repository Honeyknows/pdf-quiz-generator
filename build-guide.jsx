import { useState } from "react";

/* ═══════════════════════════════════════════════════════════
   ALL CODE BLOCKS — defined as constants so you can copy them
   ═══════════════════════════════════════════════════════════ */

const CODE = {
  nodeCheck: `node --version\nnpm --version`,

  mkdir: `mkdir pdf-quiz-generator\ncd pdf-quiz-generator`,

  cli: `npm install -g firebase-tools`,

  login: `firebase login`,

  init: `firebase init\n\n# Arrow keys to move, Space to select, Enter to confirm:\n#\n# ✔ Hosting: Configure files for Firebase Hosting\n# ✔ Functions: Configure a Cloud Functions source directory\n# Press Enter\n\n# ? Which project do you want to use?\n#   → Select your project from the list\n\n# ─── Hosting questions ───\n# ? What folder should contain your public files?\n#   → public          (just press Enter, it's the default)\n# ? Configure as a single-page app?\n#   → Yes\n# ? Set up automatic builds and deploys with GitHub?\n#   → No\n\n# ─── Functions questions ───\n# ? What language would you like to use?\n#   → JavaScript\n# ? Do you want to use ESLint?\n#   → No\n# ? File functions/package.json already exists. Overwrite?\n#   → Yes\n# ? File functions/index.js already exists. Overwrite?\n#   → Yes`,

  firebaseJson: `{\n  "functions": [\n    {\n      "source": "functions",\n      "corepack": false\n    }\n  ],\n  "hosting": {\n    "public": "public",\n    "ignore": [\n      "firebase.json",\n      "**/.*",\n      "**/node_modules/**"\n    ],\n    "rewrites": [\n      {\n        "source": "/generateQuiz",\n        "function": "generateQuiz"\n      },\n      {\n        "source": "**",\n        "destination": "/index.html"\n      }\n    ]\n  }\n}`,

  pkgJson: `{\n  "name": "pdf-quiz-functions",\n  "dependencies": {\n    "firebase-functions": "^6.0.0",\n    "@google/generative-ai": "^0.12.0",\n    "pdf-parse": "^1.1.22"\n  },\n  "engines": {\n    "node": "18"\n  }\n}`,

  dotenv: `GEMINI_API_KEY=paste_your_gemini_key_here`,

  gitignore: `node_modules/\nfunctions/.env`,

  installDeps: `cd functions\nnpm install\n\n# Downloads pdf-parse, Gemini SDK, firebase-functions\n# Takes about 30–60 seconds…`,

  serve: `firebase serve\n\n# Wait for this message:\n#   ✔ Hosting: Server running at http://localhost:5000\n\n# Then open http://localhost:5000 in your browser`,

  deploy: `firebase deploy\n\n# Firebase uploads everything to Google's servers.\n# Wait for:  ✔ Deploy complete!\n#\n# Your live app URL will be shown:\n#   Hosting URL: https://your-project-name.web.app\n#\n# 🎉 Share that URL with anyone!`
};

/* ─── index.js (Cloud Function backend) ─── */
CODE.indexJs = [
  'const { onRequest } = require("firebase-functions/v2/https");',
  'const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");',
  'const pdfParse = require("pdf-parse");',
  '',
  '// ── Reads your API key from functions/.env automatically ──',
  'const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);',
  '',
  '// ── Quiz output schema ──',
  '// This FORCES Gemini to return valid JSON in this exact shape.',
  '// The AI literally cannot deviate — no more parsing crashes.',
  'const quizSchema = {',
  '  type: SchemaType.ARRAY,',
  '  items: {',
  '    type: SchemaType.OBJECT,',
  '    properties: {',
  '      question:       { type: SchemaType.STRING },',
  '      options:        { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },',
  '      correct_answer: { type: SchemaType.STRING }',
  '    },',
  '    required: ["question", "options", "correct_answer"]',
  '  }',
  '};',
  '',
  '// ── Main Cloud Function ──',
  'exports.generateQuiz = onRequest(',
  '  { cors: true, memory: "512MiB", timeoutSeconds: 60 },',
  '  async (req, res) => {',
  '',
  '    if (req.method !== "POST") {',
  '      return res.status(405).json({ error: "Only POST requests allowed" });',
  '    }',
  '',
  '    try {',
  '      const { pdfBase64, numQuestions = 5 } = req.body;',
  '',
  '      if (!pdfBase64) {',
  '        return res.status(400).json({ error: "No PDF data received" });',
  '      }',
  '',
  '      // 1️⃣  Extract text from the uploaded PDF',
  '      const pdfBuffer = Buffer.from(pdfBase64, "base64");',
  '      const pdfData   = await pdfParse(pdfBuffer);',
  '      const text      = pdfData.text;',
  '',
  '      if (text.trim().length < 50) {',
  '        return res.status(400).json({',
  '          error: "PDF has no readable text. It may be image-based — try an OCR tool first."',
  '        });',
  '      }',
  '',
  '      // 2️⃣  Call Gemini AI — JSON output is guaranteed by the schema',
  '      const model = genAI.getGenerativeModel({',
  '        model: "gemini-2.0-flash",',
  '        generationConfig: {',
  '          responseMimeType: "application/json",',
  '          responseSchema: quizSchema',
  '        }',
  '      });',
  '',
  '      const prompt =',
  '        "Generate exactly " + numQuestions + " multiple-choice quiz questions.\\n" +',
  '        "Rules:\\n" +',
  '        "- Each question must have exactly 4 options\\n" +',
  '        "- correct_answer must exactly match one of the 4 options\\n" +',
  '        "- Test understanding, not just memorization\\n" +',
  '        "- Make wrong options plausible but clearly wrong\\n\\n" +',
  '        "TEXT:\\n" + text;',
  '',
  '      const result    = await model.generateContent(prompt);',
  '      const questions = JSON.parse(result.response.text());',
  '',
  '      // 3️⃣  Send questions back to the frontend',
  '      return res.status(200).json({',
  '        success:    true,',
  '        questions:  questions,',
  '        totalPages: pdfData.numpages,',
  '        textLength: text.length',
  '      });',
  '',
  '    } catch (err) {',
  '      console.error("Quiz generation error:", err);',
  '      return res.status(500).json({ error: err.message });',
  '    }',
  '  }',
  ');'
].join('\n');

/* ─── index.html (Full frontend — single file, no build needed) ─── */
CODE.indexHtml = [
  '<!DOCTYPE html>',
  '<html lang="en">',
  '<head>',
  '  <meta charset="UTF-8">',
  '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
  '  <title>📘 PDF Quiz Generator</title>',
  '  <style>',
  '    * { margin: 0; padding: 0; box-sizing: border-box; }',
  '    body {',
  '      font-family: "Segoe UI", system-ui, sans-serif;',
  '      background: #0f172a; color: #e2e8f0;',
  '      min-height: 100vh; padding: 40px 16px;',
  '    }',
  '    .wrap  { max-width: 660px; margin: 0 auto; }',
  '    h1     { text-align: center; font-size: 26px; color: #f1f5f9; margin-bottom: 4px; }',
  '    .sub   { text-align: center; color: #64748b; font-size: 14px; margin-bottom: 28px; }',
  '',
  '    /* ── Upload Card ── */
',
  '    .card  { background: #1e293b; border-radius: 12px; padding: 24px; border: 1px solid #334155; }',
  '    .drop  { border: 2px dashed #334155; border-radius: 10px; padding: 36px 20px; text-align: center; cursor: pointer; transition: all 0.2s; }',
  '    .drop:hover, .drop.over { border-color: #38bdf8; background: #38bdf811; }',
  '    .drop input  { display: none; }',
  '    .drop-icon   { font-size: 38px; margin-bottom: 10px; }',
  '    .drop-txt    { color: #94a3b8; font-size: 14px; }',
  '    .drop-txt strong { color: #38bdf8; }',
  '    .ftag  { margin-top: 10px; padding: 7px 12px; background: #0f172a; border-radius: 6px; font-size: 13px; color: #7dd3fc; display: none; }',
  '',
  '    /* ── Controls ── */
',
  '    .row   { display: flex; gap: 12px; align-items: center; margin-top: 16px; }',
  '    .row label  { font-size: 13px; color: #94a3b8; }',
  '    .row select { background: #0f172a; color: #f1f5f9; border: 1px solid #334155; border-radius: 6px; padding: 6px 10px; font-size: 13px; }',
  '    .btn   { width: 100%; padding: 12px; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; margin-top: 16px; background: #38bdf8; color: #0f172a; transition: all 0.2s; }',
  '    .btn:hover    { background: #7dd3fc; }',
  '    .btn:disabled { background: #334155; color: #64748b; cursor: not-allowed; }',
  '',
  '    /* ── Status ── */
',
  '    .status { text-align: center; padding: 11px; border-radius: 8px; font-size: 13px; margin-top: 12px; display: none; }',
  '    .status.load { display: block; background: #1a3a5c; color: #7dd3fc; border: 1px solid #38bdf833; }',
  '    .status.err  { display: block; background: #3b1515; color: #f87171; border: 1px solid #ef444433; }',
  '    .status.ok   { display: block; background: #1a3b1a; color: #4ade80; border: 1px solid #22c55e33; }',
  '    .spin  { display: inline-block; width: 15px; height: 15px; border: 2px solid #38bdf855; border-top-color: #38bdf8; border-radius: 50%; animation: sp 0.6s linear infinite; margin-right: 6px; vertical-align: middle; }',
  '    @keyframes sp { to { transform: rotate(360deg); } }',
  '',
  '    /* ── Results ── */
',
  '    .results { margin-top: 20px; display: none; }',
  '    .stats   { display: flex; gap: 10px; margin-bottom: 16px; }',
  '    .stat    { flex: 1; background: #1e293b; border-radius: 8px; padding: 12px; text-align: center; border: 1px solid #334155; }',
  '    .sv      { font-size: 22px; font-weight: 700; color: #38bdf8; }',
  '    .sl      { font-size: 11px; color: #64748b; margin-top: 2px; }',
  '',
  '    /* ── Question Cards ── */
',
  '    .qc      { background: #1e293b; border-radius: 10px; padding: 18px; margin-bottom: 10px; border: 1px solid #334155; }',
  '    .qn      { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }',
  '    .qt      { font-size: 15px; font-weight: 600; color: #f1f5f9; margin-bottom: 12px; line-height: 1.5; }',
  '    .opt     { padding: 8px 12px; border-radius: 6px; font-size: 13px; color: #cbd5e1; margin-bottom: 6px; background: #0f172a; border: 1px solid #334155; transition: all 0.15s; }',
  '    .opt:hover { border-color: #38bdf855; }',
  '    .opt.yes { border-color: #22c55e; background: #22c55e11; color: #4ade80; }',
  '    .ans-btn { background: none; border: 1px solid #38bdf855; color: #38bdf8; padding: 4px 10px; border-radius: 5px; font-size: 11px; cursor: pointer; margin-top: 4px; }',
  '    .ans-btn:hover { background: #38bdf811; }',
  '    .rbtn    { background: #334155; color: #94a3b8; padding: 8px 16px; border: none; border-radius: 6px; font-size: 12px; cursor: pointer; margin-top: 10px; }',
  '    .rbtn:hover { background: #475569; color: #cbd5e1; }',
  '  </style>',
  '</head>',
  '<body>',
  '<div class="wrap">',
  '  <h1>📘 PDF Quiz Generator</h1>',
  '  <p class="sub">Upload a PDF · AI generates quiz questions instantly · Powered by Google Gemini</p>',
  '',
  '  <div class="card" id="uploadCard">',
  '    <div class="drop" id="drop">',
  '      <input type="file" id="fileInput" accept=".pdf">',
  '      <div class="drop-icon">📄</div>',
  '      <p class="drop-txt">Drag &amp; drop your PDF here<br>or click to <strong>browse</strong></p>',
  '    </div>',
  '    <div class="ftag" id="ftag"></div>',
  '    <div class="row">',
  '      <label>How many questions?</label>',
  '      <select id="numQ">',
  '        <option value="3">3 questions</option>',
  '        <option value="5" selected>5 questions</option>',
  '        <option value="10">10 questions</option>',
  '      </select>',
  '    </div>',
  '    <button class="btn" id="genBtn" disabled>🧠 Generate Quiz</button>',
  '    <div class="status" id="status"></div>',
  '  </div>',
  '',
  '  <div class="results" id="results">',
  '    <div class="stats" id="stats"></div>',
  '    <div id="questionList"></div>',
  '    <button class="rbtn" onclick="resetApp()">↩ Upload another PDF</button>',
  '  </div>',
  '</div>',
  '',
  '<script>',
  '  // ── Config ──',
  '  // Firebase Hosting rewrites /generateQuiz → your Cloud Function.',
  '  // No URL to change — it just works after deploy.',
  '  var FUNCTION_URL = "/generateQuiz";',
  '',
  '  // ── File upload ──',
  '  var drop      = document.getElementById("drop");',
  '  var fileInput = document.getElementById("fileInput");',
  '  var ftag      = document.getElementById("ftag");',
  '  var genBtn    = document.getElementById("genBtn");',
  '  var selectedFile = null;',
  '',
  '  drop.addEventListener("click", function() { fileInput.click(); });',
  '  drop.addEventListener("dragover", function(e) { e.preventDefault(); drop.classList.add("over"); });',
  '  drop.addEventListener("dragleave", function() { drop.classList.remove("over"); });',
  '  drop.addEventListener("drop", function(e) {',
  '    e.preventDefault(); drop.classList.remove("over");',
  '    var f = e.dataTransfer.files[0];',
  '    if (f && f.type === "application/pdf") selectFile(f);',
  '  });',
  '  fileInput.addEventListener("change", function(e) { selectFile(e.target.files[0]); });',
  '',
  '  function selectFile(f) {',
  '    selectedFile = f;',
  '    ftag.textContent = "📎 " + f.name + " (" + (f.size / 1024).toFixed(1) + " KB)";',
  '    ftag.style.display = "block";',
  '    genBtn.disabled = false;',
  '  }',
  '',
  '  // ── Generate quiz ──',
  '  genBtn.addEventListener("click", async function() {',
  '    setSt("load", "<span class=\'spin\'></span> Extracting text & generating quiz…");',
  '    genBtn.disabled = true;',
  '    try {',
  '      // Convert PDF → base64 string',
  '      var base64 = await new Promise(function(resolve, reject) {',
  '        var reader = new FileReader();',
  '        reader.onload  = function() { resolve(reader.result.split(",")[1]); };',
  '        reader.onerror = reject;',
  '        reader.readAsDataURL(selectedFile);',
  '      });',
  '',
  '      // POST to Cloud Function',
  '      var resp = await fetch(FUNCTION_URL, {',
  '        method: "POST",',
  '        headers: { "Content-Type": "application/json" },',
  '        body: JSON.stringify({',
  '          pdfBase64: base64,',
  '          numQuestions: parseInt(document.getElementById("numQ").value)',
  '        })',
  '      });',
  '      var data = await resp.json();',
  '      if (!resp.ok) throw new Error(data.error || "Something went wrong");',
  '      showResults(data);',
  '    } catch (e) {',
  '      setSt("err", "❌ " + e.message);',
  '    } finally {',
  '      genBtn.disabled = false;',
  '    }',
  '  });',
  '',
  '  // ── Display results ──',
  '  function showResults(data) {',
  '    document.getElementById("uploadCard").style.display = "none";',
  '    document.getElementById("results").style.display = "block";',
  '',
  '    document.getElementById("stats").innerHTML =',
  '      mkStat(data.questions.length, "Questions") +',
  '      mkStat(data.totalPages, "Pages Read") +',
  '      mkStat((data.textLength / 1000).toFixed(1) + "k", "Characters");',
  '',
  '    var html = "";',
  '    data.questions.forEach(function(q, i) {',
  '      html += \'<div class="qc">\';',
  '      html += \'<div class="qn">Question \' + (i + 1) + \'</div>\';',
  '      html += \'<div class="qt">\' + q.question + \'</div>\';',
  '      html += \'<div id="opts-\' + i + \'">\';',
  '      q.options.forEach(function(o) {',
  '        html += \'<div class="opt" data-ok="\' + (o === q.correct_answer) + \'">\' + o + \'</div>\';',
  '      });',
  '      html += \'</div>\';',
  '      html += \'<button class="ans-btn" onclick="togAns(\' + i + \')">👁 Show Answer</button>\';',
  '      html += \'</div>\';',
  '    });',
  '    document.getElementById("questionList").innerHTML = html;',
  '    setSt("ok", "🎉 Generated " + data.questions.length + " quiz questions!");',
  '  }',
  '',
  '  function mkStat(v, l) {',
  '    return \'<div class="stat"><div class="sv">\' + v + \'</div><div class="sl">\' + l + \'</div></div>\';',
  '  }',
  '',
  '  function togAns(i) {',
  '    document.querySelectorAll("#opts-" + i + " .opt").forEach(function(o) {',
  '      if (o.dataset.ok === "true") o.classList.toggle("yes");',
  '    });',
  '    var b = document.querySelectorAll(".ans-btn")[i];',
  '    b.textContent = b.textContent.includes("Show") ? "🙈 Hide Answer" : "👁 Show Answer";',
  '  }',
  '',
  '  function resetApp() {',
  '    document.getElementById("uploadCard").style.display = "block";',
  '    document.getElementById("results").style.display = "none";',
  '    selectedFile = null; fileInput.value = "";',
  '    ftag.style.display = "none"; genBtn.disabled = true;',
  '    setSt("", "");',
  '  }',
  '',
  '  function setSt(type, html) {',
  '    var el = document.getElementById("status");',
  '    el.className = "status" + (type ? " " + type : "");',
  '    el.innerHTML = html;',
  '  }',
  '</script>',
  '</body>',
  '</html>'
].join('\n');

/* ═══════════════════════════════════════════════════════════
   STEPS
   ═══════════════════════════════════════════════════════════ */
const steps = [
  {
    id: 1, phase: "Setup", title: "Install Node.js", time: "3 min",
    summary: "The engine that powers Firebase & your backend",
    blocks: [
      { t: "txt", v: "Node.js is the software your backend runs on. If you already have it, skip ahead — just verify first." },
      { t: "link", url: "https://nodejs.org", label: "nodejs.org", desc: 'Click the green "Download Node.js" button. Run the installer — keep all default settings and click Next/Install through.' },
      { t: "txt", v: "After installing, open your Terminal and verify it worked:" },
      { t: "code", label: "Terminal", code: CODE.nodeCheck },
      { t: "txt", v: "You should see version numbers like v20.x.x and 10.x.x. If you do — you're good!" },
      { t: "tip", v: "How to open Terminal: Mac → Cmd+Space → type \"Terminal\" → Enter.  Windows → press Windows key → type \"cmd\" → Enter." }
    ]
  },
  {
    id: 2, phase: "Setup", title: "Create Firebase Project", time: "2 min",
    summary: "Your free Google Cloud home base",
    blocks: [
      { t: "link", url: "https://console.firebase.google.com", label: "console.firebase.google.com", desc: "Open in your browser. Sign in with your Google account." },
      { t: "steps", items: [
        'Click "Create a project" (or the + icon at the top)',
        'Type a project name — e.g.: pdf-quiz-generator',
        'When asked about Google Analytics → click "No thanks"',
        'Click "Create project" — wait a few seconds',
        'Click "Continue" — you land on your project dashboard'
      ]},
      { t: "ok", v: "Project created! You'll see a dashboard with icons like Auth, Firestore, Hosting. This is your Google home base — everything connects here." }
    ]
  },
  {
    id: 3, phase: "Setup", title: "Get Free Gemini API Key", time: "2 min",
    summary: "Your AI brain — free, no credit card needed",
    blocks: [
      { t: "link", url: "https://ai.google.dev", label: "ai.google.dev", desc: "Open this in your browser." },
      { t: "steps", items: [
        'Click "Get API key" near the top of the page',
        "Sign in with your Google account if prompted",
        'Click "Create API key"',
        'Choose "Create API key in new project" (or pick your existing Firebase project)',
        'Your key appears — it starts with: AIzaSy…'
      ]},
      { t: "warn", v: "Copy this key NOW and save it in a text file on your Desktop. You'll paste it in Step 8. Never share it publicly — it's like a password." }
    ]
  },
  {
    id: 4, phase: "Build", title: "Create Folder & Login", time: "2 min",
    summary: "Set up your local project and connect to Firebase",
    blocks: [
      { t: "txt", v: "Open your Terminal. Create a new folder and step into it:" },
      { t: "code", label: "Terminal", code: CODE.mkdir },
      { t: "txt", v: "Install the Firebase command-line tool:" },
      { t: "code", label: "Terminal", code: CODE.cli },
      { t: "txt", v: "Log in to Firebase (opens a browser for Google Sign-In):" },
      { t: "code", label: "Terminal", code: CODE.login },
      { t: "tip", v: "Sign in with the same Google account you used for the Firebase project." }
    ]
  },
  {
    id: 5, phase: "Build", title: "Initialize Firebase", time: "2 min",
    summary: "Auto-generate your project structure",
    blocks: [
      { t: "txt", v: "Run firebase init. It's interactive — here's exactly what to pick at each prompt:" },
      { t: "code", label: "Terminal", code: CODE.init },
      { t: "txt", v: "When it finishes, your folder looks like this:" },
      { t: "tree", items: [
        { name: "pdf-quiz-generator/", d: 0, folder: true },
        { name: "public/", d: 1, folder: true },
        { name: "index.html", d: 2, folder: false },
        { name: "functions/", d: 1, folder: true },
        { name: "index.js", d: 2, folder: false },
        { name: "package.json", d: 2, folder: false },
        { name: "firebase.json", d: 1, folder: false },
        { name: ".firebaserc", d: 1, folder: false }
      ]},
      { t: "tip", v: "These files have default placeholder code. We'll replace them with our own in the next steps — don't worry about what's in them now." }
    ]
  },
  {
    id: 6, phase: "Build", title: "Update firebase.json", time: "1 min",
    summary: "Tell Firebase how to route URLs",
    blocks: [
      { t: "txt", v: "Open firebase.json in VS Code (or any text editor). Select ALL the text inside and delete it. Then paste this:" },
      { t: "code", label: "firebase.json", code: CODE.firebaseJson },
      { t: "txt", v: "Save with Ctrl+S (Windows) or Cmd+S (Mac)." },
      { t: "info", v: 'The "rewrites" section is the key piece. It tells Firebase: when someone visits /generateQuiz → send them to our Cloud Function. Everything else → serve the frontend HTML. This means no URL config needed in your code.' }
    ]
  },
  {
    id: 7, phase: "Build", title: "Write the Backend", time: "5 min",
    summary: "The brain — extracts PDF text & calls Gemini AI",
    blocks: [
      { t: "txt", v: "This is the main server code. It does 3 things: receives your PDF → extracts text → asks Gemini to make quiz questions." },
      { t: "txt", v: "First, open functions/package.json. Select all, delete, paste:" },
      { t: "code", label: "functions/package.json", code: CODE.pkgJson },
      { t: "txt", v: "Now open functions/index.js. Select all, delete, paste:" },
      { t: "code", label: "functions/index.js", code: CODE.indexJs },
      { t: "info", v: 'The "quizSchema" is the magic. It forces Gemini to return JSON in an exact structure — the AI literally cannot deviate. This is why this version never crashes on parsing, unlike your original code that just hoped the AI would return valid JSON.' }
    ]
  },
  {
    id: 8, phase: "Build", title: "Add Your Gemini API Key", time: "1 min",
    summary: "Securely store your key where the backend finds it",
    blocks: [
      { t: "txt", v: 'Create a new file. The path must be exactly:  functions/.env  (inside the functions folder, filename starts with a dot).' },
      { t: "code", label: "functions/.env", code: CODE.dotenv },
      { t: "txt", v: "Replace paste_your_gemini_key_here with your actual key from Step 3 (starts with AIzaSy…)." },
      { t: "warn", v: "This file must NEVER be shared or pushed to GitHub. It's a password file." },
      { t: "txt", v: "To protect it, create a .gitignore file in the project root (pdf-quiz-generator/) with:" },
      { t: "code", label: ".gitignore", code: CODE.gitignore },
      { t: "tip", v: "Firebase reads .env automatically when your Cloud Function runs. No extra setup needed." }
    ]
  },
  {
    id: 9, phase: "Build", title: "Write the Frontend", time: "2 min",
    summary: "The UI — upload PDF, see the quiz appear",
    blocks: [
      { t: "txt", v: "Open public/index.html. Select all the text inside and delete it. Then paste this:" },
      { t: "code", label: "public/index.html", code: CODE.indexHtml },
      { t: "info", v: "This is one single HTML file — it has the layout, all the CSS styling, and the JavaScript logic built in. Zero extra libraries, zero build steps. Simple on purpose so you can read and modify every line." }
    ]
  },
  {
    id: 10, phase: "Launch", title: "Install & Test Locally", time: "3 min",
    summary: "Download packages and run the app on your machine",
    blocks: [
      { t: "txt", v: "Install the backend packages (pdf-parse, Gemini SDK, etc.):" },
      { t: "code", label: "Terminal", code: CODE.installDeps },
      { t: "txt", v: "Start the local development server:" },
      { t: "code", label: "Terminal", code: CODE.serve },
      { t: "txt", v: "Open http://localhost:5000 in your browser. Your app should be there!" },
      { t: "steps", items: [
        "Click browse or drag a PDF onto the upload area",
        "Pick how many questions you want (3, 5, or 10)",
        'Click "🧠 Generate Quiz"',
        "Wait 5–10 seconds for Gemini to think…",
        'Questions appear! Click "Show Answer" to reveal correct ones'
      ]},
      { t: "tip", v: "If you see an error, look at the Terminal — it shows detailed messages. Most common issue: your .env file has an extra space or is in the wrong folder." }
    ]
  },
  {
    id: 11, phase: "Launch", title: "Deploy to the Internet", time: "2 min",
    summary: "Go live — anyone with the link can use it",
    blocks: [
      { t: "txt", v: "Stop the local server first (Ctrl+C in terminal). Then:" },
      { t: "code", label: "Terminal", code: CODE.deploy },
      { t: "ok", v: "🎉 Your app is live! Firebase gave you a URL like https://your-project-name.web.app. Anyone on Earth can visit it, upload a PDF, and generate a quiz — for free." },
      { t: "info", v: "Everything runs on Google's free tier: Firebase Hosting (10 GB), Cloud Functions (2M calls/month), Gemini AI (free quota). Total cost: $0/month." },
      { t: "txt", v: "To update your app later — just edit the code and run firebase deploy again." }
    ]
  }
];

/* ═══════════════════════════════════════════════════════════
   COMPONENTS
   ═══════════════════════════════════════════════════════════ */

function CopyBtn({ text }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); }); }}
      style={{ background: ok ? "#22c55e22" : "#334155", border: "none", color: ok ? "#4ade80" : "#94a3b8", padding: "3px 9px", borderRadius: 5, fontSize: 11, cursor: "pointer", fontWeight: 600, transition: "all 0.2s" }}>
      {ok ? "✓ Copied!" : "📋 Copy"}
    </button>
  );
}

function Block({ b }) {
  if (b.t === "txt") return <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.7, margin: "7px 0" }}>{b.v}</p>;

  if (b.t === "code") return (
    <div style={{ margin: "10px 0", borderRadius: 9, overflow: "hidden", border: "1px solid #334155" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 11px", background: "#1a2332", borderBottom: "1px solid #334155" }}>
        <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600, fontFamily: "monospace" }}>{b.label}</span>
        <CopyBtn text={b.code} />
      </div>
      <pre style={{ padding: "13px 15px", fontSize: 11.8, color: "#7dd3fc", overflowX: "auto", lineHeight: 1.8, background: "#0f172a", margin: 0, whiteSpace: "pre", maxHeight: 380, overflowY: "auto" }}>{b.code}</pre>
    </div>
  );

  if (b.t === "tip") return (
    <div style={{ margin: "9px 0", padding: "9px 12px", borderRadius: 7, background: "#1a3a5c22", border: "1px solid #38bdf833" }}>
      <span style={{ fontSize: 12.5, color: "#7dd3fc" }}>💡 <strong>Tip:</strong> {b.v}</span>
    </div>
  );
  if (b.t === "warn") return (
    <div style={{ margin: "9px 0", padding: "9px 12px", borderRadius: 7, background: "#2a1f0e", border: "1px solid #f59e0b33" }}>
      <span style={{ fontSize: 12.5, color: "#fbbf24" }}>⚠️ <strong>Important:</strong> {b.v}</span>
    </div>
  );
  if (b.t === "info") return (
    <div style={{ margin: "9px 0", padding: "9px 12px", borderRadius: 7, background: "#1e1a3a", border: "1px solid #8b5cf633" }}>
      <span style={{ fontSize: 12.5, color: "#a78bfa" }}>ℹ️ {b.v}</span>
    </div>
  );
  if (b.t === "ok") return (
    <div style={{ margin: "9px 0", padding: "10px 12px", borderRadius: 7, background: "#1a3b1a", border: "1px solid #22c55e33" }}>
      <span style={{ fontSize: 12.5, color: "#4ade80" }}>✅ {b.v}</span>
    </div>
  );

  if (b.t === "link") return (
    <div style={{ margin: "10px 0", padding: "11px 13px", borderRadius: 8, background: "#0f172a", border: "1px solid #38bdf833" }}>
      <a href={b.url} target="_blank" rel="noopener noreferrer" style={{ color: "#38bdf8", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>{b.label} →</a>
      <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0", lineHeight: 1.5 }}>{b.desc}</p>
    </div>
  );

  if (b.t === "steps") return (
    <div style={{ margin: "10px 0" }}>
      {b.items.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "4px 0" }}>
          <div style={{ background: "#38bdf822", color: "#38bdf8", borderRadius: "50%", width: 24, height: 24, minWidth: 24, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, border: "1px solid #38bdf833" }}>{i + 1}</div>
          <span style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.6, paddingTop: 1 }}>{item}</span>
        </div>
      ))}
    </div>
  );

  if (b.t === "tree") return (
    <div style={{ margin: "10px 0", padding: "13px 16px", borderRadius: 8, background: "#0f172a", border: "1px solid #334155" }}>
      {b.items.map((item, i) => (
        <div key={i} style={{ fontSize: 13, color: item.folder ? "#94a3b8" : "#7dd3fc", fontFamily: "monospace", lineHeight: 2, paddingLeft: item.d * 20 }}>
          {item.folder ? "📁 " : "📄 "}{item.name}
        </div>
      ))}
    </div>
  );
  return null;
}

/* ═══════════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════════ */
export default function App() {
  const [expanded, setExpanded] = useState(1);
  const [done, setDone] = useState(new Set());
  const [showHelp, setShowHelp] = useState(false);

  const toggleDone = (id) => setDone(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const progress = Math.round((done.size / steps.length) * 100);
  const phases = ["Setup", "Build", "Launch"];
  const phaseColor = { Setup: "#38bdf8", Build: "#a78bfa", Launch: "#4ade80" };

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: "#0f172a", color: "#e2e8f0", minHeight: "100vh", padding: "22px 14px" }}>
      <div style={{ maxWidth: 740, margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#22c55e18", border: "1px solid #22c55e33", borderRadius: 18, padding: "4px 14px", marginBottom: 14 }}>
            <span style={{ fontSize: 11.5, color: "#4ade80", fontWeight: 600 }}>✅ Google-Only · 100% Free · No Credit Card · No Servers</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.3px" }}>📘 PDF Quiz Generator — Build Guide</h1>
          <p style={{ margin: "5px 0 0", fontSize: 13, color: "#64748b" }}>Complete step-by-step · From zero to a live deployed app · ~25 minutes total</p>
        </div>

        {/* ── Progress Bar ── */}
        <div style={{ margin: "16px 0 20px", background: "#1e293b", borderRadius: 10, padding: "13px 16px", border: "1px solid #334155" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
            <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>Progress</span>
            <span style={{ fontSize: 12.5, color: progress === 100 ? "#4ade80" : "#38bdf8", fontWeight: 700 }}>{done.size} / {steps.length} steps · {progress}%</span>
          </div>
          <div style={{ height: 7, background: "#334155", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: progress + "%", background: progress === 100 ? "#22c55e" : "linear-gradient(90deg,#38bdf8,#818cf8)", borderRadius: 4, transition: "width 0.4s ease" }} />
          </div>
        </div>

        {/* ── Steps grouped by Phase ── */}
        {phases.map(phase => {
          const phSteps = steps.filter(s => s.phase === phase);
          const col = phaseColor[phase];
          const allDone = phSteps.every(s => done.has(s.id));

          return (
            <div key={phase} style={{ marginBottom: 4 }}>
              {/* Phase label */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7, marginTop: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: col, background: col + "18", padding: "3px 10px", borderRadius: 10, display: "flex", alignItems: "center", gap: 5 }}>
                  {allDone && <span>✓</span>} {phase}
                </span>
                <div style={{ flex: 1, height: 1, background: "#334155" }} />
                <span style={{ fontSize: 10, color: "#475569" }}>{phSteps.filter(s => done.has(s.id)).length}/{phSteps.length}</span>
              </div>

              {/* Step cards */}
              {phSteps.map(step => {
                const isOpen = expanded === step.id;
                const isDone = done.has(step.id);
                return (
                  <div key={step.id} style={{ marginBottom: 5, borderRadius: 10, overflow: "hidden", border: `1px solid ${isDone ? "#22c55e44" : isOpen ? "#38bdf844" : "#334155"}`, background: "#1e293b", transition: "border-color 0.25s" }}>

                    {/* Header row */}
                    <div style={{ display: "flex", alignItems: "center", cursor: "pointer", userSelect: "none" }} onClick={() => setExpanded(isOpen ? -1 : step.id)}>
                      {/* Circle */}
                      <div style={{ width: 48, display: "flex", justifyContent: "center", flexShrink: 0 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%",
                          background: isDone ? "#22c55e" : isOpen ? "#38bdf822" : "#334155",
                          border: isDone ? "none" : isOpen ? "2px solid #38bdf8" : "2px solid #475569",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: isDone ? 14 : 11.5, color: isDone ? "#fff" : isOpen ? "#38bdf8" : "#94a3b8", fontWeight: 700, transition: "all 0.2s"
                        }}>{isDone ? "✓" : step.id}</div>
                      </div>
                      {/* Title */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: isDone ? "#4ade80" : "#f1f5f9", transition: "color 0.2s" }}>{step.title}</div>
                        <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 1 }}>{step.summary} · ⏱ {step.time}</div>
                      </div>
                      {/* Chevron */}
                      <div style={{ paddingRight: 14, color: "#475569", fontSize: 11, transition: "transform 0.25s", transform: isOpen ? "rotate(180deg)" : "rotate(0)" }}>▼</div>
                    </div>

                    {/* Body */}
                    {isOpen && (
                      <div style={{ padding: "2px 18px 18px", borderTop: "1px solid #334155" }}>
                        <div style={{ marginTop: 10 }}>
                          {step.blocks.map((b, i) => <Block key={i} b={b} />)}
                        </div>
                        {/* Mark done button */}
                        <div style={{ marginTop: 16, textAlign: "right" }}>
                          <button onClick={e => { e.stopPropagation(); toggleDone(step.id); }} style={{
                            padding: "7px 16px", borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                            background: isDone ? "#334155" : "#22c55e22", color: isDone ? "#94a3b8" : "#4ade80",
                            border: isDone ? "1px solid #475569" : "1px solid #22c55e33", transition: "all 0.2s"
                          }}>{isDone ? "↩ Mark Incomplete" : "✓ Mark as Done"}</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* ── 🎉 Completion Banner ── */}
        {progress === 100 && (
          <div style={{ marginTop: 20, background: "linear-gradient(135deg, #1a3b1a, #162816)", border: "1px solid #22c55e44", borderRadius: 14, padding: 28, textAlign: "center" }}>
            <div style={{ fontSize: 46, marginBottom: 8 }}>🎉</div>
            <h2 style={{ margin: "0 0 8px", fontSize: 20, color: "#4ade80", fontWeight: 700 }}>You did it!</h2>
            <p style={{ margin: "0 auto", fontSize: 14, color: "#86efac", lineHeight: 1.7, maxWidth: 480 }}>
              Your PDF Quiz Generator is live on the internet, running entirely on Google's free tier. Share your URL and anyone can generate quizzes instantly!
            </p>
            <div style={{ marginTop: 14, display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
              {["Firebase Hosting", "Cloud Functions", "Gemini AI"].map(s => (
                <span key={s} style={{ background: "#22c55e22", border: "1px solid #22c55e33", color: "#4ade80", padding: "4px 11px", borderRadius: 14, fontSize: 11, fontWeight: 600 }}>✓ {s}</span>
              ))}
            </div>
          </div>
        )}

        {/* ── 🔧 Troubleshooting ── */}
        <div style={{ marginTop: 20 }}>
          <button onClick={() => setShowHelp(!showHelp)} style={{
            width: "100%", background: "#1e293b", border: "1px solid #334155", borderRadius: showHelp ? "10px 10px 0 0" : 10,
            padding: "11px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
            color: "#94a3b8", fontSize: 13, fontWeight: 600
          }}>
            <span>🔧 Troubleshooting — Common Issues</span>
            <span style={{ fontSize: 11, color: "#64748b", transition: "transform 0.2s", transform: showHelp ? "rotate(180deg)" : "rotate(0)" }}>▼</span>
          </button>
          {showHelp && (
            <div style={{ background: "#1e293b", border: "1px solid #334155", borderTop: "none", borderRadius: "0 0 10px 10px", padding: "14px 16px" }}>
              {[
                { q: '"GEMINI_API_KEY is undefined"', a: 'Your .env file is in the wrong place. It must be inside functions/ — the full path is: pdf-quiz-generator/functions/.env  (not in the project root).' },
                { q: 'pdf-parse error or crash', a: 'Run npm install again inside the functions/ folder. If it still fails, delete functions/node_modules and run npm install fresh.' },
                { q: 'Works locally but not after deploy', a: 'Cloud Functions have a "cold start" — they sleep and take 2–3 seconds to wake up on first call. Try again; it usually works on the second attempt.' },
                { q: '"PDF has no readable text" error', a: 'The PDF is image-based (scanned pages). Text extraction only works on PDFs with actual text layers. Use a free online OCR tool (like Adobe Acrobat online) to convert it first.' },
                { q: 'CORS error in browser console', a: 'The firebase.json rewrite might not be working. Open Firebase Console → Functions → find generateQuiz → copy its URL. Then in public/index.html, replace "/generateQuiz" with that full URL.' }
              ].map((item, i) => (
                <div key={i} style={{ padding: "9px 0", borderBottom: i < 4 ? "1px solid #334155" : "none" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9", marginBottom: 3 }}>❓ {item.q}</div>
                  <div style={{ fontSize: 12.5, color: "#94a3b8", lineHeight: 1.55 }}>{item.a}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
