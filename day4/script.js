// ---------- Select elements ----------
const textarea = document.getElementById("note-text");
const charCount = document.getElementById("char-count");
const wordCount = document.getElementById("word-count");
const clearBtn = document.getElementById("clear-btn");
const themeToggle = document.getElementById("theme-toggle");

// ---------- Settings ----------
const MAX_CHARS = 200;
const WARN_CHARS = 180;
const DRAFT_KEY = "quicknotes-draft";
const THEME_KEY = "quicknotes-theme";

// ---------- Counters ----------
function countWords(text) {
  const trimmed = text.trim();
  if (trimmed === "") {
    return 0;
  }
  return trimmed.split(/\s+/).length;
}

function updateCounts() {
  const length = textarea.value.length;
  const words = countWords(textarea.value);

  charCount.textContent = `${length} / ${MAX_CHARS} characters`;
  wordCount.textContent = `${words} words`;

  // Over 180 gets the warning class, over 200 also gets the over class.
  charCount.classList.toggle("warning", length > WARN_CHARS);
  charCount.classList.toggle("over", length > MAX_CHARS);
}

// ---------- Draft ----------
function saveDraft() {
  localStorage.setItem(DRAFT_KEY, textarea.value);
}

function restoreDraft() {
  const savedDraft = localStorage.getItem(DRAFT_KEY);
  if (savedDraft !== null) {
    textarea.value = savedDraft;
  }
}

function clearAll() {
  textarea.value = "";
  localStorage.removeItem(DRAFT_KEY);
  updateCounts();
  textarea.focus();
}

// ---------- Theme ----------
function applyTheme(isDark) {
  document.body.classList.toggle("dark", isDark);
  themeToggle.textContent = isDark ? "Light mode" : "Dark mode";
}

function restoreTheme() {
  applyTheme(localStorage.getItem(THEME_KEY) === "dark");
}

// ---------- Events ----------
textarea.addEventListener("input", function () {
  updateCounts();
  saveDraft();
});

textarea.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    clearAll();
  }
});

clearBtn.addEventListener("click", clearAll);

themeToggle.addEventListener("click", function () {
  const isDark = !document.body.classList.contains("dark");
  applyTheme(isDark);
  localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
});

// ---------- On page load ----------
restoreDraft();
restoreTheme();
updateCounts();
