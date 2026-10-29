import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createGlossary, createSession, filterEntries, inCategory, japaneseForm, japaneseWord, meaningText, rateSession } from "../src/study/glossary.mjs";

const dataUrl = new URL("../src/data/", import.meta.url);
const read = (file) => JSON.parse(fs.readFileSync(new URL(file, dataUrl), "utf8"));
const source = {
  categories: read("categories,json"),
  tags: read("tags.json"),
  partsOfSpeech: read("partsOfSpeech.json"),
  files: Object.fromEntries(fs.readdirSync(new URL("glossary/", dataUrl)).filter((name) =>
    name.endsWith(".json")).map((name) => [name, read(`glossary/${name}`)])),
};

test("study incorporates configuration and all glossary files, including single objects", () => {
  const glossary = createGlossary(source);
  assert.equal(glossary.entries.length, 10);
  assert.deepEqual(glossary.categories, source.categories);
  assert.equal(glossary.tags.length, 7);
  assert.equal(glossary.partsOfSpeech.length, 7);
  assert.equal(glossary.entries.find((entry) => entry.romaji === "neko").meanings[0].text, "gat");
});

test("search supports all scripts, meanings, descriptions, notes, accents and sorting", () => {
  const glossary = createGlossary(source);
  for (const query of ["neko", "ねこ", "ネコ", "猫", "gat", "felids"]) {
    assert.ok(filterEntries(glossary, { query }).some((entry) => entry.romaji === "neko"), query);
  }
  assert.ok(filterEntries(glossary, { query: "otōsan" }).some((entry) => entry.romaji === "chichi"));
  const original = JSON.stringify(source);
  const sorted = filterEntries(glossary, { sort: "meaning" });
  assert.deepEqual(sorted.map((entry) => entry.meanings[0].text),
    [...sorted.map((entry) => entry.meanings[0].text)].sort((a, b) => a.localeCompare(b, "ca")));
  assert.equal(JSON.stringify(source), original);
});

test("category filtering includes descendants, tolerates cycles and combines filters", () => {
  const glossary = createGlossary(source);
  const childOnly = { ...glossary.entries[0], categories: ["pets"], tags: ["casual"] };
  const data = { ...glossary, entries: [childOnly] };
  assert.equal(filterEntries(data, { category: "animals", pos: "noun", tag: "casual" }).length, 1);
  assert.equal(filterEntries(data, { category: "animals", pos: "verb" }).length, 0);
  assert.equal(filterEntries(data, { category: "food" }).length, 0);
  assert.equal(filterEntries(data, { tag: "polite" }).length, 0);
  assert.equal(inCategory(childOnly, "animals", [...glossary.categories, { id: "animals", parentId: "pets" }]), true);
});

test("sessions shuffle without mutating data and support both directions", () => {
  const glossary = createGlossary(source);
  const original = JSON.stringify(glossary);
  for (const direction of ["ja-ca", "ca-ja"]) {
    const session = createSession(glossary.entries, direction);
    assert.equal(session.direction, direction);
    assert.notEqual(session.entries, glossary.entries);
    assert.deepEqual(session.entries.map((entry) => entry.id).sort(), glossary.entries.map((entry) => entry.id).sort());
    session.revealed = true;
    rateSession(session, false);
  }
  assert.equal(JSON.stringify(glossary), original);
});

test("rating requires a reveal, records misses and permits a missed-only review", () => {
  const entries = createGlossary(source).entries.slice(0, 2);
  const session = createSession(entries, "ja-ca");
  assert.throws(() => rateSession(session, true), /revelar/);
  const missed = session.entries[0];
  session.revealed = true;
  assert.equal(rateSession(session, false), missed.id);
  assert.equal(session.revealed, false);
  session.revealed = true;
  rateSession(session, true);
  assert.equal(session.correct, 1);
  assert.equal(session.index, 2);
  assert.deepEqual(session.missed, [missed]);
  assert.throws(() => rateSession(session, true), /revelar/);
  const review = createSession(session.missed, "ca-ja");
  assert.deepEqual(review.entries, [missed]);
  assert.equal(review.correct, 0);
  review.revealed = true;
  rateSession(review, true);
  assert.equal(review.correct, 1);
  assert.equal(review.missed.length, 0);
});

test("empty sessions and words without kanji are handled without fabricated content", () => {
  assert.equal(createSession([], "ja-ca").entries.length, 0);
  assert.throws(() => createSession([], "unknown"), /Direcció/);
  const entry = createGlossary(source).entries[0];
  assert.equal(meaningText(entry), entry.meanings.map((item) => item.text).join(" · "));
  assert.equal(japaneseWord({ ...entry, kanji: [] }), entry.hiragana);
  assert.equal(japaneseWord({ ...entry, kanji: [], hiragana: "", katakana: "" }), entry.romaji);
});

test("invalid embedded data fails explicitly", () => {
  assert.throws(() => createGlossary({ ...source, categories: null }), /Configuració/);
  const entry = createGlossary(source).entries[0];
  assert.throws(() => createGlossary({ ...source, files: { one: [entry, entry] } }), /duplicat/);
  assert.throws(() => createGlossary({ ...source, files: { one: { ...entry, meanings: [] } } }), /Contingut/);
  assert.throws(() => createGlossary({ ...source, files: { one: { ...entry, categories: ["unknown"] } } }), /Referències/);
});

test("Japanese writing selection uses the requested form and all kanji variants without mutation", () => {
  const entries = createGlossary(source).entries;
  const original = JSON.stringify(entries);
  for (const entry of entries) {
    for (const script of ["hiragana", "katakana", "kanji"]) {
      const expected = script === "kanji" ? entry.kanji.join(" · ") : entry[script];
      assert.deepEqual(japaneseForm(entry, script), { text: expected, script, alternative: false, notice: "" });
      assert.equal(japaneseWord(entry, script), expected);
    }
  }
  assert.equal(JSON.stringify(entries), original);
});

test("missing and whitespace-only writing forms have explicit alternative notices", () => {
  const entry = createGlossary(source).entries[0];
  const noKanji = japaneseForm({ ...entry, kanji: ["", "  "] }, "kanji");
  assert.deepEqual(noKanji, {
    text: entry.hiragana, script: "hiragana", alternative: true,
    notice: "Kanji no disponible · Alternativa: Hiragana",
  });
  const noHiragana = japaneseForm({ ...entry, hiragana: "  " }, "hiragana");
  assert.equal(noHiragana.script, "kanji");
  assert.equal(noHiragana.notice, "Hiragana no disponible · Alternativa: Kanji");
  const katakanaOnly = { ...entry, kanji: [], hiragana: "" };
  assert.equal(japaneseForm(katakanaOnly, "kanji").script, "katakana");
  assert.equal(japaneseForm(katakanaOnly, "hiragana").script, "katakana");
  const noKatakana = japaneseForm({ ...entry, kanji: [], katakana: "" }, "katakana");
  assert.equal(noKatakana.script, "hiragana");
  assert.equal(noKatakana.notice, "Katakana no disponible · Alternativa: Hiragana");
  const romanOnly = japaneseForm({ ...entry, kanji: [], hiragana: "", katakana: "" }, "kanji");
  assert.equal(romanOnly.text, entry.romaji);
  assert.equal(romanOnly.notice, "Kanji no disponible · Alternativa: Romaji");
  assert.throws(() => japaneseForm(entry, "unknown"), /Forma japonesa/);
  assert.throws(() => japaneseForm({ ...entry, kanji: [], hiragana: "", katakana: "", romaji: "" }), /cap forma/);
});
