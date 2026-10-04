// ---------- Starting data ----------
let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" },
];

const VALID_CATEGORIES = ["personal", "work", "study"];

// ---------- Functions ----------

// Returns an array of notes whose text contains the word (ignoring case).
function searchNotes(word) {
  const search = word.toLowerCase();
  return notes.filter(function (note) {
    return note.text.toLowerCase().includes(search);
  });
}

// Returns the note with the most characters, or null if there are no notes.
function longestNote() {
  if (notes.length === 0) {
    return null;
  }
  let longest = notes[0];
  for (const note of notes) {
    if (note.text.length > longest.text.length) {
      longest = note;
    }
  }
  return longest;
}

// Returns an object counting notes per category, e.g. { personal: 2, study: 2, work: 1 }.
function countByCategory() {
  const counts = {};
  for (const note of notes) {
    if (counts[note.category]) {
      counts[note.category] += 1;
    } else {
      counts[note.category] = 1;
    }
  }
  return counts;
}

// Returns a sentence such as "5 notes: 2 personal, 1 work, 2 study."
function getSummary() {
  const counts = countByCategory();
  const total = notes.length;
  const noun = total === 1 ? "note" : "notes";

  if (total === 0) {
    return `0 ${noun}.`;
  }

  const parts = [];
  for (const category of VALID_CATEGORIES) {
    if (counts[category]) {
      parts.push(`${counts[category]} ${category}`);
    }
  }
  return `${total} ${noun}: ${parts.join(", ")}.`;
}

// Makes text comparable: trims, lower-cases and collapses extra spaces.
function normalise(text) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

// Returns true if a note with the same text already exists.
function isDuplicate(text) {
  const target = normalise(text);
  return notes.some(function (note) {
    return normalise(note.text) === target;
  });
}

// Adds a note if valid. Returns true when added, false otherwise (and logs why).
function addNote(text, category) {
  const cleaned = text.trim();

  if (cleaned.length < 1 || cleaned.length > 200) {
    console.log("Not added: text must be 1-200 characters.");
    return false;
  }
  if (isDuplicate(cleaned)) {
    console.log("Not added: a note with that text already exists.");
    return false;
  }
  if (!VALID_CATEGORIES.includes(category)) {
    console.log("Not added: category must be personal, work or study.");
    return false;
  }

  const lastId = notes.length > 0 ? notes[notes.length - 1].id : 0;
  notes.push({ id: lastId + 1, text: cleaned, category: category });
  return true;
}

// ---------- Tests ----------
// To test "no notes" cases, notes is swapped for an empty array and then restored.

console.log("--- searchNotes ---");
console.log(searchNotes("the"));
// Expected: array of 2 notes: id 2 "Finish the Day 3 assignment" and id 3 "Email the project report to Grace"
console.log(searchNotes("JAVASCRIPT"));
// Expected: array with 1 note: id 4 "Revise JavaScript arrays" (case is ignored)
console.log(searchNotes("zebra"));
// Expected: [] (no results)

console.log("--- longestNote ---");
console.log(longestNote());
// Expected: { id: 3, text: "Email the project report to Grace", category: "work" }
const savedNotes = notes;
notes = [];
console.log(longestNote());
// Expected: null (no notes)
notes = savedNotes;

console.log("--- countByCategory ---");
console.log(countByCategory());
// Expected: { personal: 2, study: 2, work: 1 }
notes = [];
console.log(countByCategory());
// Expected: {} (no notes)
notes = savedNotes;

console.log("--- getSummary ---");
console.log(getSummary());
// Expected: "5 notes: 2 personal, 1 work, 2 study."
notes = [savedNotes[0]];
console.log(getSummary());
// Expected: "1 note: 1 personal."
notes = [];
console.log(getSummary());
// Expected: "0 notes."
notes = savedNotes;

console.log("--- isDuplicate ---");
console.log(isDuplicate("buy milk and bread"));
// Expected: true (same text, different case)
console.log(isDuplicate("   CALL    MUM  "));
// Expected: true (ignores case and extra spaces)
console.log(isDuplicate("Walk the dog"));
// Expected: false

console.log("--- addNote ---");
console.log(addNote("Walk the dog", "personal"));
// Expected: true (valid note added)
console.log(addNote("walk the dog", "personal"));
// Expected: logs "Not added: a note with that text already exists." then false
console.log(addNote("", "work"));
// Expected: logs "Not added: text must be 1-200 characters." then false
console.log(addNote("a".repeat(201), "work"));
// Expected: logs "Not added: text must be 1-200 characters." then false
console.log(addNote("Plan a trip", "holiday"));
// Expected: logs "Not added: category must be personal, work or study." then false
console.log(addNote("a".repeat(200), "study"));
// Expected: true (exactly 200 characters is allowed)
console.log(getSummary());
// Expected: "7 notes: 3 personal, 1 work, 3 study."
