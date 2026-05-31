/* ============================================================
   WordQuest — Question Parser  (wq-parser.js)
   HYBRID parsing: auto-extract questions from uploaded PDF/text,
   then the teacher reviews & edits before publishing.

   Supported auto-detected formats (common in SG worksheets):
     MC:        "1. The cat ___ on the mat.  (A) sit (B) sits (C) sat (D) sitting"
     MC (lines): question line, then A)/B)/C)/D) on their own lines
     Fill:      "1. She ___ to school." (no options) -> fill-in-blank
     Cloze:     a paragraph with several (1)____ (2)____ numbered blanks
     Transform: "Combine: ... / Rewrite: ... / Change into reported speech: ..."

   Parsing is deliberately conservative: when unsure, it emits the item
   as a 'fill' or 'mc' draft and flags low confidence so the teacher edits.

   Requires PDF.js for PDF input:
     <script src="https://cdn.jsdelivr.net/npm/pdfjs-dist@4/build/pdf.min.mjs" type="module"></script>
   Text input needs no dependency.
   ============================================================ */
(function (global) {
  "use strict";

  /* ---------- PDF -> raw text (via PDF.js) ---------- */
  async function pdfToText(arrayBuffer) {
    const pdfjsLib = global.pdfjsLib || (global.pdfjs && global.pdfjs.pdfjsLib);
    if (!pdfjsLib) throw new Error("PDF.js not loaded");
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = "";
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      // reconstruct lines by y-position
      let lastY = null, line = "";
      const lines = [];
      content.items.forEach(it => {
        const y = Math.round(it.transform[5]);
        if (lastY === null || Math.abs(y - lastY) < 4) { line += it.str; }
        else { lines.push(line); line = it.str; }
        lastY = y;
      });
      if (line) lines.push(line);
      text += lines.join("\n") + "\n";
    }
    return text;
  }

  /* ---------- main entry: parse raw text into draft questions ---------- */
  function parseText(raw, defaultCategory) {
    const cleaned = raw.replace(/\r/g, "").replace(/\u00a0/g, " ");
    const blocks = splitIntoBlocks(cleaned);
    const out = [];
    blocks.forEach(b => {
      const item = classifyBlock(b, defaultCategory);
      if (item) out.push(item);
    });
    return out;
  }

  /* Split a worksheet into per-question blocks by leading "1." "2)" markers */
  function splitIntoBlocks(text) {
    const lines = text.split("\n").map(l => l.trim()).filter(l => l.length);
    const blocks = [];
    let cur = null;
    const numRe = /^(\d{1,2})[\.\)]\s+/;
    lines.forEach(line => {
      if (numRe.test(line)) {
        if (cur) blocks.push(cur);
        cur = { num: line.match(numRe)[1], lines: [line.replace(numRe, "")] };
      } else if (cur) {
        cur.lines.push(line);
      }
    });
    if (cur) blocks.push(cur);
    return blocks;
  }

  /* Decide what kind of question a block is */
  function classifyBlock(block, category) {
    const joined = block.lines.join(" ").trim();

    // ---- Transform / synthesis cues ----
    const transformCue = /\b(combine|rewrite|change (it )?into|begin your answer|join the (two )?sentences|reported speech|passive)\b/i;
    if (transformCue.test(joined)) {
      const task = block.lines[0];
      const originals = block.lines.slice(1).filter(l => !transformCue.test(l));
      return draft("transform", category, {
        text: task, task: task,
        original: originals.length ? originals : [joined.replace(transformCue, "").trim()],
        correct: [""],         // teacher fills the model answer
        rubric: "Teacher: add required keyword(s) in 'quotes' and review."
      }, 0.5, "Transform detected — add the model answer & keyword(s).");
    }

    // ---- Inline MC: "(A) .. (B) .. (C) .. (D) .." ----
    const inlineOpts = [...joined.matchAll(/\(([A-D])\)\s*([^\(]+?)(?=\s*\([A-D]\)|$)/g)];
    if (inlineOpts.length >= 2) {
      const stem = joined.slice(0, joined.indexOf("(" + inlineOpts[0][1] + ")")).trim();
      const options = inlineOpts.map(m => m[2].trim());
      return draft("mc", category, {
        text: stem, options, answer: 0,   // teacher picks correct
      }, 0.7, "MC detected — set the correct option.");
    }

    // ---- Stacked MC: option lines like "A) sit" "B) sits" ----
    const optLines = block.lines.filter(l => /^[A-D][\.\)]\s+/.test(l));
    if (optLines.length >= 2) {
      const stem = block.lines.filter(l => !/^[A-D][\.\)]\s+/.test(l)).join(" ").trim();
      const options = optLines.map(l => l.replace(/^[A-D][\.\)]\s+/, "").trim());
      return draft("mc", category, { text: stem, options, answer: 0 },
        0.7, "MC detected — set the correct option.");
    }

    // ---- Cloze: several numbered blanks within one paragraph ----
    const blankMarks = [...joined.matchAll(/\(?\d\)?\s*_{2,}/g)];
    if (blankMarks.length >= 2) {
      let n = 0;
      const passage = joined.replace(/\(?\d\)?\s*_{2,}/g, () => `_${++n}_`);
      const blanks = [];
      for (let i = 1; i <= n; i++) {
        blanks.push({ id: i, correct: [""], rubric: "Teacher: add answer", hint: "" });
      }
      return draft("cloze", category, { passage, blanks }, 0.5,
        "Cloze detected — fill in each blank's answer.");
    }

    // ---- Single blank -> fill ----
    if (/_{2,}/.test(joined)) {
      return draft("fill", category, {
        text: joined, answer: [""]
      }, 0.6, "Fill-in detected — add the accepted answer(s).");
    }

    // ---- Fallback: treat as fill draft (teacher decides) ----
    if (joined.length > 6) {
      return draft("fill", category, { text: joined, answer: [""] },
        0.3, "Unrecognised — please set type & answer.");
    }
    return null;
  }

  function draft(qtype, category, payload, confidence, note) {
    return {
      qtype,
      category: category || guessCategory(payload),
      skill: "",
      lo: "",
      payload,
      approved: false,         // teacher must approve
      _confidence: confidence, // 0..1, drives UI warning
      _note: note
    };
  }

  /* Light heuristic for category if not provided */
  function guessCategory(payload) {
    const t = (payload.text || payload.passage || payload.task || "").toLowerCase();
    if (/spell|misspel/.test(t)) return "spelling";
    if (/combine|rewrite|reported|passive|relative clause|join the/.test(t)) return "synthesis";
    if (/synonym|antonym|opposite|meaning of|means|vocabulary|prefix|suffix|word for/.test(t)) return "vocab";
    return "grammar";
  }

  global.WQ_PARSER = { pdfToText, parseText, classifyBlock };
})(typeof window !== "undefined" ? window : globalThis);
