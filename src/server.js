const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function loadData(dataDir) {
  const categoriesFile = fs.existsSync(path.join(dataDir, "categories.json"))
    ? "categories.json" : "categories,json";
  const categories = readJson(path.join(dataDir, categoriesFile));
  const tags = readJson(path.join(dataDir, "tags.json"));
  const partsOfSpeech = readJson(path.join(dataDir, "partsOfSpeech.json"));
  const files = new Map();
  const entries = [];
  const ids = new Set();
  for (const name of fs.readdirSync(path.join(dataDir, "glossary")).sort()) {
    if (!name.endsWith(".json")) continue;
    const data = readJson(path.join(dataDir, "glossary", name));
    const items = Array.isArray(data) ? data : [data];
    files.set(name, { items, single: !Array.isArray(data) });
    for (const entry of items) {
      if (!entry || typeof entry.id !== "string" || ids.has(entry.id)) {
        throw new Error(`Identificador absent o duplicat a ${name}.`);
      }
      ids.add(entry.id);
      entries.push(entry);
    }
  }
  return { categories, tags, partsOfSpeech, files, entries };
}

function validateEntry(value, data) {
  const fail = (message) => { throw new RequestError(400, message); };
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("Entrada no vàlida.");
  const text = (value, label, required = false) => {
    if (typeof value !== "string" || (required && !value.trim())) fail(`Camp no vàlid: ${label}.`);
    if (value.length > 20000) fail(`El camp ${label} és massa llarg.`);
    return value.trim();
  };
  const strings = (value, label) => {
    if (!Array.isArray(value) || value.length > 100) fail(`Llista no vàlida: ${label}.`);
    return [...new Set(value.map((item) => text(item, label, true)))];
  };
  const refs = (value, options, label, required = false) => {
    const result = strings(value, label);
    if ((required && !result.length) || result.some((id) => !options.some((option) => option.id === id))) {
      fail(`Selecciona ${label} vàlids.`);
    }
    return result;
  };
  if (!Array.isArray(value.meanings) || !value.meanings.length || value.meanings.length > 100) {
    fail("Cal almenys un significat (màxim 100).");
  }
  if (!Array.isArray(value.examples) || value.examples.length > 100) fail("Exemples no vàlids.");
  return {
    romaji: text(value.romaji, "romaji", true),
    hiragana: text(value.hiragana, "hiragana"),
    katakana: text(value.katakana, "katakana"),
    kanji: strings(value.kanji, "kanji"),
    meanings: value.meanings.map((meaning) => {
      if (!meaning || typeof meaning !== "object") fail("Significat no vàlid.");
      return { text: text(meaning.text, "significat", true), description: text(meaning.description, "descripció") };
    }),
    partOfSpeech: refs(value.partOfSpeech, data.partsOfSpeech, "tipus de paraula", true),
    categories: refs(value.categories, data.categories, "categories", true),
    tags: refs(value.tags, data.tags, "etiquetes"),
    examples: value.examples.map((example) => {
      if (!example || typeof example !== "object") fail("Exemple no vàlid.");
      return {
        japanese: text(example.japanese, "exemple en japonès", true),
        hiragana: text(example.hiragana, "hiragana de l'exemple"),
        romaji: text(example.romaji, "romaji de l'exemple"),
        translation: text(example.translation, "traducció de l'exemple", true),
      };
    }),
    notes: text(value.notes, "notes"),
  };
}

function writeFile(dataDir, name, file) {
  const target = path.join(dataDir, "glossary", name);
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    const value = file.single && file.items.length === 1 ? file.items[0] : file.items;
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
    fs.renameSync(temporary, target);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

async function bodyJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1024 * 1024) throw new RequestError(413, "L'entrada supera el límit d'1 MB.");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new RequestError(400, "El cos de la petició no és un JSON vàlid.");
  }
}

function createServer({ dataDir = path.join(__dirname, "data") } = {}) {
  const publicDir = path.join(__dirname, "editor");
  return http.createServer(async (request, response) => {
    const json = (status, data) => {
      response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      response.end(JSON.stringify(data));
    };
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    try {
      const host = request.headers.host;
      if (!host || !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) {
        throw new RequestError(403, "Nom de servidor no permès.");
      }
      const url = new URL(request.url, `http://${host}`);
      if (url.pathname.startsWith("/api/")) {
        if (request.method === "GET" && url.pathname === "/api/glossary") {
          const { files, ...data } = loadData(dataDir);
          return json(200, data);
        }
        if (!["POST", "PUT", "DELETE"].includes(request.method)) {
          throw new RequestError(405, "Mètode no permès.");
        }
        if ((request.headers.origin && request.headers.origin !== `http://${host}`)
          || request.headers["sec-fetch-site"] === "cross-site"
          || request.headers["content-type"]?.split(";")[0] !== "application/json") {
          throw new RequestError(403, "Petició no permesa. Utilitza l'aplicació local.");
        }
        const match = url.pathname.match(/^\/api\/entries(?:\/([^/]+))?$/);
        if (!match) throw new RequestError(404, "Ruta desconeguda.");
        const id = match[1] && decodeURIComponent(match[1]);
        const payload = await bodyJson(request);
        // Read after receiving the body so concurrent local requests cannot overwrite a stale snapshot.
        const data = loadData(dataDir);
        const source = [...data.files].find(([, file]) => file.items.some((item) => item.id === id));
        if (request.method !== "POST" && !source) throw new RequestError(404, "L'entrada ja no existeix.");
        if (request.method === "POST") {
          if (id) throw new RequestError(400, "No indiquis un identificador en crear una entrada.");
          const entry = { id: `jp_${randomUUID()}`, ...validateEntry(payload, data) };
          const category = entry.categories[0];
          if (!/^[a-zA-Z0-9_-]+$/.test(category)) throw new RequestError(400, "Identificador de categoria no vàlid per a un fitxer.");
          const name = `${category}.json`;
          const file = data.files.get(name) || { items: [], single: false };
          file.items.push(entry);
          writeFile(dataDir, name, file);
          return json(201, entry);
        }
        const [name, file] = source;
        const index = file.items.findIndex((entry) => entry.id === id);
        if (request.method === "DELETE") {
          file.items.splice(index, 1);
          writeFile(dataDir, name, file);
          return json(200, { id });
        }
        const entry = { ...file.items[index], ...validateEntry(payload, data), id };
        file.items[index] = entry;
        writeFile(dataDir, name, file);
        return json(200, entry);
      }
      if (request.method !== "GET") throw new RequestError(405, "Mètode no permès.");
      const assets = { "/": ["index.html", "text/html"], "/app.js": ["app.js", "text/javascript"], "/styles.css": [path.join("..", "shared", "styles.css"), "text/css"], "/favicon.svg": [path.join("..", "shared", "favicon.svg"), "image/svg+xml"] };
      const asset = Object.hasOwn(assets, url.pathname) && assets[url.pathname];
      if (!asset) throw new RequestError(404, "Pàgina no trobada.");
      const content = fs.readFileSync(path.join(publicDir, asset[0]));
      response.writeHead(200, { "Content-Type": `${asset[1]}; charset=utf-8`, "Cache-Control": "no-cache" });
      response.end(content);
    } catch (error) {
      if (!(error instanceof RequestError)) console.error(error);
      if (!response.headersSent) json(error instanceof RequestError ? error.status : 500, {
        error: error instanceof RequestError ? error.message : "No s'han pogut llegir o desar les dades. Consulta la consola del servidor.",
      });
      else response.end();
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  const server = createServer();
  server.on("error", (error) => {
    console.error("No s'ha pogut iniciar el servidor:", error.message);
    process.exitCode = 1;
  });
  server.listen(port, "127.0.0.1", () => console.log(`Glossari: http://127.0.0.1:${server.address().port}`));
}

module.exports = { createServer };
