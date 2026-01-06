const el = (id) => document.getElementById(id);

/* ---------- 要素 ---------- */

const wordCount = el("wordCount");
const wordsArea = el("wordsArea");

const btnGenerate = el("btnGenerate");
const btnCopy = el("btnCopy");
const btnSpeak = el("btnSpeak");
const btnStop = el("btnStop");

const btnDraftSave = el("btnDraftSave");
const btnDraftLoad = el("btnDraftLoad");
const btnDraftClear = el("btnDraftClear");

const result = el("result");
const status = el("status");

const DRAFT_KEY = "word-diary-draft-v1";

/* ---------- 共通 ---------- */

function setStatus(msg = "") {
  status.textContent = msg;
}

function renderWordInputs(n) {
  wordsArea.innerHTML = "";
  for (let i = 0; i < n; i++) {
    const input = document.createElement("input");
    input.placeholder = `単語${i + 1}`;
    input.id = `w${i}`;
    wordsArea.appendChild(input);
  }
}

function getWordsFilled() {
  const n = Number(wordCount.value);
  const words = [];
  for (let i = 0; i < n; i++) {
    const v = (el(`w${i}`)?.value || "").trim();
    if (v) words.push(v);
  }
  return words;
}

function getWordsAll() {
  const n = Number(wordCount.value);
  const words = [];
  for (let i = 0; i < n; i++) {
    words.push((el(`w${i}`)?.value || "").trim());
  }
  return words;
}

function setWords(values) {
  const n = Number(wordCount.value);
  for (let i = 0; i < n; i++) {
    const input = el(`w${i}`);
    if (input) input.value = values[i] || "";
  }
}

function updateButtons() {
  const hasText = result.value.trim().length > 0;
  btnCopy.disabled = !hasText || !navigator.clipboard;
  btnSpeak.disabled = !hasText || !("speechSynthesis" in window);
  btnStop.disabled = true;
}

/* ---------- 下書き ---------- */

function saveDraft() {
  const payload = {
    count: Number(wordCount.value),
    words: getWordsAll(),
    result: result.value,
  };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  setStatus("下書きを保存した。");
}

function loadDraft() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) {
    setStatus("下書きがない。");
    return;
  }

  const data = JSON.parse(raw);
  const c = Number(data.count);

  if (c === 3 || c === 5 || c === 7) {
    wordCount.value = String(c);
  }

  renderWordInputs(Number(wordCount.value));
  setWords(Array.isArray(data.words) ? data.words : []);
  result.value = typeof data.result === "string" ? data.result : "";

  updateButtons();
  setStatus("下書きを復元した。");
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
  setStatus("下書きを削除した。");
}

/* ---------- コピー ---------- */

async function copyResult() {
  const text = result.value.trim();
  if (!text) return;
  await navigator.clipboard.writeText(text);
  setStatus("コピーした。");
}

/* ---------- 読み上げ ---------- */

function speakResult() {
  const text = result.value.trim();
  if (!text) return;
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();

  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ja-JP";
  u.onend = () => {
    btnStop.disabled = true;
    setStatus("読み上げ終了。");
  };
  u.onerror = () => {
    btnStop.disabled = true;
    setStatus("読み上げでエラー。");
  };

  window.speechSynthesis.speak(u);
  btnStop.disabled = false;
  setStatus("読み上げ中...");
}

function stopSpeak() {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  btnStop.disabled = true;
  setStatus("読み上げを停止した。");
}

/* ---------- 生成AI（Netlify Functions → OpenAI） ---------- */

async function generateDiaryAI() {
  const n = Number(wordCount.value);
  const words = getWordsFilled();

  if (words.length !== n) {
    setStatus(`単語を${n}個すべて入力して。`);
    return;
  }

  btnGenerate.disabled = true;
  setStatus("生成中...");

  try {
    const r = await fetch("/.netlify/functions/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ words }),
    });

    const ct = r.headers.get("content-type") || "";
    const data = ct.includes("application/json")
      ? await r.json()
      : { error: await r.text() };

    if (!r.ok) {
      const msg = data?.error ? String(data.error) : "unknown";
      const detail = data?.detail ? String(data.detail) : "";
      setStatus(detail ? `生成失敗: ${msg} / ${detail}` : `生成失敗: ${msg}`);
      return;
    }

    const text = typeof data.text === "string" ? data.text : "";
    result.value = text;

    if (text.trim().length === 0) {
      setStatus("生成は成功したが、本文が空。");
    } else {
      setStatus("生成完了。");
    }

    updateButtons();
  } catch (e) {
    setStatus("生成でエラー（Functions未起動／ネットワーク）。");
  } finally {
    btnGenerate.disabled = false;
  }
}

/* ---------- イベント ---------- */

wordCount.addEventListener("change", () => {
  renderWordInputs(Number(wordCount.value));
  setStatus("");
});

btnGenerate.addEventListener("click", generateDiaryAI);

btnDraftSave.addEventListener("click", saveDraft);
btnDraftLoad.addEventListener("click", loadDraft);
btnDraftClear.addEventListener("click", clearDraft);

btnCopy.addEventListener("click", () => {
  copyResult().catch(() => setStatus("コピーに失敗した。"));
});

btnSpeak.addEventListener("click", speakResult);
btnStop.addEventListener("click", stopSpeak);

result.addEventListener("input", updateButtons);

/* ---------- 初期化 ---------- */

renderWordInputs(Number(wordCount.value));
updateButtons();
setStatus("");
