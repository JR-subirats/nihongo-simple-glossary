<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { createSession, inCategory, meaningText, rateSession } from "../glossary.mjs";
import EntryDetails from "./EntryDetails.vue";
import JapaneseWord from "./JapaneseWord.vue";

const props = defineProps({
  glossary: { type: Object, required: true },
  active: { type: Boolean, required: true },
  script: { type: String, required: true },
});
const emit = defineEmits(["practiced"]);
const category = ref("");
const direction = ref("ja-ca");
const session = ref(null);
const card = computed(() => session.value?.entries[session.value.index]);
const forward = computed(() => session.value?.direction === "ja-ca");
const revealButton = ref(null);
const forgotButton = ref(null);
const rememberedButton = ref(null);

function start(entries) {
  session.value = createSession(entries ?? props.glossary.entries.filter((entry) =>
    inCategory(entry, category.value, props.glossary.categories)), direction.value);
}

function rate(remembered) {
  emit("practiced", rateSession(session.value, remembered));
}

function keydown(event) {
  if (!props.active || event.target.closest("input,textarea,select,button") || document.querySelector("dialog[open]")
    || event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;
  const button = event.code === "Space" ? revealButton.value
    : event.key === "1" ? forgotButton.value : event.key === "2" ? rememberedButton.value : null;
  if (button) { event.preventDefault(); button.click(); }
}

onMounted(() => document.addEventListener("keydown", keydown));
onUnmounted(() => document.removeEventListener("keydown", keydown));
</script>

<template>
  <div class="page-heading">
    <div><div class="eyebrow">UN PETIT PAS CADA DIA</div><h1>Temps de practicar<span>.</span></h1>
      <p>Gira la targeta, comprova la resposta i segueix aprenent.</p></div>
  </div>
  <div class="study-options">
    <label>Col·lecció<select id="study-category" v-model="category" :disabled="!!session">
      <option value="">Tot el glossari</option>
      <option v-for="item in glossary.categories" :key="item.id" :value="item.id">{{ item.label }}</option>
    </select></label>
    <label>Direcció<select id="study-direction" v-model="direction" :disabled="!!session">
      <option value="ja-ca">Japonès → Català</option><option value="ca-ja">Català → Japonès</option>
    </select></label>
    <button id="start-study" class="button primary" :disabled="!!session" @click="start()">Comença una sessió →</button>
  </div>
  <div id="study-content" class="study-content">
    <div v-if="!session" class="study-intro">
      <span lang="ja">学</span><h2>Fes espai per a una paraula més.</h2>
      <p>Tria una col·lecció i comença una sessió.<br>Les targetes es barregen a cada repàs. Tu marques el teu ritme.</p>
    </div>
    <div v-else-if="!session.entries.length" class="study-intro">
      <span>∅</span><h2>Aquesta col·lecció encara no té paraules.</h2>
      <p>Selecciona una altra col·lecció per començar a estudiar.</p>
      <button id="end-study" class="button secondary" @click="session = null">Torna a triar</button>
    </div>
    <div v-else-if="!card" class="study-intro" aria-live="polite">
      <span>✧</span><h2>Sessió completada. Ben fet!</h2>
      <div class="result-number">{{ session.correct }}<span class="subtle">/{{ session.entries.length }}</span></div>
      <p>Paraules recordades en aquest repàs.<br>
        {{ session.missed.length ? `${session.missed.length} paraules per seguir practicant.` : "Has recordat totes les paraules!" }}</p>
      <div class="session-controls">
        <button v-if="session.missed.length" id="review-missed" class="button primary" @click="start(session.missed)">Repassa els errors</button>
        <button id="repeat-study" class="button secondary" @click="start(session.entries)">Repeteix la sessió</button>
        <button id="end-study" class="button secondary" @click="session = null">Acaba</button>
      </div>
    </div>
    <template v-else>
      <div class="session-meta">
        <span>Targeta {{ session.index + 1 }} de {{ session.entries.length }}</span>
        <span>{{ session.correct }} recordades · {{ session.missed.length }} per repassar</span>
      </div>
      <div class="progress-track"><div class="progress-fill" :style="{ width: `${session.index / session.entries.length * 100}%` }"></div></div>
      <div :key="card.id" class="flashcard" aria-live="polite">
        <div class="eyebrow">{{ forward ? "QUÈ VOL DIR AQUESTA PARAULA?" : "COM ES DIU EN JAPONÈS?" }}</div>
        <div class="prompt">
          <JapaneseWord v-if="forward" :entry="card" :script="script" />
          <span v-else lang="ca">{{ meaningText(card) }}</span>
        </div>
        <template v-if="session.revealed">
          <h2 class="revealed-word">
            <span v-if="forward" lang="ca">{{ meaningText(card) }}</span>
            <JapaneseWord v-else :entry="card" :script="script" />
          </h2>
          <EntryDetails :entry="card" />
        </template>
      </div>
      <div class="study-actions">
        <template v-if="session.revealed">
          <button id="forgot" ref="forgotButton" class="button secondary" @click="rate(false)">Encara no · 1</button>
          <button id="remembered" ref="rememberedButton" class="button primary" @click="rate(true)">La sabia! · 2</button>
        </template>
        <button v-else id="reveal" ref="revealButton" class="button primary" @click="session.revealed = true">Mostra la resposta · Espai</button>
      </div>
      <button id="end-study" class="text-button session-exit" @click="session = null">Acaba la sessió</button>
    </template>
  </div>
</template>
