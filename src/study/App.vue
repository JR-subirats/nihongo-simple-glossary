<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";
import { filterEntries, inCategory, japaneseScripts, meaningText } from "./glossary.mjs";
import EntryDetails from "./components/EntryDetails.vue";
import StudySession from "./components/StudySession.vue";
import JapaneseWord from "./components/JapaneseWord.vue";

const props = defineProps({ glossary: { type: Object, required: true } });
const view = ref("study");
const script = ref("hiragana");
const filters = reactive({ query: "", category: "", pos: "", tag: "", sort: "romaji" });
const expanded = ref(false);
const error = ref("");
const practiced = ref(new Set());
const selected = ref(null);
const detailDialog = ref(null);
const searchInput = ref(null);
const entries = computed(() => filterEntries(props.glossary, filters));
const practicedCount = computed(() => props.glossary.entries.filter((entry) => practiced.value.has(entry.id)).length);
const label = (id, items) => items.find((item) => item.id === id)?.label || id;

function openEntry(entry) {
  selected.value = entry;
  detailDialog.value.showModal();
}

function resetFilters() {
  Object.assign(filters, { query: "", category: "", pos: "", tag: "", sort: "romaji" });
}

function practice(id) {
  practiced.value.add(id);
  try {
    localStorage.setItem("kotoba-practiced", JSON.stringify([...practiced.value]));
  } catch (cause) {
    error.value = `El repàs continua, però no s'ha pogut desar el recompte de pràctica: ${cause.message}`;
  }
}

function keydown(event) {
  if (event.key !== "/" || view.value !== "glossary" || event.target.closest("input,textarea,select,button")
    || detailDialog.value.open || event.ctrlKey || event.altKey || event.metaKey) return;
  event.preventDefault();
  searchInput.value.focus();
}

onMounted(() => {
  try {
    const saved = JSON.parse(localStorage.getItem("kotoba-practiced") || "[]");
    if (!Array.isArray(saved) || saved.some((id) => typeof id !== "string")) throw new Error("Format del recompte no vàlid.");
    practiced.value = new Set(saved);
  } catch (cause) {
    error.value = `No s'ha pogut recuperar el recompte de pràctica: ${cause.message}`;
  }
  document.addEventListener("keydown", keydown);
});
onUnmounted(() => document.removeEventListener("keydown", keydown));
</script>

<template>
  <aside class="sidebar">
    <a class="brand" href="./" aria-label="Kotoba, inici"><span class="brand-mark" lang="ja">言</span><span>kotoba<span class="brand-dot">.</span><small>EL TEU JAPONÈS, PARAULA A PARAULA</small></span></a>
    <div class="workspace-label">ESPAI D’ESTUDI</div>
    <nav aria-label="Navegació principal">
      <button class="nav-item" :class="{ active: view === 'study' }" :aria-current="view === 'study' ? 'page' : undefined" data-view="study" @click="view = 'study'"><span class="nav-icon">▱</span> Mode d’estudi <span class="small-tag">REPÀS</span></button>
      <button class="nav-item" :class="{ active: view === 'glossary' }" :aria-current="view === 'glossary' ? 'page' : undefined" data-view="glossary" @click="view = 'glossary'"><span class="nav-icon">▤</span> Consulta el glossari <span class="count">{{ glossary.entries.length }}</span></button>
    </nav>
    <div class="sidebar-heading">COL·LECCIONS</div>
    <div id="collections">
      <button v-for="category in glossary.categories" :key="category.id" class="collection" :class="{ child: category.parentId, active: filters.category === category.id }" @click="filters.category = category.id; view = 'glossary'">
        <span class="collection-dot"></span>{{ category.label }}
        <span class="collection-count">{{ glossary.entries.filter(entry => inCategory(entry, category.id, glossary.categories)).length }}</span>
      </button>
    </div>
    <div class="sidebar-bottom">
      <div class="daily-note"><span lang="ja">一日一歩</span><strong>Un petit pas cada dia.</strong><p>Cada paraula és una nova manera de veure el món.</p></div>
      <div class="local-status"><span class="status-dot"></span> Glossari incorporat <span>LECTURA</span></div>
    </div>
  </aside>
  <div class="app-shell">
    <header class="topbar"><span><span class="breadcrumb">Espai d’estudi</span><span class="slash">/</span>{{ view === "study" ? "Mode d’estudi" : "Consulta el glossari" }}</span><span class="topbar-note">Aplicació estàtica · Només lectura</span></header>
    <main>
      <div v-if="error" id="error" class="error-banner" role="alert">{{ error }}</div>
      <div class="script-preference">
        <label for="japanese-script">Forma japonesa
          <select id="japanese-script" v-model="script" aria-describedby="script-help">
            <option v-for="item in japaneseScripts" :key="item.id" :value="item.id">{{ item.label }}</option>
          </select>
        </label>
        <p id="script-help">S’aplica al glossari i a les targetes. Si falta aquesta forma, s’indicarà l’alternativa.</p>
      </div>
      <section v-show="view === 'study'" id="study-view">
        <StudySession :glossary="glossary" :active="view === 'study'" :script="script" @practiced="practice" />
      </section>
      <section v-show="view === 'glossary'" id="glossary-view">
        <div class="page-heading"><div><div class="eyebrow">LA TEVA COL·LECCIÓ DE PARAULES</div><h1>Explora el glossari<span>.</span></h1><p>Consulta les paraules i els exemples. Aquest glossari és de només lectura.</p></div></div>
        <div class="stats-grid">
          <div class="stat"><span class="stat-icon mint">文</span><div><span class="stat-label">Paraules al glossari</span><strong id="total-count">{{ glossary.entries.length }}</strong></div><span class="stat-caption">Cada paraula compta</span></div>
          <div class="stat"><span class="stat-icon lavender">▦</span><div><span class="stat-label">Categories</span><strong>{{ glossary.categories.length }}</strong></div><span class="stat-caption">Tot al seu lloc</span></div>
          <div class="stat"><span class="stat-icon peach">✓</span><div><span class="stat-label">Paraules practicades</span><strong id="practiced-count">{{ practicedCount }}</strong></div><span class="stat-caption">Al teu ritme</span></div>
        </div>
        <div class="list-heading"><h2>Les teves paraules <span class="count">{{ entries.length }}</span></h2><div class="view-caption">Japonès <span>→</span> Català</div></div>
        <div class="toolbar">
          <label class="search-wrap"><span aria-hidden="true">⌕</span><input id="search" ref="searchInput" v-model="filters.query" type="search" placeholder="Cerca en japonès, romaji o català..." aria-label="Cerca al glossari"><kbd>/</kbd></label>
          <label class="sr-only" for="category-filter">Categoria</label>
          <select id="category-filter" v-model="filters.category"><option value="">Totes les categories</option><option v-for="category in glossary.categories" :key="category.id" :value="category.id">{{ category.label }}</option></select>
          <label class="sr-only" for="pos-filter">Tipus de paraula</label>
          <select id="pos-filter" v-model="filters.pos"><option value="">Tots els tipus</option><option v-for="pos in glossary.partsOfSpeech" :key="pos.id" :value="pos.id">{{ pos.label }}</option></select>
          <button id="more-filters" class="button secondary" :aria-expanded="expanded" aria-controls="extra-filters" @click="expanded = !expanded"><span>☷</span> Filtres <span v-if="filters.tag">●</span></button>
        </div>
        <div v-show="expanded" id="extra-filters" class="extra-filters">
          <label>Etiqueta<select id="tag-filter" v-model="filters.tag"><option value="">Totes les etiquetes</option><option v-for="tag in glossary.tags" :key="tag.id" :value="tag.id">{{ tag.label }}</option></select></label>
          <label>Ordena per<select id="sort" v-model="filters.sort"><option value="romaji">Romaji (A–Z)</option><option value="meaning">Significat (A–Z)</option></select></label>
          <button id="reset-filters" class="text-button" @click="resetFilters">Neteja els filtres</button>
        </div>
        <div class="table-wrap">
          <table><thead><tr><th>PARAULA</th><th>SIGNIFICAT</th><th>CATEGORIA</th><th>TIPUS</th><th><span class="sr-only">Detalls</span></th></tr></thead>
            <tbody id="entries">
              <tr v-for="entry in entries" :key="entry.id">
                <td><button class="word-button" :aria-label="`Consulta ${entry.romaji}`" @click="openEntry(entry)"><JapaneseWord class="word-tile" :entry="entry" :script="script" /><span class="word-romaji">{{ entry.romaji }}</span></button></td>
                <td><span class="meaning-main">{{ meaningText(entry) }}</span><span class="meaning-description" :title="entry.meanings[0].description">{{ entry.meanings[0].description }}</span></td>
                <td><span v-for="id in entry.categories" :key="id" class="badge" :class="['animals', 'pets', 'food'].includes(id) ? id : ''">{{ label(id, glossary.categories) }}</span></td>
                <td><span class="pos-label">{{ entry.partOfSpeech.map(id => label(id, glossary.partsOfSpeech)).join(", ") }}</span></td>
                <td><button class="icon-button" :aria-label="`Mostra els detalls de ${entry.romaji}`" @click="openEntry(entry)">↗</button></td>
              </tr>
              <tr v-if="!entries.length"><td colspan="5" class="empty-state">No hi ha paraules amb aquests filtres. Prova una altra cerca.</td></tr>
            </tbody>
          </table>
          <div class="table-footer"><span>Mostrant {{ entries.length }} de {{ glossary.entries.length }} paraules</span><span>Glossari de només lectura</span></div>
        </div>
        <div class="study-banner"><span class="banner-icon">✧</span><div><strong>De llegir una paraula a recordar-la.</strong><p>Posa a prova el que saps amb una sessió de targetes d’estudi.</p></div><button class="button secondary" @click="view = 'study'">Comença a estudiar →</button></div>
      </section>
      <footer class="page-footer"><span>kotoba. <span class="subtle">Un espai per al teu japonès.</span></span><span lang="ja">継続は力なり <span class="subtle">· La constància és força.</span></span></footer>
    </main>
  </div>
  <dialog id="detail-dialog" ref="detailDialog" aria-labelledby="detail-title">
    <template v-if="selected">
      <div class="dialog-heading"><h2 id="detail-title"><JapaneseWord :entry="selected" :script="script" /></h2><button class="icon-button" aria-label="Tanca" @click="detailDialog.close()">×</button></div>
      <div class="readonly-details">
        <p><span v-for="id in selected.categories" :key="id" class="badge">{{ label(id, glossary.categories) }}</span></p>
        <p class="pos-label">{{ selected.partOfSpeech.map(id => label(id, glossary.partsOfSpeech)).join(", ") }}</p>
        <p v-if="selected.tags.length" class="pos-label">{{ selected.tags.map(id => label(id, glossary.tags)).join(", ") }}</p>
        <EntryDetails :entry="selected" />
      </div>
      <div class="dialog-footer"><span class="subtle">Només lectura</span><span class="spacer"></span><button class="button secondary" @click="detailDialog.close()">Tanca</button></div>
    </template>
  </dialog>
</template>

<style>
.revealed-word { font-size: 23px; margin-top: 25px; }
.readonly-details { padding: 8px 27px 25px; }
.readonly-details .answer { font-size: 13px; line-height: 1.8; }
.entry-notes { white-space: pre-wrap; }
.script-preference { display: flex; align-items: center; flex-wrap: wrap; gap: 12px 20px; margin-bottom: 28px; }
.script-preference label { display: flex; align-items: center; gap: 12px; font-size: 12px; color: #687680; }
.script-preference p { margin: 0; font-size: 11px; color: #87909c; max-width: 100%; line-height: 1.7; }
.word-tile { min-width: 60px; padding: 6px; border: 1px solid #eef0f3; border-radius: 7px; background: #f6f7f8; }
.word-tile .japanese-text { font-family: "Yu Gothic", "Meiryo", serif; font-size: 20px; }
.word-tile .script-alternative { max-width: 160px; }
</style>
