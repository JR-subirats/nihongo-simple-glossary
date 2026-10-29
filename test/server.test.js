const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createServer } = require("../src/server");

async function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kotoba-test-"));
  fs.cpSync(path.join(__dirname, "..", "src", "data"), root, { recursive: true });
  const server = createServer({ dataDir: root });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    fs.rmSync(root, { recursive: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (route, method = "GET", body, headers = {}) => {
    const response = await fetch(`${base}${route}`, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() };
  };
  return { root, base, request };
}

test("loads configuration, array files and a single-object file", async (t) => {
  const { request, root } = await fixture(t);
  const { status, data } = await request("/api/glossary");
  assert.equal(status, 200);
  assert.equal(data.entries.length, 10);
  const categoriesFile = fs.existsSync(path.join(root, "categories.json")) ? "categories.json" : "categories,json";
  assert.deepEqual(data.categories, JSON.parse(fs.readFileSync(path.join(root, categoriesFile), "utf8")));
  assert.equal(data.partsOfSpeech.length, 7);
  assert.equal(data.tags.length, 7);
  assert.equal(data.entries.find((entry) => entry.romaji === "neko").meanings[0].text, "gat");
});

test("creates, updates and deletes persistently without dropping other entries", async (t) => {
  const { request, root } = await fixture(t);
  const initial = (await request("/api/glossary")).data;
  const animal = initial.entries.find((entry) => entry.romaji === "neko");
  const created = await request("/api/entries", "POST", { ...animal, romaji: "test", categories: ["food"], notes: "Nota nova" });
  assert.equal(created.status, 201);
  assert.notEqual(created.data.id, animal.id);
  const foodFile = path.join(root, "glossary", "food.json");
  assert.equal(JSON.parse(fs.readFileSync(foodFile, "utf8"))[0].notes, "Nota nova");
  const updated = await request(`/api/entries/${created.data.id}`, "PUT", { ...created.data, notes: "Actualitzada", categories: ["family"] });
  assert.equal(updated.status, 200);
  assert.equal(JSON.parse(fs.readFileSync(foodFile, "utf8"))[0].notes, "Actualitzada");
  assert.deepEqual(updated.data.categories, ["family"]);
  const secondRead = (await request("/api/glossary")).data;
  assert.equal(secondRead.entries.length, 11);
  assert.equal(secondRead.entries.find((entry) => entry.id === created.data.id).notes, "Actualitzada");
  assert.equal((await request(`/api/entries/${created.data.id}`, "DELETE", {})).status, 200);
  assert.deepEqual(JSON.parse(fs.readFileSync(foodFile, "utf8")), []);
  assert.equal((await request("/api/glossary")).data.entries.length, 10);
  assert.equal((await request(`/api/entries/${created.data.id}`, "PUT", created.data)).status, 404);
});

test("preserves single-object format when editing and converts to list when adding", async (t) => {
  const { request, root } = await fixture(t);
  const animal = (await request("/api/glossary")).data.entries.find((entry) => entry.romaji === "neko");
  const file = path.join(root, "glossary", "animals.json");
  assert.equal((await request(`/api/entries/${animal.id}`, "PUT", { ...animal, notes: "Editada" })).status, 200);
  assert.equal(JSON.parse(fs.readFileSync(file, "utf8")).notes, "Editada");
  assert.equal((await request("/api/entries", "POST", { ...animal, romaji: "neko 2" })).status, 201);
  const saved = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(saved.length, 2);
  assert.equal(saved[0].notes, "Editada");
});

test("validates fields and rejects cross-origin writes without modifying files", async (t) => {
  const { request, root } = await fixture(t);
  const animal = (await request("/api/glossary")).data.entries.find((entry) => entry.romaji === "neko");
  const file = path.join(root, "glossary", "animals.json");
  const original = fs.readFileSync(file, "utf8");
  for (const invalid of [
    { romaji: "" }, { categories: ["unknown"] }, { categories: [] }, { partOfSpeech: [] },
    { tags: ["unknown"] }, { meanings: [] }, { meanings: [null] }, { kanji: "猫" },
    { examples: [{ japanese: "猫", translation: "", hiragana: "", romaji: "" }] },
    { notes: "x".repeat(20001) },
  ]) {
    assert.equal((await request(`/api/entries/${animal.id}`, "PUT", { ...animal, ...invalid })).status, 400);
  }
  assert.equal((await request(`/api/entries/${animal.id}`, "DELETE", {}, { Origin: "https://example.com" })).status, 403);
  assert.equal((await request("/api/entries", "POST", animal, { "Content-Type": "text/plain" })).status, 403);
  assert.equal(fs.readFileSync(file, "utf8"), original);
});

test("concurrent creations are not lost and unknown fields survive an edit", async (t) => {
  const { request, root } = await fixture(t);
  const animal = (await request("/api/glossary")).data.entries.find((entry) => entry.romaji === "neko");
  const file = path.join(root, "glossary", "animals.json");
  fs.writeFileSync(file, JSON.stringify({ ...animal, custom: "preserved" }));
  await request(`/api/entries/${animal.id}`, "PUT", { ...animal, notes: "Nova" });
  assert.equal(JSON.parse(fs.readFileSync(file, "utf8")).custom, "preserved");
  const results = await Promise.all(Array.from({ length: 5 }, (_, i) => request("/api/entries", "POST", { ...animal, romaji: `test ${i}` })));
  assert.ok(results.every((result) => result.status === 201));
  assert.equal((await request("/api/glossary")).data.entries.length, 15);
});

test("serves local assets and returns explicit errors for invalid requests", async (t) => {
  const { request, base } = await fixture(t);
  for (const asset of ["/", "/app.js", "/styles.css", "/favicon.svg"]) {
    const response = await fetch(`${base}${asset}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  }
  assert.equal((await request("/missing")).status, 404);
  const response = await fetch(`${base}/api/entries`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{invalid",
  });
  assert.equal(response.status, 400);
});

test("editor is separate from the static study application", async (t) => {
  const { base } = await fixture(t);
  const html = await (await fetch(base)).text();
  const script = await (await fetch(`${base}/app.js`)).text();
  assert.match(html, /Editor del glossari/);
  assert.match(html, /id="new-entry"/);
  assert.doesNotMatch(html, /id="study-view"|id="start-study"/);
  assert.doesNotMatch(script, /startStudy|renderStudy|kotoba-practiced/);
  for (const route of ["/study", "/src/data/glossary/family.json", "/src/server.js"]) {
    assert.equal((await fetch(`${base}${route}`)).status, 404);
  }
});
