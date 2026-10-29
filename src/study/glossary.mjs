export function createGlossary({ categories, tags, partsOfSpeech, files }) {
  for (const [label, items] of Object.entries({ categories, tags, partsOfSpeech })) {
    if (!Array.isArray(items) || items.some((item) => !item || typeof item.id !== "string" || typeof item.label !== "string")
      || new Set(items.map((item) => item.id)).size !== items.length) {
      throw new Error(`Configuració no vàlida: ${label}.`);
    }
  }
  const entries = Object.keys(files).sort().flatMap((name) => {
    const data = files[name];
    return Array.isArray(data) ? data : [data];
  });
  const ids = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry.id !== "string" || !entry.id || ids.has(entry.id)) {
      throw new Error("Identificador d'entrada absent o duplicat.");
    }
    ids.add(entry.id);
    for (const field of ["romaji", "hiragana", "katakana", "notes"]) {
      if (typeof entry[field] !== "string") throw new Error(`Camp ${field} no vàlid a ${entry.id}.`);
    }
    if (!entry.romaji.trim() || !Array.isArray(entry.kanji) || entry.kanji.some((item) => typeof item !== "string")
      || !Array.isArray(entry.meanings) || !entry.meanings.length
      || entry.meanings.some((item) => !item || typeof item.text !== "string" || !item.text.trim() || typeof item.description !== "string")
      || !Array.isArray(entry.examples) || entry.examples.some((example) => !example
        || ["japanese", "hiragana", "romaji", "translation"].some((field) => typeof example[field] !== "string"))) {
      throw new Error(`Contingut no vàlid a ${entry.id}.`);
    }
    for (const [field, options] of [["categories", categories], ["tags", tags], ["partOfSpeech", partsOfSpeech]]) {
      if (!Array.isArray(entry[field]) || (field !== "tags" && !entry[field].length)
        || entry[field].some((id) => !options.some((option) => option.id === id))) {
        throw new Error(`Referències ${field} no vàlides a ${entry.id}.`);
      }
    }
  }
  return { categories, tags, partsOfSpeech, entries };
}

export function inCategory(entry, id, categories) {
  if (!id) return true;
  const visited = new Set([id]);
  const descendants = [id];
  for (let index = 0; index < descendants.length; index++) {
    for (const category of categories) {
      if (category.parentId === descendants[index] && !visited.has(category.id)) {
        visited.add(category.id);
        descendants.push(category.id);
      }
    }
  }
  return entry.categories.some((category) => visited.has(category));
}

const normalize = (value) => value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("ca");

export function filterEntries(glossary, { query = "", category = "", pos = "", tag = "", sort = "romaji" } = {}) {
  const search = normalize(query.trim());
  const result = glossary.entries.filter((entry) => {
    const text = [entry.romaji, entry.hiragana, entry.katakana, ...entry.kanji,
      ...entry.meanings.flatMap((meaning) => [meaning.text, meaning.description]), entry.notes].join(" ");
    return (!search || normalize(text).includes(search))
      && inCategory(entry, category, glossary.categories)
      && (!pos || entry.partOfSpeech.includes(pos))
      && (!tag || entry.tags.includes(tag));
  });
  const value = (entry) => sort === "meaning" ? entry.meanings[0].text : entry.romaji;
  return result.sort((a, b) => value(a).localeCompare(value(b), "ca"));
}

export function createSession(entries, direction) {
  if (!["ja-ca", "ca-ja"].includes(direction)) throw new Error("Direcció d'estudi no vàlida.");
  const shuffled = [...entries];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const index = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[index]] = [shuffled[index], shuffled[i]];
  }
  return { entries: shuffled, direction, index: 0, correct: 0, missed: [], revealed: false };
}

export function rateSession(session, remembered) {
  if (!session.revealed || session.index >= session.entries.length) {
    throw new Error("Cal revelar una targeta activa abans de valorar-la.");
  }
  const entry = session.entries[session.index];
  if (remembered) session.correct++;
  else session.missed.push(entry);
  session.index++;
  session.revealed = false;
  return entry.id;
}

export const japaneseScripts = [
  { id: "kanji", label: "Kanji" },
  { id: "hiragana", label: "Hiragana" },
  { id: "katakana", label: "Katakana" },
];

export function japaneseForm(entry, requested = "kanji") {
  if (!japaneseScripts.some((script) => script.id === requested)) throw new Error("Forma japonesa no vàlida.");
  const forms = {
    kanji: entry.kanji.map((text) => text.trim()).filter(Boolean).join(" · "),
    hiragana: entry.hiragana.trim(),
    katakana: entry.katakana.trim(),
    romaji: entry.romaji.trim(),
  };
  const script = [requested, "kanji", "hiragana", "katakana", "romaji"].find((id) => forms[id]);
  if (!script) throw new Error(`No hi ha cap forma disponible a ${entry.id}.`);
  const alternative = script !== requested;
  const label = (id) => japaneseScripts.find((item) => item.id === id)?.label || "Romaji";
  return {
    text: forms[script],
    script,
    alternative,
    notice: alternative ? `${label(requested)} no disponible · Alternativa: ${label(script)}` : "",
  };
}

export const japaneseWord = (entry, script = "kanji") => japaneseForm(entry, script).text;
export const meaningText = (entry) => entry.meanings.map((meaning) => meaning.text).join(" · ");
