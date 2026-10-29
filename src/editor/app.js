"use strict";

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]);
const normalize = (value) => value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("ca");
const state = { entries: [], categories: [], tags: [], partsOfSpeech: [], loaded: false, editing: null, busy: false };
let toastTimer;

async function api(url, method = "GET", data) {
  const response = await fetch(url, {
    method,
    headers: method === "GET" ? {} : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Error HTTP ${response.status}`);
  return result;
}

function showError(error) {
  $("#error").textContent = error.message;
  $("#error").hidden = false;
}

function toast(message) {
  clearTimeout(toastTimer);
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  toastTimer = setTimeout(() => { $("#toast").hidden = true; }, 4000);
}

function options(items, first) {
  return `<option value="">${escapeHtml(first)}</option>${items.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)}</option>`).join("")}`;
}

function setupFilters() {
  $("#category-filter").innerHTML = options(state.categories, "Totes les categories");
  $("#pos-filter").innerHTML = options(state.partsOfSpeech, "Tots els tipus");
  $("#tag-filter").innerHTML = options(state.tags, "Totes les etiquetes");
}

function inCategory(entry, id) {
  if (!id) return true;
  const visited = new Set([id]);
  const descendants = [id];
  for (let index = 0; index < descendants.length; index++) {
    for (const category of state.categories) {
      if (category.parentId === descendants[index] && !visited.has(category.id)) {
        visited.add(category.id);
        descendants.push(category.id);
      }
    }
  }
  return entry.categories.some((category) => visited.has(category));
}

function filteredEntries() {
  const query = normalize($("#search").value.trim());
  const category = $("#category-filter").value;
  const pos = $("#pos-filter").value;
  const tag = $("#tag-filter").value;
  const entries = state.entries.filter((entry) => {
    const text = [entry.romaji, entry.hiragana, entry.katakana, ...entry.kanji,
      ...entry.meanings.flatMap((meaning) => [meaning.text, meaning.description]), entry.notes].join(" ");
    return (!query || normalize(text).includes(query))
      && inCategory(entry, category)
      && (!pos || entry.partOfSpeech.includes(pos))
      && (!tag || entry.tags.includes(tag));
  });
  const value = (entry) => $("#sort").value === "meaning" ? entry.meanings[0].text : entry.romaji;
  return entries.sort((a, b) => value(a).localeCompare(value(b), "ca"));
}

function labels(ids, items) {
  return ids.map((id) => items.find((item) => item.id === id)?.label || id);
}

function renderGlossary() {
  const entries = filteredEntries();
  $("#total-count").textContent = state.entries.length;
  $("#nav-count").textContent = state.entries.length;
  $("#category-count").textContent = state.categories.length;
  $("#result-count").textContent = entries.length;
  $("#collections").innerHTML = state.categories.map((category) => `
    <button class="collection ${category.parentId ? "child" : ""} ${$("#category-filter").value === category.id ? "active" : ""}" data-category="${escapeHtml(category.id)}">
      <span class="collection-dot"></span>${escapeHtml(category.label)}
      <span class="collection-count">${state.entries.filter((entry) => inCategory(entry, category.id)).length}</span>
    </button>`).join("");
  $("#entries").innerHTML = entries.length ? entries.map((entry) => `
    <tr>
      <td><button class="word-button editor-word" data-edit="${escapeHtml(entry.id)}" aria-label="Edita ${escapeHtml(entry.romaji)}">
        ${[
          ["Romaji", entry.romaji, "ja-Latn"],
          ["Hiragana", entry.hiragana, "ja"],
          ["Katakana", entry.katakana, "ja"],
          ["Kanji", entry.kanji.filter((text) => text.trim()).join(" · "), "ja"],
        ].filter(([, text]) => text.trim()).map(([label, text, lang]) => `
          <span class="editor-word-form"><span class="editor-form-label">${label}</span><span lang="${lang}">${escapeHtml(text)}</span></span>
        `).join("")}
      </button></td>
      <td><span class="meaning-main">${escapeHtml(entry.meanings.map((meaning) => meaning.text).join(", "))}</span><span class="meaning-description" title="${escapeHtml(entry.meanings[0].description)}">${escapeHtml(entry.meanings[0].description)}</span></td>
      <td>${entry.categories.map((id) => `<span class="badge ${["animals", "pets", "food"].includes(id) ? id : ""}">${escapeHtml(labels([id], state.categories)[0])}</span>`).join("")}</td>
      <td><span class="pos-label">${escapeHtml(labels(entry.partOfSpeech, state.partsOfSpeech).join(", "))}</span></td>
      <td><button class="icon-button" data-edit="${escapeHtml(entry.id)}" aria-label="Edita ${escapeHtml(entry.romaji)}">↗</button></td>
    </tr>`).join("") : `<tr><td colspan="5" class="empty-state">No hi ha paraules amb aquests filtres. Prova una altra cerca o crea una entrada.</td></tr>`;
  $("#table-summary").textContent = `Mostrant ${entries.length} de ${state.entries.length} paraules`;
  $("#filter-dot").hidden = !$("#tag-filter").value;
}

async function load() {
  $("#new-entry").disabled = true;
  try {
    const data = await api("/api/glossary");
    Object.assign(state, data, { loaded: true });
    setupFilters();
    renderGlossary();
    $("#new-entry").disabled = false;
  } catch (error) {
    showError(error);
    $("#entries").innerHTML = '<tr><td colspan="5" class="empty-state">No s’ha pogut carregar el glossari. <button class="text-button" id="retry-load">Torna-ho a provar</button></td></tr>';
    $("#retry-load").addEventListener("click", () => location.reload());
    $("#table-summary").textContent = "Error de càrrega";
  }
}

function checkboxes(target, items, selected, name) {
  $(target).innerHTML = items.map((item) => `<label><input type="checkbox" name="${name}" value="${escapeHtml(item.id)}" ${selected.includes(item.id) ? "checked" : ""}>${escapeHtml(item.label)}</label>`).join("");
}

function addMeaning(meaning = { text: "", description: "" }) {
  const block = document.createElement("div");
  block.className = "repeat-block meaning-block";
  block.innerHTML = `<div class="repeat-heading">SIGNIFICAT<button type="button" class="icon-button remove-block" aria-label="Elimina aquest significat">×</button></div><div class="form-grid"><label>Traducció *<input data-field="text" required value="${escapeHtml(meaning.text)}"></label><label>Descripció<input data-field="description" value="${escapeHtml(meaning.description)}"></label></div>`;
  $("#meaning-fields").append(block);
}

function addExample(example = { japanese: "", hiragana: "", romaji: "", translation: "" }) {
  const block = document.createElement("div");
  block.className = "repeat-block example-block";
  block.innerHTML = `<div class="repeat-heading">EXEMPLE<button type="button" class="icon-button remove-block" aria-label="Elimina aquest exemple">×</button></div><div class="form-grid">${[["japanese", "Japonès *"], ["translation", "Traducció *"], ["hiragana", "Hiragana"], ["romaji", "Romaji"]].map(([key, label]) => `<label>${label}<input data-field="${key}" ${["japanese", "translation"].includes(key) ? "required" : ""} ${["japanese", "hiragana"].includes(key) ? 'lang="ja"' : ""} value="${escapeHtml(example[key])}"></label>`).join("")}</div>`;
  $("#example-fields").append(block);
}

function openEntry(id) {
  if (!state.loaded) return;
  const entry = id ? state.entries.find((entry) => entry.id === id) : null;
  state.editing = entry?.id || null;
  $("#entry-form").reset();
  $("#dialog-title").textContent = entry ? "Edita l’entrada" : "Nova entrada";
  $("#delete-entry").hidden = !entry;
  $("#form-error").hidden = true;
  for (const key of ["romaji", "hiragana", "katakana", "notes"]) {
    $("#entry-form").elements.namedItem(key).value = entry?.[key] || "";
  }
  $("#entry-form").elements.namedItem("kanji").value = entry?.kanji.join(", ") || "";
  checkboxes("#category-fields", state.categories, entry?.categories || [$("#category-filter").value].filter(Boolean), "categories");
  checkboxes("#pos-fields", state.partsOfSpeech, entry?.partOfSpeech || [], "partOfSpeech");
  checkboxes("#tag-fields", state.tags, entry?.tags || [], "tags");
  $("#meaning-fields").replaceChildren();
  (entry?.meanings || [{ text: "", description: "" }]).forEach(addMeaning);
  $("#example-fields").replaceChildren();
  (entry?.examples || []).forEach(addExample);
  $("#entry-dialog").showModal();
}

function collectBlocks(selector) {
  return [...document.querySelectorAll(selector)].map((block) => Object.fromEntries(
    [...block.querySelectorAll("[data-field]")].map((input) => [input.dataset.field, input.value.trim()]),
  ));
}

function formEntry() {
  const data = new FormData($("#entry-form"));
  return {
    romaji: data.get("romaji").trim(),
    hiragana: data.get("hiragana").trim(),
    katakana: data.get("katakana").trim(),
    kanji: data.get("kanji").split(/[,、]/).map((text) => text.trim()).filter(Boolean),
    meanings: collectBlocks(".meaning-block"),
    examples: collectBlocks(".example-block"),
    categories: data.getAll("categories"),
    partOfSpeech: data.getAll("partOfSpeech"),
    tags: data.getAll("tags"),
    notes: data.get("notes").trim(),
  };
}

function setBusy(busy) {
  state.busy = busy;
  $("#entry-form").querySelectorAll("button").forEach((button) => { button.disabled = busy; });
  $("#confirm-dialog").querySelectorAll("button").forEach((button) => { button.disabled = busy; });
  $("#save-entry").textContent = busy ? "Desant…" : "Desa l’entrada";
}

async function saveEntry(event) {
  event.preventDefault();
  if (state.busy) return;
  const entry = formEntry();
  $("#form-error").hidden = true;
  if (!entry.categories.length || !entry.partOfSpeech.length || !entry.meanings.length) {
    $("#form-error").textContent = "Cal almenys un significat, una categoria i un tipus de paraula.";
    $("#form-error").hidden = false;
    $("#form-error").scrollIntoView({ block: "nearest" });
    return;
  }
  setBusy(true);
  try {
    const editing = state.editing;
    const saved = await api(editing ? `/api/entries/${encodeURIComponent(editing)}` : "/api/entries", editing ? "PUT" : "POST", entry);
    if (editing) state.entries = state.entries.map((item) => item.id === editing ? saved : item);
    else state.entries.push(saved);
    renderGlossary();
    $("#entry-dialog").close();
    toast(editing ? "Entrada actualitzada al fitxer JSON." : "Nova entrada desada al glossari.");
  } catch (error) {
    $("#form-error").textContent = error.message;
    $("#form-error").hidden = false;
    $("#form-error").scrollIntoView({ block: "nearest" });
  } finally {
    setBusy(false);
  }
}

async function deleteEntry() {
  if (!state.editing || state.busy) return;
  setBusy(true);
  try {
    await api(`/api/entries/${encodeURIComponent(state.editing)}`, "DELETE", {});
    state.entries = state.entries.filter((entry) => entry.id !== state.editing);
    renderGlossary();
    $("#confirm-dialog").close();
    $("#entry-dialog").close();
    toast("Entrada eliminada del fitxer JSON.");
  } catch (error) {
    $("#confirm-dialog").close();
    $("#form-error").textContent = error.message;
    $("#form-error").hidden = false;
    $("#form-error").scrollIntoView({ block: "nearest" });
  } finally {
    setBusy(false);
  }
}

document.querySelector("[data-view=glossary]").addEventListener("click", () => {
  for (const id of ["search", "category-filter", "pos-filter", "tag-filter"]) $(`#${id}`).value = "";
  renderGlossary();
});
$("#search").addEventListener("input", renderGlossary);
for (const id of ["category-filter", "pos-filter", "tag-filter", "sort"]) {
  $(`#${id}`).addEventListener("change", renderGlossary);
}
$("#collections").addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  $("#category-filter").value = button.dataset.category;
  renderGlossary();
});
$("#more-filters").addEventListener("click", () => {
  $("#extra-filters").hidden = !$("#extra-filters").hidden;
  $("#more-filters").setAttribute("aria-expanded", String(!$("#extra-filters").hidden));
});
$("#reset-filters").addEventListener("click", () => {
  for (const id of ["search", "category-filter", "pos-filter", "tag-filter"]) $(`#${id}`).value = "";
  $("#sort").value = "romaji";
  renderGlossary();
});
$("#new-entry").addEventListener("click", () => openEntry());
$("#entries").addEventListener("click", (event) => {
  const button = event.target.closest("[data-edit]");
  if (button) openEntry(button.dataset.edit);
});
document.querySelectorAll(".close-dialog").forEach((button) => button.addEventListener("click", () => $("#entry-dialog").close()));
$("#entry-dialog").addEventListener("cancel", (event) => { if (state.busy) event.preventDefault(); });
$("#confirm-dialog").addEventListener("cancel", (event) => { if (state.busy) event.preventDefault(); });
$("#entry-form").addEventListener("submit", saveEntry);
$("#entry-form").addEventListener("click", (event) => {
  if (event.target.closest(".remove-block")) event.target.closest(".repeat-block").remove();
});
$("#add-meaning").addEventListener("click", () => addMeaning());
$("#add-example").addEventListener("click", () => addExample());
$("#delete-entry").addEventListener("click", () => $("#confirm-dialog").showModal());
$("#cancel-delete").addEventListener("click", () => $("#confirm-dialog").close());
$("#confirm-delete").addEventListener("click", deleteEntry);
document.addEventListener("keydown", (event) => {
  if (event.target.closest("input,textarea,select,button") || document.querySelector("dialog[open]") || event.ctrlKey || event.altKey || event.metaKey) return;
  if (event.key === "/") {
    event.preventDefault();
    $("#search").focus();
  }
});
load();
